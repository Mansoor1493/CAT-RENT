from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
from app.config import settings

app = FastAPI(
    title="CatRent Intelligence ML Service",
    description="Machine Learning service for demand forecasting, anomaly detection, and recommendations",
    version="1.0.0",
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "service": "catrent-ml-service",
    }


# Import and include routers
from app.forecasting.forecast import router as forecast_router
from app.anomaly.detector import router as anomaly_router
from app.recommendations.engine import router as recommendation_router

app.include_router(forecast_router, prefix="/forecast", tags=["Forecasting"])
app.include_router(anomaly_router, prefix="/anomaly", tags=["Anomaly Detection"])
app.include_router(recommendation_router, prefix="/recommendations", tags=["Recommendations"])


if __name__ == "__main__":
    uvicorn.run("app.main:app", host="0.0.0.0", port=settings.port, reload=True)
