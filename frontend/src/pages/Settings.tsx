import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/services/api';
import { useStore } from '@/store/useStore';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Settings,
  Download,
  User,
  ShieldCheck,
  Database,
  Sliders,
  CheckCircle2,
  FileSpreadsheet,
} from 'lucide-react';

export default function SettingsPage() {
  const { user, clearAuth } = useStore();
  const [downloadMsg, setDownloadMsg] = useState<string | null>(null);

  const handleExportCSV = async (type: 'equipment' | 'rentals' | 'usage') => {
    try {
      const res = await api.get(`/${type}?limit=500`);
      const data = res.data.data;
      if (!data || data.length === 0) {
        setDownloadMsg(`No ${type} data available to export.`);
        return;
      }

      // Convert JSON to simple CSV
      const keys = Object.keys(data[0]).filter((k) => typeof data[0][k] !== 'object');
      const csvRows = [
        keys.join(','),
        ...data.map((row: any) =>
          keys
            .map((k) => {
              const val = row[k] ?? '';
              return `"${String(val).replace(/"/g, '""')}"`;
            })
            .join(',')
        ),
      ];

      const csvBlob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
      const url = URL.createObjectURL(csvBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `catrent_${type}_export_${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);

      setDownloadMsg(`✅ Exported ${data.length} ${type} records to CSV successfully!`);
    } catch (err: any) {
      setDownloadMsg(`Export failed: ${err.message}`);
    }
  };

  return (
    <div className="space-y-6 pb-12 max-w-4xl mx-auto">
      {/* Header */}
      <div className="border-b border-border pb-4">
        <h1 className="text-2xl sm:text-3xl font-black text-foreground">Platform Settings & Data Exports</h1>
        <p className="text-sm text-muted-foreground mt-1">
          System telemetry parameters, user permissions, and report generation utilities.
        </p>
      </div>

      {downloadMsg && (
        <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-xs font-bold text-emerald-400 flex items-center justify-between">
          <span>{downloadMsg}</span>
          <button onClick={() => setDownloadMsg(null)} className="text-muted-foreground hover:text-foreground">
            ✕
          </button>
        </div>
      )}

      {/* User Profile & Role Info */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-bold flex items-center gap-2">
            <User className="h-4 w-4 text-cat-yellow" />
            Active Session & Access Level
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-3 bg-muted/40 rounded-lg border border-border space-y-1">
              <span className="text-muted-foreground font-semibold">User:</span>
              <div className="font-bold text-foreground text-sm">{user?.name || 'Jordan Hayes (Fleet Mgr)'}</div>
              <div className="text-muted-foreground">{user?.email || 'manager@catrent.io'}</div>
            </div>

            <div className="p-3 bg-muted/40 rounded-lg border border-border space-y-1">
              <span className="text-muted-foreground font-semibold">Assigned Role:</span>
              <div className="flex items-center gap-2 pt-0.5">
                <Badge variant="default" className="font-mono">
                  {user?.role || 'RENTAL_MANAGER'}
                </Badge>
                <span className="text-emerald-500 font-semibold flex items-center gap-1">
                  <ShieldCheck className="h-3.5 w-3.5" /> Full Operational Clearance
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* CSV Reports & Exports (Section 3 of Blueprint) */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-bold flex items-center gap-2">
            <FileSpreadsheet className="h-4 w-4 text-cat-yellow" />
            Industrial Reports & CSV Data Exports
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Download raw fleet telemetry logs, rental contracts, and historical shift utilization datasets for audit compliance.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleExportCSV('equipment')}
              className="w-full gap-2 text-xs font-semibold"
            >
              <Download className="h-4 w-4 text-cat-yellow" />
              Export Fleet Inventory (.csv)
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => handleExportCSV('rentals')}
              className="w-full gap-2 text-xs font-semibold"
            >
              <Download className="h-4 w-4 text-cat-yellow" />
              Export Rental History (.csv)
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => handleExportCSV('usage')}
              className="w-full gap-2 text-xs font-semibold"
            >
              <Download className="h-4 w-4 text-cat-yellow" />
              Export Telemetry Logs (.csv)
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Service Status Diagnostics */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-bold flex items-center gap-2">
            <Database className="h-4 w-4 text-cat-yellow" />
            Service Endpoints & Status
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-xs">
          <div className="flex justify-between p-2.5 bg-muted/40 rounded-lg border border-border">
            <span>Node.js / Express API:</span>
            <span className="font-mono text-emerald-500 font-bold">http://localhost:3001/api (Healthy)</span>
          </div>
          <div className="flex justify-between p-2.5 bg-muted/40 rounded-lg border border-border">
            <span>Python ML FastAPI Service:</span>
            <span className="font-mono text-purple-400 font-bold">http://localhost:8000 (FastAPI Swagger)</span>
          </div>
          <div className="flex justify-between p-2.5 bg-muted/40 rounded-lg border border-border">
            <span>Real-time WebSocket Gateway:</span>
            <span className="font-mono text-emerald-500 font-bold">Socket.IO Active</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
