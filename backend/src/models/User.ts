import mongoose, { Schema } from 'mongoose';

export type UserRole = 'CUSTOMER' | 'ADMIN' | 'RENTAL_MANAGER' | 'SITE_MANAGER' | 'OPERATOR';

export interface IUser {
  userId: string;
  email: string;
  passwordHash: string;
  name: string;
  role: UserRole;
  assignedSiteIds?: string[];
  companyName?: string;
  phone?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

const UserSchema = new Schema<IUser>(
  {
    userId: { type: String, required: true, unique: true, index: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    passwordHash: { type: String, required: true },
    name: { type: String, required: true, trim: true },
    role: {
      type: String,
      enum: ['CUSTOMER', 'ADMIN', 'RENTAL_MANAGER', 'SITE_MANAGER', 'OPERATOR'],
      default: 'CUSTOMER',
      required: true,
      index: true,
    },
    assignedSiteIds: { type: [String], default: [] },
    companyName: { type: String, default: '' },
    phone: { type: String, default: '' },
  },
  { timestamps: true }
);

export const User = mongoose.model<IUser>('User', UserSchema);
