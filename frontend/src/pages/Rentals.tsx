import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import api from '@/services/api';
import { Rental, Equipment, Operator, Site } from '@/types';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  FileText,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Plus,
  Calendar,
  Search,
  ExternalLink,
  DollarSign,
  User,
  MapPin,
  ChevronRight,
  RotateCcw,
  Gauge,
  Fuel,
  ShieldCheck,
  Building2,
  RefreshCw,
  Truck,
  QrCode,
} from 'lucide-react';
import { formatNumber } from '@/lib/utils';
import QRCodeModal from '@/components/common/QRCodeModal';

export default function RentalsPage() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<'ACTIVE' | 'OVERDUE' | 'COMPLETED' | 'ALL'>('ACTIVE');
  const [searchTerm, setSearchTerm] = useState('');
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Extension Modal
  const [extendOpen, setExtendOpen] = useState(false);
  const [selectedRental, setSelectedRental] = useState<Rental | null>(null);
  const [selectedEquipmentForQR, setSelectedEquipmentForQR] = useState<Equipment | null>(null);
  const [newReturnDate, setNewReturnDate] = useState('');

  // In-Page Return / Check-In Modal
  const [checkinOpen, setCheckinOpen] = useState(false);
  const [selectedCheckinRental, setSelectedCheckinRental] = useState<Rental | null>(null);
  const [checkinHours, setCheckinHours] = useState<number>(0);
  const [checkinFuel, setCheckinFuel] = useState<number>(85);
  const [checkinCondition, setCheckinCondition] = useState<'GOOD' | 'DAMAGED'>('GOOD');
  const [checkinNotes, setCheckinNotes] = useState('Shift complete. Standard field return inspection passed.');

  const { data: rentalsData, isLoading } = useQuery<{ success: boolean; data: Rental[] }>({
    queryKey: ['rentals-list'],
    queryFn: async () => (await api.get('/rentals?limit=100')).data,
    refetchInterval: 15000,
  });

  const extendMutation = useMutation({
    mutationFn: async () => {
      if (!selectedRental) return;
      return (
        await api.post(`/rentals/${selectedRental.rentalId}/extend`, {
          newReturnDate,
        })
      ).data;
    },
    onSuccess: () => {
      setExtendOpen(false);
      queryClient.invalidateQueries({ queryKey: ['rentals-list'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-kpis'] });
    },
  });

  const checkinMutation = useMutation({
    mutationFn: async () => {
      if (!selectedCheckinRental) return;
      return (
        await api.post('/rentals/checkin', {
          rentalId: selectedCheckinRental.rentalId,
          checkinEngineHours: checkinHours,
          checkinFuelLevel: checkinFuel,
          condition: checkinCondition,
          notes: checkinNotes,
        })
      ).data;
    },
    onSuccess: () => {
      setCheckinOpen(false);
      queryClient.invalidateQueries({ queryKey: ['rentals-list'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-kpis'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-equipment'] });
      queryClient.invalidateQueries({ queryKey: ['fleet-all-equipment'] });
    },
  });

  const rentals = rentalsData?.data || [];

  const filtered = rentals.filter((r) => {
    const matchesTab =
      tab === 'ALL'
        ? true
        : tab === 'ACTIVE'
        ? ['ACTIVE', 'RENTED'].includes(r.status)
        : tab === 'OVERDUE'
        ? r.status === 'OVERDUE'
        : r.status === 'COMPLETED';

    const matchesSearch =
      r.rentalId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.equipmentId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (r.customerName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (r.equipment?.model || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (r.operator?.name || '').toLowerCase().includes(searchTerm.toLowerCase());

    return matchesTab && matchesSearch;
  });

  const overdueCount = rentals.filter((r) => r.status === 'OVERDUE').length;
  const activeCount = rentals.filter((r) => ['ACTIVE', 'RENTED'].includes(r.status)).length;
  const completedCount = rentals.filter((r) => r.status === 'COMPLETED').length;

  const openCheckinModal = (rental: Rental) => {
    setSelectedCheckinRental(rental);
    const currHours = rental.equipment?.engineHours || rental.checkoutEngineHours || 0;
    setCheckinHours(currHours + 8);
    setCheckinFuel(Math.max(10, (rental.equipment?.fuelLevel || 90) - 15));
    setCheckinCondition('GOOD');
    setCheckinNotes('Shift complete. Standard field return inspection passed.');
    setCheckinOpen(true);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border pb-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-foreground">Rental Lifecycle Agreements</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Track active machinery checkouts, monitor return milestones, and process extensions or returns.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link to="/qr-scanner">
            <Button variant="cat" size="sm" className="gap-2 font-bold shadow-lg">
              <Plus className="h-4 w-4" />
              New Rental Check-Out (QR / RFID)
            </Button>
          </Link>
        </div>
      </div>

      {/* Metric Tabs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card
          className={`cursor-pointer transition-all border-2 ${
            tab === 'ACTIVE' ? 'border-cat-yellow bg-cat-yellow/5 font-bold' : 'hover:border-border'
          }`}
          onClick={() => setTab('ACTIVE')}
        >
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <div className="text-xs font-semibold text-muted-foreground uppercase">Active Rentals</div>
              <div className="text-2xl font-black text-foreground mt-1">{activeCount}</div>
            </div>
            <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-500">
              <CheckCircle2 className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card
          className={`cursor-pointer transition-all border-2 ${
            tab === 'OVERDUE' ? 'border-red-500 bg-red-500/5 font-bold' : 'hover:border-border'
          }`}
          onClick={() => setTab('OVERDUE')}
        >
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <div className="text-xs font-semibold text-red-400 uppercase">Overdue Returns</div>
              <div className="text-2xl font-black text-red-500 mt-1">{overdueCount}</div>
            </div>
            <div className="h-10 w-10 rounded-lg bg-red-500/10 flex items-center justify-center text-red-500">
              <Clock className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card
          className={`cursor-pointer transition-all border-2 ${
            tab === 'COMPLETED' ? 'border-emerald-500 bg-emerald-500/5 font-bold' : 'hover:border-border'
          }`}
          onClick={() => setTab('COMPLETED')}
        >
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <div className="text-xs font-semibold text-emerald-400 uppercase">Completed History</div>
              <div className="text-2xl font-black text-foreground mt-1">{completedCount}</div>
            </div>
            <div className="h-10 w-10 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-500">
              <FileText className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search by rental ID, contractor/customer, equipment model, operator name..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="h-9 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-xs focus:outline-none focus:ring-2 focus:ring-cat-yellow font-medium"
        />
      </div>

      {/* Rentals Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/40 border-b border-border">
                <tr className="text-muted-foreground">
                  <th className="p-3.5 font-bold">Rental ID</th>
                  <th className="p-3.5 font-bold">Equipment Asset</th>
                  <th className="p-3.5 font-bold">Contractor / Customer</th>
                  <th className="p-3.5 font-bold">Status</th>
                  <th className="p-3.5 font-bold">Assigned Operator</th>
                  <th className="p-3.5 font-bold">Site</th>
                  <th className="p-3.5 font-bold">Checkout Date</th>
                  <th className="p-3.5 font-bold">Expected Return</th>
                  <th className="p-3.5 font-bold">Hours / Billed</th>
                  <th className="p-3.5 font-bold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((rental) => (
                  <tr key={rental.rentalId} className="hover:bg-muted/40 transition-colors">
                    {/* Rental ID */}
                    <td className="p-3.5 font-mono font-bold text-cat-yellow">
                      <div>{rental.rentalId}</div>
                      {rental.poNumber && (
                        <div className="text-[10px] text-muted-foreground font-mono">{rental.poNumber}</div>
                      )}
                    </td>

                    {/* Equipment Asset */}
                    <td className="p-3.5">
                      <Link to={`/equipment/${rental.equipmentId}`} className="group block">
                        <div className="font-bold text-foreground group-hover:text-cat-yellow">
                          {rental.equipment?.model || rental.equipmentId}
                        </div>
                        <div className="font-mono text-[10px] text-muted-foreground">
                          {rental.equipmentId} • {rental.equipment?.type}
                        </div>
                      </Link>
                    </td>

                    {/* Contractor / Customer */}
                    <td className="p-3.5">
                      <div className="font-bold text-foreground">
                        {rental.customerName || 'Kiewit Infrastructure Corp'}
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        {rental.contactPerson || 'Site Superintendent'}
                      </div>
                    </td>

                    {/* Status */}
                    <td className="p-3.5">
                      <Badge
                        variant={
                          rental.status === 'OVERDUE'
                            ? 'overdue'
                            : rental.status === 'ACTIVE'
                            ? 'active'
                            : 'secondary'
                        }
                      >
                        {rental.status}
                      </Badge>
                      {rental.extensionCount > 0 && (
                        <div className="text-[9px] text-amber-400 font-semibold mt-0.5">
                          Ext: +{rental.extensionCount}x
                        </div>
                      )}
                    </td>

                    {/* Operator */}
                    <td className="p-3.5">
                      <div className="flex items-center gap-1.5 font-medium">
                        <User className="h-3.5 w-3.5 text-muted-foreground" />
                        {rental.operator?.name || rental.operatorId}
                      </div>
                    </td>

                    {/* Site */}
                    <td className="p-3.5 font-medium text-muted-foreground">
                      {rental.site?.name || rental.siteId}
                    </td>

                    {/* Checkout Date */}
                    <td className="p-3.5 text-muted-foreground">
                      {new Date(rental.checkoutDate).toLocaleDateString()}
                    </td>

                    {/* Expected Return */}
                    <td className="p-3.5 font-semibold">
                      <span className={rental.status === 'OVERDUE' ? 'text-red-500 font-bold' : 'text-foreground'}>
                        {new Date(rental.expectedReturnDate).toLocaleDateString()}
                      </span>
                    </td>

                    {/* Billed Cost / Hours */}
                    <td className="p-3.5 font-mono">
                      {rental.status === 'COMPLETED' ? (
                        <span className="font-bold text-emerald-500">${formatNumber(rental.rentalCost || 0)}</span>
                      ) : (
                        <span className="text-muted-foreground">Active shift</span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="p-3.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            setSelectedEquipmentForQR(
                              rental.equipment || {
                                equipmentId: rental.equipmentId,
                                model: 'Caterpillar Asset',
                                type: 'Excavator',
                                status: rental.status as any,
                                serialNumber: `CAT-SER-${rental.equipmentId}`,
                                hourlyRate: 150,
                                engineHours: rental.checkoutEngineHours,
                                operatingHours: 0,
                                idleHours: 0,
                                fuelLevel: rental.checkoutFuelLevel,
                                healthScore: 95,
                                qrCode: `CATRENT:${rental.equipmentId}`,
                                siteId: rental.siteId,
                                operatorId: rental.operatorId,
                                lat: 0,
                                lng: 0,
                                yearManufactured: 2024,
                                _id: '',
                                createdAt: '',
                                updatedAt: '',
                              }
                            )
                          }
                          className="h-7 text-xs px-2 text-cat-yellow hover:bg-cat-yellow/10"
                          title="View & Download QR Code"
                        >
                          <QrCode className="h-3.5 w-3.5" />
                        </Button>
                        {['ACTIVE', 'OVERDUE'].includes(rental.status) && (
                          <>
                            <Button
                              variant="cat"
                              size="sm"
                              className="h-7 text-[11px] px-2 font-bold"
                              onClick={() => openCheckinModal(rental)}
                            >
                              <RotateCcw className="h-3 w-3 mr-1" /> Check-In
                            </Button>

                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 text-xs px-2"
                              onClick={() => {
                                setSelectedRental(rental);
                                const base = new Date(rental.expectedReturnDate);
                                base.setDate(base.getDate() + 7);
                                setNewReturnDate(base.toISOString().split('T')[0]);
                                setExtendOpen(true);
                              }}
                            >
                              Extend
                            </Button>
                          </>
                        )}
                        <Link to={`/equipment/${rental.equipmentId}`}>
                          <Button variant="ghost" size="sm" className="h-7 text-xs px-2 text-cat-yellow">
                            Inspect
                          </Button>
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Return / Check-In Modal */}
      <Dialog open={checkinOpen} onOpenChange={setCheckinOpen}>
        <DialogClose onClose={() => setCheckinOpen(false)} />
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base font-bold">
            <RotateCcw className="h-5 w-5 text-cat-yellow" />
            Process Field Return / Check-In ({selectedCheckinRental?.rentalId})
          </DialogTitle>
          <DialogDescription>
            Record shift completion, inspect condition, and finalize billing for {selectedCheckinRental?.equipment?.model || selectedCheckinRental?.equipmentId}.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 text-xs">
          <div className="p-3 bg-muted/40 rounded-lg border border-border space-y-1">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Contractor / Customer:</span>
              <span className="font-bold text-foreground">{selectedCheckinRental?.customerName || 'Kiewit Infrastructure'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Checkout Engine Hours:</span>
              <span className="font-mono font-bold">{formatNumber(selectedCheckinRental?.checkoutEngineHours || 0)}h</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-bold text-foreground flex items-center gap-1">
                <Gauge className="h-3.5 w-3.5 text-cat-yellow" /> Return Engine Hours *
              </label>
              <Input
                type="number"
                value={checkinHours}
                onChange={(e) => setCheckinHours(Number(e.target.value))}
                className="mt-1 font-mono font-bold"
              />
            </div>

            <div>
              <label className="font-bold text-foreground flex items-center gap-1">
                <Fuel className="h-3.5 w-3.5 text-cat-yellow" /> Return Fuel Level (%) *
              </label>
              <Input
                type="number"
                min="0"
                max="100"
                value={checkinFuel}
                onChange={(e) => setCheckinFuel(Number(e.target.value))}
                className="mt-1 font-mono font-bold"
              />
            </div>
          </div>

          <div>
            <label className="font-bold text-foreground">Post-Shift Inspection Condition *</label>
            <div className="grid grid-cols-2 gap-2 mt-1.5">
              <button
                type="button"
                onClick={() => setCheckinCondition('GOOD')}
                className={`p-2 rounded-lg border text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition-all ${
                  checkinCondition === 'GOOD'
                    ? 'border-emerald-500 bg-emerald-500/20 text-emerald-300'
                    : 'border-border bg-background text-muted-foreground hover:text-foreground'
                }`}
              >
                <ShieldCheck className="h-4 w-4" /> Good / Ready
              </button>

              <button
                type="button"
                onClick={() => setCheckinCondition('DAMAGED')}
                className={`p-2 rounded-lg border text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition-all ${
                  checkinCondition === 'DAMAGED'
                    ? 'border-amber-500 bg-amber-500/20 text-amber-300'
                    : 'border-border bg-background text-muted-foreground hover:text-foreground'
                }`}
              >
                <AlertTriangle className="h-4 w-4" /> Damaged / Review
              </button>
            </div>
          </div>

          <div>
            <label className="font-bold text-foreground">Return / Inspection Notes</label>
            <Input
              type="text"
              value={checkinNotes}
              onChange={(e) => setCheckinNotes(e.target.value)}
              className="mt-1 text-xs"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => setCheckinOpen(false)}>
            Cancel
          </Button>
          <Button
            variant="cat"
            size="sm"
            onClick={() => checkinMutation.mutate()}
            disabled={checkinMutation.isPending}
            className="font-bold gap-1"
          >
            {checkinMutation.isPending ? (
              <>
                <RefreshCw className="h-3.5 w-3.5 animate-spin" /> Finalizing Return...
              </>
            ) : (
              <>
                <CheckCircle2 className="h-3.5 w-3.5" /> Complete Field Check-In
              </>
            )}
          </Button>
        </DialogFooter>
      </Dialog>

      {/* Rental Extension Modal */}
      <Dialog open={extendOpen} onOpenChange={setExtendOpen}>
        <DialogClose onClose={() => setExtendOpen(false)} />
        <DialogHeader>
          <DialogTitle>Extend Rental Agreement ({selectedRental?.rentalId})</DialogTitle>
          <DialogDescription>
            Modify expected return milestone for {selectedRental?.equipment?.model || selectedRental?.equipmentId}.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 text-xs">
          <div>
            <label className="font-semibold text-foreground">Current Return Date</label>
            <div className="mt-1 font-mono text-muted-foreground">
              {selectedRental ? new Date(selectedRental.expectedReturnDate).toLocaleDateString() : ''}
            </div>
          </div>

          <div>
            <label className="font-semibold text-foreground">New Extended Return Date</label>
            <Input
              type="date"
              value={newReturnDate}
              onChange={(e) => setNewReturnDate(e.target.value)}
              className="mt-1.5"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => setExtendOpen(false)}>
            Cancel
          </Button>
          <Button
            variant="cat"
            size="sm"
            onClick={() => extendMutation.mutate()}
            disabled={extendMutation.isPending}
          >
            {extendMutation.isPending ? 'Extending...' : 'Confirm Extension (+7 Days)'}
          </Button>
        </DialogFooter>
      </Dialog>

      {/* Reusable QR Code Modal */}
      <QRCodeModal
        equipment={selectedEquipmentForQR}
        open={!!selectedEquipmentForQR}
        onClose={() => setSelectedEquipmentForQR(null)}
      />
    </div>
  );
}
