"""
test_scoring_engine.py
Unit tests and determinism test harness for UniRank Scoring Engine.
"""

import json
import os
import unittest
from typing import Dict, Any

from pydantic import ValidationError

from scoring_schemas import (
    SubPromptValidationError,
    CodeQualityResult,
    DemoReviewResult,
    ReadmeQualityResult,
    FinalScoreOutput,
)
from llm_client import MockLLMClient, GeminiClient
from scoring_cache import ScoringCache
from score_github_user import UniRankScoringEngine, get_mock_fixture_repos


class TestScoringEngineUnit(unittest.TestCase):
    """Fast, mocked unit tests for UniRank scoring components."""

    def setUp(self):
        self.mock_llm = MockLLMClient()
        self.cache = ScoringCache(enabled=False)
        self.engine = UniRankScoringEngine(llm_client=self.mock_llm, cache=self.cache)
        self.fixture_repo = get_mock_fixture_repos("test-user")[0]

    def test_mock_pipeline_execution(self):
        """Test full mock scoring pipeline returns valid FinalScoreOutput."""
        res = self.engine.score_repo(self.fixture_repo, demo_evidence="Demo video link provided")
        self.assertIsInstance(res, FinalScoreOutput)
        self.assertGreaterEqual(res.implementation_score, 0.0)
        self.assertLessEqual(res.implementation_score, 10.0)
        self.assertGreaterEqual(res.working_score, 0.0)
        self.assertLessEqual(res.working_score, 10.0)
        self.assertGreaterEqual(res.impact_score, 0)
        self.assertLessEqual(res.impact_score, 100)

    def test_implementation_score_out_of_bounds_raises_validation_error(self):
        """Feeding implementation_score: 42 (old 0-100 scale) into FinalScoreOutput must raise ValidationError."""
        with self.assertRaises(ValidationError) as ctx:
            FinalScoreOutput(
                implementation_score=42.0,  # Invalid: > 10.0
                impact_score=50,
                working_score=8.0,
                evidence={},
                computed_at="2026-08-18T15:00:00Z",
                scoring_version="v1.1",
            )
        self.assertIn("implementation_score", str(ctx.exception))

    def test_impact_score_within_bounds_is_accepted(self):
        """Assert that impact_score: 85 is accepted as valid input to FinalScoreOutput (within [0, 100])."""
        output = FinalScoreOutput(
            implementation_score=7.5,
            impact_score=85,  # Valid: within 0-100
            working_score=8.0,
            evidence={},
            computed_at="2026-08-18T15:00:00Z",
            scoring_version="v1.1",
        )
        self.assertEqual(output.impact_score, 85)

    def test_subprompt_validation_error_on_malformed_json(self):
        """Malformed sub-prompt JSON raises SubPromptValidationError with prompt_id."""
        malformed_llm = MockLLMClient(force_malformed=True)
        faulty_engine = UniRankScoringEngine(llm_client=malformed_llm, cache=self.cache)

        with self.assertRaises(SubPromptValidationError) as ctx:
            faulty_engine.score_repo(self.fixture_repo)

        self.assertEqual(ctx.exception.prompt_id, "code_quality_subprompt")
        self.assertIn("code_quality_subprompt", str(ctx.exception))

    def test_zero_repo_and_fork_only(self):
        """Test user with 0 repos or fork-only repos returns 0 user-level scores."""
        result = self.engine.score_user("zero-repo-user", repos_data=[])
        self.assertEqual(result["overall_implementation_score"], 0.0)
        self.assertEqual(result["overall_working_score"], 0.0)
        self.assertEqual(result["overall_impact_score"], 0)
        self.assertEqual(result["overall_composite_score"], 0.0)
        self.assertEqual(result["scored_repos"], [])

    def test_missing_readme_and_demo_evidence(self):
        """Test scoring a repo with missing README and missing demo evidence."""
        no_docs_repo = {
            "name": "bare-repo",
            "owner": "test-user",
            "stars": 0,
            "forks": 0,
            "open_issues": 0,
            "pushed_at": "2026-08-15T10:00:00Z",
            "contributors_count": 1,
            "structure": {"has_gitignore": False, "has_license": False, "has_readme": False, "has_build_config": False},
            "ci_status": "none",
            "readme_text": "",
            "source_files": [],
        }
        res = self.engine.score_repo(no_docs_repo, demo_evidence=None)
        self.assertIsInstance(res, FinalScoreOutput)

    def test_partial_failure_behavior(self):
        """When some repos error out, aggregate user-level score from successful repos only."""
        good_repo = self.fixture_repo

        # Create broken engine that raises exception on specific repo
        class ErrorOnBrokenRepoLLM(MockLLMClient):
            def generate(self, prompt_id, system_prompt, user_payload, schema_cls, temperature=0.0):
                if "broken-repo" in user_payload:
                    raise SubPromptValidationError("code_quality_subprompt", "Simulated failure on broken-repo")
                return super().generate(prompt_id, system_prompt, user_payload, schema_cls, temperature)

        partial_engine = UniRankScoringEngine(llm_client=ErrorOnBrokenRepoLLM(), cache=self.cache)

        bad_repo = {**self.fixture_repo, "name": "broken-repo"}
        repos = [good_repo, bad_repo]

        result = partial_engine.score_user("partial-user", repos)

        self.assertEqual(len(result["scored_repos"]), 1)
        self.assertEqual(len(result["failed_repos"]), 1)
        self.assertEqual(result["failed_repos"][0]["repo_name"], "broken-repo")
        self.assertGreater(result["overall_implementation_score"], 0.0)


class TestScoringEngineDeterminism(unittest.TestCase):
    """
    Real API determinism tests.
    Must construct GeminiClient directly (never MockLLMClient) and raise explicit
    error if API key is not configured to prevent silent mock fallbacks.
    """

    def setUp(self):
        api_key = os.getenv("GOOGLE_API_KEY") or os.getenv("GEMINI_API_KEY")
        if not api_key:
            raise ValueError(
                "GOOGLE_API_KEY or GEMINI_API_KEY environment variable MUST be set "
                "to run TestScoringEngineDeterminism against real Gemini API. "
                "Determinism testing on mocks is invalid."
            )
        self.gemini_client = GeminiClient(api_key=api_key)
        self.cache = ScoringCache(enabled=False) # Force non-cached
        self.engine = UniRankScoringEngine(llm_client=self.gemini_client, cache=self.cache)
        self.fixture_repo = get_mock_fixture_repos("determinism-user")[0]

    def test_real_gemini_determinism(self):
        """Runs N real Gemini calls against frozen evidence fixture and checks max_score_delta <= 3.0."""
        # Threshold 3.0 is a starting guess; derive empirically from 20+ runs on real fixtures.
        runs = 3
        threshold = 3.0

        impl_scores = []
        work_scores = []
        impact_scores = []

        for _ in range(runs):
            output = self.engine.score_repo(self.fixture_repo)
            impl_scores.append(output.implementation_score)
            work_scores.append(output.working_score)
            impact_scores.append(output.impact_score)

        delta_impl = max(impl_scores) - min(impl_scores)
        delta_work = max(work_scores) - min(work_scores)
        delta_impact = max(impact_scores) - min(impact_scores)

        max_delta = max(delta_impl, delta_work, delta_impact)
        self.assertLessEqual(
            max_delta,
            threshold,
            f"Real Gemini score delta ({max_delta:.1f}) exceeded threshold ({threshold})"
        )


if __name__ == "__main__":
    unittest.main()
