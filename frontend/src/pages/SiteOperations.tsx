import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import api from '@/services/api';
import { useStore } from '@/store/useStore';
import { Site, Equipment, Rental, Alert } from '@/types';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Building2,
  Truck,
  Gauge,
  Fuel,
  AlertTriangle,
  CheckCircle2,
  Clock,
  MapPin,
  RotateCcw,
  QrCode,
  ArrowRight,
  ShieldAlert,
  Flame,
  Activity,
  Layers,
} from 'lucide-react';
import { formatNumber } from '@/lib/utils';
import QRCodeModal from '@/components/common/QRCodeModal';

export default function SiteOperationsPage() {
  const user = useStore((state) => state.user);
  const [selectedEquipmentForQR, setSelectedEquipmentForQR] = useState<Equipment | null>(null);

  // Queries for assigned sites
  const { data: mySitesData } = useQuery<{ success: boolean; data: Site[] }>({
    queryKey: ['my-assigned-sites'],
    queryFn: async () => (await api.get('/site-ops/my-sites')).data,
  });

  const sites = mySitesData?.data || [];
  const [selectedSiteId, setSelectedSiteId] = useState<string>('');

  // Auto-select first assigned site
  React.useEffect(() => {
    if (sites.length > 0 && !selectedSiteId) {
      setSelectedSiteId(sites[0].siteId);
    }
  }, [sites.length]);

  const activeSite = sites.find((s) => s.siteId === selectedSiteId) || sites[0];

  // Queries scoped to selected site
  const { data: siteEquipmentData } = useQuery<{ success: boolean; data: Equipment[] }>({
    queryKey: ['site-ops-equipment', selectedSiteId],
    queryFn: async () => {
      const url = selectedSiteId ? `/site-ops/equipment?siteId=${selectedSiteId}` : '/site-ops/equipment';
      return (await api.get(url)).data;
    },
    enabled: !!selectedSiteId || sites.length > 0,
    refetchInterval: 10000,
  });

  const { data: siteRentalsData } = useQuery<{ success: boolean; data: Rental[] }>({
    queryKey: ['site-ops-rentals', selectedSiteId],
    queryFn: async () => {
      const url = selectedSiteId ? `/site-ops/rentals?siteId=${selectedSiteId}` : '/site-ops/rentals';
      return (await api.get(url)).data;
    },
    enabled: !!selectedSiteId || sites.length > 0,
    refetchInterval: 10000,
  });

  const { data: siteAlertsData } = useQuery<{ success: boolean; data: Alert[] }>({
    queryKey: ['site-ops-alerts', selectedSiteId],
    queryFn: async () => {
      const url = selectedSiteId ? `/site-ops/alerts?siteId=${selectedSiteId}` : '/site-ops/alerts';
      return (await api.get(url)).data;
    },
    enabled: !!selectedSiteId || sites.length > 0,
    refetchInterval: 10000,
  });

  const equipmentList = siteEquipmentData?.data || [];
  const rentals = siteRentalsData?.data || [];
  const alerts = siteAlertsData?.data || [];

  const activeCount = equipmentList.filter((e) => e.status === 'ACTIVE' || e.status === 'RENTED').length;
  const availableCount = equipmentList.filter((e) => e.status === 'AVAILABLE').length;
  const idleCount = equipmentList.filter((e) => e.status === 'IDLE').length;
  const overdueCount = rentals.filter((r) => r.status === 'OVERDUE').length;

  return (
    <div className="space-y-6 pb-12 max-w-7xl mx-auto">
      {/* Header Banner */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-neutral-900 via-neutral-950 to-neutral-900 border-2 border-cat-yellow/40 shadow-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs font-mono font-bold text-cat-yellow uppercase tracking-wider">
              Site Manager Operations
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-foreground">
            {activeSite ? `${activeSite.siteId}: ${activeSite.name}` : 'Assigned Site Operations'}
          </h1>
          <p className="text-xs text-muted-foreground">
            Superintendent: <strong className="text-foreground">{user?.name}</strong> • Location:{' '}
            <span className="text-foreground">{activeSite?.address || 'Rocky Mountain Sector'}</span>
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link to="/qr-scanner">
            <Button variant="cat" size="sm" className="font-bold text-xs gap-1.5 shadow-md">
              <QrCode className="h-4 w-4" /> QR / RFID Station
            </Button>
          </Link>
          <Link to="/map">
            <Button variant="outline" size="sm" className="font-bold text-xs gap-1.5">
              <MapPin className="h-4 w-4 text-cat-yellow" /> Site GPS Map
            </Button>
          </Link>
        </div>
      </div>

      {/* Assigned Sites Selector Bar */}
      {sites.length > 1 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <span className="text-xs font-bold text-muted-foreground uppercase flex items-center gap-1 flex-shrink-0">
            <Building2 className="h-3.5 w-3.5 text-cat-yellow" /> Switch Assigned Site:
          </span>
          {sites.map((s) => (
            <button
              key={s.siteId}
              onClick={() => setSelectedSiteId(s.siteId)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex-shrink-0 ${
                selectedSiteId === s.siteId
                  ? 'bg-cat-yellow text-cat-black shadow-md font-black'
                  : 'bg-neutral-900 border border-neutral-800 text-muted-foreground hover:text-foreground'
              }`}
            >
              {s.siteId} • {s.name.split(' ')[0]}
            </button>
          ))}
        </div>
      )}

      {/* 4 Site KPI Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-l-4 border-l-cat-yellow bg-card/60">
          <CardContent className="p-4">
            <div className="flex items-center justify-between text-muted-foreground text-xs font-semibold uppercase">
              <span>Total Site Machinery</span>
              <Truck className="h-4 w-4 text-cat-yellow" />
            </div>
            <div className="mt-2 text-2xl font-black font-mono text-foreground">{equipmentList.length} units</div>
            <p className="text-[10px] text-muted-foreground mt-1">Assigned to {selectedSiteId}</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-blue-500 bg-card/60">
          <CardContent className="p-4">
            <div className="flex items-center justify-between text-blue-400 text-xs font-semibold uppercase">
              <span>Active In Production</span>
              <Activity className="h-4 w-4 text-blue-500" />
            </div>
            <div className="mt-2 text-2xl font-black font-mono text-blue-400">{activeCount} units</div>
            <p className="text-[10px] text-muted-foreground mt-1">Direct job site production</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-emerald-500 bg-card/60">
          <CardContent className="p-4">
            <div className="flex items-center justify-between text-emerald-400 text-xs font-semibold uppercase">
              <span>Available / Idle Pool</span>
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            </div>
            <div className="mt-2 text-2xl font-black font-mono text-emerald-400">
              {availableCount + idleCount} units
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">Available: {availableCount} • Idle: {idleCount}</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-red-500 bg-card/60">
          <CardContent className="p-4">
            <div className="flex items-center justify-between text-red-400 text-xs font-semibold uppercase">
              <span>Overdue Returns</span>
              <Clock className="h-4 w-4 text-red-500" />
            </div>
            <div className="mt-2 text-2xl font-black font-mono text-red-400">{overdueCount}</div>
            <p className="text-[10px] text-muted-foreground mt-1">Requires immediate field check-in</p>
          </CardContent>
        </Card>
      </div>

      {/* SECTION 1: SITE EQUIPMENT FLEET TELEMETRY */}
      <Card className="border-2 border-border shadow-xl">
        <CardHeader className="pb-3 border-b border-border flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base font-black flex items-center gap-2">
              <Truck className="h-5 w-5 text-cat-yellow" />
              Assigned Site Equipment & Telemetry ({equipmentList.length})
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              Real-time engine run-time, fuel levels, health scores, and operational statuses.
            </p>
          </div>
          <Link to="/qr-scanner">
            <Button variant="outline" size="sm" className="h-8 text-xs font-bold gap-1 text-cat-yellow">
              <QrCode className="h-3.5 w-3.5" /> Scan QR Label
            </Button>
          </Link>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/40 border-b border-border text-muted-foreground">
                <tr>
                  <th className="p-3.5 font-bold">Asset ID</th>
                  <th className="p-3.5 font-bold">Model & Class</th>
                  <th className="p-3.5 font-bold">Status</th>
                  <th className="p-3.5 font-bold">Engine Hours</th>
                  <th className="p-3.5 font-bold">Fuel Level</th>
                  <th className="p-3.5 font-bold">Health</th>
                  <th className="p-3.5 font-bold">Assigned Operator</th>
                  <th className="p-3.5 font-bold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {equipmentList.map((asset) => (
                  <tr key={asset.equipmentId} className="hover:bg-muted/30 transition-colors">
                    <td className="p-3.5 font-mono font-bold text-cat-yellow">
                      <Link to={`/equipment/${asset.equipmentId}`} className="hover:underline">
                        {asset.equipmentId}
                      </Link>
                    </td>
                    <td className="p-3.5">
                      <div className="font-bold text-foreground">{asset.model}</div>
                      <div className="text-[10px] text-muted-foreground">{asset.type} • Serial: {asset.serialNumber}</div>
                    </td>
                    <td className="p-3.5">
                      <Badge
                        variant={
                          asset.status === 'AVAILABLE'
                            ? 'available'
                            : asset.status === 'ACTIVE'
                            ? 'active'
                            : asset.status === 'OVERDUE'
                            ? 'overdue'
                            : asset.status === 'IDLE'
                            ? 'idle'
                            : 'secondary'
                        }
                        className="font-bold text-[10px]"
                      >
                        {asset.status}
                      </Badge>
                    </td>
                    <td className="p-3.5 font-mono font-bold">{formatNumber(asset.engineHours)} hrs</td>
                    <td className="p-3.5 font-mono">
                      <span className={asset.fuelLevel < 20 ? 'text-red-400 font-bold' : ''}>{asset.fuelLevel}%</span>
                    </td>
                    <td className="p-3.5 font-mono font-bold text-emerald-400">{asset.healthScore}%</td>
                    <td className="p-3.5 font-medium">{asset.operatorId || 'Unassigned'}</td>
                    <td className="p-3.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedEquipmentForQR(asset)}
                          className="h-7 text-xs px-2 text-cat-yellow hover:bg-cat-yellow/10"
                          title="View & Download QR Code"
                        >
                          <QrCode className="h-3.5 w-3.5" />
                        </Button>
                        <Link to={`/equipment/${asset.equipmentId}`}>
                          <Button variant="ghost" size="sm" className="h-7 text-xs text-cat-yellow font-bold">
                            Inspect Dossier →
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

      {/* SECTION 2: ACTIVE SITE RENTALS */}
      <Card className="border-2 border-border shadow-xl">
        <CardHeader className="pb-3 border-b border-border">
          <CardTitle className="text-base font-black flex items-center gap-2">
            <Building2 className="h-5 w-5 text-cat-yellow" />
            Active Job Site Agreements ({rentals.length})
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-0.5">
            Active shift checkouts and return milestones for {selectedSiteId}.
          </p>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/40 border-b border-border text-muted-foreground">
                <tr>
                  <th className="p-3.5 font-bold">Rental ID</th>
                  <th className="p-3.5 font-bold">Equipment Asset</th>
                  <th className="p-3.5 font-bold">Contractor Client</th>
                  <th className="p-3.5 font-bold">Checkout Date</th>
                  <th className="p-3.5 font-bold">Return Milestone</th>
                  <th className="p-3.5 font-bold">Status</th>
                  <th className="p-3.5 font-bold text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rentals.map((r) => (
                  <tr key={r.rentalId} className="hover:bg-muted/30 transition-colors">
                    <td className="p-3.5 font-mono font-bold text-cat-yellow">{r.rentalId}</td>
                    <td className="p-3.5 font-bold text-foreground">{r.equipmentId}</td>
                    <td className="p-3.5 font-medium">{r.customerName || 'Direct Contractor'}</td>
                    <td className="p-3.5 text-muted-foreground font-mono">{new Date(r.checkoutDate).toLocaleDateString()}</td>
                    <td className="p-3.5 font-bold font-mono">
                      <span className={r.status === 'OVERDUE' ? 'text-red-400 font-bold' : ''}>
                        {new Date(r.expectedReturnDate).toLocaleDateString()}
                      </span>
                    </td>
                    <td className="p-3.5">
                      <Badge variant={r.status === 'ACTIVE' ? 'active' : 'overdue'} className="font-bold text-[10px]">
                        {r.status}
                      </Badge>
                    </td>
                    <td className="p-3.5 text-right">
                      <Link to="/qr-scanner">
                        <Button variant="cat" size="sm" className="h-7 text-xs font-bold gap-1">
                          <RotateCcw className="h-3 w-3" /> Field Check-In
                        </Button>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Reusable QR Code Modal */}
      <QRCodeModal
        equipment={selectedEquipmentForQR}
        open={!!selectedEquipmentForQR}
        onClose={() => setSelectedEquipmentForQR(null)}
      />
    </div>
  );
}
