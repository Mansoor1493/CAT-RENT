import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/services/api';
import { AuditLog } from '@/types';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  ShieldCheck,
  Search,
  Filter,
  Clock,
  User,
  Activity,
  Layers,
  FileText,
  Lock,
} from 'lucide-react';

export default function AuditLogsPage() {
  const [actionFilter, setActionFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const { data: auditData, isLoading } = useQuery<{ success: boolean; data: AuditLog[] }>({
    queryKey: ['admin-audit-logs', actionFilter],
    queryFn: async () => {
      const url = actionFilter ? `/audit-logs?action=${actionFilter}` : '/audit-logs';
      return (await api.get(url)).data;
    },
    refetchInterval: 15000,
  });

  const logs = auditData?.data || [];

  const filteredLogs = logs.filter((log) => {
    const matchesSearch =
      log.userId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.entity.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.entityId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (log.details || '').toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  });

  const ACTIONS = [
    'ALL',
    'USER_LOGIN',
    'USER_REGISTERED',
    'RENTAL_REQUEST_CREATED',
    'RENTAL_REQUEST_APPROVED',
    'RENTAL_REQUEST_REJECTED',
    'EXTENSION_REQUESTED',
    'EXTENSION_APPROVED',
    'EXTENSION_REJECTED',
  ];

  return (
    <div className="space-y-6 pb-12 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-black text-foreground">System Audit Trail & Compliance</h1>
            <Badge variant="default" className="text-xs font-bold bg-cat-yellow text-cat-black">
              SECURITY AUDIT
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Immutable log of user logins, rental applications, approval actions, state changes, and security events.
          </p>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5">
          {ACTIONS.map((act) => (
            <button
              key={act}
              onClick={() => setActionFilter(act === 'ALL' ? '' : act)}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                (act === 'ALL' && !actionFilter) || actionFilter === act
                  ? 'bg-cat-yellow text-cat-black shadow-md font-black'
                  : 'bg-neutral-900 border border-neutral-800 text-muted-foreground hover:text-foreground'
              }`}
            >
              {act.replace(/_/g, ' ')}
            </button>
          ))}
        </div>

        <div className="relative">
          <Search className="h-3.5 w-3.5 absolute left-2.5 top-2.5 text-muted-foreground" />
          <Input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search audit trail..."
            className="h-8 pl-8 text-xs w-56 bg-background"
          />
        </div>
      </div>

      {/* Audit Log Table */}
      <Card className="border-2 border-border shadow-xl">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/40 border-b border-border text-muted-foreground">
                <tr>
                  <th className="p-3.5 font-bold">Timestamp</th>
                  <th className="p-3.5 font-bold">User / Role</th>
                  <th className="p-3.5 font-bold">Action</th>
                  <th className="p-3.5 font-bold">Entity</th>
                  <th className="p-3.5 font-bold">Entity ID</th>
                  <th className="p-3.5 font-bold">Audit Details</th>
                  <th className="p-3.5 font-bold text-right">IP Address</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border font-mono">
                {filteredLogs.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-muted-foreground font-sans">
                      No audit log records match the selected filter.
                    </td>
                  </tr>
                ) : (
                  filteredLogs.map((log) => (
                    <tr key={log._id} className="hover:bg-muted/30 transition-colors">
                      <td className="p-3.5 text-muted-foreground text-[11px]">
                        {new Date(log.timestamp).toLocaleString()}
                      </td>
                      <td className="p-3.5">
                        <div className="font-bold text-foreground font-sans">{log.userId}</div>
                        <span className="text-[9px] text-cat-yellow font-bold">{log.role || 'USER'}</span>
                      </td>
                      <td className="p-3.5">
                        <Badge
                          variant={
                            log.action.includes('APPROVED')
                              ? 'available'
                              : log.action.includes('REJECTED')
                              ? 'destructive'
                              : log.action.includes('LOGIN')
                              ? 'secondary'
                              : 'default'
                          }
                          className="text-[9px] font-bold"
                        >
                          {log.action}
                        </Badge>
                      </td>
                      <td className="p-3.5 font-bold text-foreground font-sans">{log.entity}</td>
                      <td className="p-3.5 text-cat-yellow font-bold">{log.entityId}</td>
                      <td className="p-3.5 font-sans text-xs max-w-sm">
                        <div className="text-foreground">{log.details || 'System operation executed'}</div>
                        {log.newValue && (
                          <div className="text-[10px] text-muted-foreground font-mono mt-0.5 truncate">
                            Value: {JSON.stringify(log.newValue)}
                          </div>
                        )}
                      </td>
                      <td className="p-3.5 text-right text-muted-foreground text-[11px]">
                        {log.ipAddress || '127.0.0.1'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
