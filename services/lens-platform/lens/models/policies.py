from sqlalchemy import Boolean, String, JSON
from sqlalchemy.orm import Mapped, mapped_column
from lens.database import LensBase, LensTimestampMixin, LensUUIDMixin


class AssessmentPolicy(LensUUIDMixin, LensTimestampMixin, LensBase):
    """Database-backed assessment timeline & retrieval interval policies (Section 10, 57)."""
    __tablename__ = "lens_assessment_policies"

    tenant_id: Mapped[str] = mapped_column(String(64), index=True, default="default_tenant")
    name: Mapped[str] = mapped_column(String(128), default="Default Institutional Policy")
    version: Mapped[str] = mapped_column(String(32), default="v1.0")
    
    rules_json: Mapped[dict] = mapped_column(JSON, default=lambda: {
        "initial_diagnostic": {"required": True},
        "post_learning_quiz": {"enabled": True, "delay_minutes": 60},
        "retrieval": {"enabled": True, "intervals": [2, 7, 21]},
        "transfer": {"enabled": True, "intervals": [3, 14]},
        "periodic_evaluation": {"enabled": True, "interval_days": 30}
    })
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)


class BottleneckPolicy(LensUUIDMixin, LensTimestampMixin, LensBase):
    """Database-backed bottleneck thresholds and mode mapping policies (Section 22, 23, 57)."""
    __tablename__ = "lens_bottleneck_policies"

    tenant_id: Mapped[str] = mapped_column(String(64), index=True, default="default_tenant")
    name: Mapped[str] = mapped_column(String(128), default="Standard Cognitive Bottleneck Policy")
    version: Mapped[str] = mapped_column(String(32), default="v1.0")

    thresholds_json: Mapped[dict] = mapped_column(JSON, default=lambda: {
        "minimum_identifiability": 0.50,
        "mastery_threshold": 0.75,
        "retention_decay_threshold": 0.60,
        "transfer_threshold": 0.50,
        "misconception_alert_threshold": 0.35,
        "uncertainty_threshold": 0.40
    })
    weights_json: Mapped[dict] = mapped_column(JSON, default=lambda: {
        "w_M": 1.0,
        "w_R": 0.8,
        "w_T": 0.9,
        "w_MS": 1.2,
        "w_U": 0.5
    })
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)


class InterventionPolicy(LensUUIDMixin, LensTimestampMixin, LensBase):
    """Database-backed utility function weights & action constraints (Section 26, 57)."""
    __tablename__ = "lens_intervention_policies"

    tenant_id: Mapped[str] = mapped_column(String(64), index=True, default="default_tenant")
    name: Mapped[str] = mapped_column(String(128), default="Policy Optimizer Config")
    version: Mapped[str] = mapped_column(String(32), default="v1.0")

    utility_weights_json: Mapped[dict] = mapped_column(JSON, default=lambda: {
        "w_M": 1.0,
        "w_R": 0.8,
        "w_T": 0.9,
        "w_C": 1.2,
        "w_MS": 1.5,
        "w_U": 0.4,
        "cost_penalty_lambda": 0.15
    })
    constraints_json: Mapped[dict] = mapped_column(JSON, default=lambda: {
        "max_daily_interventions": 4,
        "max_daily_workload_hours": 3.0,
        "enforce_prerequisites": True,
        "require_human_approval_for_escalations": True
    })
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
