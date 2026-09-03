import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import api from '@/services/api';
import { Alert } from '@/types';
import { getSocket } from '@/services/socket';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Bell,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Filter,
  Search,
  ChevronRight,
  ShieldAlert,
  Flame,
  Thermometer,
  RotateCcw,
  Sparkles,
  ArrowRight,
  TrendingDown,
  Info,
} from 'lucide-react';

export default function AlertsPage() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<'ACTIVE' | 'RESOLVED' | 'ALL'>('ACTIVE');
  const [severityFilter, setSeverityFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const { data: alertsData, isLoading, refetch } = useQuery<{ success: boolean; data: Alert[] }>({
    queryKey: ['alerts-list', statusFilter, severityFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statusFilter !== 'ALL') params.append('status', statusFilter);
      if (severityFilter !== 'ALL') params.append('severity', severityFilter);
      return (await api.get(`/alerts?${params.toString()}`)).data;
    },
    refetchInterval: 6000,
  });

  // Real-Time Socket.IO Refresh
  useEffect(() => {
    const socket = getSocket();
    const handleNewAlert = () => {
      queryClient.invalidateQueries({ queryKey: ['alerts-list'] });
    };
    const handleResolvedAlert = () => {
      queryClient.invalidateQueries({ queryKey: ['alerts-list'] });
    };

    socket.on('alert:new', handleNewAlert);
    socket.on('alert:resolved', handleResolvedAlert);

    return () => {
      socket.off('alert:new', handleNewAlert);
      socket.off('alert:resolved', handleResolvedAlert);
    };
  }, [queryClient]);

  const resolveMutation = useMutation({
    mutationFn: async (alertId: string) => {
      return (await api.put(`/alerts/${alertId}/resolve`)).data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alerts-list'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-alerts'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-kpis'] });
    },
  });

  const alerts = alertsData?.data || [];

  // Filter by search query
  const filteredAlerts = alerts.filter((a) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      a.equipmentId?.toLowerCase().includes(q) ||
      a.type?.toLowerCase().includes(q) ||
      a.title?.toLowerCase().includes(q) ||
      a.message?.toLowerCase().includes(q) ||
      a.recommendation?.toLowerCase().includes(q) ||
      a.siteId?.toLowerCase().includes(q)
    );
  });

  const activeCount = alerts.filter((a) => a.status === 'ACTIVE').length;
  const criticalCount = alerts.filter((a) => a.status === 'ACTIVE' && a.severity === 'CRITICAL').length;
  const highCount = alerts.filter((a) => a.status === 'ACTIVE' && a.severity === 'HIGH').length;

  return (
    <div className="space-y-6 pb-12 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-black text-foreground">Operational Risk Alerts</h1>
            <Badge variant="destructive" className="font-mono text-xs">
              {activeCount} Active Alerts
            </Badge>
            {criticalCount > 0 && (
              <Badge variant="destructive" className="bg-red-600 font-mono text-xs animate-pulse">
                {criticalCount} CRITICAL
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Real-time rule engine detecting machine overuse, idle anomalies, thermal spikes, fuel drops, and overdue returns.
          </p>
        </div>

        {/* Action button */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            className="gap-1.5 text-xs font-bold"
          >
            <RotateCcw className="h-3.5 w-3.5" /> Refresh Feed
          </Button>
        </div>
      </div>

      {/* 3 Metric Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl border border-red-500/30 bg-red-500/10 flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-red-400 uppercase">Critical Severity</span>
            <div className="text-2xl font-black font-mono text-red-500 mt-1">{criticalCount}</div>
            <p className="text-[11px] text-red-300/80">Immediate field intervention required</p>
          </div>
          <ShieldAlert className="h-8 w-8 text-red-500 flex-shrink-0" />
        </div>

        <div className="p-4 rounded-xl border border-orange-500/30 bg-orange-500/10 flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-orange-400 uppercase">High Priority</span>
            <div className="text-2xl font-black font-mono text-orange-500 mt-1">{highCount}</div>
            <p className="text-[11px] text-orange-300/80">Severe idle or overdue contract</p>
          </div>
          <AlertTriangle className="h-8 w-8 text-orange-500 flex-shrink-0" />
        </div>

        <div className="p-4 rounded-xl border border-border bg-card flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-muted-foreground uppercase">Total Alert History</span>
            <div className="text-2xl font-black font-mono text-foreground mt-1">{alerts.length}</div>
            <p className="text-[11px] text-muted-foreground">Persisted in MongoDB audit log</p>
          </div>
          <Bell className="h-8 w-8 text-cat-yellow flex-shrink-0" />
        </div>
      </div>

      {/* Filter Toolbar */}
      <Card className="p-4 border-border bg-card">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Status Tabs */}
          <div className="flex items-center gap-1.5 bg-muted/40 p-1 rounded-lg border border-border">
            <button
              onClick={() => setStatusFilter('ACTIVE')}
              className={`px-3 py-1 rounded text-xs font-bold transition-colors cursor-pointer ${
                statusFilter === 'ACTIVE'
                  ? 'bg-cat-yellow text-cat-black shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Active Alerts ({activeCount})
            </button>
            <button
              onClick={() => setStatusFilter('RESOLVED')}
              className={`px-3 py-1 rounded text-xs font-bold transition-colors cursor-pointer ${
                statusFilter === 'RESOLVED'
                  ? 'bg-cat-yellow text-cat-black shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Resolved History
            </button>
            <button
              onClick={() => setStatusFilter('ALL')}
              className={`px-3 py-1 rounded text-xs font-bold transition-colors cursor-pointer ${
                statusFilter === 'ALL'
                  ? 'bg-cat-yellow text-cat-black shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              All Records
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Search Input */}
            <div className="relative min-w-[200px]">
              <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search machine, type, or key..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-8 pl-8 text-xs bg-background"
              />
            </div>

            {/* Severity Filter */}
            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
              className="h-8 rounded-lg border border-border bg-background px-3 text-xs font-semibold"
            >
              <option value="ALL">All Severities</option>
              <option value="CRITICAL">🔴 Critical Only</option>
              <option value="HIGH">🟠 High Priority</option>
              <option value="WARNING">🟡 Warning</option>
              <option value="INFO">🔵 Info</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Alerts Feed */}
      <div className="space-y-3.5">
        {filteredAlerts.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center text-muted-foreground space-y-3">
              <CheckCircle2 className="h-12 w-12 text-emerald-500 mx-auto opacity-70" />
              <h3 className="font-bold text-foreground text-base">No Matching Risk Alerts Found</h3>
              <p className="text-xs max-w-sm mx-auto">
                No active or historical alerts match your selected filters. All telemetry streams are operating within safe Caterpillar tolerance limits.
              </p>
            </CardContent>
          </Card>
        ) : (
          filteredAlerts.map((alert) => (
            <Card
              key={alert._id || alert.alertId}
              className={`transition-all border-l-4 shadow-md ${
                alert.severity === 'CRITICAL'
                  ? 'border-l-red-600 bg-red-950/10 border-red-500/30'
                  : alert.severity === 'HIGH'
                  ? 'border-l-orange-500 bg-orange-950/10 border-orange-500/30'
                  : alert.severity === 'WARNING'
                  ? 'border-l-amber-500 bg-amber-950/10 border-amber-500/30'
                  : 'border-l-blue-500 bg-blue-950/10 border-blue-500/30'
              }`}
            >
              <CardContent className="p-5 space-y-3">
                {/* Header Line */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge
                      variant={
                        alert.severity === 'CRITICAL' || alert.severity === 'HIGH'
                          ? 'destructive'
                          : 'secondary'
                      }
                      className="font-bold text-[10px] uppercase"
                    >
                      {alert.type} • {alert.severity}
                    </Badge>

                    <span className="font-mono text-xs font-black text-cat-yellow bg-black/40 px-2 py-0.5 rounded border border-cat-yellow/30">
                      {alert.equipmentId}
                    </span>

                    {alert.siteId && (
                      <span className="text-xs text-muted-foreground">
                        Site: <strong className="text-foreground">{alert.siteId}</strong>
                      </span>
                    )}

                    <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3" /> {new Date(alert.createdAt || alert.timestamp).toLocaleString()}
                    </span>

                    {alert.status === 'RESOLVED' && (
                      <Badge variant="outline" className="text-emerald-400 border-emerald-500 text-[10px]">
                        RESOLVED
                      </Badge>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    {alert.status === 'ACTIVE' && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs h-8 font-bold border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10"
                        onClick={() => resolveMutation.mutate(alert._id || alert.alertId)}
                        disabled={resolveMutation.isPending}
                      >
                        <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                        Resolve
                      </Button>
                    )}

                    <Link to={`/equipment/${alert.equipmentId}`}>
                      <Button variant="cat" size="sm" className="text-xs h-8 font-bold gap-1">
                        Inspect Asset <ChevronRight className="h-3.5 w-3.5" />
                      </Button>
                    </Link>
                  </div>
                </div>

                {/* Title & Message */}
                <div>
                  <h4 className="text-sm font-black text-foreground">{alert.title || alert.type}</h4>
                  <p className="text-xs text-foreground mt-1 leading-relaxed">{alert.message}</p>
                </div>

                {/* Metric Comparison & Recommendation Box */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
                  {/* Metric Box */}
                  {(alert.currentValue || alert.threshold) && (
                    <div className="p-3 bg-neutral-900/80 rounded-xl border border-neutral-800 text-xs space-y-1">
                      <div className="text-[10px] font-bold text-muted-foreground uppercase">
                        Metric Comparison
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Observed:</span>
                        <strong className="font-mono text-cat-yellow">{alert.currentValue || 'N/A'}</strong>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Threshold:</span>
                        <span className="font-mono text-muted-foreground">{alert.threshold || 'N/A'}</span>
                      </div>
                    </div>
                  )}

                  {/* Actionable Recommendation */}
                  <div className={`p-3 rounded-xl border text-xs space-y-1 ${
                    alert.currentValue || alert.threshold ? 'md:col-span-2' : 'md:col-span-3'
                  } bg-neutral-900/60 border-neutral-800`}>
                    <div className="text-[10px] font-bold text-cat-yellow uppercase flex items-center gap-1">
                      <Sparkles className="h-3 w-3" /> Recommended Corrective Action
                    </div>
                    <p className="text-xs text-foreground font-medium">
                      {alert.recommendation || 'Review operational logs and dispatch maintenance technician if necessary.'}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
