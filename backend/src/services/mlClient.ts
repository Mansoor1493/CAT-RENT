import axios from 'axios';
import { config } from '../config/env';
import { logger } from '../utils/logger';

const client = axios.create({
  baseURL: config.mlServiceUrl,
  timeout: 10000,
});

export async function callMlForecast(siteId: string, equipmentType: string, horizonDays = 30): Promise<any> {
  try {
    const response = await client.post('/forecast/generate', {
      site_id: siteId,
      equipment_type: equipmentType,
      horizon_days: horizonDays,
    });
    return response.data;
  } catch (error: any) {
    logger.warn(`ML Service forecast unreachable (${error.message}). Using built-in heuristics.`);
    return null;
  }
}

export async function callMlAnomalies(equipmentIds?: string[]): Promise<any> {
  try {
    const response = await client.post('/anomaly/detect', {
      equipment_ids: equipmentIds || null,
    });
    return response.data;
  } catch (error: any) {
    logger.warn(`ML Service anomaly unreachable (${error.message}). Using rule-based fallback.`);
    return null;
  }
}

export async function callMlRecommendations(): Promise<any> {
  try {
    const response = await client.post('/recommendations/generate', {});
    return response.data;
  } catch (error: any) {
    logger.warn(`ML Service recommendations unreachable (${error.message}).`);
    return null;
  }
}
