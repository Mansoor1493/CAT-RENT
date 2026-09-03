import { v4 as uuidv4 } from 'uuid';

export function generateId(prefix: string): string {
  const short = uuidv4().split('-')[0].toUpperCase();
  return `${prefix}${short}`;
}

export function calculateUtilization(operatingHours: number, availableHours: number): number {
  if (availableHours === 0) return 0;
  return Math.round((operatingHours / availableHours) * 100 * 10) / 10;
}

export function haversineDistance(
  lat1: number, lng1: number,
  lat2: number, lng2: number
): number {
  const R = 6371; // km
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}
