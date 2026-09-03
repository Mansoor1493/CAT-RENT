import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import api from '@/services/api';
import { RentalRequest, ExtensionRequest, Equipment, Site, Rental } from '@/types';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import {
  FileCheck2,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RotateCcw,
  Building2,
  Calendar,
  DollarSign,
  User,
  Truck,
  ArrowRight,
  ShieldCheck,
  Search,
  Filter,
  Check,
  Sparkles,
} from 'lucide-react';
import { formatNumber } from '@/lib/utils';

export default function RentalApprovalsPage() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<'REQUESTS' | 'EXTENSIONS' | 'HISTORY'>('REQUESTS');

  // Rejection Modals
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [selectedReqForReject, setSelectedReqForReject] = useState<RentalRequest | null>(null);
  const [rejectionReason, setRejectionReason] = useState('Equipment unavailable for requested dates');

  const [extRejectModalOpen, setExtRejectModalOpen] = useState(false);
  const [selectedExtForReject, setSelectedExtForReject] = useState<ExtensionRequest | null>(null);
  const [extRejectionReason, setExtRejectionReason] = useState('Machine allocated to scheduled subsequent deployment');

  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Queries
  const { data: requestsData, isLoading: reqLoading } = useQuery<{ success: boolean; data: RentalRequest[] }>({
    queryKey: ['admin-rental-requests'],
    queryFn: async () => (await api.get('/rental-requests')).data,
    refetchInterval: 10000,
  });

  const { data: extensionsData, isLoading: extLoading } = useQuery<{ success: boolean; data: ExtensionRequest[] }>({
    queryKey: ['admin-extension-requests'],
    queryFn: async () => (await api.get('/extension-requests')).data,
    refetchInterval: 10000,
  });

  const allRequests = requestsData?.data || [];
  const allExtensions = extensionsData?.data || [];

  const pendingRequests = allRequests.filter((r) => r.status === 'PENDING_APPROVAL');
  const pendingExtensions = allExtensions.filter((e) => e.status === 'PENDING_APPROVAL');
  const historyRequests = allRequests.filter((r) => r.status !== 'PENDING_APPROVAL');

  // Approve Rental Request Mutation
  const approveMutation = useMutation({
    mutationFn: async (requestId: string) => {
      setActionError(null);
      return (await api.post(`/rental-requests/${requestId}/approve`)).data;
    },
    onSuccess: (data) => {
      setActionSuccess(data.message || 'Rental request approved and contract activated!');
      queryClient.invalidateQueries({ queryKey: ['admin-rental-requests'] });
      queryClient.invalidateQueries({ queryKey: ['rentals-list'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-kpis'] });
      queryClient.invalidateQueries({ queryKey: ['fleet-all-equipment'] });
    },
    onError: (err: any) => {
      setActionError(err.response?.data?.message || err.message || 'Failed to approve request');
    },
  });

  // Reject Rental Request Mutation
  const rejectMutation = useMutation({
    mutationFn: async () => {
      if (!selectedReqForReject) return;
      setActionError(null);
      return (
        await api.post(`/rental-requests/${selectedReqForReject.requestId}/reject`, {
          rejectionReason,
        })
      ).data;
    },
    onSuccess: (data) => {
      setRejectModalOpen(false);
      setActionSuccess(data.message || 'Rental request rejected.');
      queryClient.invalidateQueries({ queryKey: ['admin-rental-requests'] });
    },
    onError: (err: any) => {
      setActionError(err.response?.data?.message || err.message || 'Failed to reject request');
    },
  });

  // Approve Extension Mutation
  const approveExtMutation = useMutation({
    mutationFn: async (extId: string) => {
      setActionError(null);
      return (await api.post(`/extension-requests/${extId}/approve`)).data;
    },
    onSuccess: (data) => {
      setActionSuccess(data.message || 'Rental extension approved!');
      queryClient.invalidateQueries({ queryKey: ['admin-extension-requests'] });
      queryClient.invalidateQueries({ queryKey: ['rentals-list'] });
    },
    onError: (err: any) => {
      setActionError(err.response?.data?.message || err.message || 'Failed to approve extension');
    },
  });

  // Reject Extension Mutation
  const rejectExtMutation = useMutation({
    mutationFn: async () => {
      if (!selectedExtForReject) return;
      setActionError(null);
      return (
        await api.post(`/extension-requests/${selectedExtForReject.extensionId}/reject`, {
          rejectionReason: extRejectionReason,
        })
      ).data;
    },
    onSuccess: (data) => {
      setExtRejectModalOpen(false);
      setActionSuccess(data.message || 'Extension request rejected.');
      queryClient.invalidateQueries({ queryKey: ['admin-extension-requests'] });
    },
    onError: (err: any) => {
      setActionError(err.response?.data?.message || err.message || 'Failed to reject extension');
    },
  });

  const openRejectModal = (req: RentalRequest) => {
    setSelectedReqForReject(req);
    setRejectionReason('Equipment booked for project priority or scheduled maintenance');
    setRejectModalOpen(true);
  };

  const openExtRejectModal = (ext: ExtensionRequest) => {
    setSelectedExtForReject(ext);
    setExtRejectionReason('Machine allocated to subsequent project deployment');
    setExtRejectModalOpen(true);
  };

  return (
    <div className="space-y-6 pb-12 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-black text-foreground">Rental & Extension Approvals</h1>
            <Badge variant="default" className="text-xs font-bold bg-cat-yellow text-cat-black">
              ADMIN CONTROL
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Review customer rental applications, verify equipment availability, and process contract extensions.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link to="/rentals">
            <Button variant="outline" size="sm" className="text-xs font-bold gap-1.5">
              <Building2 className="h-4 w-4 text-cat-yellow" /> Active Agreements
            </Button>
          </Link>
        </div>
      </div>

      {/* Global Alerts */}
      {actionSuccess && (
        <div className="p-4 bg-emerald-500/15 border-2 border-emerald-500/50 rounded-xl text-xs font-bold text-emerald-400 flex items-center justify-between shadow-lg">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-emerald-400 flex-shrink-0" />
            <span>{actionSuccess}</span>
          </div>
          <button onClick={() => setActionSuccess(null)} className="text-muted-foreground hover:text-foreground">
            ✕
          </button>
        </div>
      )}

      {actionError && (
        <div className="p-4 bg-red-500/15 border-2 border-red-500/50 rounded-xl text-xs font-bold text-red-400 flex items-center justify-between shadow-lg">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-400 flex-shrink-0" />
            <span>{actionError}</span>
          </div>
          <button onClick={() => setActionError(null)} className="text-muted-foreground hover:text-foreground">
            ✕
          </button>
        </div>
      )}

      {/* 4 Metric KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card
          className={`cursor-pointer transition-all border-2 ${
            tab === 'REQUESTS' ? 'border-cat-yellow bg-cat-yellow/5' : 'hover:border-border'
          }`}
          onClick={() => setTab('REQUESTS')}
        >
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <div className="text-xs font-semibold text-muted-foreground uppercase">Pending Rental Requests</div>
              <div className="text-2xl font-black text-cat-yellow mt-1">{pendingRequests.length}</div>
            </div>
            <div className="h-10 w-10 rounded-lg bg-cat-yellow/10 flex items-center justify-center text-cat-yellow">
              <Clock className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card
          className={`cursor-pointer transition-all border-2 ${
            tab === 'EXTENSIONS' ? 'border-blue-500 bg-blue-500/5' : 'hover:border-border'
          }`}
          onClick={() => setTab('EXTENSIONS')}
        >
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <div className="text-xs font-semibold text-blue-400 uppercase">Pending Extensions</div>
              <div className="text-2xl font-black text-blue-400 mt-1">{pendingExtensions.length}</div>
            </div>
            <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-400">
              <RotateCcw className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card
          className={`cursor-pointer transition-all border-2 ${
            tab === 'HISTORY' ? 'border-emerald-500 bg-emerald-500/5' : 'hover:border-border'
          }`}
          onClick={() => setTab('HISTORY')}
        >
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <div className="text-xs font-semibold text-emerald-400 uppercase">Approved Total</div>
              <div className="text-2xl font-black text-emerald-400 mt-1">
                {allRequests.filter((r) => r.status === 'APPROVED').length}
              </div>
            </div>
            <div className="h-10 w-10 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-500">
              <CheckCircle2 className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <div className="text-xs font-semibold text-red-400 uppercase">Rejected Total</div>
              <div className="text-2xl font-black text-red-400 mt-1">
                {allRequests.filter((r) => r.status === 'REJECTED').length}
              </div>
            </div>
            <div className="h-10 w-10 rounded-lg bg-red-500/10 flex items-center justify-center text-red-400">
              <XCircle className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* TAB 1: PENDING RENTAL REQUESTS */}
      {tab === 'REQUESTS' && (
        <Card className="border-2 border-border shadow-xl">
          <CardHeader className="pb-3 border-b border-border">
            <CardTitle className="text-base font-black flex items-center gap-2">
              <Clock className="h-5 w-5 text-cat-yellow" />
              Pending Customer Rental Requests ({pendingRequests.length})
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Authorize equipment reservations. Approving creates active rental contracts and assigns target project sites.
            </p>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/40 border-b border-border text-muted-foreground">
                  <tr>
                    <th className="p-3.5 font-bold">Request ID</th>
                    <th className="p-3.5 font-bold">Customer Organization</th>
                    <th className="p-3.5 font-bold">Requested Asset</th>
                    <th className="p-3.5 font-bold">Target Site</th>
                    <th className="p-3.5 font-bold">Rental Dates</th>
                    <th className="p-3.5 font-bold">Est. Cost</th>
                    <th className="p-3.5 font-bold">Purpose / Notes</th>
                    <th className="p-3.5 font-bold text-right">Approval Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {pendingRequests.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-muted-foreground">
                        <CheckCircle2 className="h-8 w-8 text-emerald-400 mx-auto mb-2 opacity-50" />
                        No pending rental requests at this time. All customer applications are processed!
                      </td>
                    </tr>
                  ) : (
                    pendingRequests.map((req) => (
                      <tr key={req.requestId} className="hover:bg-muted/30 transition-colors">
                        <td className="p-3.5 font-mono font-bold text-cat-yellow">{req.requestId}</td>
                        <td className="p-3.5">
                          <div className="font-bold text-foreground">{req.customerName}</div>
                          <div className="text-[10px] text-muted-foreground">{req.customerEmail || req.customerId}</div>
                        </td>
                        <td className="p-3.5">
                          <div className="font-bold text-foreground">{req.equipment?.model || req.equipmentId}</div>
                          <div className="text-[10px] text-muted-foreground font-mono">
                            {req.equipmentId} • Rate: ${req.equipment?.hourlyRate || 140}/hr
                          </div>
                        </td>
                        <td className="p-3.5">
                          <div className="font-bold text-foreground">{req.site?.name || req.siteId}</div>
                          <div className="text-[10px] text-muted-foreground font-mono">{req.siteId}</div>
                        </td>
                        <td className="p-3.5 font-mono">
                          <div>{new Date(req.startDate).toLocaleDateString()}</div>
                          <div className="text-muted-foreground text-[10px]">
                            to {new Date(req.expectedReturnDate).toLocaleDateString()}
                          </div>
                        </td>
                        <td className="p-3.5 font-mono font-bold text-cat-yellow">
                          ${formatNumber(req.estimatedCost)}
                        </td>
                        <td className="p-3.5 max-w-xs">
                          <div className="font-medium text-foreground truncate">{req.purpose || 'Site operations'}</div>
                          {req.notes && <div className="text-[10px] text-muted-foreground truncate">{req.notes}</div>}
                        </td>
                        <td className="p-3.5 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="cat"
                              size="sm"
                              onClick={() => approveMutation.mutate(req.requestId)}
                              disabled={approveMutation.isPending}
                              className="h-7 text-xs font-bold gap-1 px-3 shadow-md"
                            >
                              <Check className="h-3.5 w-3.5" /> Approve
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => openRejectModal(req)}
                              className="h-7 text-xs font-bold gap-1 px-2.5"
                            >
                              <XCircle className="h-3.5 w-3.5" /> Reject
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* TAB 2: PENDING EXTENSION REQUESTS */}
      {tab === 'EXTENSIONS' && (
        <Card className="border-2 border-border shadow-xl">
          <CardHeader className="pb-3 border-b border-border">
            <CardTitle className="text-base font-black flex items-center gap-2">
              <RotateCcw className="h-5 w-5 text-blue-400" />
              Pending Rental Extension Applications ({pendingExtensions.length})
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Review customer requests to extend active contract return deadlines.
            </p>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/40 border-b border-border text-muted-foreground">
                  <tr>
                    <th className="p-3.5 font-bold">Extension ID</th>
                    <th className="p-3.5 font-bold">Agreement / Asset</th>
                    <th className="p-3.5 font-bold">Customer</th>
                    <th className="p-3.5 font-bold">Current Return</th>
                    <th className="p-3.5 font-bold">Requested Return</th>
                    <th className="p-3.5 font-bold">Reason</th>
                    <th className="p-3.5 font-bold text-right">Approval Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {pendingExtensions.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-muted-foreground">
                        <CheckCircle2 className="h-8 w-8 text-emerald-400 mx-auto mb-2 opacity-50" />
                        No pending extension requests at this time.
                      </td>
                    </tr>
                  ) : (
                    pendingExtensions.map((ext) => (
                      <tr key={ext.extensionId} className="hover:bg-muted/30 transition-colors">
                        <td className="p-3.5 font-mono font-bold text-cat-yellow">{ext.extensionId}</td>
                        <td className="p-3.5">
                          <div className="font-bold text-foreground">{ext.equipment?.model || ext.equipmentId}</div>
                          <div className="text-[10px] text-muted-foreground font-mono">
                            Rental: {ext.rentalId}
                          </div>
                        </td>
                        <td className="p-3.5 font-semibold text-foreground">{ext.customerId}</td>
                        <td className="p-3.5 font-mono text-muted-foreground">
                          {new Date(ext.currentReturnDate).toLocaleDateString()}
                        </td>
                        <td className="p-3.5 font-mono font-bold text-emerald-400">
                          {new Date(ext.requestedReturnDate).toLocaleDateString()}
                        </td>
                        <td className="p-3.5 max-w-xs text-foreground font-medium truncate">
                          {ext.reason || 'Project timeline extended'}
                        </td>
                        <td className="p-3.5 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="cat"
                              size="sm"
                              onClick={() => approveExtMutation.mutate(ext.extensionId)}
                              disabled={approveExtMutation.isPending}
                              className="h-7 text-xs font-bold gap-1 px-3 shadow-md"
                            >
                              <Check className="h-3.5 w-3.5" /> Approve Extension
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => openExtRejectModal(ext)}
                              className="h-7 text-xs font-bold gap-1 px-2.5"
                            >
                              <XCircle className="h-3.5 w-3.5" /> Reject
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* TAB 3: APPROVAL HISTORY AUDIT */}
      {tab === 'HISTORY' && (
        <Card className="border-2 border-border shadow-xl">
          <CardHeader className="pb-3 border-b border-border">
            <CardTitle className="text-base font-black flex items-center gap-2">
              <FileCheck2 className="h-5 w-5 text-emerald-400" />
              Processed Rental Applications History
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Complete historical record of approved and rejected customer rental requests.
            </p>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/40 border-b border-border text-muted-foreground">
                  <tr>
                    <th className="p-3.5 font-bold">Request ID</th>
                    <th className="p-3.5 font-bold">Customer</th>
                    <th className="p-3.5 font-bold">Equipment Asset</th>
                    <th className="p-3.5 font-bold">Site</th>
                    <th className="p-3.5 font-bold">Outcome Status</th>
                    <th className="p-3.5 font-bold">Processed By</th>
                    <th className="p-3.5 font-bold">Processed Date</th>
                    <th className="p-3.5 font-bold text-right">Reference</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {historyRequests.map((req) => (
                    <tr key={req.requestId} className="hover:bg-muted/30 transition-colors">
                      <td className="p-3.5 font-mono font-bold text-cat-yellow">{req.requestId}</td>
                      <td className="p-3.5 font-semibold text-foreground">{req.customerName}</td>
                      <td className="p-3.5">{req.equipment?.model || req.equipmentId}</td>
                      <td className="p-3.5">{req.site?.name || req.siteId}</td>
                      <td className="p-3.5">
                        <Badge
                          variant={req.status === 'APPROVED' ? 'available' : 'destructive'}
                          className="font-bold text-[10px]"
                        >
                          {req.status}
                        </Badge>
                        {req.rejectionReason && (
                          <div className="text-[9px] text-red-400 mt-1 max-w-[220px] truncate" title={req.rejectionReason}>
                            Reason: {req.rejectionReason}
                          </div>
                        )}
                      </td>
                      <td className="p-3.5 font-mono">{req.approvedBy || req.rejectedBy || 'ADMIN'}</td>
                      <td className="p-3.5 font-mono text-muted-foreground">
                        {new Date(req.approvedAt || req.rejectedAt || req.updatedAt).toLocaleDateString()}
                      </td>
                      <td className="p-3.5 text-right font-mono text-cat-yellow font-bold">
                        {req.rentalId ? (
                          <Link to="/rentals" className="hover:underline">
                            {req.rentalId}
                          </Link>
                        ) : (
                          'N/A'
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* REJECT RENTAL REQUEST MODAL */}
      <Dialog open={rejectModalOpen} onOpenChange={setRejectModalOpen}>
        <DialogClose onClose={() => setRejectModalOpen(false)} />
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-400 font-bold">
            <XCircle className="h-5 w-5" />
            Reject Rental Request ({selectedReqForReject?.requestId})
          </DialogTitle>
          <DialogDescription>
            Specify reason for declining {selectedReqForReject?.customerName}'s application for {selectedReqForReject?.equipmentId}.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 text-xs">
          <div>
            <label className="font-bold text-foreground">Rejection Reason *</label>
            <Input
              type="text"
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              className="mt-1 text-xs"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => setRejectModalOpen(false)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => rejectMutation.mutate()}
            disabled={rejectMutation.isPending}
          >
            {rejectMutation.isPending ? 'Rejecting...' : 'Confirm Rejection'}
          </Button>
        </DialogFooter>
      </Dialog>

      {/* REJECT EXTENSION MODAL */}
      <Dialog open={extRejectModalOpen} onOpenChange={setExtRejectModalOpen}>
        <DialogClose onClose={() => setExtRejectModalOpen(false)} />
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-400 font-bold">
            <XCircle className="h-5 w-5" />
            Decline Extension Request ({selectedExtForReject?.extensionId})
          </DialogTitle>
          <DialogDescription>
            Specify rationale for declining extension for rental {selectedExtForReject?.rentalId}.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 text-xs">
          <div>
            <label className="font-bold text-foreground">Decline Rationale *</label>
            <Input
              type="text"
              value={extRejectionReason}
              onChange={(e) => setExtRejectionReason(e.target.value)}
              className="mt-1 text-xs"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => setExtRejectModalOpen(false)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => rejectExtMutation.mutate()}
            disabled={rejectExtMutation.isPending}
          >
            {rejectExtMutation.isPending ? 'Rejecting...' : 'Confirm Decline'}
          </Button>
        </DialogFooter>
      </Dialog>
    </div>
  );
}
