import mongoose, { Schema } from 'mongoose';

export type SiteStatus = 'ACTIVE' | 'INACTIVE';

export interface ISite {
  siteId: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  activeRentals: number;
  status: SiteStatus;
  geofenceRadius: number;
  createdAt?: Date;
  updatedAt?: Date;
}

const SiteSchema = new Schema<ISite>(
  {
    siteId: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true, trim: true },
    address: { type: String, required: true },
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
    activeRentals: { type: Number, default: 0 },
    geofenceRadius: { type: Number, default: 5.0 },
    status: {
      type: String,
      enum: ['ACTIVE', 'INACTIVE'],
      default: 'ACTIVE',
      index: true,
    },
  },
  { timestamps: true }
);

export const Site = mongoose.model<ISite>('Site', SiteSchema);
