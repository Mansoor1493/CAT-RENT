import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import api from '@/services/api';
import { useStore } from '@/store/useStore';
import { Equipment, Site, Rental, RentalRequest, ExtensionRequest, EquipmentType } from '@/types';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import {
  Truck,
  FileText,
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
  Plus,
  ArrowRight,
  MapPin,
  DollarSign,
  Building2,
  Gauge,
  Sparkles,
  RotateCcw,
  Search,
  Filter,
  ShieldCheck,
  Send,
  XCircle,
  Briefcase,
  QrCode,
} from 'lucide-react';
import { formatNumber } from '@/lib/utils';
import QRCodeModal from '@/components/common/QRCodeModal';

export default function CustomerDashboardPage() {
  const queryClient = useQueryClient();
  const user = useStore((state) => state.user);

  // Modals
  const [requestModalOpen, setRequestModalOpen] = useState(false);
  const [extensionModalOpen, setExtensionModalOpen] = useState(false);
  const [selectedRentalForExt, setSelectedRentalForExt] = useState<Rental | null>(null);
  const [selectedEquipmentForQR, setSelectedEquipmentForQR] = useState<Equipment | null>(null);

  // New Rental Request Form State
  const [selectedEquipmentId, setSelectedEquipmentId] = useState('');
  const [selectedSiteId, setSelectedSiteId] = useState('S002');
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
  });
  const [returnDate, setReturnDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().split('T')[0];
  });
  const [purpose, setPurpose] = useState('Commercial Site Operations');
  const [notes, setNotes] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  // Extension Form State
  const [extReturnDate, setExtReturnDate] = useState('');
  const [extReason, setExtReason] = useState('Project schedule extended');
  const [extError, setExtError] = useState<string | null>(null);

  // Equipment Category Filter
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Queries
  const { data: myRequestsData } = useQuery<{ success: boolean; data: RentalRequest[] }>({
    queryKey: ['my-rental-requests'],
    queryFn: async () => (await api.get('/rental-requests')).data,
    refetchInterval: 10000,
  });

  const { data: myRentalsData } = useQuery<{ success: boolean; data: Rental[] }>({
    queryKey: ['my-active-rentals'],
    queryFn: async () => (await api.get('/rentals')).data,
    refetchInterval: 10000,
  });

  const { data: allEquipmentData } = useQuery<{ success: boolean; data: Equipment[] }>({
    queryKey: ['fleet-all-equipment'],
    queryFn: async () => (await api.get('/equipment?limit=100')).data,
  });

  const { data: sitesData } = useQuery<{ success: boolean; data: Site[] }>({
    queryKey: ['sites-list'],
    queryFn: async () => (await api.get('/sites')).data,
  });

  const requests = myRequestsData?.data || [];
  const allRentals = myRentalsData?.data || [];
  // Filter rentals belonging to current customer
  const myRentals = allRentals.filter(
    (r) => !r.customerId || r.customerId === user?.userId || r.customerName?.includes(user?.name?.split(' ')[0] || '')
  );
  const fleet = allEquipmentData?.data || [];
  const sites = sitesData?.data || [];

  // Available machinery for browsing/requesting
  const availableFleet = fleet.filter((f) => f.status === 'AVAILABLE');
  const filteredAvailable = availableFleet.filter((item) => {
    const matchesCat = categoryFilter === 'ALL' || item.type === categoryFilter;
    const matchesSearch =
      item.model.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.equipmentId.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCat && matchesSearch;
  });

  // Selected Machine in Request Form
  const selectedEquipment = fleet.find((f) => f.equipmentId === selectedEquipmentId) || availableFleet[0];

  // Estimated Cost Calculator
  const calculateEstimatedCost = () => {
    if (!selectedEquipment) return 0;
    const start = new Date(startDate);
    const end = new Date(returnDate);
    const diffTime = end.getTime() - start.getTime();
    const diffDays = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
    return Math.round(diffDays * 8 * selectedEquipment.hourlyRate);
  };

  // Submit Rental Request Mutation
  const requestMutation = useMutation({
    mutationFn: async () => {
      setFormError(null);
      return (
        await api.post('/rental-requests', {
          equipmentId: selectedEquipmentId || availableFleet[0]?.equipmentId,
          siteId: selectedSiteId,
          startDate,
          expectedReturnDate: returnDate,
          purpose,
          notes,
        })
      ).data;
    },
    onSuccess: (data) => {
      setFormSuccess(`Rental request ${data?.data?.requestId} submitted successfully! Status is PENDING APPROVAL.`);
      setRequestModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ['my-rental-requests'] });
    },
    onError: (err: any) => {
      setFormError(err.response?.data?.message || err.message || 'Failed to submit rental request');
    },
  });

  // Cancel Request Mutation
  const cancelMutation = useMutation({
    mutationFn: async (requestId: string) => {
      return (await api.post(`/rental-requests/${requestId}/cancel`)).data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-rental-requests'] });
    },
  });

  // Submit Extension Mutation
  const extensionMutation = useMutation({
    mutationFn: async () => {
      if (!selectedRentalForExt) return;
      setExtError(null);
      return (
        await api.post('/extension-requests', {
          rentalId: selectedRentalForExt.rentalId,
          requestedReturnDate: extReturnDate,
          reason: extReason,
        })
      ).data;
    },
    onSuccess: () => {
      setExtensionModalOpen(false);
      setFormSuccess('Extension request submitted! Awaiting administrator approval.');
      queryClient.invalidateQueries({ queryKey: ['my-active-rentals'] });
    },
    onError: (err: any) => {
      setExtError(err.response?.data?.message || err.message || 'Failed to submit extension request');
    },
  });

  const pendingRequestsCount = requests.filter((r) => r.status === 'PENDING_APPROVAL').length;
  const activeRentalsCount = myRentals.filter((r) => ['ACTIVE', 'RENTED', 'OVERDUE'].includes(r.status)).length;

  const openRequestModalWithMachine = (eqId: string) => {
    setSelectedEquipmentId(eqId);
    setFormError(null);
    setRequestModalOpen(true);
  };

  const openExtensionModal = (rental: Rental) => {
    setSelectedRentalForExt(rental);
    const base = new Date(rental.expectedReturnDate);
    base.setDate(base.getDate() + 7);
    setExtReturnDate(base.toISOString().split('T')[0]);
    setExtReason('Project scope extension (+7 Days)');
    setExtError(null);
    setExtensionModalOpen(true);
  };

  return (
    <div className="space-y-6 pb-12 max-w-7xl mx-auto">
      {/* Customer Header Banner */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-neutral-900 via-neutral-950 to-neutral-900 border-2 border-cat-yellow/40 shadow-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-cat-yellow animate-pulse" />
            <span className="text-xs font-mono font-bold text-cat-yellow uppercase tracking-wider">
              Customer Operations Portal
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-foreground">
            Welcome, {user?.name || 'Authorized Customer'}
          </h1>
          <p className="text-xs text-muted-foreground">
            {user?.companyName || 'Enterprise Contractor Client'} • Account ID:{' '}
            <span className="font-mono text-foreground font-bold">{user?.userId || 'USR-CUST-001'}</span>
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="cat"
            size="sm"
            onClick={() => {
              if (availableFleet.length > 0 && !selectedEquipmentId) {
                setSelectedEquipmentId(availableFleet[0].equipmentId);
              }
              setRequestModalOpen(true);
            }}
            className="font-black text-xs h-10 px-4 gap-2 shadow-xl shadow-cat-yellow/10"
          >
            <Plus className="h-4 w-4" /> Request Machine Rental
          </Button>
        </div>
      </div>

      {/* Global Success / Error Feedback */}
      {formSuccess && (
        <div className="p-4 bg-emerald-500/15 border-2 border-emerald-500/50 rounded-xl text-xs font-bold text-emerald-400 flex items-center justify-between shadow-lg">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-emerald-400 flex-shrink-0" />
            <span>{formSuccess}</span>
          </div>
          <button onClick={() => setFormSuccess(null)} className="text-muted-foreground hover:text-foreground">
            ✕
          </button>
        </div>
      )}

      {/* 4 Customer KPI Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-l-4 border-l-cat-yellow bg-card/60">
          <CardContent className="p-4">
            <div className="flex items-center justify-between text-muted-foreground text-xs font-semibold uppercase">
              <span>Available Machines</span>
              <Truck className="h-4 w-4 text-cat-yellow" />
            </div>
            <div className="mt-2 text-2xl font-black font-mono text-foreground">{availableFleet.length} units</div>
            <p className="text-[10px] text-muted-foreground mt-1">Ready for immediate field dispatch</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-amber-500 bg-card/60">
          <CardContent className="p-4">
            <div className="flex items-center justify-between text-amber-400 text-xs font-semibold uppercase">
              <span>Pending Approvals</span>
              <Clock className="h-4 w-4 text-amber-500" />
            </div>
            <div className="mt-2 text-2xl font-black font-mono text-amber-400">{pendingRequestsCount}</div>
            <p className="text-[10px] text-muted-foreground mt-1">Under review by CatRent admin</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-blue-500 bg-card/60">
          <CardContent className="p-4">
            <div className="flex items-center justify-between text-blue-400 text-xs font-semibold uppercase">
              <span>My Active Rentals</span>
              <CheckCircle2 className="h-4 w-4 text-blue-500" />
            </div>
            <div className="mt-2 text-2xl font-black font-mono text-blue-400">{activeRentalsCount}</div>
            <p className="text-[10px] text-muted-foreground mt-1">Operating on project sites</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-emerald-500 bg-card/60">
          <CardContent className="p-4">
            <div className="flex items-center justify-between text-emerald-400 text-xs font-semibold uppercase">
              <span>Total Fleet Categories</span>
              <ShieldCheck className="h-4 w-4 text-emerald-500" />
            </div>
            <div className="mt-2 text-2xl font-black font-mono text-emerald-500">7 Classes</div>
            <p className="text-[10px] text-muted-foreground mt-1">Excavators, Dozers, Loaders, Cranes...</p>
          </CardContent>
        </Card>
      </div>

      {/* SECTION 1: MY RENTAL REQUESTS */}
      <Card className="border-2 border-border shadow-xl">
        <CardHeader className="pb-3 border-b border-border flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base font-black flex items-center gap-2">
              <FileText className="h-5 w-5 text-cat-yellow" />
              My Submitted Rental Requests
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              Track status of equipment rental requests submitted to CatRent administration.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setRequestModalOpen(true)}
            className="h-8 text-xs font-bold gap-1 text-cat-yellow"
          >
            <Plus className="h-3.5 w-3.5" /> New Request
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/40 border-b border-border text-muted-foreground">
                <tr>
                  <th className="p-3.5 font-bold">Request ID</th>
                  <th className="p-3.5 font-bold">Requested Machine</th>
                  <th className="p-3.5 font-bold">Target Site</th>
                  <th className="p-3.5 font-bold">Start Date</th>
                  <th className="p-3.5 font-bold">Return Date</th>
                  <th className="p-3.5 font-bold">Estimated Cost</th>
                  <th className="p-3.5 font-bold">Status</th>
                  <th className="p-3.5 font-bold text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {requests.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-muted-foreground">
                      You have not submitted any rental requests yet. Click "+ Request Machine Rental" to get started!
                    </td>
                  </tr>
                ) : (
                  requests.map((req) => (
                    <tr key={req.requestId} className="hover:bg-muted/30 transition-colors">
                      <td className="p-3.5 font-mono font-bold text-cat-yellow">{req.requestId}</td>
                      <td className="p-3.5">
                        <div className="font-bold text-foreground">{req.equipment?.model || req.equipmentId}</div>
                        <div className="text-[10px] text-muted-foreground font-mono">{req.equipmentId}</div>
                      </td>
                      <td className="p-3.5">
                        <div className="font-bold text-foreground">{req.site?.name || req.siteId}</div>
                        <div className="text-[10px] text-muted-foreground font-mono">{req.siteId}</div>
                      </td>
                      <td className="p-3.5 text-muted-foreground font-mono">
                        {new Date(req.startDate).toLocaleDateString()}
                      </td>
                      <td className="p-3.5 text-foreground font-semibold font-mono">
                        {new Date(req.expectedReturnDate).toLocaleDateString()}
                      </td>
                      <td className="p-3.5 font-mono font-bold text-cat-yellow">
                        ${formatNumber(req.estimatedCost)}
                      </td>
                      <td className="p-3.5">
                        <Badge
                          variant={
                            req.status === 'APPROVED'
                              ? 'available'
                              : req.status === 'PENDING_APPROVAL'
                              ? 'idle'
                              : req.status === 'REJECTED'
                              ? 'destructive'
                              : 'secondary'
                          }
                          className="font-bold text-[10px]"
                        >
                          {req.status.replace('_', ' ')}
                        </Badge>
                        {req.status === 'REJECTED' && req.rejectionReason && (
                          <div className="text-[9px] text-red-400 mt-1 max-w-[200px] truncate" title={req.rejectionReason}>
                            Reason: {req.rejectionReason}
                          </div>
                        )}
                        {req.status === 'APPROVED' && req.rentalId && (
                          <div className="text-[9px] text-emerald-400 font-mono mt-0.5">Agreement: {req.rentalId}</div>
                        )}
                      </td>
                      <td className="p-3.5 text-right">
                        {req.status === 'PENDING_APPROVAL' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => cancelMutation.mutate(req.requestId)}
                            disabled={cancelMutation.isPending}
                            className="h-7 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10"
                          >
                            Cancel
                          </Button>
                        )}
                        {req.status === 'APPROVED' && (
                          <Link to="/rentals">
                            <Button variant="ghost" size="sm" className="h-7 text-xs text-cat-yellow">
                              View Agreement →
                            </Button>
                          </Link>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* SECTION 2: MY ACTIVE RENTALS & EXTENSION REQUESTS */}
      <Card className="border-2 border-border shadow-xl">
        <CardHeader className="pb-3 border-b border-border">
          <CardTitle className="text-base font-black flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-emerald-400" />
            My Active Deployed Rentals
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-0.5">
            Machinery currently active on job sites with 1-click contract extension requests.
          </p>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/40 border-b border-border text-muted-foreground">
                <tr>
                  <th className="p-3.5 font-bold">Rental ID</th>
                  <th className="p-3.5 font-bold">Equipment Asset</th>
                  <th className="p-3.5 font-bold">Assigned Site</th>
                  <th className="p-3.5 font-bold">Checkout Date</th>
                  <th className="p-3.5 font-bold">Return Milestone</th>
                  <th className="p-3.5 font-bold">Status</th>
                  <th className="p-3.5 font-bold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {myRentals.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-muted-foreground">
                      No active rentals currently deployed. Submit a rental request above to dispatch equipment!
                    </td>
                  </tr>
                ) : (
                  myRentals.map((rental) => (
                    <tr key={rental.rentalId} className="hover:bg-muted/30 transition-colors">
                      <td className="p-3.5 font-mono font-bold text-cat-yellow">{rental.rentalId}</td>
                      <td className="p-3.5">
                        <Link to={`/equipment/${rental.equipmentId}`} className="hover:underline font-bold text-foreground">
                          {rental.equipment?.model || rental.equipmentId}
                        </Link>
                        <div className="text-[10px] text-muted-foreground font-mono">{rental.equipmentId}</div>
                      </td>
                      <td className="p-3.5 font-medium">{rental.site?.name || rental.siteId}</td>
                      <td className="p-3.5 text-muted-foreground font-mono">
                        {new Date(rental.checkoutDate).toLocaleDateString()}
                      </td>
                      <td className="p-3.5 font-bold font-mono text-foreground">
                        <span className={rental.status === 'OVERDUE' ? 'text-red-400 font-bold' : ''}>
                          {new Date(rental.expectedReturnDate).toLocaleDateString()}
                        </span>
                      </td>
                      <td className="p-3.5">
                        <Badge
                          variant={
                            rental.status === 'ACTIVE'
                              ? 'active'
                              : rental.status === 'OVERDUE'
                              ? 'overdue'
                              : 'secondary'
                          }
                          className="font-bold text-[10px]"
                        >
                          {rental.status}
                        </Badge>
                        {rental.extensionCount > 0 && (
                          <div className="text-[9px] text-amber-400 font-mono mt-0.5">
                            +{rental.extensionCount}x Extended
                          </div>
                        )}
                      </td>
                      <td className="p-3.5 text-right">
                        {['ACTIVE', 'OVERDUE'].includes(rental.status) && (
                          <Button
                            variant="cat"
                            size="sm"
                            onClick={() => openExtensionModal(rental)}
                            className="h-7 text-xs font-bold gap-1"
                          >
                            <RotateCcw className="h-3 w-3" /> Request Extension
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* SECTION 3: BROWSE AVAILABLE FLEET CATALOG */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-black text-foreground flex items-center gap-2">
              <Truck className="h-5 w-5 text-cat-yellow" />
              Available Caterpillar Fleet Catalog
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Browse ready machines and click "Request Rental" to pre-fill your application.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="h-3.5 w-3.5 absolute left-2.5 top-2.5 text-muted-foreground" />
              <Input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search models..."
                className="h-8 pl-8 text-xs w-44 bg-background"
              />
            </div>
          </div>
        </div>

        {/* Category Filter Pills */}
        <div className="flex flex-wrap gap-1.5">
          {['ALL', 'Excavator', 'Loader', 'Dozer', 'Crane', 'Dump Truck', 'Grader', 'Compactor'].map((cat) => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                categoryFilter === cat
                  ? 'bg-cat-yellow text-cat-black shadow-md'
                  : 'bg-neutral-900 border border-neutral-800 text-muted-foreground hover:text-foreground'
              }`}
            >
              {cat === 'ALL' ? 'All Classes' : cat}
            </button>
          ))}
        </div>

        {/* Grid of Available Machines */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredAvailable.slice(0, 9).map((asset) => (
            <Card key={asset.equipmentId} className="border border-border hover:border-cat-yellow/60 transition-all">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-bold text-cat-yellow">{asset.equipmentId}</span>
                  <div className="flex items-center gap-1.5">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedEquipmentForQR(asset)}
                      className="h-6 w-6 p-0 text-cat-yellow hover:bg-cat-yellow/10"
                      title="View & Download QR Code"
                    >
                      <QrCode className="h-3.5 w-3.5" />
                    </Button>
                    <Badge variant="available" className="text-[9px] font-bold">
                      AVAILABLE
                    </Badge>
                  </div>
                </div>

                <div>
                  <h3 className="font-bold text-sm text-foreground">{asset.model}</h3>
                  <p className="text-xs text-muted-foreground">{asset.type} • Serial: {asset.serialNumber}</p>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center p-2 rounded-lg bg-muted/40 border border-border text-[11px]">
                  <div>
                    <span className="text-muted-foreground text-[9px] uppercase">Rate</span>
                    <div className="font-black font-mono text-cat-yellow">${asset.hourlyRate}/hr</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-[9px] uppercase">Health</span>
                    <div className="font-bold text-emerald-400">{asset.healthScore}%</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-[9px] uppercase">Fuel</span>
                    <div className="font-mono font-bold text-foreground">{asset.fuelLevel}%</div>
                  </div>
                </div>

                <Button
                  variant="cat"
                  size="sm"
                  onClick={() => openRequestModalWithMachine(asset.equipmentId)}
                  className="w-full font-bold text-xs h-8 gap-1.5 shadow-md"
                >
                  <Send className="h-3.5 w-3.5" /> Request Rental
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* MODAL 1: SUBMIT NEW RENTAL REQUEST */}
      <Dialog open={requestModalOpen} onOpenChange={setRequestModalOpen}>
        <DialogClose onClose={() => setRequestModalOpen(false)} />
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-black text-lg">
            <Truck className="h-5 w-5 text-cat-yellow" />
            Submit Equipment Rental Request
          </DialogTitle>
          <DialogDescription>
            Select machinery, operational dates, and target project site. Submission will be routed to CatRent admins for approval.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 text-xs">
          {formError && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-xs text-red-400 font-bold flex items-center gap-2">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          {/* Machine Picker */}
          <div>
            <label className="font-bold text-foreground uppercase text-[11px] flex items-center gap-1.5">
              <Truck className="h-3.5 w-3.5 text-cat-yellow" />
              Select Machinery *
            </label>
            <select
              value={selectedEquipmentId}
              onChange={(e) => setSelectedEquipmentId(e.target.value)}
              className="mt-1.5 h-9 w-full rounded-lg border border-border bg-background px-3 text-xs font-bold text-foreground focus:ring-2 focus:ring-cat-yellow"
            >
              {availableFleet.map((f) => (
                <option key={f.equipmentId} value={f.equipmentId}>
                  {f.equipmentId} • {f.model} ({f.type} - ${f.hourlyRate}/hr)
                </option>
              ))}
            </select>
          </div>

          {/* Site Picker */}
          <div>
            <label className="font-bold text-foreground uppercase text-[11px] flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5 text-cat-yellow" />
              Project Destination Site *
            </label>
            <select
              value={selectedSiteId}
              onChange={(e) => setSelectedSiteId(e.target.value)}
              className="mt-1.5 h-9 w-full rounded-lg border border-border bg-background px-3 text-xs font-bold text-foreground focus:ring-2 focus:ring-cat-yellow"
            >
              {sites.map((s) => (
                <option key={s.siteId} value={s.siteId}>
                  {s.siteId}: {s.name} ({s.address})
                </option>
              ))}
            </select>
          </div>

          {/* Operational Dates */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-bold text-foreground uppercase text-[11px] flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5 text-cat-yellow" /> Start Date *
              </label>
              <Input
                type="date"
                min={new Date().toISOString().split('T')[0]}
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="mt-1 font-mono font-bold text-xs"
              />
            </div>

            <div>
              <label className="font-bold text-foreground uppercase text-[11px] flex items-center gap-1">
                <Clock className="h-3.5 w-3.5 text-cat-yellow" /> Expected Return Date *
              </label>
              <Input
                type="date"
                min={startDate}
                value={returnDate}
                onChange={(e) => setReturnDate(e.target.value)}
                className="mt-1 font-mono font-bold text-xs"
              />
            </div>
          </div>

          {/* Purpose & Notes */}
          <div>
            <label className="font-bold text-foreground uppercase text-[11px]">
              Purpose / Work Scope
            </label>
            <Input
              type="text"
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              placeholder="e.g. Highway foundation grading phase 2"
              className="mt-1 text-xs"
            />
          </div>

          <div>
            <label className="font-bold text-foreground uppercase text-[11px]">
              Special Attachment Notes
            </label>
            <Input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Dual-tilt bucket or high-flow hydraulics required"
              className="mt-1 text-xs"
            />
          </div>

          {/* Dynamic Billing Estimate Preview */}
          <div className="p-3.5 bg-neutral-950 rounded-xl border border-border flex items-center justify-between">
            <div>
              <span className="text-muted-foreground text-xs">Estimated Cost (8 hrs/day):</span>
              <div className="text-[10px] text-muted-foreground">
                ${selectedEquipment?.hourlyRate || 140}/hr base rate
              </div>
            </div>
            <div className="font-black font-mono text-lg text-cat-yellow">
              ${formatNumber(calculateEstimatedCost())}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => setRequestModalOpen(false)}>
            Cancel
          </Button>
          <Button
            variant="cat"
            size="sm"
            onClick={() => requestMutation.mutate()}
            disabled={requestMutation.isPending}
            className="font-bold gap-2 shadow-lg"
          >
            {requestMutation.isPending ? 'Submitting...' : 'Confirm & Submit Request'}
          </Button>
        </DialogFooter>
      </Dialog>

      {/* MODAL 2: REQUEST EXTENSION */}
      <Dialog open={extensionModalOpen} onOpenChange={setExtensionModalOpen}>
        <DialogClose onClose={() => setExtensionModalOpen(false)} />
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-black text-lg">
            <RotateCcw className="h-5 w-5 text-cat-yellow" />
            Request Rental Agreement Extension
          </DialogTitle>
          <DialogDescription>
            Submit an extension request for {selectedRentalForExt?.equipment?.model || selectedRentalForExt?.equipmentId}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 text-xs">
          {extError && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-xs text-red-400 font-bold">
              {extError}
            </div>
          )}

          <div className="p-3 bg-muted/40 rounded-lg border border-border space-y-1">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Rental Agreement:</span>
              <span className="font-mono font-bold text-cat-yellow">{selectedRentalForExt?.rentalId}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Current Return Date:</span>
              <span className="font-mono font-bold">
                {selectedRentalForExt ? new Date(selectedRentalForExt.expectedReturnDate).toLocaleDateString() : ''}
              </span>
            </div>
          </div>

          <div>
            <label className="font-bold text-foreground flex items-center gap-1 text-[11px] uppercase">
              <Calendar className="h-3.5 w-3.5 text-cat-yellow" /> New Extended Return Date *
            </label>
            <Input
              type="date"
              value={extReturnDate}
              onChange={(e) => setExtReturnDate(e.target.value)}
              className="mt-1 font-mono font-bold"
            />
          </div>

          <div>
            <label className="font-bold text-foreground text-[11px] uppercase">
              Reason for Extension
            </label>
            <Input
              type="text"
              value={extReason}
              onChange={(e) => setExtReason(e.target.value)}
              placeholder="e.g. Unforeseen weather delay or site expansion"
              className="mt-1 text-xs"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => setExtensionModalOpen(false)}>
            Cancel
          </Button>
          <Button
            variant="cat"
            size="sm"
            onClick={() => extensionMutation.mutate()}
            disabled={extensionMutation.isPending}
            className="font-bold"
          >
            {extensionMutation.isPending ? 'Submitting...' : 'Submit Extension Request'}
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
