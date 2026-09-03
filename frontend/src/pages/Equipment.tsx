import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import api from '@/services/api';
import { Equipment, Site } from '@/types';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Truck,
  Search,
  Filter,
  QrCode,
  MapPin,
  User,
  Activity,
  Fuel,
  HeartPulse,
  ExternalLink,
  Plus,
  ChevronRight,
  Sparkles,
} from 'lucide-react';
import { formatNumber } from '@/lib/utils';
import QRCodeModal from '@/components/common/QRCodeModal';

const EQUIPMENT_TYPES = [
  'ALL',
  'Excavator',
  'Loader',
  'Dozer',
  'Crane',
  'Dump Truck',
  'Grader',
  'Compactor',
];

const STATUS_FILTERS = [
  'ALL',
  'AVAILABLE',
  'ACTIVE',
  'RENTED',
  'IDLE',
  'OVERDUE',
  'MAINTENANCE',
];

export default function EquipmentPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState('ALL');
  const [selectedStatus, setSelectedStatus] = useState('ALL');
  const [selectedSite, setSelectedSite] = useState('ALL');
  const [selectedEquipmentForQR, setSelectedEquipmentForQR] = useState<Equipment | null>(null);

  const { data: equipmentData, isLoading } = useQuery<{ success: boolean; data: Equipment[] }>({
    queryKey: ['equipment-list'],
    queryFn: async () => (await api.get('/equipment?limit=200')).data,
    refetchInterval: 15000,
  });

  const { data: sitesData } = useQuery<{ success: boolean; data: Site[] }>({
    queryKey: ['sites-list'],
    queryFn: async () => (await api.get('/sites')).data,
  });

  const equipmentList = equipmentData?.data || [];
  const sites = sitesData?.data || [];

  const filtered = equipmentList.filter((eq) => {
    const matchesSearch =
      eq.equipmentId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      eq.model.toLowerCase().includes(searchTerm.toLowerCase()) ||
      eq.serialNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      eq.qrCode.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesType = selectedType === 'ALL' || eq.type === selectedType;
    const matchesStatus = selectedStatus === 'ALL' || eq.status === selectedStatus;
    const matchesSite = selectedSite === 'ALL' || eq.siteId === selectedSite;

    return matchesSearch && matchesType && matchesStatus && matchesSite;
  });

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border pb-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-foreground">Equipment Fleet Inventory</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Browse, inspect, and manage all {equipmentList.length} Caterpillar rental assets across job sites.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link to="/qr-scanner">
            <Button variant="cat" size="sm" className="gap-2">
              <QrCode className="h-4 w-4" />
              Scan QR Code
            </Button>
          </Link>
          <Link to="/map">
            <Button variant="outline" size="sm" className="gap-2">
              <MapPin className="h-4 w-4 text-cat-yellow" />
              Map View
            </Button>
          </Link>
        </div>
      </div>

      {/* Filter Toolbar */}
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Search Input */}
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search ID, model, serial..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="h-9 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-xs focus:outline-none focus:ring-2 focus:ring-cat-yellow"
              />
            </div>

            {/* Type Filter */}
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="h-9 w-full rounded-lg border border-border bg-background px-3 text-xs focus:outline-none focus:ring-2 focus:ring-cat-yellow"
            >
              {EQUIPMENT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t === 'ALL' ? 'All Machine Types' : t}
                </option>
              ))}
            </select>

            {/* Status Filter */}
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="h-9 w-full rounded-lg border border-border bg-background px-3 text-xs focus:outline-none focus:ring-2 focus:ring-cat-yellow"
            >
              {STATUS_FILTERS.map((s) => (
                <option key={s} value={s}>
                  {s === 'ALL' ? 'All Statuses' : s}
                </option>
              ))}
            </select>

            {/* Site Filter */}
            <select
              value={selectedSite}
              onChange={(e) => setSelectedSite(e.target.value)}
              className="h-9 w-full rounded-lg border border-border bg-background px-3 text-xs focus:outline-none focus:ring-2 focus:ring-cat-yellow"
            >
              <option value="ALL">All Project Sites</option>
              {sites.map((site) => (
                <option key={site.siteId} value={site.siteId}>
                  {site.siteId}: {site.name}
                </option>
              ))}
            </select>
          </div>

          {/* Quick Filter Badges */}
          <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-border text-xs text-muted-foreground">
            <span className="font-semibold text-foreground">Showing:</span>
            <span className="font-mono font-bold text-cat-yellow">{filtered.length}</span>
            <span>of {equipmentList.length} total units</span>
            {selectedStatus !== 'ALL' && (
              <Badge variant="secondary" className="cursor-pointer" onClick={() => setSelectedStatus('ALL')}>
                Status: {selectedStatus} ✕
              </Badge>
            )}
            {selectedType !== 'ALL' && (
              <Badge variant="secondary" className="cursor-pointer" onClick={() => setSelectedType('ALL')}>
                Type: {selectedType} ✕
              </Badge>
            )}
            {(selectedStatus !== 'ALL' || selectedType !== 'ALL' || searchTerm !== '') && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-[11px] px-2 text-cat-yellow"
                onClick={() => {
                  setSearchTerm('');
                  setSelectedType('ALL');
                  setSelectedStatus('ALL');
                  setSelectedSite('ALL');
                }}
              >
                Reset Filters
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Equipment Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/40 border-b border-border">
                <tr className="text-muted-foreground">
                  <th className="p-3.5 font-bold">Equipment ID / Model</th>
                  <th className="p-3.5 font-bold">Type</th>
                  <th className="p-3.5 font-bold">Status</th>
                  <th className="p-3.5 font-bold">Assigned Site</th>
                  <th className="p-3.5 font-bold">Operator</th>
                  <th className="p-3.5 font-bold">Engine Hours</th>
                  <th className="p-3.5 font-bold">Fuel Level</th>
                  <th className="p-3.5 font-bold">Health</th>
                  <th className="p-3.5 font-bold">Rate</th>
                  <th className="p-3.5 font-bold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((eq) => (
                  <tr key={eq.equipmentId} className="hover:bg-muted/40 transition-colors">
                    {/* Equipment ID & Model */}
                    <td className="p-3.5">
                      <Link to={`/equipment/${eq.equipmentId}`} className="group block">
                        <div className="font-mono font-bold text-cat-yellow group-hover:underline flex items-center gap-1">
                          {eq.equipmentId}
                          <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                        <div className="font-semibold text-foreground">{eq.model}</div>
                        <div className="text-[10px] text-muted-foreground font-mono">{eq.serialNumber}</div>
                      </Link>
                    </td>

                    {/* Type */}
                    <td className="p-3.5 font-medium text-foreground">{eq.type}</td>

                    {/* Status */}
                    <td className="p-3.5">
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
                    </td>

                    {/* Assigned Site */}
                    <td className="p-3.5">
                      {eq.site ? (
                        <div>
                          <div className="font-medium text-foreground">{eq.site.name}</div>
                          <div className="text-[10px] text-muted-foreground">{eq.site.siteId}</div>
                        </div>
                      ) : (
                        <span className="text-muted-foreground italic">Unassigned</span>
                      )}
                    </td>

                    {/* Operator */}
                    <td className="p-3.5">
                      {eq.operator ? (
                        <div className="flex items-center gap-1.5">
                          <User className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="font-medium text-foreground">{eq.operator.name}</span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground italic">None</span>
                      )}
                    </td>

                    {/* Engine Hours */}
                    <td className="p-3.5 font-mono font-semibold">
                      {formatNumber(eq.engineHours)} hrs
                      <div className="text-[10px] text-muted-foreground font-normal">
                        Op: {formatNumber(eq.operatingHours)}h | Idle: {formatNumber(eq.idleHours)}h
                      </div>
                    </td>

                    {/* Fuel Level */}
                    <td className="p-3.5">
                      <div className="flex items-center gap-2">
                        <div className="w-14 h-2 bg-neutral-800 rounded-full overflow-hidden">
                          <div
                            className={`h-full ${
                              eq.fuelLevel < 20
                                ? 'bg-red-500'
                                : eq.fuelLevel < 40
                                ? 'bg-amber-500'
                                : 'bg-cat-yellow'
                            }`}
                            style={{ width: `${eq.fuelLevel}%` }}
                          />
                        </div>
                        <span className="font-mono text-xs font-semibold">{eq.fuelLevel}%</span>
                      </div>
                    </td>

                    {/* Health Score */}
                    <td className="p-3.5">
                      <div className="flex items-center gap-1 font-bold">
                        <HeartPulse
                          className={`h-3.5 w-3.5 ${
                            eq.healthScore >= 90
                              ? 'text-emerald-500'
                              : eq.healthScore >= 75
                              ? 'text-amber-500'
                              : 'text-red-500'
                          }`}
                        />
                        <span
                          className={
                            eq.healthScore >= 90
                              ? 'text-emerald-500'
                              : eq.healthScore >= 75
                              ? 'text-amber-500'
                              : 'text-red-500'
                          }
                        >
                          {eq.healthScore}%
                        </span>
                      </div>
                    </td>

                    {/* Hourly Rate */}
                    <td className="p-3.5 font-mono font-semibold text-foreground">${eq.hourlyRate}/h</td>

                    {/* Actions */}
                    <td className="p-3.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedEquipmentForQR(eq)}
                          className="h-7 text-xs px-2 text-cat-yellow hover:bg-cat-yellow/10"
                          title="Generate & Download QR Code"
                        >
                          <QrCode className="h-3.5 w-3.5" />
                        </Button>
                        <Link to={`/equipment/${eq.equipmentId}`}>
                          <Button variant="outline" size="sm" className="h-7 text-xs px-2.5">
                            Inspect
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

      {/* Reusable QR Code Modal */}
      <QRCodeModal
        equipment={selectedEquipmentForQR}
        open={!!selectedEquipmentForQR}
        onClose={() => setSelectedEquipmentForQR(null)}
      />
    </div>
  );
}
