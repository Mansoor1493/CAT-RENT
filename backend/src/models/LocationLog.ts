import mongoose, { Schema } from 'mongoose';

export interface ILocationLog {
  equipmentId: string;
  timestamp: Date;
  lat: number;
  lng: number;
  speed: number;
  siteId?: string | null;
  createdAt?: Date;
}

const LocationLogSchema = new Schema<ILocationLog>(
  {
    equipmentId: { type: String, required: true, index: true },
    timestamp: { type: Date, required: true, default: Date.now, index: true },
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
    speed: { type: Number, default: 0 },
    siteId: { type: String, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

LocationLogSchema.index({ equipmentId: 1, timestamp: -1 });

export const LocationLog = mongoose.model<ILocationLog>('LocationLog', LocationLogSchema);
