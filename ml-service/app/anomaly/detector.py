from fastapi import APIRouter, HTTPException
from app.schemas import AnomalyRequest, AnomalyResponse, AnomalyResult
from app.anomaly.preprocess import preprocess_equipment_data
from app.anomaly.scoring import classify_severity
from pymongo import MongoClient
from app.config import settings
from sklearn.ensemble import IsolationForest
import numpy as np
import pandas as pd

router = APIRouter()


def get_db():
    client = MongoClient(settings.mongodb_uri)
    return client.get_default_database()


def run_rule_based_detection(equipment: dict, usage_stats: dict) -> list[tuple[str, float]]:
    """Run rule-based anomaly checks. Returns list of (reason, score_contribution)."""
    issues = []

    # Check: No operator assigned to active equipment
    if equipment.get('status') in ['ACTIVE', 'RENTED'] and not equipment.get('operatorId'):
        issues.append(('No operator assigned to active equipment', 0.3))

    # Check: No site assigned
    if equipment.get('status') != 'AVAILABLE' and not equipment.get('siteId'):
        issues.append(('No site assigned to non-available equipment', 0.2))

    # Check: Very low utilization
    utilization = usage_stats.get('utilization', 50)
    if utilization < 10 and equipment.get('status') in ['ACTIVE', 'RENTED']:
        issues.append((f'Utilization critically low at {utilization:.1f}%', 0.3))

    # Check: Very high idle hours
    idle_ratio = usage_stats.get('idle_ratio', 0)
    if idle_ratio > 0.7:
        issues.append((f'Idle ratio {idle_ratio:.1%} exceeds threshold', 0.25))

    # Check: Low fuel
    if equipment.get('fuelLevel', 100) < 10:
        issues.append((f'Fuel level critically low at {equipment["fuelLevel"]}%', 0.15))

    return issues


@router.post("/detect", response_model=AnomalyResponse)
async def detect_anomalies(request: AnomalyRequest):
    """Run anomaly detection on equipment fleet."""
    try:
        db = get_db()

        # Fetch equipment
        query = {}
        if request.equipment_ids:
            query['equipmentId'] = {'$in': request.equipment_ids}

        equipment_list = list(db.equipments.find(query))

        if not equipment_list:
            return AnomalyResponse(success=True, anomalies=[])

        # Fetch recent usage data
        eq_ids = [e['equipmentId'] for e in equipment_list]
        usage_data = list(db.usagelogs.find({'equipmentId': {'$in': eq_ids}}).sort('date', -1).limit(1000))

        # Preprocess for ML
        df = preprocess_equipment_data(equipment_list, usage_data)

        anomalies = []

        # ML-based detection using Isolation Forest
        feature_cols = ['engineHours', 'operatingHours', 'idleHours', 'fuelLevel', 'healthScore']
        available_features = [c for c in feature_cols if c in df.columns]

        if len(available_features) >= 3 and len(df) >= 5:
            X = df[available_features].fillna(0).values
            iso_forest = IsolationForest(contamination=0.15, random_state=42, n_estimators=100)
            scores = iso_forest.fit_predict(X)
            decision_scores = iso_forest.decision_function(X)

            # Normalize scores to 0-1 (lower decision_function = more anomalous)
            norm_scores = 1 - (decision_scores - decision_scores.min()) / (decision_scores.max() - decision_scores.min() + 1e-10)

            for idx, row in df.iterrows():
                eq_id = row.get('equipmentId', '')
                ml_score = float(norm_scores[idx]) if idx < len(norm_scores) else 0

                # Run rule-based detection too
                equipment = next((e for e in equipment_list if e.get('equipmentId') == eq_id), {})
                usage_stats = {'utilization': row.get('utilization', 50), 'idle_ratio': row.get('idle_ratio', 0)}
                rule_issues = run_rule_based_detection(equipment, usage_stats)

                # Combine scores
                rule_score = min(sum(s for _, s in rule_issues), 1.0) if rule_issues else 0
                combined_score = max(ml_score, rule_score)

                if combined_score > 0.4:  # Threshold for reporting
                    reasons = [r for r, _ in rule_issues]
                    if ml_score > 0.5:
                        reasons.append(f'ML anomaly score: {ml_score:.2f}')

                    if not reasons:
                        # Generate ML-based reasons from feature importance
                        for feat in available_features:
                            val = row.get(feat, 0)
                            mean_val = df[feat].mean()
                            if val > mean_val * 2:
                                reasons.append(f'{feat} ({val:.0f}) is {val/mean_val:.1f}x above fleet average')
                            elif val < mean_val * 0.3 and mean_val > 0:
                                reasons.append(f'{feat} ({val:.0f}) is significantly below fleet average')

                    if reasons:  # Only report if we can explain
                        anomalies.append(AnomalyResult(
                            equipment_id=eq_id,
                            score=round(combined_score, 3),
                            severity=classify_severity(combined_score),
                            reasons=reasons,
                            detection_method='ML_BASED' if ml_score > rule_score else 'RULE_BASED'
                        ))

        else:
            # Fallback to rule-based only
            for equipment in equipment_list:
                eq_id = equipment.get('equipmentId', '')
                usage_stats = {'utilization': 50, 'idle_ratio': 0}  # defaults
                rule_issues = run_rule_based_detection(equipment, usage_stats)

                if rule_issues:
                    score = min(sum(s for _, s in rule_issues), 1.0)
                    anomalies.append(AnomalyResult(
                        equipment_id=eq_id,
                        score=round(score, 3),
                        severity=classify_severity(score),
                        reasons=[r for r, _ in rule_issues],
                        detection_method='RULE_BASED'
                    ))

        # Sort by score descending
        anomalies.sort(key=lambda a: a.score, reverse=True)

        return AnomalyResponse(success=True, anomalies=anomalies)

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
