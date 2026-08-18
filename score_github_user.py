"""
score_github_user.py
UniRank Scoring Engine CLI & Pipeline Orchestrator.
"""

import argparse
import datetime
import json
import logging
import os
import sys
import time
from typing import Dict, Any, List, Optional, Tuple, Type

import requests
from pydantic import ValidationError

from scoring_schemas import (
    SubPromptValidationError,
    CodeQualityResult,
    DemoReviewResult,
    ReadmeQualityResult,
    FinalScoreOutput,
)
from llm_client import LLMClient, GeminiClient, MockLLMClient
from scoring_cache import ScoringCache

logging.basicConfig(level=logging.INFO, format="[%(asctime)s] %(levelname)s: %(message)s")
logger = logging.getLogger("UniRank")

PRIVACY_BANNER = (
    "\n=========================================================================\n"
    "PRIVACY NOTICE: Source code excerpts and README documentation from public\n"
    "repositories will be transmitted to Google's Gemini API for LLM scoring.\n"
    "To suppress this banner, pass --accept-privacy-terms or set UNIRANK_PRIVACY_ACK=1.\n"
    "=========================================================================\n"
)


class GitHubCollector:
    """GitHub REST API collector with rate limit tracking and automatic backoff."""

    def __init__(self, token: Optional[str] = None):
        self.token = token or os.getenv("GITHUB_TOKEN")
        self.headers = {
            "Accept": "application/vnd.github.v3+json",
            "User-Agent": "UniRank-Scoring-Engine",
        }
        if self.token:
            self.headers["Authorization"] = f"token {self.token}"

        self.last_rate_limit_remaining: Optional[int] = None
        self.last_rate_limit_reset: Optional[float] = None

    def _check_rate_limit(self, response: requests.Response):
        """Monitor X-RateLimit-Remaining header and pause if remaining request budget is low."""
        rem_header = response.headers.get("X-RateLimit-Remaining")
        reset_header = response.headers.get("X-RateLimit-Reset")

        if rem_header is not None:
            self.last_rate_limit_remaining = int(rem_header)
        if reset_header is not None:
            self.last_rate_limit_reset = float(reset_header)

        if self.last_rate_limit_remaining is not None and self.last_rate_limit_remaining < 5:
            now = time.time()
            reset_time = self.last_rate_limit_reset or (now + 60)
            sleep_duration = max(1.0, reset_time - now + 1.0)
            logger.warning(
                f"GitHub API rate limit remaining: {self.last_rate_limit_remaining}. "
                f"Sleeping for {sleep_duration:.1f} seconds until reset..."
            )
            time.sleep(sleep_duration)

    def _get(self, url: str, params: Optional[Dict[str, Any]] = None) -> Optional[requests.Response]:
        try:
            resp = requests.get(url, headers=self.headers, params=params, timeout=15)
            self._check_rate_limit(resp)
            if resp.status_code == 200:
                return resp
            logger.warning(f"GitHub API HTTP {resp.status_code} for {url}")
            return None
        except Exception as err:
            logger.error(f"GitHub API request failed for {url}: {err}")
            return None

    def collect_repo_data(self, owner: str, repo_name: str) -> Optional[Dict[str, Any]]:
        repo_url = f"https://api.github.com/repos/{owner}/{repo_name}"
        repo_resp = self._get(repo_url)
        if not repo_resp:
            return None
        repo_data = repo_resp.json()

        # 1. Contributors (exclude bots)
        contrib_resp = self._get(f"{repo_url}/contributors")
        contributors = []
        if contrib_resp:
            c_json = contrib_resp.json()
            if isinstance(c_json, list):
                for c in c_json:
                    login = c.get("login", "")
                    c_type = c.get("type", "")
                    if c_type != "Bot" and not login.endswith("[bot]"):
                        contributors.append(login)

        # 2. Root structure files
        contents_resp = self._get(f"{repo_url}/contents")
        root_files = []
        if contents_resp:
            cnt_json = contents_resp.json()
            if isinstance(cnt_json, list):
                root_files = [f.get("name", "").lower() for f in cnt_json]

        has_gitignore = ".gitignore" in root_files
        has_license = "license" in root_files or "license.md" in root_files or "license.txt" in root_files
        has_readme = any(f.startswith("readme") for f in root_files)

        build_configs = ["package.json", "requirements.txt", "go.mod", "pom.xml", "cargo.toml", "pyproject.toml", "cmakelists.txt"]
        has_build_config = any(cfg in root_files for cfg in build_configs)

        # 3. Source files (sorted alphabetically by path, max 10 files, max 500 lines each)
        source_files = self._fetch_source_files(owner, repo_name)

        # 4. CI status via Actions API
        ci_resp = self._get(f"{repo_url}/actions/runs", params={"per_page": 5})
        ci_status = "unknown"
        if ci_resp:
            ci_json = ci_resp.json()
            runs = ci_json.get("workflow_runs", [])
            if runs:
                ci_status = runs[0].get("conclusion") or runs[0].get("status") or "unknown"

        # 5. Issues activity ratio
        issues_closed = repo_data.get("open_issues_count", 0) # Base metadata
        issues_ratio = 1.0

        # 6. README text
        readme_text = ""
        readme_resp = self._get(f"{repo_url}/readme")
        if readme_resp:
            r_json = readme_resp.json()
            download_url = r_json.get("download_url")
            if download_url:
                raw_readme = requests.get(download_url, timeout=10)
                if raw_readme.status_code == 200:
                    readme_text = raw_readme.text[:10000]

        return {
            "name": repo_name,
            "owner": owner,
            "stars": repo_data.get("stargazers_count", 0),
            "forks": repo_data.get("forks_count", 0),
            "open_issues": repo_data.get("open_issues_count", 0),
            "pushed_at": repo_data.get("pushed_at", ""),
            "created_at": repo_data.get("created_at", ""),
            "default_branch": repo_data.get("default_branch", "main"),
            "contributors_count": len(contributors),
            "structure": {
                "has_gitignore": has_gitignore,
                "has_license": has_license,
                "has_readme": has_readme,
                "has_build_config": has_build_config,
            },
            "ci_status": ci_status,
            "readme_text": readme_text,
            "source_files": source_files,
        }

    def _fetch_source_files(self, owner: str, repo: str) -> List[Dict[str, str]]:
        """Fetches up to 10 source files sorted alphabetically by path, max 500 lines per file."""
        tree_resp = self._get(f"https://api.github.com/repos/{owner}/{repo}/git/trees/HEAD", params={"recursive": 1})
        if not tree_resp:
            return []

        tree_data = tree_resp.json().get("tree", [])
        code_exts = {".py", ".js", ".ts", ".jsx", ".tsx", ".java", ".cpp", ".c", ".h", ".go", ".rs"}
        
        candidates = []
        for item in tree_data:
            if item.get("type") == "blob":
                path = item.get("path", "")
                ext = os.path.splitext(path)[1].lower()
                if ext in code_exts and not any(part.startswith(".") for part in path.split("/")):
                    candidates.append(path)

        # Sort alphabetically by path for stable deterministic ordering
        candidates.sort()
        selected_paths = candidates[:10]

        files_data = []
        for path in selected_paths:
            raw_resp = self._get(f"https://raw.githubusercontent.com/{owner}/{repo}/HEAD/{path}")
            if raw_resp:
                lines = raw_resp.text.splitlines()[:500]
                files_data.append({
                    "file": path,
                    "content": "\n".join(lines)
                })

        return files_data

    def fetch_user_repos(self, username: str) -> List[Dict[str, Any]]:
        user_url = f"https://api.github.com/users/{username}/repos"
        resp = self._get(user_url, params={"per_page": 100, "type": "public"})
        if not resp:
            return []
        repos = resp.json()
        if not isinstance(repos, list):
            return []
        # Exclude forks
        original_repos = [r for r in repos if not r.get("fork")]
        return original_repos


class UniRankScoringEngine:
    """Orchestrates the 4-prompt UniRank Scoring Engine pipeline."""

    def __init__(
        self,
        llm_client: LLMClient,
        cache: Optional[ScoringCache] = None,
        scoring_version: str = "v1.1",
        prompts_path: str = "prompts/scoring_prompts.json",
    ):
        self.llm_client = llm_client
        self.cache = cache or ScoringCache(enabled=False)
        self.scoring_version = scoring_version
        self.prompts = self._load_prompts(prompts_path)
        self.model_name = getattr(llm_client, "model_name", "mock-model")

    def _load_prompts(self, prompts_path: str) -> Dict[str, Dict[str, Any]]:
        if not os.path.exists(prompts_path):
            raise FileNotFoundError(f"Prompts file not found at {prompts_path}")
        with open(prompts_path, "r", encoding="utf-8") as f:
            prompt_list = json.load(f)
        return {p["id"]: p for p in prompt_list}

    def _run_subprompt(
        self,
        prompt_id: str,
        user_payload: str,
        schema_cls: Type[Any],
    ) -> Any:
        prompt_info = self.prompts[prompt_id]
        prompt_text = prompt_info["text"]

        cache_key = ScoringCache.compute_cache_key(
            model_name=self.model_name,
            scoring_version=self.scoring_version,
            prompt_id=prompt_id,
            prompt_text=prompt_text,
            json_payload=user_payload,
        )

        cached_val = self.cache.get(cache_key)
        if cached_val:
            try:
                return schema_cls.model_validate_json(cached_val)
            except Exception:
                pass

        result = self.llm_client.generate(
            prompt_id=prompt_id,
            system_prompt=prompt_text,
            user_payload=user_payload,
            schema_cls=schema_cls,
            temperature=0.0,
        )

        self.cache.set(
            key=cache_key,
            prompt_id=prompt_id,
            scoring_version=self.scoring_version,
            response_text=result.model_dump_json(),
        )
        return result

    def score_repo(
        self,
        github_data: Dict[str, Any],
        demo_evidence: Optional[str] = None,
    ) -> FinalScoreOutput:
        # Step 2: Run code_quality_subprompt
        source_excerpt = json.dumps(github_data.get("source_files", []), indent=2)
        code_quality_res = self._run_subprompt("code_quality_subprompt", source_excerpt, CodeQualityResult)

        # Step 3: Run demo_review_subprompt if demo evidence submitted
        demo_res = None
        if demo_evidence and demo_evidence.strip():
            demo_res = self._run_subprompt("demo_review_subprompt", demo_evidence, DemoReviewResult)

        # Step 4: Run readme_quality_subprompt if README present
        readme_text = github_data.get("readme_text", "")
        readme_res = None
        if readme_text and readme_text.strip():
            readme_res = self._run_subprompt("readme_quality_subprompt", readme_text, ReadmeQualityResult)

        # Step 5: Assemble payload for main orchestrator
        # Addendum Fix #2: payload explicitly includes pushed_at timestamp for cache invalidation
        combined_payload = {
            "github_data": {
                "name": github_data.get("name"),
                "owner": github_data.get("owner"),
                "stars": github_data.get("stars", 0),
                "forks": github_data.get("forks", 0),
                "open_issues": github_data.get("open_issues", 0),
                "pushed_at": github_data.get("pushed_at", ""),
                "contributors_count": github_data.get("contributors_count", 1),
                "structure": github_data.get("structure", {}),
                "ci_status": github_data.get("ci_status", "unknown"),
            },
            "code_quality": code_quality_res.model_dump() if code_quality_res else None,
            "demo": demo_res.model_dump() if demo_res else None,
            "readme": readme_res.model_dump() if readme_res else None,
        }

        payload_str = json.dumps(combined_payload, sort_keys=True)

        # Step 6: Execute main_system_prompt (temperature=0)
        final_output = self._run_subprompt("main_system_prompt", payload_str, FinalScoreOutput)
        return final_output

    def score_user(
        self,
        username: str,
        repos_data: List[Dict[str, Any]],
        demo_evidence: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Score all user repos and compute user-level aggregations."""
        if not repos_data:
            return {
                "username": username,
                "overall_implementation_score": 0.0,
                "overall_working_score": 0.0,
                "overall_impact_score": 0,
                "overall_composite_score": 0.0,
                "scored_repos": [],
                "failed_repos": [],
                "computed_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
            }

        scored_repos = []
        failed_repos = []

        for repo in repos_data:
            repo_name = repo.get("name", "unknown")
            try:
                score_out = self.score_repo(repo, demo_evidence=demo_evidence)
                scored_repos.append({
                    "repo_name": repo_name,
                    "score": score_out.model_dump(),
                })
            except Exception as ex:
                logger.error(f"Failed to score repo {repo_name}: {ex}")
                failed_repos.append({
                    "repo_name": repo_name,
                    "error": str(ex),
                })

        if not scored_repos:
            return {
                "username": username,
                "overall_implementation_score": 0.0,
                "overall_working_score": 0.0,
                "overall_impact_score": 0,
                "overall_composite_score": 0.0,
                "scored_repos": [],
                "failed_repos": failed_repos,
                "computed_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
            }

        impl_scores = [r["score"]["implementation_score"] for r in scored_repos]
        work_scores = [r["score"]["working_score"] for r in scored_repos]
        impact_scores = [r["score"]["impact_score"] for r in scored_repos]

        overall_impl = round(sum(impl_scores) / len(impl_scores), 1)
        overall_work = round(sum(work_scores) / len(work_scores), 1)
        overall_impact = int(round(sum(impact_scores) / len(impact_scores)))

        # overall_composite_score: impact normalized to /10 basis only for this average
        composite_impact = overall_impact / 10.0
        overall_composite = round((overall_impl + overall_work + composite_impact) / 3.0, 1)

        return {
            "username": username,
            "overall_implementation_score": overall_impl,
            "overall_working_score": overall_work,
            "overall_impact_score": overall_impact,
            "overall_composite_score": overall_composite,
            "scored_repos": scored_repos,
            "failed_repos": failed_repos,
            "computed_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        }


def get_mock_fixture_repos(username: str = "sample-student") -> List[Dict[str, Any]]:
    """Fixture repo data for offline `--mock` runs."""
    return [
        {
            "name": "sample-project",
            "owner": username,
            "stars": 15,
            "forks": 3,
            "open_issues": 1,
            "pushed_at": "2026-08-15T12:00:00Z",
            "contributors_count": 2,
            "structure": {
                "has_gitignore": True,
                "has_license": True,
                "has_readme": True,
                "has_build_config": True,
            },
            "ci_status": "success",
            "readme_text": "# Sample Project\nA web application built with TypeScript and Python.\n## Setup\nRun `npm install` and `npm start`.",
            "source_files": [
                {"file": "src/index.ts", "content": "console.log('Hello World');"},
                {"file": "src/server.py", "content": "print('Server running')"},
            ],
        }
    ]


def run_determinism_test(fixture_path: str, runs: int = 3, threshold: float = 3.0):
    """
    Forces non-cached real Gemini LLM calls against a frozen evidence fixture.
    Measures max score delta across N runs.
    Note: threshold=3.0 is a starting guess and should be derived empirically
    by running real Gemini calls ~20 times on fixtures and observing actual variance.
    """
    # Threshold 3.0 comment noted per spec
    logger.info(f"Running determinism test with {runs} runs on fixture {fixture_path}...")
    if not os.path.exists(fixture_path):
        raise FileNotFoundError(f"Fixture file not found: {fixture_path}")

    with open(fixture_path, "r", encoding="utf-8") as f:
        fixture_data = json.load(f)

    # Strictly use GeminiClient (raises error if no API key)
    llm = GeminiClient()
    cache = ScoringCache(enabled=False)
    engine = UniRankScoringEngine(llm_client=llm, cache=cache)

    impl_scores = []
    working_scores = []
    impact_scores = []

    for i in range(runs):
        logger.info(f"Run {i+1}/{runs}...")
        res = engine.score_repo(fixture_data, demo_evidence=fixture_data.get("demo_evidence"))
        impl_scores.append(res.implementation_score)
        working_scores.append(res.working_score)
        impact_scores.append(res.impact_score)

    delta_impl = max(impl_scores) - min(impl_scores)
    delta_work = max(working_scores) - min(working_scores)
    delta_impact = max(impact_scores) - min(impact_scores)
    max_delta = max(delta_impl, delta_work, delta_impact)

    logger.info(f"Determinism Results over {runs} runs:")
    logger.info(f"  Implementation: {impl_scores} (delta: {delta_impl:.1f})")
    logger.info(f"  Working: {working_scores} (delta: {delta_work:.1f})")
    logger.info(f"  Impact: {impact_scores} (delta: {delta_impact})")
    logger.info(f"  Max Delta: {max_delta:.1f} (Threshold: {threshold})")

    if max_delta > threshold:
        logger.error(f"Determinism test FAILED! Max delta {max_delta:.1f} exceeds threshold {threshold}.")
        sys.exit(1)
    else:
        logger.info("Determinism test PASSED successfully.")


def main():
    parser = argparse.ArgumentParser(description="UniRank GitHub User Scoring Engine")
    parser.add_argument("pos_username", nargs="?", help="GitHub username to score")
    parser.add_argument("--username", help="GitHub username to score")
    parser.add_argument("--mock", action="store_true", help="Run with mock LLM and fixture data")
    parser.add_argument("--no-cache", action="store_true", help="Bypass SQLite cache")
    parser.add_argument("--demo-evidence", help="Submitted demo evidence description/transcript")
    parser.add_argument("--accept-privacy-terms", action="store_true", help="Accept privacy notice for Gemini API")
    parser.add_argument("--test-determinism", action="store_true", help="Run determinism harness")
    parser.add_argument("--fixture", help="Fixture JSON path for determinism test")
    parser.add_argument("--runs", type=int, default=3, help="Number of runs for determinism test")

    args = parser.parse_args()

    username = args.username or args.pos_username

    if not args.accept_privacy_terms and os.getenv("UNIRANK_PRIVACY_ACK") != "1" and not args.mock:
        print(PRIVACY_BANNER, file=sys.stderr)

    if args.test_determinism:
        fixture_file = args.fixture
        if not fixture_file:
            # Create default fixture if none provided
            fixture_file = ".cache/determinism_fixture.json"
            os.makedirs(".cache", exist_ok=True)
            with open(fixture_file, "w", encoding="utf-8") as f:
                json.dump(get_mock_fixture_repos("fixture-user")[0], f, indent=2)
        run_determinism_test(fixture_file, runs=args.runs)
        return

    cache = ScoringCache(enabled=not args.no_cache)

    if args.mock:
        llm = MockLLMClient()
        engine = UniRankScoringEngine(llm_client=llm, cache=cache)

        if username:
            collector = GitHubCollector()
            raw_repos = collector.fetch_user_repos(username)
            if raw_repos:
                repos = [collector.collect_repo_data(username, r["name"]) for r in raw_repos[:5]]
                repos = [r for r in repos if r]
            else:
                repos = get_mock_fixture_repos(username)
        else:
            username = "mock-student"
            repos = get_mock_fixture_repos(username)
    else:
        if not username:
            print("Error: Username is required unless running with --mock.", file=sys.stderr)
            sys.exit(1)

        llm = GeminiClient()
        engine = UniRankScoringEngine(llm_client=llm, cache=cache)

        collector = GitHubCollector()
        raw_repos = collector.fetch_user_repos(username)
        if not raw_repos:
            print(f"No original public repositories found for @{username}.", file=sys.stderr)
            sys.exit(0)

        repos = []
        for r in raw_repos[:10]: # Limit to top 10 original repos
            r_data = collector.collect_repo_data(username, r["name"])
            if r_data:
                repos.append(r_data)

    results = engine.score_user(username, repos, demo_evidence=args.demo_evidence)
    print(json.dumps(results, indent=2))


if __name__ == "__main__":
    main()
