import mongoose, { Schema } from 'mongoose';

export interface IUsageLog {
  equipmentId: string;
  date: Date;
  engineHours: number;
  operatingHours: number;
  idleHours: number;
  fuelConsumed: number;
  lat: number;
  lng: number;
  siteId?: string | null;
  operatorId?: string | null;
  createdAt?: Date;
}

const UsageLogSchema = new Schema<IUsageLog>(
  {
    equipmentId: { type: String, required: true, index: true },
    date: { type: Date, required: true, index: true },
    engineHours: { type: Number, required: true, default: 0 },
    operatingHours: { type: Number, required: true, default: 0 },
    idleHours: { type: Number, required: true, default: 0 },
    fuelConsumed: { type: Number, required: true, default: 0 },
    lat: { type: Number, required: true, default: 0 },
    lng: { type: Number, required: true, default: 0 },
    siteId: { type: String, default: null, index: true },
    operatorId: { type: String, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

UsageLogSchema.index({ equipmentId: 1, date: -1 });

export const UsageLog = mongoose.model<IUsageLog>('UsageLog', UsageLogSchema);
