import pandas as pd
import numpy as np
from typing import Optional


def preprocess_demand_data(data: list[dict]) -> pd.DataFrame:
    """Preprocess demand history data for forecasting."""
    df = pd.DataFrame(data)

    if df.empty:
        return df

    df['date'] = pd.to_datetime(df['date'])
    df = df.sort_values('date')

    # Feature engineering
    df['day_of_week'] = df['date'].dt.dayofweek
    df['month'] = df['date'].dt.month
    df['day_of_month'] = df['date'].dt.day
    df['is_weekend'] = (df['day_of_week'] >= 5).astype(int)

    # Lag features
    df['demand_lag_1'] = df['demand'].shift(1)
    df['demand_lag_7'] = df['demand'].shift(7)
    df['demand_lag_30'] = df['demand'].shift(30)

    # Rolling features
    df['demand_roll_7'] = df['demand'].rolling(7, min_periods=1).mean()
    df['demand_roll_30'] = df['demand'].rolling(30, min_periods=1).mean()
    df['demand_roll_7_std'] = df['demand'].rolling(7, min_periods=1).std().fillna(0)

    # Utilization features if available
    if 'utilization' in df.columns:
        df['util_roll_7'] = df['utilization'].rolling(7, min_periods=1).mean()

    df = df.fillna(method='bfill').fillna(0)

    return df


def create_forecast_features(df: pd.DataFrame, horizon_days: int) -> pd.DataFrame:
    """Create feature matrix for forecast horizon."""
    last_date = df['date'].max()
    future_dates = pd.date_range(start=last_date + pd.Timedelta(days=1), periods=horizon_days)

    future_df = pd.DataFrame({'date': future_dates})
    future_df['day_of_week'] = future_df['date'].dt.dayofweek
    future_df['month'] = future_df['date'].dt.month
    future_df['day_of_month'] = future_df['date'].dt.day
    future_df['is_weekend'] = (future_df['day_of_week'] >= 5).astype(int)

    # Use last known values for lag features
    last_demand = df['demand'].iloc[-1] if len(df) > 0 else 0
    future_df['demand_lag_1'] = last_demand
    future_df['demand_lag_7'] = df['demand'].iloc[-7] if len(df) >= 7 else last_demand
    future_df['demand_lag_30'] = df['demand'].iloc[-30] if len(df) >= 30 else last_demand
    future_df['demand_roll_7'] = df['demand'].tail(7).mean() if len(df) >= 7 else last_demand
    future_df['demand_roll_30'] = df['demand'].tail(30).mean() if len(df) >= 30 else last_demand
    future_df['demand_roll_7_std'] = df['demand'].tail(7).std() if len(df) >= 7 else 0

    return future_df
