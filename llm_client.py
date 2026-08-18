"""
llm_client.py
LLM client interface, Google Gemini implementation with retries, and Mock LLM client.
"""

from abc import ABC, abstractmethod
import json
import os
import re
import time
from typing import Type, TypeVar, Optional, Any
from pydantic import BaseModel, ValidationError

from scoring_schemas import (
    SubPromptValidationError,
    CodeQualityResult,
    CodeQualityFinding,
    DemoReviewResult,
    ReadmeQualityResult,
    FinalScoreOutput,
)

T = TypeVar("T", bound=BaseModel)


class LLMClient(ABC):
    @abstractmethod
    def generate(
        self,
        prompt_id: str,
        system_prompt: str,
        user_payload: str,
        schema_cls: Type[T],
        temperature: float = 0.0,
    ) -> T:
        """Execute prompt against LLM and validate result using Pydantic schema."""
        pass


class GeminiClient(LLMClient):
    """Google Gemini LLM client with exponential backoff retry for rate/quota limits."""

    def __init__(self, api_key: Optional[str] = None, model_name: str = "gemini-3.6-flash"):
        self.api_key = api_key or os.getenv("GOOGLE_API_KEY") or os.getenv("GEMINI_API_KEY")
        if not self.api_key:
            raise ValueError("GOOGLE_API_KEY or GEMINI_API_KEY environment variable is required for GeminiClient.")
        self.model_name = model_name

        try:
            import google.generativeai as genai
            genai.configure(api_key=self.api_key)
            self._genai = genai
        except ImportError:
            raise ImportError("google-generativeai package is required. Install via `pip install google-generativeai`.")

    def generate(
        self,
        prompt_id: str,
        system_prompt: str,
        user_payload: str,
        schema_cls: Type[T],
        temperature: float = 0.0,
    ) -> T:
        full_prompt = f"{system_prompt}\n\nINPUT DATA:\n{user_payload}"
        model = self._genai.GenerativeModel(
            model_name=self.model_name,
            generation_config={"temperature": temperature},
        )

        max_retries = 3
        last_exception = None

        for attempt in range(max_retries + 1):
            try:
                response = model.generate_content(full_prompt)
                raw_text = response.text if response and hasattr(response, "text") else ""
                break
            except Exception as e:
                last_exception = e
                err_str = str(e).lower()
                if ("429" in err_str or "503" in err_str or "quota" in err_str or "resource_exhausted" in err_str) and attempt < max_retries:
                    sleep_time = 2 ** (attempt + 1)
                    time.sleep(sleep_time)
                else:
                    raise e
        else:
            raise RuntimeError(f"Gemini API failed after {max_retries} retries: {last_exception}")

        cleaned_text = self._clean_json(raw_text)

        try:
            return schema_cls.model_validate_json(cleaned_text)
        except ValidationError as ve:
            raise SubPromptValidationError(
                prompt_id=prompt_id,
                message=str(ve),
                original_error=ve,
                raw_response=raw_text,
            )
        except Exception as ex:
            raise SubPromptValidationError(
                prompt_id=prompt_id,
                message=f"JSON parsing error: {str(ex)}",
                original_error=ex,
                raw_response=raw_text,
            )

    @staticmethod
    def _clean_json(text: str) -> str:
        text = text.strip()
        if text.startswith("```json"):
            text = text[7:]
        elif text.startswith("```"):
            text = text[3:]
        if text.endswith("```"):
            text = text[:-3]
        return text.strip()


class MockLLMClient(LLMClient):
    """Deterministic Mock LLM client for offline testing."""

    def __init__(self, force_malformed: bool = False):
        self.force_malformed = force_malformed

    def generate(
        self,
        prompt_id: str,
        system_prompt: str,
        user_payload: str,
        schema_cls: Type[T],
        temperature: float = 0.0,
    ) -> T:
        if self.force_malformed:
            raise SubPromptValidationError(
                prompt_id=prompt_id,
                message="Forced malformed output for testing",
                raw_response="INVALID_JSON",
            )

        if schema_cls == CodeQualityResult:
            return CodeQualityResult(
                estimated_bugs=0,
                estimated_vulnerabilities=0,
                estimated_smells=2,
                avg_cyclomatic_complexity=2.5,
                duplication_pct_estimate=3.0,
                confidence="high",
                method="llm_static_review_v1",
                findings=[
                    CodeQualityFinding(
                        file="src/index.js",
                        line=42,
                        category="smell",
                        description="Magic number 42 used in condition",
                    )
                ],
                note="Mock static code review result",
            )
        elif schema_cls == DemoReviewResult:
            has_demo = "insufficient_evidence" not in user_payload.lower() and "demo" in user_payload.lower()
            if not has_demo:
                return DemoReviewResult(
                    demo_points=None,
                    shows_running_app=False,
                    demonstrates_core_features=False,
                    shows_complete_flow=False,
                    issues_observed=["No demo evidence provided"],
                    reasoning="insufficient_evidence",
                )
            return DemoReviewResult(
                demo_points=14,
                shows_running_app=True,
                demonstrates_core_features=True,
                shows_complete_flow=True,
                issues_observed=[],
                reasoning="Complete video walkthrough demonstrates all core features running.",
            )
        elif schema_cls == ReadmeQualityResult:
            return ReadmeQualityResult(
                documentation_completeness_score=8,
                setup_instructions_score=9,
                has_install_steps=True,
                has_prerequisites=True,
                has_run_instructions=True,
                has_test_instructions=True,
                reasoning="Detailed README with architecture diagrams and complete setup guide.",
            )
        elif schema_cls == FinalScoreOutput:
            return FinalScoreOutput(
                implementation_score=8.5,
                impact_score=45,
                working_score=9.0,
                evidence={
                    "implementation": {
                        "sonarqube_raw": {
                            "estimated_bugs": 0,
                            "confidence": "high",
                            "method": "llm_static_review_v1",
                        },
                        "repo_structure": {"has_gitignore": True, "has_license": True, "has_readme": True},
                        "formula_breakdown": {"code_quality": 2.8, "repo_structure": 1.5, "doc_completeness": 0.8},
                    },
                    "impact": {
                        "raw_metrics": {"stars": 12, "forks": 4, "contributors": 2},
                        "normalization_method": "log_scaled",
                        "cohort_percentile": None,
                    },
                    "working": {
                        "ci_status": "success",
                        "tests": "passing",
                        "demo_reviewed": True,
                        "faculty_verified": None,
                    },
                },
                computed_at="2026-08-18T15:00:00Z",
                scoring_version="v1.1",
            )
        else:
            raise ValueError(f"Unsupported schema class in MockLLMClient: {schema_cls}")
