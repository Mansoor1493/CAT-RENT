def classify_severity(score: float) -> str:
    """Classify anomaly severity based on score."""
    if score >= 0.9:
        return 'CRITICAL'
    elif score >= 0.7:
        return 'HIGH'
    elif score >= 0.5:
        return 'MEDIUM'
    return 'LOW'
