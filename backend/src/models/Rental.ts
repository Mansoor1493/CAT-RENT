import mongoose, { Schema } from 'mongoose';

export type RentalStatus = 'PENDING_APPROVAL' | 'APPROVED' | 'ACTIVE' | 'COMPLETED' | 'OVERDUE' | 'CANCELLED';

export interface IRental {
  rentalId: string;
  requestId?: string;
  customerId?: string;
  equipmentId: string;
  operatorId: string;
  siteId: string;
  startDate?: Date;
  checkoutDate: Date;
  expectedReturnDate: Date;
  actualReturnDate?: Date | null;
  status: RentalStatus;
  checkoutEngineHours: number;
  checkinEngineHours?: number | null;
  checkoutFuelLevel: number;
  checkinFuelLevel?: number | null;
  rentalCost?: number;
  extensionCount: number;
  checkinNotes?: string;
  customerName?: string;
  contactPerson?: string;
  poNumber?: string;
  checkedOutBy: string;
  checkedInBy?: string | null;
  approvedBy?: string | null;
  approvedAt?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}

const RentalSchema = new Schema<IRental>(
  {
    rentalId: { type: String, required: true, unique: true, index: true },
    requestId: { type: String, default: null, index: true },
    customerId: { type: String, default: null, index: true },
    equipmentId: { type: String, required: true, index: true },
    operatorId: { type: String, required: true, index: true },
    siteId: { type: String, required: true, index: true },
    startDate: { type: Date, default: Date.now },
    checkoutDate: { type: Date, required: true, default: Date.now },
    expectedReturnDate: { type: Date, required: true, index: true },
    actualReturnDate: { type: Date, default: null },
    status: {
      type: String,
      enum: ['PENDING_APPROVAL', 'APPROVED', 'ACTIVE', 'COMPLETED', 'OVERDUE', 'CANCELLED'],
      default: 'ACTIVE',
      index: true,
    },
    checkoutEngineHours: { type: Number, required: true, default: 0 },
    checkinEngineHours: { type: Number, default: null },
    checkoutFuelLevel: { type: Number, required: true, default: 100 },
    checkinFuelLevel: { type: Number, default: null },
    rentalCost: { type: Number, default: 0 },
    extensionCount: { type: Number, default: 0 },
    checkinNotes: { type: String, default: '' },
    customerName: { type: String, default: 'Kiewit Infrastructure Corp' },
    contactPerson: { type: String, default: 'David Miller (Site Superintendent)' },
    poNumber: { type: String, default: 'PO-2026-CAT-7740' },
    checkedOutBy: { type: String, required: true, default: 'ADMIN' },
    checkedInBy: { type: String, default: null },
    approvedBy: { type: String, default: null },
    approvedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

RentalSchema.index({ equipmentId: 1, status: 1 });
RentalSchema.index({ customerId: 1, status: 1 });
RentalSchema.index({ status: 1, expectedReturnDate: 1 });

export const Rental = mongoose.model<IRental>('Rental', RentalSchema);
