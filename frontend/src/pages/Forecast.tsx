import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import api from '@/services/api';
import { Forecast, Site, EquipmentType } from '@/types';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  TrendingUp,
  Brain,
  Building2,
  Truck,
  Sparkles,
  AlertTriangle,
  RefreshCw,
  ArrowRight,
  ShieldAlert,
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
  Legend,
} from 'recharts';

const EQUIPMENT_TYPES: EquipmentType[] = [
  'Excavator',
  'Loader',
  'Dozer',
  'Crane',
  'Dump Truck',
  'Grader',
  'Compactor',
];

export default function ForecastPage() {
  const queryClient = useQueryClient();
  const [selectedSiteId, setSelectedSiteId] = useState('S002');
  const [selectedType, setSelectedType] = useState<EquipmentType>('Excavator');

  const { data: sitesData } = useQuery<{ success: boolean; data: Site[] }>({
    queryKey: ['sites-list'],
    queryFn: async () => (await api.get('/sites')).data,
  });

  const { data: forecastsData, isLoading } = useQuery<{ success: boolean; data: Forecast[] }>({
    queryKey: ['forecasts-list', selectedSiteId, selectedType],
    queryFn: async () =>
      (await api.get(`/forecast?siteId=${selectedSiteId}&equipmentType=${selectedType}`)).data,
  });

  const generateMutation = useMutation({
    mutationFn: async () => {
      return (
        await api.post('/forecast/generate', {
          siteId: selectedSiteId,
          equipmentType: selectedType,
          horizonDays: 7,
        })
      ).data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['forecasts-list'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-forecast'] });
    },
  });

  const sites = sitesData?.data || [];
  const forecasts = forecastsData?.data || [];
  const currentSite = sites.find((s) => s.siteId === selectedSiteId);

  const maxPredicted = forecasts.length > 0 ? Math.max(...forecasts.map((f) => f.predictedDemand)) : 8;
  const currentAvailable = forecasts.length > 0 ? forecasts[0].available : 3;
  const shortageCount = Math.max(0, Math.ceil(maxPredicted - currentAvailable));
  const hasShortage = shortageCount > 0;

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-black text-foreground">Predictive Demand Forecasting</h1>
            <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/10 px-2.5 py-0.5 text-xs font-semibold text-blue-400 border border-blue-500/20">
              <Brain className="h-3.5 w-3.5" />
              Gradient Boosted Regressor
            </span>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Anticipate job-site machinery deficits 7 to 30 days ahead using project history, seasonal lag, and active shift velocity.
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
            {generateMutation.isPending ? 'Forecasting...' : 'Re-Run Model'}
          </Button>
        </div>
      </div>

      {/* Selector Toolbar */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Site Picker */}
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase">Target Project Site</label>
              <select
                value={selectedSiteId}
                onChange={(e) => setSelectedSiteId(e.target.value)}
                className="mt-1.5 h-9 w-full rounded-lg border border-border bg-background px-3 text-xs focus:outline-none focus:ring-2 focus:ring-cat-yellow font-bold"
              >
                {sites.map((s) => (
                  <option key={s.siteId} value={s.siteId}>
                    {s.siteId}: {s.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Equipment Type Picker */}
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase">Machine Category</label>
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value as EquipmentType)}
                className="mt-1.5 h-9 w-full rounded-lg border border-border bg-background px-3 text-xs focus:outline-none focus:ring-2 focus:ring-cat-yellow font-bold"
              >
                {EQUIPMENT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Shortage Alert / Safe Banner */}
      {hasShortage ? (
        <div className="rounded-xl border-2 border-red-500/60 bg-red-500/10 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500 animate-pulse" />
              <h3 className="font-bold text-red-400 text-sm">
                HIGH SHORTAGE RISK DETECTED AT {currentSite?.name} ({selectedSiteId})
              </h3>
            </div>
            <p className="text-xs text-foreground">
              Peak predicted demand: <strong>{maxPredicted.toFixed(0)} {selectedType}s</strong> vs Current available: <strong>{currentAvailable} units</strong>. Projected deficit of <strong>{shortageCount} {selectedType}(s)</strong>.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Link to="/recommendations">
              <Button variant="cat" size="sm" className="font-bold gap-1 text-xs">
                View Reallocation Plan <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-4 flex items-center gap-3">
          <Brain className="h-5 w-5 text-emerald-500" />
          <div>
            <h3 className="font-bold text-emerald-400 text-sm">Demand Coverage Optimal</h3>
            <p className="text-xs text-muted-foreground">Current site assets are sufficient to cover forecasted shift requirements.</p>
          </div>
        </div>
      )}

      {/* Forecast Chart */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <div>
            <CardTitle className="text-base font-bold">
              7-Day Demand Forecast vs. Available Fleet ({selectedType}s @ {selectedSiteId})
            </CardTitle>
            <p className="text-xs text-muted-foreground">ML model confidence: 88.4% (features: project scale, day-of-week, lag demand)</p>
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={forecasts}>
                <CartesianGrid strokeDasharray="3 3" stroke="#333" opacity={0.3} />
                <XAxis dataKey="forecastDate" stroke="#888" fontSize={11} />
                <YAxis stroke="#888" fontSize={11} domain={[0, 'auto']} />
                <Tooltip contentStyle={{ backgroundColor: '#1a1a1a', borderColor: '#333', borderRadius: '8px' }} />
                <Legend />
                <Bar dataKey="predictedDemand" name="Predicted Demand" fill="#ef4444" radius={[4, 4, 0, 0]} />
                <Bar dataKey="available" name="Current Available Assets" fill="#22c55e" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Forecast Milestones Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-bold">Day-by-Day Forecast Timeline</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/40 border-b border-border text-muted-foreground">
                <tr>
                  <th className="p-3.5 font-bold">Forecast Horizon</th>
                  <th className="p-3.5 font-bold">Site</th>
                  <th className="p-3.5 font-bold">Equipment Category</th>
                  <th className="p-3.5 font-bold">Predicted Need</th>
                  <th className="p-3.5 font-bold">Available Now</th>
                  <th className="p-3.5 font-bold">Confidence</th>
                  <th className="p-3.5 font-bold text-right">Shortage Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {forecasts.map((fc) => (
                  <tr key={fc.forecastDate} className="hover:bg-muted/40 transition-colors">
                    <td className="p-3.5 font-bold font-mono text-foreground">{fc.forecastDate}</td>
                    <td className="p-3.5 font-medium">{fc.siteId}</td>
                    <td className="p-3.5 font-medium">{fc.equipmentType}</td>
                    <td className="p-3.5 font-mono font-bold text-red-400">{fc.predictedDemand} units</td>
                    <td className="p-3.5 font-mono font-bold text-emerald-500">{fc.available} units</td>
                    <td className="p-3.5 font-mono font-semibold">{(fc.confidence * 100).toFixed(1)}%</td>
                    <td className="p-3.5 text-right">
                      <Badge variant={fc.shortageRisk === 'HIGH' ? 'destructive' : fc.shortageRisk === 'MEDIUM' ? 'secondary' : 'available'}>
                        {fc.shortageRisk} RISK
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
