import mongoose from 'mongoose';
import { Site } from '../models';

const SITES = [
  { siteId: 'S001', name: 'Chennai Industrial Project', address: 'OMR IT & Manufacturing Corridor, Chennai, TN 600119', lat: 13.0827, lng: 80.2707, r: 5.0 },
  { siteId: 'S002', name: 'Bengaluru Infrastructure Project', address: 'Electronic City Phase II, Bengaluru, KA 560100', lat: 12.9716, lng: 77.5946, r: 5.0 },
  { siteId: 'S003', name: 'Hyderabad Construction Project', address: 'HITEC City Metro Extension, Hyderabad, TG 500081', lat: 17.3850, lng: 78.4867, r: 5.0 },
  { siteId: 'S004', name: 'Pune Industrial Project', address: 'Chakan Industrial Area Phase III, Pune, MH 410501', lat: 18.5204, lng: 73.8567, r: 5.0 },
  { siteId: 'S005', name: 'Mumbai Infrastructure Project', address: 'Bandra-Kurla Complex (BKC), Mumbai, MH 400051', lat: 19.0760, lng: 72.8777, r: 5.0 },
  { siteId: 'S006', name: 'Ahmedabad Manufacturing Project', address: 'Sanand Industrial Estate, Ahmedabad, GJ 382110', lat: 23.0225, lng: 72.5714, r: 5.0 },
  { siteId: 'S007', name: 'Delhi NCR Construction Project', address: 'Dwarka Expressway Sector 113, Gurugram / Delhi NCR 122017', lat: 28.6139, lng: 77.2090, r: 5.0 },
  { siteId: 'S008', name: 'Kolkata Infrastructure Project', address: 'New Town Action Area II, Kolkata, WB 700156', lat: 22.5726, lng: 88.3639, r: 5.0 },
];

async function run() {
  await mongoose.connect('mongodb://localhost:27017/catrent');
  for (const s of SITES) {
    await Site.updateOne({ siteId: s.siteId }, { $set: { name: s.name, address: s.address, lat: s.lat, lng: s.lng, geofenceRadius: s.r } });
  }
  console.log('✅ Sites updated with Indian coordinates and geofenceRadius');
  await mongoose.disconnect();
}

run();
