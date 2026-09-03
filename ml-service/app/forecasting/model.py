import numpy as np
import pandas as pd
from sklearn.ensemble import GradientBoostingRegressor
from typing import Optional
import pickle
import os


class DemandForecaster:
    """Demand forecasting model using Gradient Boosting."""

    FEATURE_COLS = [
        'day_of_week', 'month', 'day_of_month', 'is_weekend',
        'demand_lag_1', 'demand_lag_7', 'demand_lag_30',
        'demand_roll_7', 'demand_roll_30', 'demand_roll_7_std'
    ]

    def __init__(self):
        self.model = GradientBoostingRegressor(
            n_estimators=100,
            max_depth=5,
            learning_rate=0.1,
            random_state=42
        )
        self.is_fitted = False

    def train(self, df: pd.DataFrame) -> dict:
        """Train the forecasting model."""
        available_features = [c for c in self.FEATURE_COLS if c in df.columns]
        X = df[available_features].values
        y = df['demand'].values

        self.model.fit(X, y)
        self.is_fitted = True
        self._feature_cols = available_features

        # Return training metrics
        train_pred = self.model.predict(X)
        mse = np.mean((y - train_pred) ** 2)
        return {'mse': float(mse), 'rmse': float(np.sqrt(mse))}

    def predict(self, df: pd.DataFrame) -> np.ndarray:
        """Generate demand predictions."""
        if not self.is_fitted:
            raise ValueError("Model not trained yet. Call train() first.")

        available_features = [c for c in self._feature_cols if c in df.columns]
        X = df[available_features].values
        predictions = self.model.predict(X)
        # Demand can't be negative
        return np.maximum(predictions, 0)

    def get_confidence(self, predictions: np.ndarray, historical_std: float) -> np.ndarray:
        """Estimate confidence based on historical variability."""
        if historical_std == 0:
            return np.ones(len(predictions)) * 0.9
        # Simple confidence: inversely related to prediction variance
        confidence = np.clip(1 - (historical_std / (predictions.mean() + 1)), 0.3, 0.95)
        return np.full(len(predictions), confidence)

    def save(self, path: str):
        """Save model to disk."""
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, 'wb') as f:
            pickle.dump({'model': self.model, 'features': self._feature_cols}, f)

    def load(self, path: str):
        """Load model from disk."""
        with open(path, 'rb') as f:
            data = pickle.load(f)
            self.model = data['model']
            self._feature_cols = data['features']
            self.is_fitted = True
