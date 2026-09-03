import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import api from '@/services/api';
import { DashboardKPIs, Equipment, Alert, Recommendation, Forecast } from '@/types';
import { getSocket } from '@/services/socket';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Truck,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Flame,
  Building2,
  TrendingUp,
  Activity,
  ArrowRight,
  QrCode,
  Sparkles,
  RefreshCw,
  Search,
  ExternalLink,
  ChevronRight,
  Bot,
  Zap,
  Sliders,
  ShieldAlert,
  Radio,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from 'recharts';
import { formatNumber, formatPercent } from '@/lib/utils';

export default function Dashboard() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Simulation Controls State (for live hackathon demo)
  const [simPanelOpen, setSimPanelOpen] = useState(false);
  const [simEquipmentId, setSimEquipmentId] = useState('EQX1005');
  const [simScenario, setSimScenario] = useState<string>('HIGH_USAGE');
  const [simFeedback, setSimFeedback] = useState<string | null>(null);

  // Queries
  const { data: kpisData, isLoading: kpisLoading } = useQuery<{ success: boolean; data: DashboardKPIs }>({
    queryKey: ['dashboard-kpis'],
    queryFn: async () => (await api.get('/analytics/dashboard')).data,
    refetchInterval: 10000,
  });

  const { data: equipmentData, isLoading: eqLoading } = useQuery<{ success: boolean; data: Equipment[] }>({
    queryKey: ['dashboard-equipment'],
    queryFn: async () => (await api.get('/equipment?limit=100')).data,
    refetchInterval: 15000,
  });

  const { data: alertsData } = useQuery<{ success: boolean; data: Alert[] }>({
    queryKey: ['dashboard-alerts'],
    queryFn: async () => (await api.get('/alerts?status=ACTIVE')).data,
    refetchInterval: 8000,
  });

  const { data: recommendationsData } = useQuery<{ success: boolean; data: Recommendation[] }>({
    queryKey: ['dashboard-recommendations'],
    queryFn: async () => (await api.get('/recommendations?status=PENDING')).data,
  });

  const { data: utilizationData } = useQuery<{ success: boolean; data: { trend: any[]; byType: any[] } }>({
    queryKey: ['dashboard-utilization-trend'],
    queryFn: async () => (await api.get('/analytics/utilization?period=14')).data,
  });

  const { data: forecastData } = useQuery<{ success: boolean; data: Forecast[] }>({
    queryKey: ['dashboard-forecast'],
    queryFn: async () => (await api.get('/forecast?siteId=S002&equipmentType=Excavator')).data,
  });

  // Socket.IO Real-Time Stream
  useEffect(() => {
    const socket = getSocket();
    const handleNewAlert = () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard-alerts'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-kpis'] });
    };
    const handleEquipmentUpdate = () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard-equipment'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-kpis'] });
    };

    socket.on('alert:new', handleNewAlert);
    socket.on('alert:resolved', handleNewAlert);
    socket.on('equipment:updated', handleEquipmentUpdate);

    return () => {
      socket.off('alert:new', handleNewAlert);
      socket.off('alert:resolved', handleNewAlert);
      socket.off('equipment:updated', handleEquipmentUpdate);
    };
  }, [queryClient]);

  // Trigger Scenario Mutation
  const simMutation = useMutation({
    mutationFn: async () => {
      setSimFeedback(null);
      return (
        await api.post('/simulation/scenario', {
          equipmentId: simEquipmentId,
          scenario: simScenario,
        })
      ).data;
    },
    onSuccess: (data) => {
      setSimFeedback(`⚡ Triggered ${simScenario} on ${simEquipmentId}! Alert Engine evaluated.`);
      queryClient.invalidateQueries({ queryKey: ['dashboard-alerts'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-equipment'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-kpis'] });
    },
    onError: (err: any) => {
      setSimFeedback(`❌ Failed: ${err.response?.data?.message || err.message}`);
    },
  });

  // Execute recommendation mutation
  const executeMutation = useMutation({
    mutationFn: async (id: string) => {
      return (await api.post(`/recommendations/${id}/execute`)).data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard-recommendations'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-kpis'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-equipment'] });
    },
  });

  const kpis = kpisData?.data || {
    totalAssets: 60,
    rented: 24,
    available: 22,
    overdue: 3,
    underUtilized: 11,
    avgUtilization: 68.4,
    activeSites: 8,
    inMaintenance: 3,
  };

  const equipmentList = equipmentData?.data || [];
  const activeAlerts = alertsData?.data || [];
  const recommendations = recommendationsData?.data || [];
  const trendData = utilizationData?.data?.trend || [];
  const typeData = utilizationData?.data?.byType || [];
  const forecasts = forecastData?.data || [];

  const filteredEquipment = equipmentList.filter((eq) => {
    const matchesSearch =
      eq.equipmentId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      eq.model.toLowerCase().includes(searchTerm.toLowerCase()) ||
      eq.type.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'ALL' || eq.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6 pb-12">
      {/* Top Banner & Fast Actions */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-border pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black tracking-tight text-foreground sm:text-3xl">
              Command Center
            </h1>
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-500 border border-emerald-500/20">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Live Telemetry Stream
            </span>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Real-time fleet tracking, predictive demand forecasts, and autonomous asset reallocation.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Simulation Demo Trigger Button */}
          <Button
            variant={simPanelOpen ? 'cat' : 'outline'}
            size="sm"
            onClick={() => setSimPanelOpen(!simPanelOpen)}
            className="gap-2 font-bold border-cat-yellow/50 shadow-sm"
          >
            <Zap className="h-4 w-4 text-cat-yellow" />
            {simPanelOpen ? 'Close Demo Simulator' : 'Live Scenario Simulator'}
          </Button>

          <Link to="/qr-scanner">
            <Button variant="cat" size="sm" className="gap-2">
              <QrCode className="h-4 w-4" />
              Scan QR Station
            </Button>
          </Link>
          <Link to="/copilot">
            <Button variant="outline" size="sm" className="gap-2 border-cat-yellow/40">
              <Bot className="h-4 w-4 text-cat-yellow" />
              AI Copilot
            </Button>
          </Link>
        </div>
      </div>

      {/* COLLAPSIBLE LIVE DEMO SIMULATOR PANEL */}
      {simPanelOpen && (
        <Card className="border-2 border-cat-yellow bg-neutral-950 p-5 shadow-2xl animate-in fade-in-50 duration-200">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Radio className="h-4 w-4 text-cat-yellow animate-pulse" />
                <span className="text-xs font-black uppercase tracking-wider text-cat-yellow font-mono">
                  Live Hackathon Telemetry Simulator
                </span>
                <Badge variant="outline" className="text-[10px] border-cat-yellow/40 text-cat-yellow font-mono">
                  DEMO SCENARIOS
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                Inject controlled industrial fault conditions into live assets to verify the 9-Rule Real-Time Alert Engine.
              </p>
            </div>

            {/* Selector & Trigger Form */}
            <div className="flex flex-wrap items-center gap-3">
              {/* Target Equipment */}
              <div>
                <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">
                  Target Machine
                </label>
                <select
                  value={simEquipmentId}
                  onChange={(e) => setSimEquipmentId(e.target.value)}
                  className="h-8 rounded-lg border border-neutral-800 bg-neutral-900 px-3 text-xs font-mono font-bold text-foreground"
                >
                  <option value="EQX1005">EQX1005 (CAT D8T Dozer)</option>
                  <option value="EQX1002">EQX1002 (CAT 320 GC Excavator)</option>
                  <option value="EQX1003">EQX1003 (CAT 966M Loader)</option>
                  <option value="EQX1001">EQX1001 (CAT 336 Excavator)</option>
                  <option value="EQX1006">EQX1006 (CAT 745 Dump Truck)</option>
                </select>
              </div>

              {/* Scenario Type */}
              <div>
                <label className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">
                  Fault / Telemetry Scenario
                </label>
                <select
                  value={simScenario}
                  onChange={(e) => setSimScenario(e.target.value as any)}
                  className="h-8 rounded-lg border border-neutral-800 bg-neutral-900 px-3 text-xs font-bold text-foreground"
                >
                  <option value="HIGH_USAGE">🔥 High Shift Usage (Overuse Alert)</option>
                  <option value="HIGH_IDLE">⏳ Severe Idle Hours (Idle Anomaly)</option>
                  <option value="TEMPERATURE_SPIKE">🌡️ Engine Thermal Spike (104°C Critical)</option>
                  <option value="FUEL_ANOMALY">⛽ Fuel Consumption Anomaly</option>
                  <option value="GEOFENCE_VIOLATION">📍 Geofence Boundary Breach</option>
                  <option value="OVERDUE">⏰ Overdue Rental Return</option>
                  <option value="UNASSIGNED">👤 Unassigned Rented Machine</option>
                  <option value="NORMAL">✅ Reset to Normal (Clear Faults)</option>
                </select>
              </div>

              <div className="self-end">
                <Button
                  variant="cat"
                  size="sm"
                  onClick={() => simMutation.mutate()}
                  disabled={simMutation.isPending}
                  className="h-8 font-black text-xs gap-1.5 shadow-lg"
                >
                  {simMutation.isPending ? (
                    <>
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" /> Injecting...
                    </>
                  ) : (
                    <>
                      <Zap className="h-3.5 w-3.5" /> Inject Scenario
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>

          {simFeedback && (
            <div className="mt-3 pt-3 border-t border-neutral-800 text-xs font-mono font-bold text-cat-yellow flex items-center justify-between">
              <span>{simFeedback}</span>
              <button onClick={() => setSimFeedback(null)} className="text-muted-foreground hover:text-foreground">
                ✕
              </button>
            </div>
          )}
        </Card>
      )}

      {/* 8 KPI Cards Grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
        {/* Total Assets */}
        <Card className="border-l-4 border-l-cat-yellow">
          <CardContent className="p-4">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-medium uppercase">Total Fleet</span>
              <Truck className="h-4 w-4 text-cat-yellow" />
            </div>
            <div className="mt-2 text-2xl font-black text-foreground">{kpis.totalAssets}</div>
            <p className="text-[10px] text-muted-foreground mt-1">Industrial units</p>
          </CardContent>
        </Card>

        {/* Active / Rented */}
        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="p-4">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-medium uppercase">Rented / Active</span>
              <Activity className="h-4 w-4 text-blue-500" />
            </div>
            <div className="mt-2 text-2xl font-black text-blue-500">{kpis.rented}</div>
            <p className="text-[10px] text-muted-foreground mt-1">
              {formatPercent((kpis.rented / Math.max(1, kpis.totalAssets)) * 100)} of fleet
            </p>
          </CardContent>
        </Card>

        {/* Available */}
        <Card className="border-l-4 border-l-emerald-500">
          <CardContent className="p-4">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-medium uppercase">Available</span>
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            </div>
            <div className="mt-2 text-2xl font-black text-emerald-500">{kpis.available}</div>
            <p className="text-[10px] text-muted-foreground mt-1">Ready for dispatch</p>
          </CardContent>
        </Card>

        {/* Overdue */}
        <Card className="border-l-4 border-l-red-500">
          <CardContent className="p-4">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-medium uppercase">Overdue</span>
              <Clock className="h-4 w-4 text-red-500" />
            </div>
            <div className="mt-2 text-2xl font-black text-red-500">{kpis.overdue}</div>
            <p className="text-[10px] text-red-400 font-semibold mt-1">Requires follow-up</p>
          </CardContent>
        </Card>

        {/* Under-utilized */}
        <Card className="border-l-4 border-l-amber-500">
          <CardContent className="p-4">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-medium uppercase">Under-Utilized</span>
              <Flame className="h-4 w-4 text-amber-500" />
            </div>
            <div className="mt-2 text-2xl font-black text-amber-500">{kpis.underUtilized}</div>
            <p className="text-[10px] text-amber-400 mt-1">Reallocation candidates</p>
          </CardContent>
        </Card>

        {/* Avg Utilization */}
        <Card className="border-l-4 border-l-purple-500">
          <CardContent className="p-4">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-medium uppercase">Utilization</span>
              <TrendingUp className="h-4 w-4 text-purple-500" />
            </div>
            <div className="mt-2 text-2xl font-black text-purple-400">
              {formatPercent(kpis.avgUtilization)}
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">Fleet average</p>
          </CardContent>
        </Card>

        {/* Active Sites */}
        <Card className="border-l-4 border-l-cyan-500">
          <CardContent className="p-4">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-medium uppercase">Active Sites</span>
              <Building2 className="h-4 w-4 text-cyan-500" />
            </div>
            <div className="mt-2 text-2xl font-black text-cyan-400">{kpis.activeSites}</div>
            <p className="text-[10px] text-muted-foreground mt-1">Project locations</p>
          </CardContent>
        </Card>

        {/* In Maintenance */}
        <Card className="border-l-4 border-l-neutral-500">
          <CardContent className="p-4">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-medium uppercase">Service</span>
              <AlertTriangle className="h-4 w-4 text-neutral-400" />
            </div>
            <div className="mt-2 text-2xl font-black text-neutral-400">{kpis.inMaintenance}</div>
            <p className="text-[10px] text-muted-foreground mt-1">In shop / inspect</p>
          </CardContent>
        </Card>
      </div>

      {/* AI Recommendations Banner (Core Pitch: Where equipment should be next) */}
      {recommendations.length > 0 && (
        <div className="rounded-xl border-2 border-cat-yellow/60 bg-gradient-to-r from-cat-yellow/10 via-amber-500/5 to-transparent p-5 shadow-lg">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-cat-yellow animate-bounce" />
                <span className="text-xs font-bold uppercase tracking-wider text-cat-yellow">
                  AI Optimization Recommendation Engine
                </span>
                <Badge variant="default" className="text-[10px]">
                  Priority Score: {recommendations[0].score}/100
                </Badge>
              </div>
              <h3 className="text-base sm:text-lg font-bold text-foreground">
                Reallocate {recommendations[0].sourceEquipmentIds.join(' & ')} ({recommendations[0].equipmentType}s) → Site {recommendations[0].targetSiteId}
              </h3>
              <p className="text-xs sm:text-sm text-muted-foreground">
                {recommendations[0].reasons[0]} — {recommendations[0].reasons[1]}
              </p>
              <div className="flex flex-wrap gap-4 pt-1 text-xs font-semibold text-foreground">
                <span className="text-emerald-500">
                  📈 Expected Utilization Gain: +{recommendations[0].expectedImpact.utilizationGain}%
                </span>
                <span className="text-blue-500">
                  🎯 Shortage Coverage: {recommendations[0].expectedImpact.shortageCoverage}%
                </span>
                <span className="text-amber-400">
                  💰 Projected Delay Savings: ${formatNumber(recommendations[0].expectedImpact.costSaving)}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="cat"
                size="sm"
                onClick={() => executeMutation.mutate(recommendations[0]._id || recommendations[0].recommendationId)}
                disabled={executeMutation.isPending}
                className="gap-2 font-bold"
              >
                {executeMutation.isPending ? 'Executing...' : 'Approve & Execute Reallocation'}
                <ArrowRight className="h-4 w-4" />
              </Button>
              <Link to="/recommendations">
                <Button variant="ghost" size="sm">
                  View All ({recommendations.length})
                </Button>
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Analytics Charts Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Fleet Utilization Trend */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div>
              <CardTitle className="text-base font-bold">Fleet Utilization & Telemetry Trend</CardTitle>
              <p className="text-xs text-muted-foreground">Operating vs. Idle hours ratio across 14 days</p>
            </div>
            <Link to="/usage" className="text-xs text-cat-yellow hover:underline flex items-center gap-1">
              Detailed Analytics <ChevronRight className="h-3 w-3" />
            </Link>
          </CardHeader>
          <CardContent className="pt-2">
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trendData.length > 0 ? trendData : [
                  { date: 'Day 1', utilization: 62, operatingHours: 320, idleHours: 120 },
                  { date: 'Day 3', utilization: 68, operatingHours: 360, idleHours: 110 },
                  { date: 'Day 5', utilization: 74, operatingHours: 410, idleHours: 95 },
                  { date: 'Day 7', utilization: 71, operatingHours: 390, idleHours: 105 },
                  { date: 'Day 9', utilization: 78, operatingHours: 440, idleHours: 85 },
                  { date: 'Day 11', utilization: 82, operatingHours: 470, idleHours: 75 },
                  { date: 'Day 14', utilization: 79, operatingHours: 450, idleHours: 90 },
                ]}>
                  <defs>
                    <linearGradient id="utilGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#FFCD11" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#FFCD11" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#333" opacity={0.3} />
                  <XAxis dataKey="date" stroke="#888" fontSize={11} />
                  <YAxis stroke="#888" fontSize={11} domain={[0, 100]} unit="%" />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1a1a1a', borderColor: '#333', borderRadius: '8px' }}
                    formatter={(val: any) => [`${val}%`, 'Utilization']}
                  />
                  <Area
                    type="monotone"
                    dataKey="utilization"
                    stroke="#FFCD11"
                    strokeWidth={3}
                    fillOpacity={1}
                    fill="url(#utilGradient)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Predictive Shortage Forecast (Site S002 Focus) */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div>
              <CardTitle className="text-base font-bold">Predictive Demand Forecast</CardTitle>
              <p className="text-xs text-muted-foreground">Site S002 (Highway Expansion) — Excavators</p>
            </div>
            <Link to="/forecast" className="text-xs text-cat-yellow hover:underline flex items-center gap-1">
              Forecasts <ChevronRight className="h-3 w-3" />
            </Link>
          </CardHeader>
          <CardContent className="pt-2">
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={forecasts.length > 0 ? forecasts : [
                  { forecastDate: 'Sep 2', predictedDemand: 8, available: 3 },
                  { forecastDate: 'Sep 3', predictedDemand: 9, available: 3 },
                  { forecastDate: 'Sep 4', predictedDemand: 8, available: 3 },
                  { forecastDate: 'Sep 5', predictedDemand: 7, available: 3 },
                  { forecastDate: 'Sep 6', predictedDemand: 9, available: 3 },
                ]}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#333" opacity={0.3} />
                  <XAxis dataKey="forecastDate" stroke="#888" fontSize={11} />
                  <YAxis stroke="#888" fontSize={11} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1a1a1a', borderColor: '#333', borderRadius: '8px' }}
                  />
                  <Bar dataKey="predictedDemand" name="Predicted Demand" fill="#ef4444" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="available" name="Current Available" fill="#22c55e" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-2 flex items-center justify-between text-xs font-semibold bg-red-500/10 border border-red-500/20 text-red-400 p-2 rounded-lg">
              <span>⚠️ Shortage Risk: HIGH (+5 units deficit)</span>
              <Link to="/recommendations" className="underline font-bold text-cat-yellow">
                View Reallocations →
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Critical Alerts & Fleet Inventory Split */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Critical Alerts Panel */}
        <Card className="lg:col-span-1">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div>
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-red-500" />
                Active Risk Alerts ({activeAlerts.length})
              </CardTitle>
              <p className="text-xs text-muted-foreground">Automated overdue & anomaly detections</p>
            </div>
            <Link to="/alerts" className="text-xs text-cat-yellow hover:underline">
              View All
            </Link>
          </CardHeader>
          <CardContent className="space-y-3">
            {activeAlerts.slice(0, 4).map((alert) => (
              <div
                key={alert._id || alert.alertId}
                className="rounded-lg border border-border p-3 space-y-1.5 hover:bg-muted/40 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <Badge
                    variant={
                      alert.severity === 'CRITICAL' || alert.severity === 'HIGH'
                        ? 'destructive'
                        : 'secondary'
                    }
                    className="text-[10px]"
                  >
                    {alert.type} • {alert.severity}
                  </Badge>
                  <span className="text-[10px] text-muted-foreground">
                    {new Date(alert.createdAt || alert.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <p className="text-xs text-foreground font-medium">{alert.message}</p>
                <div className="flex items-center justify-between pt-1">
                  <span className="text-[11px] font-mono text-muted-foreground">
                    Asset: {alert.equipmentId}
                  </span>
                  <Link
                    to={`/equipment/${alert.equipmentId}`}
                    className="text-[11px] text-cat-yellow font-semibold hover:underline flex items-center gap-0.5"
                  >
                    Investigate <ChevronRight className="h-3 w-3" />
                  </Link>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Live Equipment Table */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3">
            <div>
              <CardTitle className="text-base font-bold">Fleet Telemetry & Status</CardTitle>
              <p className="text-xs text-muted-foreground">
                Showing {filteredEquipment.length} machines with live metrics
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search fleet ID, model..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="h-8 w-44 rounded-md border border-border bg-background pl-8 pr-3 text-xs focus:outline-none focus:ring-1 focus:ring-cat-yellow"
                />
              </div>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="h-8 rounded-md border border-border bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-cat-yellow"
              >
                <option value="ALL">All Statuses</option>
                <option value="AVAILABLE">Available</option>
                <option value="ACTIVE">Active</option>
                <option value="RENTED">Rented</option>
                <option value="IDLE">Idle</option>
                <option value="OVERDUE">Overdue</option>
                <option value="MAINTENANCE">Maintenance</option>
              </select>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-border text-muted-foreground">
                    <th className="pb-2 font-semibold">Equipment</th>
                    <th className="pb-2 font-semibold">Status</th>
                    <th className="pb-2 font-semibold">Site</th>
                    <th className="pb-2 font-semibold">Engine Hrs</th>
                    <th className="pb-2 font-semibold">Fuel</th>
                    <th className="pb-2 font-semibold">Health</th>
                    <th className="pb-2 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredEquipment.slice(0, 7).map((eq) => (
                    <tr key={eq.equipmentId} className="hover:bg-muted/40 transition-colors">
                      <td className="py-2.5 font-medium">
                        <Link
                          to={`/equipment/${eq.equipmentId}`}
                          className="font-bold text-foreground hover:text-cat-yellow flex items-center gap-1.5"
                        >
                          <span className="font-mono text-cat-yellow">{eq.equipmentId}</span>
                          <span className="text-muted-foreground">({eq.model})</span>
                        </Link>
                      </td>
                      <td className="py-2.5">
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
                          className="text-[10px]"
                        >
                          {eq.status}
                        </Badge>
                      </td>
                      <td className="py-2.5 text-muted-foreground">{eq.siteId || 'Unassigned'}</td>
                      <td className="py-2.5 font-mono">{formatNumber(eq.engineHours)} hrs</td>
                      <td className="py-2.5">
                        <div className="flex items-center gap-1.5">
                          <div className="w-12 h-1.5 bg-neutral-800 rounded-full overflow-hidden">
                            <div
                              className={`h-full ${
                                eq.fuelLevel < 20 ? 'bg-red-500' : 'bg-cat-yellow'
                              }`}
                              style={{ width: `${eq.fuelLevel}%` }}
                            />
                          </div>
                          <span className="font-mono text-[10px]">{eq.fuelLevel}%</span>
                        </div>
                      </td>
                      <td className="py-2.5">
                        <span
                          className={`font-semibold ${
                            eq.healthScore >= 90
                              ? 'text-emerald-500'
                              : eq.healthScore >= 75
                              ? 'text-amber-500'
                              : 'text-red-500'
                          }`}
                        >
                          {eq.healthScore}%
                        </span>
                      </td>
                      <td className="py-2.5 text-right">
                        <Link
                          to={`/equipment/${eq.equipmentId}`}
                          className="inline-flex items-center gap-1 font-semibold text-cat-yellow hover:underline"
                        >
                          Details <ChevronRight className="h-3 w-3" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-3 flex items-center justify-between border-t border-border pt-3 text-xs">
              <span className="text-muted-foreground">
                Showing top 7 of {filteredEquipment.length} machines
              </span>
              <Link to="/equipment" className="font-semibold text-cat-yellow hover:underline flex items-center gap-1">
                View Complete Fleet Inventory ({equipmentList.length}) <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
