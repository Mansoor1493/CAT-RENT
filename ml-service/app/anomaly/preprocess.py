import pandas as pd
import numpy as np
from typing import Optional


def preprocess_equipment_data(equipment_list: list[dict], usage_data: list[dict]) -> pd.DataFrame:
    """Preprocess equipment and usage data for anomaly detection."""
    eq_df = pd.DataFrame(equipment_list)

    if eq_df.empty:
        return eq_df

    # Aggregate usage stats per equipment
    if usage_data:
        usage_df = pd.DataFrame(usage_data)
        usage_agg = usage_df.groupby('equipmentId').agg({
            'engineHours': 'sum',
            'operatingHours': 'sum',
            'idleHours': 'sum',
            'fuelConsumed': 'sum',
        }).reset_index()

        # Calculate usage averages
        usage_count = usage_df.groupby('equipmentId').size().reset_index(name='usage_records')
        usage_agg = usage_agg.merge(usage_count, on='equipmentId', how='left')

        # Daily averages
        for col in ['engineHours', 'operatingHours', 'idleHours', 'fuelConsumed']:
            usage_agg[f'{col}_daily_avg'] = usage_agg[col] / usage_agg['usage_records'].clip(lower=1)

        eq_df = eq_df.merge(usage_agg, on='equipmentId', how='left', suffixes=('', '_usage'))

    # Calculate derived features
    eq_df['utilization'] = np.where(
        (eq_df.get('operatingHours', 0) + eq_df.get('idleHours', 0)) > 0,
        eq_df.get('operatingHours', 0) / (eq_df.get('operatingHours', 0) + eq_df.get('idleHours', 0)) * 100,
        0
    )

    eq_df['idle_ratio'] = np.where(
        (eq_df.get('operatingHours', 0) + eq_df.get('idleHours', 0)) > 0,
        eq_df.get('idleHours', 0) / (eq_df.get('operatingHours', 0) + eq_df.get('idleHours', 0)),
        0
    )

    return eq_df
