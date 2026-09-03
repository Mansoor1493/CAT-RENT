import mongoose, { Schema } from 'mongoose';
import { EquipmentType } from './Equipment';

export type ShortageRisk = 'LOW' | 'MEDIUM' | 'HIGH';

export interface IForecast {
  siteId: string;
  equipmentType: EquipmentType;
  forecastDate: string;
  generatedAt: Date;
  predictedDemand: number;
  confidence: number;
  shortageRisk: ShortageRisk;
  available: number;
  createdAt?: Date;
  updatedAt?: Date;
}

const ForecastSchema = new Schema<IForecast>(
  {
    siteId: { type: String, required: true, index: true },
    equipmentType: {
      type: String,
      enum: ['Excavator', 'Loader', 'Dozer', 'Crane', 'Dump Truck', 'Grader', 'Compactor'],
      required: true,
      index: true,
    },
    forecastDate: { type: String, required: true, index: true },
    generatedAt: { type: Date, default: Date.now, index: true },
    predictedDemand: { type: Number, required: true, default: 0 },
    confidence: { type: Number, required: true, default: 0.8 },
    shortageRisk: {
      type: String,
      enum: ['LOW', 'MEDIUM', 'HIGH'],
      default: 'LOW',
      required: true,
      index: true,
    },
    available: { type: Number, required: true, default: 0 },
  },
  { timestamps: true }
);

ForecastSchema.index({ siteId: 1, equipmentType: 1, forecastDate: 1 }, { unique: true });

export const Forecast = mongoose.model<IForecast>('Forecast', ForecastSchema);
