import mongoose, { Schema } from 'mongoose';

export type MaintenanceType = 'PREVENTIVE' | 'CORRECTIVE' | 'INSPECTION';

export interface IMaintenanceRecord {
  equipmentId: string;
  date: Date;
  type: MaintenanceType;
  engineHoursAtService: number;
  cost: number;
  notes: string;
  createdAt?: Date;
  updatedAt?: Date;
}

const MaintenanceRecordSchema = new Schema<IMaintenanceRecord>(
  {
    equipmentId: { type: String, required: true, index: true },
    date: { type: Date, required: true, default: Date.now },
    type: {
      type: String,
      enum: ['PREVENTIVE', 'CORRECTIVE', 'INSPECTION'],
      default: 'PREVENTIVE',
      required: true,
      index: true,
    },
    engineHoursAtService: { type: Number, required: true, default: 0 },
    cost: { type: Number, required: true, default: 0 },
    notes: { type: String, default: '' },
  },
  { timestamps: true }
);

MaintenanceRecordSchema.index({ equipmentId: 1, date: -1 });

export const MaintenanceRecord = mongoose.model<IMaintenanceRecord>(
  'MaintenanceRecord',
  MaintenanceRecordSchema
);
