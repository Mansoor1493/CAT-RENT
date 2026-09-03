from fastapi import APIRouter, HTTPException
from app.schemas import ForecastRequest, ForecastResponse, ForecastResult
from app.forecasting.preprocess import preprocess_demand_data, create_forecast_features
from app.forecasting.model import DemandForecaster
from pymongo import MongoClient
from app.config import settings
import numpy as np

router = APIRouter()


def get_db():
    client = MongoClient(settings.mongodb_uri)
    return client.get_default_database()


@router.post("/generate", response_model=ForecastResponse)
async def generate_forecast(request: ForecastRequest):
    """Generate demand forecast for a site and equipment type."""
    try:
        db = get_db()

        # Fetch demand history
        query = {
            'siteId': request.site_id,
            'equipmentType': request.equipment_type
        }
        history = list(db.demandhistories.find(query).sort('date', 1))

        if len(history) < 14:
            # Not enough data — use simple average
            avg_demand = np.mean([h.get('demand', 0) for h in history]) if history else 5
            forecasts = []
            for i in range(request.horizon_days):
                forecasts.append(ForecastResult(
                    site_id=request.site_id,
                    equipment_type=request.equipment_type,
                    forecast_date=f"day_{i+1}",
                    predicted_demand=round(float(avg_demand), 1),
                    confidence=0.5,
                    shortage_risk="MEDIUM",
                    available=0
                ))
            return ForecastResponse(success=True, forecasts=forecasts)

        # Preprocess
        df = preprocess_demand_data(history)

        # Train model
        forecaster = DemandForecaster()
        forecaster.train(df)

        # Generate future features and predict
        future_df = create_forecast_features(df, request.horizon_days)
        predictions = forecaster.predict(future_df)
        historical_std = float(df['demand'].std())
        confidence_scores = forecaster.get_confidence(predictions, historical_std)

        # Get current available equipment count
        available_count = db.equipments.count_documents({
            'type': request.equipment_type,
            'status': {'$in': ['AVAILABLE', 'IDLE']},
            'siteId': request.site_id
        })

        # Build results
        forecasts = []
        for i, (pred, conf) in enumerate(zip(predictions, confidence_scores)):
            shortage_risk = 'LOW'
            if pred > available_count * 1.5:
                shortage_risk = 'HIGH'
            elif pred > available_count:
                shortage_risk = 'MEDIUM'

            date_str = future_df['date'].iloc[i].strftime('%Y-%m-%d') if 'date' in future_df.columns else f"day_{i+1}"

            forecasts.append(ForecastResult(
                site_id=request.site_id,
                equipment_type=request.equipment_type,
                forecast_date=date_str,
                predicted_demand=round(float(pred), 1),
                confidence=round(float(conf), 3),
                shortage_risk=shortage_risk,
                available=available_count
            ))

        return ForecastResponse(success=True, forecasts=forecasts)

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
