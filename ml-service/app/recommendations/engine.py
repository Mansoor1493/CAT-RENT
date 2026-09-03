from fastapi import APIRouter, HTTPException
from app.schemas import RecommendationResponse, RecommendationResult
from pymongo import MongoClient
from app.config import settings
import numpy as np

router = APIRouter()


def get_db():
    client = MongoClient(settings.mongodb_uri)
    return client.get_default_database()


def haversine_distance(lat1, lng1, lat2, lng2):
    """Calculate distance between two points in km."""
    R = 6371
    dlat = np.radians(lat2 - lat1)
    dlng = np.radians(lng2 - lng1)
    a = np.sin(dlat/2)**2 + np.cos(np.radians(lat1)) * np.cos(np.radians(lat2)) * np.sin(dlng/2)**2
    return R * 2 * np.arctan2(np.sqrt(a), np.sqrt(1-a))


@router.post("/generate", response_model=RecommendationResponse)
async def generate_recommendations():
    """Generate asset reallocation recommendations."""
    try:
        db = get_db()

        # Get forecasts with high shortage risk
        high_risk = list(db.forecasts.find({'shortageRisk': {'$in': ['HIGH', 'MEDIUM']}}))

        if not high_risk:
            return RecommendationResponse(success=True, recommendations=[])

        # Get under-utilized and available equipment
        candidates = list(db.equipments.find({
            'status': {'$in': ['AVAILABLE', 'IDLE']}
        }))

        sites = {s['siteId']: s for s in db.sites.find()}

        recommendations = []

        for forecast in high_risk:
            target_site_id = forecast.get('siteId', '')
            eq_type = forecast.get('equipmentType', '')
            predicted = forecast.get('predictedDemand', 0)
            available_at_site = forecast.get('available', 0)
            shortage = max(0, predicted - available_at_site)

            if shortage <= 0:
                continue

            # Find matching candidates from other sites
            matching = [
                c for c in candidates
                if c.get('type') == eq_type and c.get('siteId') != target_site_id
            ]

            if not matching:
                continue

            target_site = sites.get(target_site_id, {})
            target_lat = target_site.get('lat', 0)
            target_lng = target_site.get('lng', 0)

            # Score and rank candidates
            scored = []
            for candidate in matching:
                source_site = sites.get(candidate.get('siteId', ''), {})
                distance = haversine_distance(
                    candidate.get('lat', 0), candidate.get('lng', 0),
                    target_lat, target_lng
                )

                # Score: higher is better
                demand_score = min(shortage / max(predicted, 1), 1) * 40
                utilization_opp = (100 - candidate.get('healthScore', 50)) / 100 * 30
                distance_penalty = min(distance / 500, 1) * 20
                availability = 10 if candidate.get('status') == 'AVAILABLE' else 5

                score = demand_score + utilization_opp + availability - distance_penalty
                scored.append((candidate, score, distance))

            scored.sort(key=lambda x: x[1], reverse=True)

            # Take top candidates up to shortage count
            selected = scored[:int(shortage)]

            if selected:
                source_ids = [s[0]['equipmentId'] for s in selected]
                avg_distance = np.mean([s[2] for s in selected])

                recommendations.append(RecommendationResult(
                    action='REALLOCATE',
                    source_equipment_ids=source_ids,
                    source_site_id=selected[0][0].get('siteId'),
                    target_site_id=target_site_id,
                    equipment_type=eq_type,
                    reasons=[
                        f'Site {target_site_id} forecasted demand: {predicted:.0f} units',
                        f'Current available at site: {available_at_site}',
                        f'Shortage of {shortage:.0f} {eq_type}(s)',
                        f'{len(source_ids)} candidate(s) available for reallocation',
                        f'Average distance: {avg_distance:.0f} km'
                    ],
                    expected_impact={
                        'utilizationGain': round(shortage / max(predicted, 1) * 100, 1),
                        'shortageCoverage': round(min(len(source_ids) / max(shortage, 1), 1) * 100, 1),
                        'costSaving': round(shortage * 150, 2)  # estimated daily cost saving
                    },
                    score=round(float(np.mean([s[1] for s in selected])), 2)
                ))

        recommendations.sort(key=lambda r: r.score, reverse=True)

        return RecommendationResponse(success=True, recommendations=recommendations)

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
