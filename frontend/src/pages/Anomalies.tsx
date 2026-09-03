import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import api from '@/services/api';
import { Anomaly, Equipment } from '@/types';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  AlertTriangle,
  Brain,
  Sparkles,
  RefreshCw,
  CheckCircle2,
  ChevronRight,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import { formatPercent } from '@/lib/utils';

export default function AnomaliesPage() {
  const queryClient = useQueryClient();
  const [severityFilter, setSeverityFilter] = useState('ALL');

  const { data: anomaliesData, isLoading } = useQuery<{ success: boolean; data: Anomaly[] }>({
    queryKey: ['anomalies-list', severityFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (severityFilter !== 'ALL') params.append('severity', severityFilter);
      return (await api.get(`/anomalies?${params.toString()}`)).data;
    },
    refetchInterval: 15000,
  });

  const scanMutation = useMutation({
    mutationFn: async () => {
      return (await api.post('/anomalies/run')).data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['anomalies-list'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-alerts'] });
    },
  });

  const acknowledgeMutation = useMutation({
    mutationFn: async (id: string) => {
      return (await api.put(`/anomalies/${id}/acknowledge`)).data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['anomalies-list'] });
    },
  });

  const anomalies = anomaliesData?.data || [];

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-black text-foreground">Explainable Anomaly Detection</h1>
            <span className="inline-flex items-center gap-1 rounded-full bg-purple-500/10 px-2.5 py-0.5 text-xs font-semibold text-purple-400 border border-purple-500/20">
              <Brain className="h-3.5 w-3.5" />
              Isolation Forest ML Engine
            </span>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Multivariate statistical machine learning identifying abnormal idle durations, missing operators, and unexpected fuel burn.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="cat"
            size="sm"
            onClick={() => scanMutation.mutate()}
            disabled={scanMutation.isPending}
            className="gap-2 font-bold"
          >
            <RefreshCw className={`h-4 w-4 ${scanMutation.isPending ? 'animate-spin' : ''}`} />
            {scanMutation.isPending ? 'Running ML Pipeline...' : 'Trigger Anomaly Scan'}
          </Button>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-l-4 border-l-purple-500">
          <CardContent className="p-4">
            <div className="flex items-center justify-between text-muted-foreground text-xs font-semibold uppercase">
              <span>Detection Architecture</span>
              <Brain className="h-4 w-4 text-purple-400" />
            </div>
            <div className="mt-1 text-sm font-bold text-foreground">Dual Hybrid Model</div>
            <p className="text-[11px] text-muted-foreground mt-1">
              Deterministic boundary rules + scikit-learn Isolation Forest
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-red-500">
          <CardContent className="p-4">
            <div className="flex items-center justify-between text-muted-foreground text-xs font-semibold uppercase">
              <span>Flagged Anomalies</span>
              <AlertTriangle className="h-4 w-4 text-red-500" />
            </div>
            <div className="mt-1 text-2xl font-black font-mono text-red-500">{anomalies.length}</div>
            <p className="text-[11px] text-muted-foreground mt-1">Machines requiring immediate review</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-cat-yellow">
          <CardContent className="p-4">
            <div className="flex items-center justify-between text-muted-foreground text-xs font-semibold uppercase">
              <span>Explainability Score</span>
              <Zap className="h-4 w-4 text-cat-yellow" />
            </div>
            <div className="mt-1 text-sm font-bold text-foreground">100% Transparent Reasons</div>
            <p className="text-[11px] text-muted-foreground mt-1">Zero black-box decisions; exact causal factors</p>
          </CardContent>
        </Card>
      </div>

      {/* Filter Toolbar */}
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold text-foreground">Active Anomalous Assets ({anomalies.length})</h2>

        <select
          value={severityFilter}
          onChange={(e) => setSeverityFilter(e.target.value)}
          className="h-8 rounded-lg border border-border bg-background px-3 text-xs"
        >
          <option value="ALL">All Severities</option>
          <option value="CRITICAL">Critical</option>
          <option value="HIGH">High</option>
          <option value="MEDIUM">Medium</option>
        </select>
      </div>

      {/* Anomalies List */}
      <div className="space-y-4">
        {anomalies.map((anom) => (
          <Card
            key={anom._id}
            className={`border-2 transition-all ${
              anom.severity === 'CRITICAL'
                ? 'border-red-500/60 bg-red-500/5'
                : anom.severity === 'HIGH'
                ? 'border-orange-500/60 bg-orange-500/5'
                : 'border-border'
            }`}
          >
            <CardContent className="p-5">
              <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                {/* Left: Machine & Score */}
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-lg font-black text-cat-yellow">{anom.equipmentId}</span>
                    <Badge variant={anom.severity === 'CRITICAL' || anom.severity === 'HIGH' ? 'destructive' : 'secondary'}>
                      {anom.severity}
                    </Badge>
                    <Badge variant="outline" className="font-mono text-[10px]">
                      Method: {anom.detectionMethod || 'Isolation Forest ML'}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      Scored: {new Date(anom.timestamp || anom.date || new Date().toISOString()).toLocaleDateString()}
                    </span>
                  </div>

                  <div className="text-sm font-semibold text-foreground">
                    Confidence Anomaly Score: <strong className="text-red-400 font-mono">{(((anom.score ?? anom.anomalyScore ?? 0.85)) * 100).toFixed(0)}%</strong>
                  </div>

                  {/* Explainable Factors List */}
                  <div className="space-y-1 pt-1">
                    <span className="text-xs font-bold text-muted-foreground uppercase">Explainable Causal Reasons:</span>
                    <ul className="text-xs text-foreground space-y-1">
                      {(anom.reasons || [anom.explanation || 'Operational metric exceeded baseline threshold']).map((r: string, i: number) => (
                        <li key={i} className="flex items-start gap-2">
                          <span className="text-red-500 font-bold">•</span>
                          <span>{r}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Right: Actions */}
                <div className="flex flex-col sm:flex-row lg:flex-col gap-2 min-w-44">
                  <Link to={`/equipment/${anom.equipmentId}`}>
                    <Button variant="default" size="sm" className="w-full font-bold">
                      Inspect Machine Telemetry
                    </Button>
                  </Link>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full text-xs"
                    onClick={() => acknowledgeMutation.mutate(anom._id)}
                    disabled={anom.status === 'ACKNOWLEDGED' || anom.acknowledged || acknowledgeMutation.isPending}
                  >
                    {anom.status === 'ACKNOWLEDGED' || anom.acknowledged ? 'Acknowledged' : 'Acknowledge Risk'}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
