import mongoose, { Schema } from 'mongoose';

export type EquipmentStatus =
  | 'AVAILABLE'
  | 'RENTED'
  | 'IN_TRANSIT'
  | 'ACTIVE'
  | 'IDLE'
  | 'OVERDUE'
  | 'MAINTENANCE'
  | 'UNASSIGNED';

export type EquipmentType =
  | 'Excavator'
  | 'Loader'
  | 'Dozer'
  | 'Crane'
  | 'Dump Truck'
  | 'Grader'
  | 'Compactor';

export interface IEquipment {
  equipmentId: string;
  type: EquipmentType;
  model: string;
  serialNumber: string;
  status: EquipmentStatus;
  siteId?: string;
  operatorId?: string;
  lat: number;
  lng: number;
  engineHours: number;
  operatingHours: number;
  idleHours: number;
  fuelLevel: number;
  healthScore: number;
  qrCode: string;
  qrPayload?: string;
  qrVersion?: number;
  temperature?: number;
  yearManufactured: number;
  hourlyRate: number;
  createdAt?: Date;
  updatedAt?: Date;
}

const EquipmentSchema = new Schema<IEquipment>(
  {
    equipmentId: { type: String, required: true, unique: true, index: true },
    type: {
      type: String,
      enum: ['Excavator', 'Loader', 'Dozer', 'Crane', 'Dump Truck', 'Grader', 'Compactor'],
      required: true,
      index: true,
    },
    model: { type: String, required: true, trim: true },
    serialNumber: { type: String, required: true, unique: true },
    status: {
      type: String,
      enum: [
        'AVAILABLE',
        'RENTED',
        'IN_TRANSIT',
        'ACTIVE',
        'IDLE',
        'OVERDUE',
        'MAINTENANCE',
        'UNASSIGNED',
      ],
      default: 'AVAILABLE',
      required: true,
      index: true,
    },
    siteId: { type: String, default: null, index: true },
    operatorId: { type: String, default: null, index: true },
    lat: { type: Number, required: true, default: 0 },
    lng: { type: Number, required: true, default: 0 },
    engineHours: { type: Number, required: true, default: 0, min: 0 },
    operatingHours: { type: Number, required: true, default: 0, min: 0 },
    idleHours: { type: Number, required: true, default: 0, min: 0 },
    fuelLevel: { type: Number, required: true, default: 100, min: 0, max: 100 },
    healthScore: { type: Number, required: true, default: 100, min: 0, max: 100 },
    qrCode: { type: String, required: true, unique: true },
    qrPayload: { type: String, default: null, index: true },
    qrVersion: { type: Number, default: 1 },
    temperature: { type: Number, default: 82 },
    yearManufactured: { type: Number, required: true, default: 2022 },
    hourlyRate: { type: Number, required: true, default: 150 },
  },
  { timestamps: true }
);

EquipmentSchema.index({ status: 1, type: 1 });
EquipmentSchema.index({ siteId: 1, status: 1 });

export const Equipment = mongoose.model<IEquipment>('Equipment', EquipmentSchema);
