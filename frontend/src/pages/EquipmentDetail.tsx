import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import QRCode from 'qrcode';
import api from '@/services/api';
import { Equipment, Site, Operator, Rental, UsageLog, Anomaly, Alert } from '@/types';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  Truck,
  ArrowLeft,
  QrCode,
  MapPin,
  User,
  Calendar,
  Clock,
  Fuel,
  HeartPulse,
  AlertTriangle,
  Activity,
  CheckCircle2,
  FileText,
  DollarSign,
  ChevronRight,
  Sparkles,
  Download,
  Printer,
  ShieldAlert,
  Flame,
  Thermometer,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { formatNumber, formatPercent } from '@/lib/utils';
import { useStore } from '@/store/useStore';
import QRCodeModal from '@/components/common/QRCodeModal';

export default function EquipmentDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const user = useStore((state) => state.user);

  // Modals
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [checkinOpen, setCheckinOpen] = useState(false);
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');

  // Form states
  const [selectedOpId, setSelectedOpId] = useState('');
  const [selectedSiteId, setSelectedSiteId] = useState('');
  const [expectedReturnDate, setExpectedReturnDate] = useState('');
  const [checkinEngineHours, setCheckinEngineHours] = useState('');
  const [checkinFuelLevel, setCheckinFuelLevel] = useState('85');
  const [checkinCondition, setCheckinCondition] = useState('GOOD');
  const [checkinNotes, setCheckinNotes] = useState('');

  // Fetch Equipment Detail
  const { data: detailData, isLoading } = useQuery<{
    success: boolean;
    data: Equipment & {
      site?: Site;
      operator?: Operator;
      activeRental?: Rental;
      recentUsage?: UsageLog[];
      anomalies?: Anomaly[];
    };
  }>({
    queryKey: ['equipment-detail', id],
    queryFn: async () => (await api.get(`/equipment/${id}`)).data,
  });

  const { data: sitesData } = useQuery<{ success: boolean; data: Site[] }>({
    queryKey: ['sites-list'],
    queryFn: async () => (await api.get('/sites')).data,
  });

  const { data: operatorsData } = useQuery<{ success: boolean; data: Operator[] }>({
    queryKey: ['operators-list'],
    queryFn: async () => (await api.get('/operators')).data,
  });

  const { data: alertsData } = useQuery<{ success: boolean; data: Alert[] }>({
    queryKey: ['equipment-alerts', id],
    queryFn: async () => (await api.get(`/alerts?equipmentId=${id}`)).data,
    refetchInterval: 8000,
  });

  const eq = detailData?.data;
  const sites = sitesData?.data || [];
  const operators = operatorsData?.data || [];
  const usageHistory = eq?.recentUsage || [];
  const activeRental = eq?.activeRental;
  const anomalies = eq?.anomalies || [];
  const equipmentAlerts = alertsData?.data?.filter((a) => a.equipmentId === id && a.status === 'ACTIVE') || [];

  // Generate Real High-Res QR Code Data URL
  useEffect(() => {
    if (eq) {
      const payload = eq.qrPayload || `CATFLEET:${eq.equipmentId}`;
      QRCode.toDataURL(payload, {
        width: 320,
        margin: 1,
        color: {
          dark: '#000000',
          light: '#ffffff',
        },
      })
        .then((url) => setQrDataUrl(url))
        .catch((err) => console.error('QR generation error:', err));
    }
  }, [eq?.equipmentId, eq?.qrPayload]);

  const handleDownloadQr = () => {
    if (!qrDataUrl || !eq) return;
    const link = document.createElement('a');
    link.download = `CATFLEET-QR-${eq.equipmentId}.png`;
    link.href = qrDataUrl;
    link.click();
  };

  const handlePrintQr = () => {
    window.print();
  };

  // Checkout Mutation
  const checkoutMutation = useMutation({
    mutationFn: async () => {
      return (
        await api.post('/rentals/checkout', {
          equipmentId: eq?.equipmentId,
          operatorId: selectedOpId,
          siteId: selectedSiteId,
          expectedReturnDate,
        })
      ).data;
    },
    onSuccess: () => {
      setCheckoutOpen(false);
      queryClient.invalidateQueries({ queryKey: ['equipment-detail', id] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-kpis'] });
    },
  });

  // Checkin Mutation
  const checkinMutation = useMutation({
    mutationFn: async () => {
      return (
        await api.post('/rentals/checkin', {
          rentalId: activeRental?.rentalId,
          checkinEngineHours: Number(checkinEngineHours) || eq?.engineHours,
          checkinFuelLevel: Number(checkinFuelLevel) || 85,
          condition: checkinCondition,
          notes: checkinNotes,
        })
      ).data;
    },
    onSuccess: () => {
      setCheckinOpen(false);
      queryClient.invalidateQueries({ queryKey: ['equipment-detail', id] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-kpis'] });
    },
  });

  if (isLoading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="text-center space-y-2">
          <Truck className="h-8 w-8 text-cat-yellow animate-bounce mx-auto" />
          <p className="text-sm text-muted-foreground">Loading Caterpillar equipment telemetry...</p>
        </div>
      </div>
    );
  }

  if (!eq) {
    return (
      <div className="p-8 text-center space-y-4">
        <AlertTriangle className="h-12 w-12 text-red-500 mx-auto" />
        <h2 className="text-xl font-bold">Equipment Not Found</h2>
        <p className="text-sm text-muted-foreground">No asset matching ID "{id}" could be located.</p>
        <Link to="/equipment">
          <Button variant="default">Return to Inventory</Button>
        </Link>
      </div>
    );
  }

  const totalH = (eq.operatingHours || 0) + (eq.idleHours || 0);
  const idleRatio = totalH > 0 ? ((eq.idleHours || 0) / totalH) * 100 : 0;
  const utilization = totalH > 0 ? ((eq.operatingHours || 0) / totalH) * 100 : 70;

  return (
    <div className="space-y-6 pb-12">
      {/* Back Link & Title */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border pb-4">
        <div className="flex items-center gap-3">
          <Link to="/equipment">
            <Button variant="outline" size="icon" className="h-9 w-9">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl sm:text-3xl font-black text-foreground">{eq.model}</h1>
              <Badge
                variant={
                  eq.status === 'AVAILABLE'
                    ? 'available'
                    : eq.status === 'ACTIVE'
                    ? 'active'
                    : eq.status === 'OVERDUE'
                    ? 'overdue'
                    : eq.status === 'IDLE'
                    ? 'idle'
                    : eq.status === 'RENTED'
                    ? 'rented'
                    : 'secondary'
                }
              >
                {eq.status}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground font-mono mt-0.5">
              ID: <span className="text-cat-yellow font-bold">{eq.equipmentId}</span> • Payload:{' '}
              <span className="font-bold text-foreground">{eq.qrPayload || `CATFLEET:${eq.equipmentId}`}</span> • Serial: {eq.serialNumber}
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Show Real Machine QR Code */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setQrModalOpen(true)}
            className="gap-1.5 font-bold border-cat-yellow/40 hover:bg-cat-yellow/10"
          >
            <QrCode className="h-4 w-4 text-cat-yellow" />
            Show QR Code
          </Button>

          {user?.role === 'CUSTOMER' ? (
            <Link to="/customer-dashboard">
              <Button variant="cat" size="sm" className="gap-2 font-bold shadow-lg">
                <FileText className="h-4 w-4" />
                Request Rental for This Machine
              </Button>
            </Link>
          ) : (eq.status === 'AVAILABLE' || eq.status === 'IDLE') ? (
            <Button
              variant="default"
              size="sm"
              onClick={() => {
                setSelectedSiteId(eq.siteId || sites[0]?.siteId || 'S001');
                const d = new Date();
                d.setDate(d.getDate() + 7);
                setExpectedReturnDate(d.toISOString().split('T')[0]);
                if (operators.length > 0) setSelectedOpId(operators[0].operatorId);
                setCheckoutOpen(true);
              }}
              className="gap-2 font-bold"
            >
              <CheckCircle2 className="h-4 w-4" />
              Check Out Equipment
            </Button>
          ) : activeRental ? (
            <Button
              variant="cat"
              size="sm"
              onClick={() => {
                setCheckinEngineHours((eq.engineHours + 8).toString());
                setCheckinFuelLevel(Math.max(10, eq.fuelLevel - 15).toString());
                setCheckinOpen(true);
              }}
              className="gap-2 font-bold"
            >
              <FileText className="h-4 w-4" />
              Check In (Complete Shift)
            </Button>
          ) : null}

          <Link to="/map">
            <Button variant="outline" size="sm" className="gap-2">
              <MapPin className="h-4 w-4 text-cat-yellow" />
              GPS Live View
            </Button>
          </Link>
        </div>
      </div>

      {/* Anomalies Alert Banner if present */}
      {anomalies.length > 0 && (
        <div className="rounded-xl border-2 border-red-500/50 bg-red-500/10 p-4 space-y-2">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-500 animate-pulse" />
            <h3 className="font-bold text-red-400 text-sm">
              Active Operational Anomaly Detected (Score: {(((anomalies[0]?.score ?? anomalies[0]?.anomalyScore ?? 0.85)) * 100).toFixed(0)}% — {anomalies[0]?.detectionMethod || 'Isolation Forest ML'})
            </h3>
          </div>
          <ul className="text-xs text-foreground list-disc list-inside space-y-1 pl-1">
            {(anomalies[0]?.reasons || [anomalies[0]?.explanation || 'Unusual telemetry deviation']).map((r: string, i: number) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
        </div>
      )}

      {/* 4 Metric Highlights */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {/* Engine Hours */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between text-muted-foreground text-xs">
              <span>Total Engine Hours</span>
              <Clock className="h-4 w-4 text-cat-yellow" />
            </div>
            <div className="mt-2 text-2xl font-black font-mono">{formatNumber(eq.engineHours)} h</div>
            <p className="text-[10px] text-muted-foreground mt-1">
              Operating: {formatNumber(eq.operatingHours)}h | Idle: {formatNumber(eq.idleHours)}h
            </p>
          </CardContent>
        </Card>

        {/* Utilization Rate */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between text-muted-foreground text-xs">
              <span>Utilization Rate</span>
              <Activity className="h-4 w-4 text-purple-500" />
            </div>
            <div className="mt-2 text-2xl font-black font-mono text-purple-400">
              {formatPercent(utilization)}
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">
              Idle ratio: {formatPercent(idleRatio)}
            </p>
          </CardContent>
        </Card>

        {/* Fuel Level */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between text-muted-foreground text-xs">
              <span>Fuel Reservoir</span>
              <Fuel className="h-4 w-4 text-cat-yellow" />
            </div>
            <div className="mt-2 text-2xl font-black font-mono">{eq.fuelLevel}%</div>
            <div className="w-full bg-neutral-800 h-1.5 rounded-full mt-2 overflow-hidden">
              <div
                className={`h-full ${eq.fuelLevel < 20 ? 'bg-red-500' : 'bg-cat-yellow'}`}
                style={{ width: `${eq.fuelLevel}%` }}
              />
            </div>
          </CardContent>
        </Card>

        {/* Health Score */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between text-muted-foreground text-xs">
              <span>Health Score</span>
              <HeartPulse className="h-4 w-4 text-emerald-500" />
            </div>
            <div
              className={`mt-2 text-2xl font-black font-mono ${
                eq.healthScore >= 90
                  ? 'text-emerald-500'
                  : eq.healthScore >= 75
                  ? 'text-amber-500'
                  : 'text-red-500'
              }`}
            >
              {eq.healthScore}%
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">
              Thermal: {eq.temperature || 82}°C | Safe PM
            </p>
          </CardContent>
        </Card>
      </div>

      {/* RISK STATUS & ACTIVE ALERTS CARD (Phase 26) */}
      <Card className="border-2 border-border bg-card shadow-sm">
        <CardHeader className="pb-3 border-b border-border flex flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-cat-yellow" />
            <div>
              <CardTitle className="text-base font-bold">Asset Risk Status & Live Telemetry Health</CardTitle>
              <p className="text-xs text-muted-foreground">Real-time alert monitoring & operational rule engine</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-muted-foreground">Active Alerts:</span>
            <Badge
              variant={equipmentAlerts.length > 0 ? 'destructive' : 'available'}
              className="font-mono text-xs px-2"
            >
              {equipmentAlerts.length}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-4 space-y-3">
          {equipmentAlerts.length === 0 ? (
            <div className="flex items-center gap-2 text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 p-3 rounded-lg">
              <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
              <span>All telemetry metrics nominal. No active overuse, geofence, or thermal violations.</span>
            </div>
          ) : (
            <div className="space-y-2">
              {equipmentAlerts.map((alt) => (
                <div
                  key={alt._id || alt.alertId}
                  className={`p-3 rounded-xl border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs ${
                    alt.severity === 'CRITICAL'
                      ? 'bg-red-500/10 border-red-500/40 text-red-400'
                      : alt.severity === 'HIGH'
                      ? 'bg-orange-500/10 border-orange-500/40 text-orange-400'
                      : 'bg-amber-500/10 border-amber-500/40 text-amber-400'
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={alt.severity === 'CRITICAL' || alt.severity === 'HIGH' ? 'destructive' : 'secondary'}
                        className="text-[10px]"
                      >
                        {alt.type} • {alt.severity}
                      </Badge>
                      <span className="font-bold text-foreground">{alt.title || alt.type}</span>
                    </div>
                    <p className="text-foreground">{alt.message}</p>
                    {alt.recommendation && (
                      <p className="text-[11px] text-muted-foreground">
                        💡 <strong>Recommendation:</strong> {alt.recommendation}
                      </p>
                    )}
                  </div>

                  <Link to="/alerts">
                    <Button variant="outline" size="sm" className="text-xs h-7 self-start sm:self-auto">
                      View in Alerts Feed
                    </Button>
                  </Link>
                </div>
              ))}
            </div>
          )}

          {/* Recent Events Timeline */}
          <div className="pt-2 border-t border-border flex flex-wrap items-center justify-between text-[11px] text-muted-foreground gap-2">
            <span className="flex items-center gap-1.5">
              <Activity className="h-3.5 w-3.5 text-cat-yellow" /> Telemetry received (12s stream active)
            </span>
            <span className="flex items-center gap-1.5">
              <Thermometer className="h-3.5 w-3.5 text-blue-400" /> Operating Temp: {eq.temperature || 82}°C
            </span>
            <span className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-purple-400" /> Shift Hours: {(eq.operatingHours % 12 || 6.5).toFixed(1)}h today
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Grid: Details & Telemetry Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Metadata Card */}
        <Card className="lg:col-span-1 space-y-4">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-bold">Operational Context</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-xs">
            {/* Current Site */}
            <div className="border-b border-border pb-3">
              <span className="text-muted-foreground font-semibold">Assigned Job Site:</span>
              <div className="mt-1 flex items-start gap-2">
                <MapPin className="h-4 w-4 text-cat-yellow flex-shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold text-foreground">{eq.site?.name || 'Unassigned Facility'}</div>
                  <div className="text-muted-foreground text-[11px]">{eq.site?.address || 'In transit / yard'}</div>
                  <div className="font-mono text-muted-foreground text-[10px] mt-0.5">
                    Lat: {eq.lat.toFixed(4)}, Lng: {eq.lng.toFixed(4)}
                  </div>
                </div>
              </div>
            </div>

            {/* Operator */}
            <div className="border-b border-border pb-3">
              <span className="text-muted-foreground font-semibold">Assigned Operator:</span>
              <div className="mt-1 flex items-center gap-2">
                <User className="h-4 w-4 text-blue-400 flex-shrink-0" />
                {eq.operator ? (
                  <div>
                    <div className="font-bold text-foreground">{eq.operator.name}</div>
                    <div className="text-muted-foreground text-[11px]">{eq.operator.phone}</div>
                  </div>
                ) : (
                  <span className="text-muted-foreground italic">No operator currently assigned</span>
                )}
              </div>
            </div>

            {/* Active Rental Agreement */}
            <div className="border-b border-border pb-3">
              <span className="text-muted-foreground font-semibold">Rental Agreement:</span>
              {activeRental ? (
                <div className="mt-1 space-y-1 bg-muted/40 p-2.5 rounded-lg border border-border">
                  <div className="flex justify-between font-mono font-bold">
                    <span className="text-cat-yellow">{activeRental.rentalId}</span>
                    <Badge variant={activeRental.status === 'OVERDUE' ? 'overdue' : 'active'}>
                      {activeRental.status}
                    </Badge>
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    Checkout: {new Date(activeRental.checkoutDate).toLocaleDateString()}
                  </div>
                  <div className="text-[11px] text-foreground font-semibold">
                    Expected Return: {new Date(activeRental.expectedReturnDate).toLocaleDateString()}
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    Shift start hours: {activeRental.checkoutEngineHours}h
                  </div>
                </div>
              ) : (
                <div className="mt-1 text-muted-foreground italic">Asset is currently unrented</div>
              )}
            </div>

            {/* QR Identification */}
            <div>
              <span className="text-muted-foreground font-semibold">QR Digital Tag:</span>
              <div className="mt-1 flex items-center gap-2 bg-cat-black p-2.5 rounded-lg border border-cat-yellow/40">
                <QrCode className="h-5 w-5 text-cat-yellow" />
                <span className="font-mono text-[11px] text-cat-yellow font-bold">{eq.qrCode}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Right: Usage & Telemetry Trend */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-bold">Recent Telemetry & Operating History</CardTitle>
            <p className="text-xs text-muted-foreground">Daily operating vs. idle hours logging</p>
          </CardHeader>
          <CardContent>
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={
                    usageHistory.length > 0
                      ? usageHistory.map((u) => ({
                          date: new Date(u.date).toLocaleDateString([], { month: 'short', day: 'numeric' }),
                          operating: u.operatingHours,
                          idle: u.idleHours,
                          fuel: u.fuelConsumed,
                        }))
                      : [
                          { date: 'Aug 26', operating: 6.2, idle: 1.8, fuel: 84 },
                          { date: 'Aug 27', operating: 7.1, idle: 1.2, fuel: 92 },
                          { date: 'Aug 28', operating: 5.8, idle: 2.0, fuel: 76 },
                          { date: 'Aug 29', operating: 7.5, idle: 1.0, fuel: 98 },
                          { date: 'Aug 30', operating: 6.9, idle: 1.5, fuel: 90 },
                          { date: 'Aug 31', operating: 8.0, idle: 0.8, fuel: 104 },
                          { date: 'Sep 01', operating: 7.4, idle: 1.1, fuel: 96 },
                        ]
                  }
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#333" opacity={0.3} />
                  <XAxis dataKey="date" stroke="#888" fontSize={11} />
                  <YAxis stroke="#888" fontSize={11} unit="h" />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1a1a1a', borderColor: '#333', borderRadius: '8px' }}
                  />
                  <Bar dataKey="operating" name="Operating Hours" fill="#FFCD11" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="idle" name="Idle Hours" fill="#f97316" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="mt-4 flex items-center justify-between text-xs border-t border-border pt-3">
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1.5">
                  <span className="h-3 w-3 rounded bg-cat-yellow" /> Operating Hours
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-3 w-3 rounded bg-orange-500" /> Idle Hours
                </span>
              </div>
              <span className="font-mono text-muted-foreground font-semibold">
                Hourly Rental Rate: ${eq.hourlyRate}/hr
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Checkout Modal */}
      <Dialog open={checkoutOpen} onOpenChange={setCheckoutOpen}>
        <DialogClose onClose={() => setCheckoutOpen(false)} />
        <DialogHeader>
          <DialogTitle>Check Out Equipment ({eq.equipmentId})</DialogTitle>
          <DialogDescription>
            Assign job site, qualified operator, and expected return date for {eq.model}.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 text-xs">
          <div>
            <label className="font-semibold text-foreground">Target Project Site</label>
            <select
              value={selectedSiteId}
              onChange={(e) => setSelectedSiteId(e.target.value)}
              className="mt-1.5 h-9 w-full rounded-lg border border-border bg-background px-3 text-xs"
            >
              {sites.map((s) => (
                <option key={s.siteId} value={s.siteId}>
                  {s.siteId}: {s.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="font-semibold text-foreground">Assigned Operator</label>
            <select
              value={selectedOpId}
              onChange={(e) => setSelectedOpId(e.target.value)}
              className="mt-1.5 h-9 w-full rounded-lg border border-border bg-background px-3 text-xs"
            >
              <option value="">Select an operator...</option>
              {operators.map((op) => (
                <option key={op.operatorId} value={op.operatorId}>
                  {op.name} ({op.operatorId}) — {op.status}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="font-semibold text-foreground">Expected Return Date</label>
            <Input
              type="date"
              value={expectedReturnDate}
              onChange={(e) => setExpectedReturnDate(e.target.value)}
              className="mt-1.5"
            />
          </div>

          <div className="bg-muted/40 p-3 rounded-lg border border-border text-[11px] space-y-1">
            <div>Current Engine Hours: <span className="font-mono font-bold">{eq.engineHours} hrs</span></div>
            <div>Current Fuel Level: <span className="font-mono font-bold">{eq.fuelLevel}%</span></div>
            <div>Billing Rate: <span className="font-mono font-bold">${eq.hourlyRate}/hr</span></div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => setCheckoutOpen(false)}>
            Cancel
          </Button>
          <Button
            variant="default"
            size="sm"
            disabled={!selectedOpId || !selectedSiteId || !expectedReturnDate || checkoutMutation.isPending}
            onClick={() => checkoutMutation.mutate()}
          >
            {checkoutMutation.isPending ? 'Processing...' : 'Confirm Checkout'}
          </Button>
        </DialogFooter>
      </Dialog>

      {/* Checkin Modal */}
      <Dialog open={checkinOpen} onOpenChange={setCheckinOpen}>
        <DialogClose onClose={() => setCheckinOpen(false)} />
        <DialogHeader>
          <DialogTitle>Check In Equipment ({eq.equipmentId})</DialogTitle>
          <DialogDescription>
            Complete rental agreement {activeRental?.rentalId} and log final shift telemetry.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 text-xs">
          <div>
            <label className="font-semibold text-foreground">Final Engine Hours</label>
            <Input
              type="number"
              value={checkinEngineHours}
              onChange={(e) => setCheckinEngineHours(e.target.value)}
              className="mt-1.5"
            />
            <span className="text-[10px] text-muted-foreground">
              Checkout hours was: {activeRental?.checkoutEngineHours} hrs
            </span>
          </div>

          <div>
            <label className="font-semibold text-foreground">Return Fuel Level (%)</label>
            <Input
              type="number"
              min="0"
              max="100"
              value={checkinFuelLevel}
              onChange={(e) => setCheckinFuelLevel(e.target.value)}
              className="mt-1.5"
            />
          </div>

          <div>
            <label className="font-semibold text-foreground">Equipment Condition</label>
            <select
              value={checkinCondition}
              onChange={(e) => setCheckinCondition(e.target.value)}
              className="mt-1.5 h-9 w-full rounded-lg border border-border bg-background px-3 text-xs"
            >
              <option value="GOOD">Good / Ready for Available Fleet</option>
              <option value="DAMAGED">Flagged for Damage / Shop Maintenance</option>
            </select>
          </div>

          <div>
            <label className="font-semibold text-foreground">Check-in Notes / Inspection Remarks</label>
            <Input
              type="text"
              placeholder="e.g. Normal shift completed. Hydraulics inspected."
              value={checkinNotes}
              onChange={(e) => setCheckinNotes(e.target.value)}
              className="mt-1.5"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => setCheckinOpen(false)}>
            Cancel
          </Button>
          <Button
            variant="default"
            size="sm"
            disabled={checkinMutation.isPending}
            onClick={() => checkinMutation.mutate()}
          >
            {checkinMutation.isPending ? 'Processing...' : 'Complete Check-In'}
          </Button>
        </DialogFooter>
      </Dialog>

      {/* Persistent Machine QR Code Modal */}
      <QRCodeModal
        equipment={eq}
        open={qrModalOpen}
        onClose={() => setQrModalOpen(false)}
      />
    </div>
  );
}
