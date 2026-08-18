"""
scoring_schemas.py
Pydantic v2 data models for UniRank Scoring Engine prompts and outputs.
"""

from typing import List, Optional, Literal, Dict, Any
from pydantic import BaseModel, Field, ValidationError


class SubPromptValidationError(Exception):
    """Raised when an LLM response fails validation against the expected sub-prompt schema."""

    def __init__(self, prompt_id: str, message: str, original_error: Optional[Exception] = None, raw_response: Optional[str] = None):
        super().__init__(f"Validation failed for prompt '{prompt_id}': {message}")
        self.prompt_id = prompt_id
        self.message = message
        self.original_error = original_error
        self.raw_response = raw_response


class CodeQualityFinding(BaseModel):
    file: str
    line: Optional[int] = None
    category: Literal["bug", "vuln", "smell"]
    description: str


class CodeQualityResult(BaseModel):
    estimated_bugs: int
    estimated_vulnerabilities: int
    estimated_smells: int
    avg_cyclomatic_complexity: float
    duplication_pct_estimate: float = Field(ge=0.0, le=100.0)
    confidence: Literal["low", "medium", "high"]
    method: str = "llm_static_review_v1"
    findings: List[CodeQualityFinding] = Field(default_factory=list)
    note: str


class DemoReviewResult(BaseModel):
    demo_points: Optional[int] = Field(default=None, ge=0, le=15)
    shows_running_app: bool
    demonstrates_core_features: bool
    shows_complete_flow: bool
    issues_observed: List[str] = Field(default_factory=list)
    reasoning: str


class ReadmeQualityResult(BaseModel):
    documentation_completeness_score: int = Field(ge=0, le=10)
    setup_instructions_score: int = Field(ge=0, le=10)
    has_install_steps: bool
    has_prerequisites: bool
    has_run_instructions: bool
    has_test_instructions: bool
    reasoning: str


class ImplementationEvidence(BaseModel):
    sonarqube_raw: Optional[Dict[str, Any]] = None
    repo_structure: Dict[str, Any] = Field(default_factory=dict)
    formula_breakdown: Dict[str, Any] = Field(default_factory=dict)


class ImpactEvidence(BaseModel):
    raw_metrics: Dict[str, Any] = Field(default_factory=dict)
    normalization_method: str = "log_scaled"
    cohort_percentile: Optional[Dict[str, Any]] = None


class WorkingEvidence(BaseModel):
    ci_status: str
    tests: str
    demo_reviewed: bool
    faculty_verified: Optional[Dict[str, Any]] = None


class FinalEvidenceBlock(BaseModel):
    implementation: ImplementationEvidence
    impact: ImpactEvidence
    working: WorkingEvidence


class FinalScoreOutput(BaseModel):
    implementation_score: float = Field(ge=0.0, le=10.0)
    impact_score: int = Field(ge=0, le=100)
    working_score: float = Field(ge=0.0, le=10.0)
    evidence: Dict[str, Any]
    computed_at: str
    scoring_version: str = "v1.1"
