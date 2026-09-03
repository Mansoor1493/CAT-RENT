import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import api from '@/services/api';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  BarChart3,
  TrendingUp,
  Clock,
  Flame,
  DollarSign,
  Fuel,
  Activity,
  AlertTriangle,
  Lightbulb,
  ChevronRight,
  MapPin,
  Building2,
  Gauge,
  Layers,
  Truck,
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
import { formatNumber, formatPercent } from '@/lib/utils';

export default function UsagePage() {
  const [period, setPeriod] = useState('30');

  const { data: utilData, isLoading } = useQuery<{
    success: boolean;
    data: {
      trend: { date: string; utilization: number; operatingHours: number; idleHours: number; fuelConsumed: number }[];
      byType: { type: string; totalUnits: number; rentedUnits: number; utilizationRate: number; avgHealth: number; idleRatio: number }[];
      bySite: {
        siteId: string;
        siteName: string;
        address: string;
        totalUnits: number;
        rentedUnits: number;
        totalOpHours: number;
        totalIdleHours: number;
        fuelConsumed: number;
        downtimeHours: number;
        utilizationRate: number;
        avgHealth: number;
      }[];
      summary: {
        totalRentedHours: number;
        totalIdleHours: number;
        totalDowntime: number;
        totalFuelBurn: number;
      };
    };
  }>({
    queryKey: ['utilization-analytics', period],
    queryFn: async () => (await api.get(`/analytics/utilization?period=${period}`)).data,
  });

  const { data: costData } = useQuery<{
    success: boolean;
    data: {
      totalIdleHours: number;
      totalOperatingHours: number;
      estimatedIdleCost: number;
      totalRentalRevenue: number;
      potentialSavings: number;
      idleHourlyRate: number;
    };
  }>({
    queryKey: ['cost-analytics'],
    queryFn: async () => (await api.get('/analytics/cost')).data,
  });

  const trend = utilData?.data?.trend || [];
  const byType = utilData?.data?.byType || [];
  const bySite = utilData?.data?.bySite || [];
  const summary = utilData?.data?.summary || {
    totalRentedHours: 42800,
    totalIdleHours: 14200,
    totalDowntime: 9230,
    totalFuelBurn: 791800,
  };

  const cost = costData?.data || {
    totalIdleHours: 14200,
    totalOperatingHours: 42800,
    estimatedIdleCost: 639000,
    totalRentalRevenue: 1250000,
    potentialSavings: 242820,
    idleHourlyRate: 45,
  };

  const totalHours = cost.totalOperatingHours + cost.totalIdleHours;
  const fleetIdleRatio = totalHours > 0 ? (cost.totalIdleHours / totalHours) * 100 : 25;

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border pb-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-foreground">Usage Logging & Fleet Telemetry Analytics</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Engine runtime hours, fuel consumption, site-level usage, downtime analysis, and idle cost metrics.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-border bg-background p-1 text-xs">
            {['7', '14', '30', '90'].map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`rounded-md px-3 py-1 font-semibold transition-colors cursor-pointer ${
                  period === p ? 'bg-cat-yellow text-cat-black shadow-sm' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {p} Days
              </button>
            ))}
          </div>

          <Link to="/reallocations">
            <Button variant="cat" size="sm" className="gap-2 font-bold shadow-lg">
              <Lightbulb className="h-4 w-4" />
              View Reallocations
            </Button>
          </Link>
        </div>
      </div>

      {/* 4 Financial & Operational Cost Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Operating Run-Time */}
        <Card className="border-l-4 border-l-cat-yellow">
          <CardContent className="p-4">
            <div className="flex items-center justify-between text-muted-foreground text-xs font-semibold uppercase">
              <span>Total Rented Runtime</span>
              <Activity className="h-4 w-4 text-cat-yellow" />
            </div>
            <div className="mt-2 text-2xl font-black font-mono">{formatNumber(cost.totalOperatingHours)} hrs</div>
            <p className="text-[10px] text-muted-foreground mt-1">Productive active work on sites</p>
          </CardContent>
        </Card>

        {/* Total Idle Hours */}
        <Card className="border-l-4 border-l-orange-500">
          <CardContent className="p-4">
            <div className="flex items-center justify-between text-muted-foreground text-xs font-semibold uppercase">
              <span>Unproductive Idle Run</span>
              <Flame className="h-4 w-4 text-orange-500" />
            </div>
            <div className="mt-2 text-2xl font-black font-mono text-orange-400">
              {formatNumber(cost.totalIdleHours)} hrs
            </div>
            <p className="text-[10px] text-orange-400 font-semibold mt-1">
              Fleet Idle Ratio: {formatPercent(fleetIdleRatio)}
            </p>
          </CardContent>
        </Card>

        {/* Fuel Consumption & Downtime */}
        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="p-4">
            <div className="flex items-center justify-between text-muted-foreground text-xs font-semibold uppercase">
              <span>Total Fuel Consumed</span>
              <Fuel className="h-4 w-4 text-blue-400" />
            </div>
            <div className="mt-2 text-2xl font-black font-mono text-blue-400">
              {formatNumber(summary.totalFuelBurn)} gal
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">Downtime: ~{formatNumber(summary.totalDowntime)} hrs</p>
          </CardContent>
        </Card>

        {/* Potential Optimization Savings */}
        <Card className="border-l-4 border-l-emerald-500">
          <CardContent className="p-4">
            <div className="flex items-center justify-between text-muted-foreground text-xs font-semibold uppercase">
              <span>Reallocation Savings</span>
              <TrendingUp className="h-4 w-4 text-emerald-500" />
            </div>
            <div className="mt-2 text-2xl font-black font-mono text-emerald-500">
              ${formatNumber(cost.potentialSavings)}
            </div>
            <p className="text-[10px] text-emerald-400 font-semibold mt-1">38% reachable idle reduction</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Charts: Daily Trend & Type Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Daily Operating vs Idle Trend */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-bold">Daily Hours Breakdown (Operating vs. Idle)</CardTitle>
            <p className="text-xs text-muted-foreground">Historical telemetry timeline across selected period</p>
          </CardHeader>
          <CardContent>
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trend}>
                  <defs>
                    <linearGradient id="opGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#FFCD11" stopOpacity={0.5} />
                      <stop offset="95%" stopColor="#FFCD11" stopOpacity={0.0} />
                    </linearGradient>
                    <linearGradient id="idleGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f97316" stopOpacity={0.5} />
                      <stop offset="95%" stopColor="#f97316" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#333" opacity={0.3} />
                  <XAxis dataKey="date" stroke="#888" fontSize={11} />
                  <YAxis stroke="#888" fontSize={11} unit="h" />
                  <Tooltip contentStyle={{ backgroundColor: '#1a1a1a', borderColor: '#333', borderRadius: '8px' }} />
                  <Legend />
                  <Area type="monotone" dataKey="operatingHours" name="Operating Hours" stroke="#FFCD11" fill="url(#opGrad)" strokeWidth={2} />
                  <Area type="monotone" dataKey="idleHours" name="Idle Hours" stroke="#f97316" fill="url(#idleGrad)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Utilization Rate by Equipment Class */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-bold">Utilization by Machine Classification</CardTitle>
            <p className="text-xs text-muted-foreground">Category comparison of efficiency and fleet demand</p>
          </CardHeader>
          <CardContent>
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={byType} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#333" opacity={0.3} />
                  <XAxis type="number" stroke="#888" fontSize={11} domain={[0, 100]} unit="%" />
                  <YAxis type="category" dataKey="type" stroke="#888" fontSize={11} width={90} />
                  <Tooltip contentStyle={{ backgroundColor: '#1a1a1a', borderColor: '#333', borderRadius: '8px' }} />
                  <Bar dataKey="utilizationRate" name="Utilization %" fill="#FFCD11" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Site-Level Usage Breakdown Table */}
      <Card>
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <Building2 className="h-4 w-4 text-cat-yellow" />
              Site-Level Usage, Fuel & Downtime Breakdown
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              Geospatial aggregation of machine hours, fuel burn, and idle downtime per project location.
            </p>
          </div>
          <Link to="/map">
            <Button variant="outline" size="sm" className="h-7 text-xs font-bold gap-1">
              <MapPin className="h-3.5 w-3.5 text-cat-yellow" /> Live Map View
            </Button>
          </Link>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/40 border-b border-border text-muted-foreground">
                <tr>
                  <th className="p-3.5 font-bold">Project Site</th>
                  <th className="p-3.5 font-bold">Total Units</th>
                  <th className="p-3.5 font-bold">Active Rented</th>
                  <th className="p-3.5 font-bold">Runtime Hours</th>
                  <th className="p-3.5 font-bold">Idle Hours</th>
                  <th className="p-3.5 font-bold">Fuel Consumed</th>
                  <th className="p-3.5 font-bold">Est. Downtime</th>
                  <th className="p-3.5 font-bold">Utilization Rate</th>
                  <th className="p-3.5 font-bold text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {bySite.map((site) => (
                  <tr key={site.siteId} className="hover:bg-muted/40 transition-colors">
                    <td className="p-3.5">
                      <div className="font-bold text-foreground">{site.siteName}</div>
                      <div className="text-[10px] text-muted-foreground font-mono">{site.siteId} • {site.address}</div>
                    </td>
                    <td className="p-3.5 font-mono">{site.totalUnits} units</td>
                    <td className="p-3.5 font-mono font-bold text-blue-400">{site.rentedUnits} units</td>
                    <td className="p-3.5 font-mono font-bold text-cat-yellow">{formatNumber(site.totalOpHours)}h</td>
                    <td className="p-3.5 font-mono text-orange-400">{formatNumber(site.totalIdleHours)}h</td>
                    <td className="p-3.5 font-mono text-foreground">{formatNumber(site.fuelConsumed)} gal</td>
                    <td className="p-3.5 font-mono text-muted-foreground">{formatNumber(site.downtimeHours)}h</td>
                    <td className="p-3.5 font-mono font-bold text-foreground">{formatPercent(site.utilizationRate)}</td>
                    <td className="p-3.5 text-right">
                      {site.utilizationRate < 50 ? (
                        <Badge variant="destructive" className="text-[10px]">
                          Low Efficiency
                        </Badge>
                      ) : (
                        <Badge variant="available" className="text-[10px]">
                          Active Run
                        </Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Equipment Category Breakdown Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-bold">Equipment Category Fleet Efficiency Table</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/40 border-b border-border text-muted-foreground">
                <tr>
                  <th className="p-3.5 font-bold">Category</th>
                  <th className="p-3.5 font-bold">Total Fleet</th>
                  <th className="p-3.5 font-bold">Active Rented</th>
                  <th className="p-3.5 font-bold">Utilization Rate</th>
                  <th className="p-3.5 font-bold">Idle Ratio</th>
                  <th className="p-3.5 font-bold">Average Health</th>
                  <th className="p-3.5 font-bold text-right">Optimization Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {byType.map((t) => (
                  <tr key={t.type} className="hover:bg-muted/40 transition-colors">
                    <td className="p-3.5 font-bold text-foreground">{t.type}</td>
                    <td className="p-3.5 font-mono">{t.totalUnits} units</td>
                    <td className="p-3.5 font-mono font-semibold text-blue-400">{t.rentedUnits} units</td>
                    <td className="p-3.5 font-mono font-bold text-cat-yellow">{formatPercent(t.utilizationRate)}</td>
                    <td className="p-3.5 font-mono text-orange-400">{formatPercent(t.idleRatio)}</td>
                    <td className="p-3.5 font-mono font-semibold text-emerald-500">{t.avgHealth}%</td>
                    <td className="p-3.5 text-right">
                      {t.utilizationRate < 45 ? (
                        <Badge variant="destructive" className="text-[10px]">
                          Under-Utilized Reallocation
                        </Badge>
                      ) : (
                        <Badge variant="available" className="text-[10px]">
                          Optimal Flow
                        </Badge>
                      )}
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
