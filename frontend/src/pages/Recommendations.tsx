import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import api from '@/services/api';
import { Recommendation, Site, Equipment } from '@/types';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Lightbulb,
  Sparkles,
  ArrowRight,
  RefreshCw,
  CheckCircle2,
  TrendingUp,
  DollarSign,
  ShieldCheck,
  Building2,
  Truck,
  ExternalLink,
} from 'lucide-react';
import { formatNumber } from '@/lib/utils';

export default function RecommendationsPage() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [executionMessage, setExecutionMessage] = useState<string | null>(null);

  const { data: recData, isLoading } = useQuery<{ success: boolean; data: Recommendation[] }>({
    queryKey: ['recommendations-list', statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statusFilter !== 'ALL') params.append('status', statusFilter);
      return (await api.get(`/recommendations?${params.toString()}`)).data;
    },
    refetchInterval: 15000,
  });

  const generateMutation = useMutation({
    mutationFn: async () => {
      return (await api.post('/recommendations/generate')).data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recommendations-list'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-recommendations'] });
    },
  });

  const executeMutation = useMutation({
    mutationFn: async (id: string) => {
      return (await api.post(`/recommendations/${id}/execute`)).data;
    },
    onSuccess: (data) => {
      setExecutionMessage(data.message || '✅ Reallocation executed successfully!');
      queryClient.invalidateQueries({ queryKey: ['recommendations-list'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-recommendations'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-kpis'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-equipment'] });
    },
  });

  const recommendations = recData?.data || [];

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-black text-foreground">
              Predictive Asset Reallocation Engine
            </h1>
            <span className="inline-flex items-center gap-1 rounded-full bg-cat-yellow/15 px-2.5 py-0.5 text-xs font-bold text-cat-yellow border border-cat-yellow/30">
              <Sparkles className="h-3.5 w-3.5" />
              Prescriptive Optimization
            </span>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            “We don't just tell the rental manager where equipment is. We tell them where it should be next.”
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="cat"
            size="sm"
            onClick={() => generateMutation.mutate()}
            disabled={generateMutation.isPending}
            className="gap-2 font-bold"
          >
            <RefreshCw className={`h-4 w-4 ${generateMutation.isPending ? 'animate-spin' : ''}`} />
            {generateMutation.isPending ? 'Optimizing...' : 'Generate New Decisions'}
          </Button>
        </div>
      </div>

      {executionMessage && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-sm font-bold text-emerald-400 flex items-center justify-between">
          <span>{executionMessage}</span>
          <button onClick={() => setExecutionMessage(null)} className="text-xs text-muted-foreground hover:text-foreground">
            ✕
          </button>
        </div>
      )}

      {/* Recommendations Cards List */}
      <div className="space-y-6">
        {recommendations.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground space-y-2">
              <CheckCircle2 className="h-10 w-10 text-emerald-500 mx-auto" />
              <h3 className="font-bold text-foreground">Fleet Perfectly Balanced</h3>
              <p className="text-xs">No pending asset deficits or under-utilization imbalances detected across active job sites.</p>
            </CardContent>
          </Card>
        ) : (
          recommendations.map((rec) => (
            <Card
              key={rec._id || rec.recommendationId}
              className={`border-2 transition-all ${
                rec.status === 'EXECUTED'
                  ? 'border-emerald-500/40 bg-emerald-500/5'
                  : 'border-cat-yellow/60 bg-gradient-to-r from-cat-yellow/5 to-transparent'
              }`}
            >
              <CardContent className="p-6 space-y-5">
                {/* Top Title & Score */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-border pb-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Badge variant="default" className="font-mono text-xs">
                        {rec.action}
                      </Badge>
                      <span className="font-mono font-bold text-cat-yellow">{rec.recommendationId}</span>
                      <Badge variant={rec.status === 'EXECUTED' ? 'available' : 'secondary'}>
                        {rec.status}
                      </Badge>
                    </div>
                    <h3 className="text-lg font-black text-foreground pt-0.5">
                      Dispatch {rec.sourceEquipmentIds.join(' & ')} ({rec.equipmentType}s) → Site {rec.targetSiteId} ({rec.targetSite?.name || 'Expansion Project'})
                    </h3>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className="text-[10px] text-muted-foreground font-semibold uppercase">Priority Score</div>
                      <div className="text-2xl font-black font-mono text-cat-yellow">{rec.score}/100</div>
                    </div>

                    {rec.status !== 'EXECUTED' && (
                      <Button
                        variant="cat"
                        size="sm"
                        onClick={() => executeMutation.mutate(rec._id || rec.recommendationId)}
                        disabled={executeMutation.isPending}
                        className="gap-2 font-bold shadow-md"
                      >
                        {executeMutation.isPending ? 'Executing...' : 'Approve & Execute'}
                        <ArrowRight className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>

                {/* 3 Pillars: WHAT? WHY? EXPECTED IMPACT? */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* WHAT? */}
                  <div className="p-4 bg-muted/30 rounded-xl border border-border space-y-2">
                    <div className="flex items-center gap-2 text-cat-yellow font-bold text-xs uppercase tracking-wider">
                      <Truck className="h-4 w-4" /> 1. Operational Action (WHAT?)
                    </div>
                    <p className="text-xs text-foreground font-medium">
                      Physically reallocate {rec.sourceEquipmentIds.length} under-utilized {rec.equipmentType}(s) from origin facility to high-demand Site {rec.targetSiteId}.
                    </p>
                    <div className="text-[11px] font-mono text-muted-foreground">
                      Target Equipment: <strong>{rec.sourceEquipmentIds.join(', ')}</strong>
                    </div>
                  </div>

                  {/* WHY? */}
                  <div className="p-4 bg-muted/30 rounded-xl border border-border space-y-2">
                    <div className="flex items-center gap-2 text-blue-400 font-bold text-xs uppercase tracking-wider">
                      <Building2 className="h-4 w-4" /> 2. Machine Intelligence (WHY?)
                    </div>
                    <ul className="text-xs text-foreground space-y-1">
                      {rec.reasons.map((reason, i) => (
                        <li key={i} className="flex items-start gap-1.5 text-[11px]">
                          <span className="text-blue-400 font-bold">•</span>
                          <span>{reason}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* EXPECTED IMPACT? */}
                  <div className="p-4 bg-muted/30 rounded-xl border border-border space-y-2">
                    <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs uppercase tracking-wider">
                      <TrendingUp className="h-4 w-4" /> 3. Expected Business Impact
                    </div>
                    <div className="space-y-1.5 pt-1 text-xs">
                      <div className="flex justify-between font-semibold">
                        <span className="text-muted-foreground">Utilization Gain:</span>
                        <span className="text-emerald-400 font-bold font-mono">
                          +{rec.expectedImpact.utilizationGain}%
                        </span>
                      </div>
                      <div className="flex justify-between font-semibold">
                        <span className="text-muted-foreground">Shortage Coverage:</span>
                        <span className="text-blue-400 font-bold font-mono">
                          {rec.expectedImpact.shortageCoverage}%
                        </span>
                      </div>
                      <div className="flex justify-between font-semibold">
                        <span className="text-muted-foreground">Projected Cost Savings:</span>
                        <span className="text-cat-yellow font-bold font-mono">
                          ${formatNumber(rec.expectedImpact.costSaving)}
                        </span>
                      </div>
                    </div>
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
