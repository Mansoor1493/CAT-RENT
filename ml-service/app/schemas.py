from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class ForecastRequest(BaseModel):
    site_id: str
    equipment_type: str
    horizon_days: int = 30


class ForecastResult(BaseModel):
    site_id: str
    equipment_type: str
    forecast_date: str
    predicted_demand: float
    confidence: float
    shortage_risk: str  # LOW, MEDIUM, HIGH
    available: int


class ForecastResponse(BaseModel):
    success: bool
    forecasts: list[ForecastResult]


class AnomalyRequest(BaseModel):
    equipment_ids: Optional[list[str]] = None  # None = all equipment


class AnomalyResult(BaseModel):
    equipment_id: str
    score: float
    severity: str  # LOW, MEDIUM, HIGH, CRITICAL
    reasons: list[str]
    detection_method: str  # RULE_BASED, ML_BASED


class AnomalyResponse(BaseModel):
    success: bool
    anomalies: list[AnomalyResult]


class RecommendationRequest(BaseModel):
    pass  # Uses current DB state


class RecommendationResult(BaseModel):
    action: str
    source_equipment_ids: list[str]
    source_site_id: Optional[str] = None
    target_site_id: str
    equipment_type: str
    reasons: list[str]
    expected_impact: dict
    score: float


class RecommendationResponse(BaseModel):
    success: bool
    recommendations: list[RecommendationResult]
