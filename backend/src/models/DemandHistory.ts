import mongoose, { Schema } from 'mongoose';
import { EquipmentType } from './Equipment';

export interface IDemandHistory {
  date: Date;
  siteId: string;
  equipmentType: EquipmentType;
  demand: number;
  rentals: number;
  returns: number;
  utilization: number;
}

const DemandHistorySchema = new Schema<IDemandHistory>(
  {
    date: { type: Date, required: true, index: true },
    siteId: { type: String, required: true, index: true },
    equipmentType: {
      type: String,
      enum: ['Excavator', 'Loader', 'Dozer', 'Crane', 'Dump Truck', 'Grader', 'Compactor'],
      required: true,
      index: true,
    },
    demand: { type: Number, required: true, default: 0 },
    rentals: { type: Number, required: true, default: 0 },
    returns: { type: Number, required: true, default: 0 },
    utilization: { type: Number, required: true, default: 0 },
  },
  { timestamps: false }
);

DemandHistorySchema.index({ siteId: 1, equipmentType: 1, date: 1 });

export const DemandHistory = mongoose.model<IDemandHistory>('DemandHistory', DemandHistorySchema);
