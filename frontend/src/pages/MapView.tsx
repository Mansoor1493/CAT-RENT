import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { MapContainer, TileLayer, Marker, Popup, Circle, Polyline, useMap } from 'react-leaflet';
import api from '@/services/api';
import { Equipment, Site, Alert, Operator, SiteMatchStatus, TelemetryEvent, TrailPoint, DwellInfo, SiteSummary, NearbyEquipmentResult } from '@/types';
import { getSocket } from '@/services/socket';
import QRCodeModal from '@/components/common/QRCodeModal';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  MapPin, Truck, Activity, Search, ExternalLink, Wifi, WifiOff, Navigation,
  ShieldAlert, Clock, Thermometer, Fuel, Gauge, HeartPulse, QrCode, Building2,
  CheckCircle2, AlertTriangle, RotateCcw, Play, Pause, RotateCw, Route, Layers,
  Radio, User, Target, Crosshair, ChevronDown, ChevronUp, Zap, Eye, EyeOff,
  ArrowRightLeft, Timer, BarChart3, Globe,
} from 'lucide-react';
import { formatNumber } from '@/lib/utils';

// ── Leaflet Icon Assets Configuration ──
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// ── Haversine Distance Calculation (km) ──
function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ── India Map Bounds Controller ──
function MapBoundsController({ selectedSite, sites, activeAsset }: {
  selectedSite: string;
  sites: Site[];
  activeAsset: LiveEquipment | null;
}) {
  const map = useMap();
  useEffect(() => {
    if (activeAsset && activeAsset.lat && activeAsset.lng) {
      map.flyTo([activeAsset.lat, activeAsset.lng], 13, { duration: 1.2 });
      return;
    }
    if (selectedSite !== 'ALL') {
      const site = sites.find((s) => s.siteId === selectedSite);
      if (site) { map.flyTo([site.lat, site.lng], 12, { duration: 1.2 }); return; }
    }
    // Default: fit all Indian sites with smooth padding
    if (sites.length > 0) {
      const bounds = L.latLngBounds(sites.map((s) => [s.lat, s.lng]));
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 6 });
    }
  }, [selectedSite, activeAsset?.equipmentId, sites.length]);
  return null;
}

// ── Types ──
interface LiveEquipment extends Equipment {
  lastUpdated?: number;
  speed?: number;
  detectedSiteId?: string | null;
  detectedSiteName?: string | null;
  siteMatchStatus?: SiteMatchStatus;
  distanceFromAssignedSiteKm?: number;
}

// ══════════════════════════════════════════════════════
// MAIN COMPONENT
// ══════════════════════════════════════════════════════
export default function MapView() {
  // ── Core State ──
  const [selectedSite, setSelectedSite] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeAssetId, setActiveAssetId] = useState<string | null>(null);
  const [qrModalEquipment, setQrModalEquipment] = useState<Equipment | null>(null);
  const [liveEquipmentMap, setLiveEquipmentMap] = useState<Record<string, LiveEquipment>>({});
  const [activeAlertsMap, setActiveAlertsMap] = useState<Record<string, Alert[]>>({});
  const [socketStatus, setSocketStatus] = useState<'CONNECTED' | 'DISCONNECTED' | 'RECONNECTING'>('DISCONNECTED');
  const [timeTick, setTimeTick] = useState<number>(Date.now());

  // ── Intelligence Feature State ──
  const [showTrail, setShowTrail] = useState(false);
  const [trailDuration, setTrailDuration] = useState<string>('1h');
  const [trailPoints, setTrailPoints] = useState<TrailPoint[]>([]);
  const [dwellInfo, setDwellInfo] = useState<DwellInfo | null>(null);
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showSitePanel, setShowSitePanel] = useState(false);
  const [eventTimeline, setEventTimeline] = useState<TelemetryEvent[]>([]);
  const [siteSummary, setSiteSummary] = useState<SiteSummary | null>(null);
  const [nearbyResults, setNearbyResults] = useState<NearbyEquipmentResult[]>([]);
  const [showNearby, setShowNearby] = useState(false);
  const [dossierTab, setDossierTab] = useState<'telemetry' | 'timeline' | 'nearby'>('telemetry');

  // ── GPS Playback State ──
  const [playbackActive, setPlaybackActive] = useState(false);
  const [playbackIndex, setPlaybackIndex] = useState(0);
  const playbackTimerRef = useRef<NodeJS.Timeout | null>(null);

  // ── Data Queries ──
  const { data: equipmentData } = useQuery<{ success: boolean; data: Equipment[] }>({
    queryKey: ['map-equipment'],
    queryFn: async () => (await api.get('/equipment?limit=100')).data,
    refetchInterval: 15000,
  });
  const { data: sitesData } = useQuery<{ success: boolean; data: Site[] }>({
    queryKey: ['sites-list'],
    queryFn: async () => (await api.get('/sites')).data,
  });
  const { data: alertsData } = useQuery<{ success: boolean; data: Alert[] }>({
    queryKey: ['map-alerts'],
    queryFn: async () => (await api.get('/alerts?status=ACTIVE')).data,
    refetchInterval: 10000,
  });

  const sites = sitesData?.data || [];
  const siteMap = useMemo(() => new Map(sites.map((s) => [s.siteId, s])), [sites]);

  // ── Compute Site Match Info ──
  const computeSiteMatch = useCallback((eq: LiveEquipment): Partial<LiveEquipment> => {
    if (!eq.lat || !eq.lng || sites.length === 0) return {};
    if (!eq.siteId) return { siteMatchStatus: 'NO_ASSIGNED_SITE' as SiteMatchStatus, detectedSiteId: null, detectedSiteName: null, distanceFromAssignedSiteKm: 0 };

    const assignedSite = siteMap.get(eq.siteId);
    const distToAssigned = assignedSite ? haversineKm(eq.lat, eq.lng, assignedSite.lat, assignedSite.lng) : 999;
    const assignedRadius = assignedSite?.geofenceRadius || 5.0;

    let nearestSite: Site | null = null;
    let nearestDist = Infinity;
    for (const s of sites) {
      const d = haversineKm(eq.lat, eq.lng, s.lat, s.lng);
      if (d < nearestDist) { nearestDist = d; nearestSite = s; }
    }

    let status: SiteMatchStatus = 'OUTSIDE_GEOFENCE';
    let detectedId: string | null = null;
    let detectedName: string | null = null;

    if (distToAssigned <= assignedRadius) {
      status = 'MATCHED';
      detectedId = eq.siteId;
      detectedName = assignedSite?.name || null;
    } else if (nearestSite) {
      const nearestRadius = nearestSite.geofenceRadius || 5.0;
      if (nearestDist <= nearestRadius) {
        status = nearestSite.siteId === eq.siteId ? 'MATCHED' : 'WRONG_SITE';
        detectedId = nearestSite.siteId;
        detectedName = nearestSite.name;
      }
    }

    return {
      siteMatchStatus: status,
      detectedSiteId: detectedId,
      detectedSiteName: detectedName,
      distanceFromAssignedSiteKm: Math.round(distToAssigned * 100) / 100,
    };
  }, [sites, siteMap]);

  // ── Sync Equipment Fleet ──
  useEffect(() => {
    if (equipmentData?.data) {
      setLiveEquipmentMap((prev) => {
        const next = { ...prev };
        equipmentData.data.forEach((eq) => {
          const siteInfo = computeSiteMatch(eq as LiveEquipment);
          if (!next[eq.equipmentId]) {
            next[eq.equipmentId] = { ...eq, lastUpdated: Date.now(), ...siteInfo };
          } else {
            next[eq.equipmentId] = {
              ...eq,
              lat: next[eq.equipmentId].lat || eq.lat,
              lng: next[eq.equipmentId].lng || eq.lng,
              lastUpdated: next[eq.equipmentId].lastUpdated || Date.now(),
              ...siteInfo,
            };
          }
        });
        return next;
      });
    }
  }, [equipmentData?.data, computeSiteMatch]);

  // ── Sync Active Risk Alerts ──
  useEffect(() => {
    if (alertsData?.data) {
      const map: Record<string, Alert[]> = {};
      alertsData.data.forEach((a) => {
        if (!map[a.equipmentId]) map[a.equipmentId] = [];
        map[a.equipmentId].push(a);
      });
      setActiveAlertsMap(map);
    }
  }, [alertsData?.data]);

  // ── Timer Tick for Relative Time ──
  useEffect(() => {
    const timer = setInterval(() => setTimeTick(Date.now()), 2000);
    return () => clearInterval(timer);
  }, []);

  // ── Socket.IO Live Telemetry ──
  useEffect(() => {
    const socket = getSocket();
    const handleConnect = () => setSocketStatus('CONNECTED');
    const handleDisconnect = () => setSocketStatus('DISCONNECTED');
    if (socket.connected) setSocketStatus('CONNECTED');
    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);

    socket.on('equipment:location', (loc: { equipmentId: string; lat: number; lng: number; speed?: number; timestamp?: string }) => {
      setLiveEquipmentMap((prev) => {
        const current = prev[loc.equipmentId];
        if (!current) return prev;
        const updated = { ...current, lat: loc.lat, lng: loc.lng, speed: loc.speed ?? current.speed, lastUpdated: Date.now() };
        const siteInfo = computeSiteMatch(updated);
        return { ...prev, [loc.equipmentId]: { ...updated, ...siteInfo } };
      });
      addTimelineEvent(loc.equipmentId, 'GPS_UPDATE', `GPS → ${loc.lat.toFixed(4)}, ${loc.lng.toFixed(4)} (${loc.speed || 0} km/h)`);
    });

    socket.on('equipment:updated', (updatedEq: Equipment) => {
      setLiveEquipmentMap((prev) => {
        const merged = { ...(prev[updatedEq.equipmentId] || {}), ...updatedEq, lastUpdated: Date.now() } as LiveEquipment;
        const siteInfo = computeSiteMatch(merged);
        return { ...prev, [updatedEq.equipmentId]: { ...merged, ...siteInfo } };
      });
    });

    socket.on('equipment:telemetry', (tel: any) => {
      setLiveEquipmentMap((prev) => {
        const current = prev[tel.equipmentId];
        if (!current) return prev;
        return {
          ...prev,
          [tel.equipmentId]: {
            ...current,
            lat: tel.lat,
            lng: tel.lng,
            speed: tel.speed,
            detectedSiteId: tel.detectedSiteId,
            detectedSiteName: tel.detectedSiteName,
            siteMatchStatus: tel.siteMatchStatus,
            distanceFromAssignedSiteKm: tel.distanceFromAssignedSiteKm,
            lastUpdated: Date.now(),
          },
        };
      });
      if (tel.siteMatchStatus === 'WRONG_SITE') {
        addTimelineEvent(tel.equipmentId, 'SITE_DETECTED', `⚠ Wrong Site: Operating at ${tel.detectedSiteId}`);
      } else if (tel.siteMatchStatus === 'MATCHED') {
        addTimelineEvent(tel.equipmentId, 'GEOFENCE_MATCH', `✓ Geofence Verified: ${tel.detectedSiteId}`);
      }
    });

    socket.on('alert:new', (newAlert: Alert) => {
      setActiveAlertsMap((prev) => {
        const existing = prev[newAlert.equipmentId] || [];
        return { ...prev, [newAlert.equipmentId]: [newAlert, ...existing.filter((a) => a.alertId !== newAlert.alertId)] };
      });
      addTimelineEvent(newAlert.equipmentId, 'ALERT_CREATED', `🚨 ${newAlert.title || newAlert.type}`);
    });

    socket.on('alert:resolved', (resAlert: Alert) => {
      setActiveAlertsMap((prev) => {
        const existing = prev[resAlert.equipmentId] || [];
        return { ...prev, [resAlert.equipmentId]: existing.filter((a) => a.alertId !== resAlert.alertId) };
      });
    });

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('equipment:location');
      socket.off('equipment:updated');
      socket.off('equipment:telemetry');
      socket.off('alert:new');
      socket.off('alert:resolved');
    };
  }, [computeSiteMatch]);

  const addTimelineEvent = useCallback((equipmentId: string, type: TelemetryEvent['type'], message: string) => {
    setEventTimeline((prev) => [{ id: `${Date.now()}-${Math.random()}`, type, equipmentId, message, timestamp: Date.now() }, ...prev].slice(0, 50));
  }, []);

  // ── Fetch Movement Trail ──
  useEffect(() => {
    if (!showTrail || !activeAssetId) { setTrailPoints([]); return; }
    api.get(`/location/${activeAssetId}/trail?duration=${trailDuration}`).then((res) => {
      setTrailPoints(res.data.data || []);
    }).catch(() => setTrailPoints([]));
  }, [showTrail, activeAssetId, trailDuration]);

  // ── Fetch Dwell Time ──
  useEffect(() => {
    if (!activeAssetId) { setDwellInfo(null); return; }
    api.get(`/location/${activeAssetId}/dwell`).then((res) => {
      setDwellInfo(res.data.data || null);
    }).catch(() => setDwellInfo(null));
  }, [activeAssetId]);

  // ── Fetch Site Summary ──
  useEffect(() => {
    if (selectedSite === 'ALL') { setSiteSummary(null); return; }
    api.get(`/map/site-summary/${selectedSite}`).then((res) => {
      setSiteSummary(res.data.data || null);
    }).catch(() => setSiteSummary(null));
  }, [selectedSite]);

  // ── GPS Playback ──
  useEffect(() => {
    if (playbackActive && trailPoints.length > 0) {
      playbackTimerRef.current = setInterval(() => {
        setPlaybackIndex((prev) => {
          if (prev >= trailPoints.length - 1) { setPlaybackActive(false); return prev; }
          return prev + 1;
        });
      }, 800);
    }
    return () => { if (playbackTimerRef.current) clearInterval(playbackTimerRef.current); };
  }, [playbackActive, trailPoints.length]);

  // ── Fetch Nearby Equipment ──
  const fetchNearby = useCallback(async (siteId: string, type?: string) => {
    try {
      const params = new URLSearchParams({ siteId });
      if (type) params.set('type', type);
      const res = await api.get(`/map/nearby-equipment?${params}`);
      setNearbyResults(res.data.data || []);
      setShowNearby(true);
      setDossierTab('nearby');
    } catch { setNearbyResults([]); }
  }, []);

  // ── Derived Data ──
  const equipmentList = Object.values(liveEquipmentMap);

  const filtered = useMemo(() => {
    return equipmentList.filter((eq) => {
      const matchesSite = selectedSite === 'ALL' || eq.siteId === selectedSite;
      const matchesStatus =
        selectedStatus === 'ALL' ||
        (selectedStatus === 'OVERDUE'
          ? eq.status === 'OVERDUE' || (activeAlertsMap[eq.equipmentId]?.length > 0)
          : selectedStatus === 'MAINTENANCE'
          ? eq.status === 'MAINTENANCE'
          : eq.status === selectedStatus);
      const q = searchQuery.toLowerCase();
      const matchesSearch =
        !q ||
        eq.equipmentId.toLowerCase().includes(q) ||
        eq.model.toLowerCase().includes(q) ||
        eq.serialNumber.toLowerCase().includes(q) ||
        (eq.siteId || '').toLowerCase().includes(q);
      return matchesSite && matchesStatus && matchesSearch;
    });
  }, [equipmentList, selectedSite, selectedStatus, searchQuery, activeAlertsMap]);

  const activeAsset = activeAssetId ? liveEquipmentMap[activeAssetId] : null;
  const activeAssetAlerts = activeAssetId ? activeAlertsMap[activeAssetId] || [] : [];
  const activeTimeline = useMemo(() => eventTimeline.filter((e) => e.equipmentId === activeAssetId).slice(0, 12), [eventTimeline, activeAssetId]);

  // ── Status Counts ──
  const statusCounts = useMemo(() => {
    const base = selectedSite === 'ALL' ? equipmentList : equipmentList.filter((e) => e.siteId === selectedSite);
    return {
      total: base.length,
      available: base.filter((e) => e.status === 'AVAILABLE').length,
      active: base.filter((e) => e.status === 'ACTIVE' || e.status === 'RENTED').length,
      idle: base.filter((e) => e.status === 'IDLE').length,
      overdue: base.filter((e) => e.status === 'OVERDUE' || (activeAlertsMap[e.equipmentId]?.length > 0)).length,
      maintenance: base.filter((e) => e.status === 'MAINTENANCE').length,
    };
  }, [equipmentList, selectedSite, activeAlertsMap]);

  // ── Helpers ──
  const getSecondsAgo = (timestamp?: number) => {
    if (!timestamp) return 'N/A';
    const diff = Math.floor((timeTick - timestamp) / 1000);
    if (diff < 3) return 'Just now';
    if (diff < 60) return `${diff}s ago`;
    if (diff < 300) return `${Math.floor(diff / 60)}m ${diff % 60}s ago`;
    return `${Math.floor(diff / 60)}m ago`;
  };

  const isTelemetryStale = (timestamp?: number) => {
    if (!timestamp) return true;
    return timeTick - timestamp > 60000;
  };

  const getSiteMatchBadge = (status?: SiteMatchStatus) => {
    switch (status) {
      case 'MATCHED':
        return <Badge variant="available" className="text-[9px] font-black gap-1"><CheckCircle2 className="h-2.5 w-2.5" /> AT ASSIGNED SITE</Badge>;
      case 'WRONG_SITE':
        return <Badge variant="destructive" className="text-[9px] font-black gap-1 animate-pulse"><AlertTriangle className="h-2.5 w-2.5" /> WRONG SITE</Badge>;
      case 'OUTSIDE_GEOFENCE':
        return <Badge variant="idle" className="text-[9px] font-black gap-1"><AlertTriangle className="h-2.5 w-2.5" /> OUTSIDE GEOFENCE</Badge>;
      case 'NO_ASSIGNED_SITE':
        return <Badge variant="outline" className="text-[9px] font-bold gap-1">NO SITE ASSIGNED</Badge>;
      default:
        return <Badge variant="outline" className="text-[9px]">—</Badge>;
    }
  };

  // ── Equipment Marker Icon ──
  const createEquipmentIcon = (eq: LiveEquipment, isSelected: boolean, hasRisk: boolean) => {
    const isOverdue = eq.status === 'OVERDUE' || hasRisk || eq.siteMatchStatus === 'WRONG_SITE';
    const stale = isTelemetryStale(eq.lastUpdated);
    const color = stale ? '#525252' : isOverdue ? '#ef4444' : eq.status === 'AVAILABLE' ? '#10b981' : eq.status === 'ACTIVE' || eq.status === 'RENTED' ? '#FFCD11' : eq.status === 'IDLE' ? '#f59e0b' : '#a1a1aa';
    const glyph = eq.type === 'Excavator' ? '⛏' : eq.type === 'Loader' ? '🚜' : eq.type === 'Dozer' ? '🏗' : eq.type === 'Crane' ? '🏗' : '🚛';
    const textColor = eq.status === 'ACTIVE' && !stale && !isOverdue ? '#000' : '#fff';

    return L.divIcon({
      className: 'cat-eq-marker',
      html: `<div style="position:relative;display:flex;flex-direction:column;align-items:center;cursor:pointer;${stale ? 'opacity:0.5;' : ''}">
        ${isOverdue ? '<div style="position:absolute;width:34px;height:34px;border-radius:50%;background:rgba(239,68,68,0.4);animation:ping 1.5s cubic-bezier(0,0,0.2,1) infinite;top:-5px;"></div>' : ''}
        <div style="width:26px;height:26px;border-radius:50%;background:${color};color:${textColor};border:2px solid ${isSelected ? '#fff' : '#18181b'};box-shadow:0 4px 10px rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center;font-weight:900;font-size:11px;transform:${isSelected ? 'scale(1.3)' : 'scale(1)'};transition:transform 0.2s;">${glyph}</div>
        <div style="margin-top:2px;background:rgba(18,18,20,0.92);color:${color};border:1px solid rgba(255,255,255,0.15);border-radius:4px;padding:1px 4px;font-size:9px;font-family:monospace;font-weight:900;white-space:nowrap;box-shadow:0 2px 5px rgba(0,0,0,0.5);">${eq.equipmentId}</div>
      </div>`,
      iconSize: [40, 48],
      iconAnchor: [20, 24],
      popupAnchor: [0, -26],
    });
  };

  const createSiteIcon = (site: Site, count: number) =>
    L.divIcon({
      className: 'cat-site-marker',
      html: `<div style="display:flex;flex-direction:column;align-items:center;cursor:pointer;">
      <div style="width:34px;height:34px;border-radius:8px;background:#121214;border:2px solid #FFCD11;color:#FFCD11;box-shadow:0 4px 12px rgba(255,205,17,0.4);display:flex;align-items:center;justify-content:center;font-weight:900;font-size:11px;font-family:monospace;">${site.siteId}</div>
      <div style="margin-top:2px;background:#FFCD11;color:#121214;border-radius:4px;padding:1px 5px;font-size:9px;font-weight:900;white-space:nowrap;">${count} units</div>
    </div>`,
      iconSize: [48, 54],
      iconAnchor: [24, 27],
      popupAnchor: [0, -28],
    });

  const handleSearch = useCallback(() => {
    if (!searchQuery) return;
    const match = equipmentList.find((e) => e.equipmentId.toLowerCase() === searchQuery.toLowerCase());
    if (match) setActiveAssetId(match.equipmentId);
  }, [searchQuery, equipmentList]);

  // ══════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════
  return (
    <div className="space-y-4 pb-12 max-w-[1600px] mx-auto">
      {/* ── Top Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-black text-foreground">Live Geospatial Fleet Map</h1>
            <Badge
              variant={socketStatus === 'CONNECTED' ? 'available' : socketStatus === 'RECONNECTING' ? 'idle' : 'destructive'}
              className="text-xs font-bold gap-1.5 px-2.5 py-1 font-mono"
            >
              {socketStatus === 'CONNECTED' ? (
                <>
                  <Wifi className="h-3.5 w-3.5 animate-pulse text-emerald-400" /> Simulated Live Telemetry
                </>
              ) : socketStatus === 'RECONNECTING' ? (
                <>
                  <Activity className="h-3.5 w-3.5 animate-spin text-amber-400" /> Reconnecting...
                </>
              ) : (
                <>
                  <WifiOff className="h-3.5 w-3.5 text-red-400" /> Connection Lost
                </>
              )}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1.5">
            <Globe className="h-3.5 w-3.5 text-cat-yellow inline" />
            <strong className="text-foreground">India Industrial Fleet Network</strong> — Real-world OpenStreetMap GIS telemetry across 8 major Indian economic corridors.
          </p>
        </div>

        {/* Global Toolbar */}
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={selectedSite}
            onChange={(e) => setSelectedSite(e.target.value)}
            className="h-9 rounded-lg border border-border bg-background px-3 text-xs font-bold text-foreground focus:ring-2 focus:ring-cat-yellow"
          >
            <option value="ALL">All India Sites ({sites.length})</option>
            {sites.map((s) => (
              <option key={s.siteId} value={s.siteId}>
                {s.siteId}: {s.name}
              </option>
            ))}
          </select>

          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="h-9 rounded-lg border border-border bg-background px-3 text-xs font-bold text-foreground focus:ring-2 focus:ring-cat-yellow"
          >
            <option value="ALL">All Statuses ({statusCounts.total})</option>
            <option value="AVAILABLE">Available ({statusCounts.available})</option>
            <option value="ACTIVE">Active ({statusCounts.active})</option>
            <option value="IDLE">Idle ({statusCounts.idle})</option>
            <option value="OVERDUE">Risk / Overdue ({statusCounts.overdue})</option>
            <option value="MAINTENANCE">Maintenance ({statusCounts.maintenance})</option>
          </select>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSearch();
            }}
            className="relative"
          >
            <Search className="h-3.5 w-3.5 absolute left-2.5 top-2.5 text-muted-foreground" />
            <Input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search EQX1031..."
              className="h-9 pl-8 text-xs w-36 bg-background font-mono"
            />
          </form>
        </div>
      </div>

      {/* ── Selected Site Summary Bar ── */}
      {siteSummary && selectedSite !== 'ALL' && (
        <Card className="border border-border bg-card/50">
          <CardContent className="p-3 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-cat-yellow" />
              <span className="font-black text-foreground">{siteSummary.siteId}</span>
              <span className="text-muted-foreground">— {siteSummary.name}</span>
            </div>
            <div className="flex items-center gap-4 font-mono font-bold">
              <span>Total: <strong className="text-foreground">{siteSummary.total}</strong></span>
              <span className="text-emerald-400">Active: {siteSummary.active}</span>
              <span className="text-amber-400">Idle: {siteSummary.idle}</span>
              <span className="text-emerald-500">Avail: {siteSummary.available}</span>
              <span className="text-red-400">Risk: {siteSummary.risk}</span>
              <span className="text-muted-foreground">|</span>
              <span>Util: <strong className="text-cat-yellow">{siteSummary.avgUtilization?.toFixed(0)}%</strong></span>
              <span>Health: <strong className="text-emerald-400">{siteSummary.avgHealth?.toFixed(0)}%</strong></span>
              <span>Fuel: <strong className="text-blue-400">{siteSummary.avgFuel?.toFixed(0)}%</strong></span>
            </div>
            <Button variant="outline" size="sm" className="h-7 text-[10px] font-bold gap-1" onClick={() => fetchNearby(selectedSite)}>
              <ArrowRightLeft className="h-3 w-3" /> Find Nearby Equipment
            </Button>
          </CardContent>
        </Card>
      )}

      {/* ── Main Map & Panels Grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* ── Real Geographic Map Container (8 cols) ── */}
        <Card className="lg:col-span-8 overflow-hidden border-2 border-border shadow-xl">
          {/* Map Top Bar */}
          <div className="p-2.5 bg-neutral-900 border-b border-neutral-800 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <Navigation className="h-4 w-4 text-cat-yellow" />
              <span className="font-bold text-foreground">India Geographic Operations</span>
              <span className="text-muted-foreground">•</span>
              <span className="text-muted-foreground font-mono">
                Visible: <strong className="text-cat-yellow">{filtered.length}</strong> / {equipmentList.length} units
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="hidden md:flex items-center gap-2 text-[10px] font-semibold mr-2">
                <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-500" />Avail</span>
                <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-cat-yellow" />Active</span>
                <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-amber-500" />Idle</span>
                <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />Risk</span>
              </div>
              <Button
                variant={showSitePanel ? 'default' : 'outline'}
                size="sm"
                className="h-7 text-[10px] font-bold gap-1 px-2"
                onClick={() => setShowSitePanel(!showSitePanel)}
              >
                <Building2 className="h-3 w-3" /> Sites ({sites.length})
              </Button>
              <Button
                variant={showHeatmap ? 'default' : 'outline'}
                size="sm"
                className="h-7 text-[10px] font-bold gap-1 px-2"
                onClick={() => setShowHeatmap(!showHeatmap)}
              >
                <BarChart3 className="h-3 w-3" /> Heatmap
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-[10px] font-bold gap-1 px-2"
                onClick={() => setShowAdvanced(!showAdvanced)}
              >
                <Layers className="h-3 w-3" /> {showAdvanced ? 'Controls ▲' : 'Controls ▼'}
              </Button>
            </div>
          </div>

          {/* India Sites Drawer (when toggled) */}
          {showSitePanel && (
            <div className="p-2.5 bg-neutral-950 border-b border-neutral-800 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              {sites.map((s) => {
                const count = equipmentList.filter((e) => e.siteId === s.siteId).length;
                const isSel = selectedSite === s.siteId;
                return (
                  <button
                    key={s.siteId}
                    onClick={() => {
                      setSelectedSite(isSel ? 'ALL' : s.siteId);
                    }}
                    className={`p-2 rounded-lg border text-left transition-all ${
                      isSel ? 'bg-cat-yellow/15 border-cat-yellow text-foreground' : 'bg-neutral-900 border-neutral-800 hover:border-neutral-700 text-muted-foreground'
                    }`}
                  >
                    <div className="font-mono font-black text-cat-yellow text-[11px] flex justify-between">
                      <span>{s.siteId}</span>
                      <span className="text-foreground">{count} units</span>
                    </div>
                    <div className="font-bold text-[10px] text-foreground truncate">{s.name}</div>
                  </button>
                );
              })}
            </div>
          )}

          {/* Real Leaflet Map of India */}
          <div className="relative h-[560px] w-full bg-neutral-950">
            <MapContainer
              center={[22.9734, 78.6569]}
              zoom={5}
              minZoom={4}
              maxZoom={18}
              maxBounds={[
                [6.0, 68.0],
                [37.5, 97.5],
              ]}
              scrollWheelZoom={true}
              className="h-full w-full z-10"
              style={{ background: '#121214' }}
            >
              {/* Standard OpenStreetMap Free Tiles — No API Key Required! */}
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                maxZoom={19}
              />

              <MapBoundsController selectedSite={selectedSite} sites={sites} activeAsset={activeAsset} />

              {/* 1. Indian Project Sites & Geofences */}
              {sites.map((site) => {
                const siteEq = equipmentList.filter((e) => e.siteId === site.siteId);
                const radiusM = (site.geofenceRadius || 5.0) * 1000;

                return (
                  <React.Fragment key={site.siteId}>
                    {/* Geofence Boundary Circle */}
                    <Circle
                      center={[site.lat, site.lng]}
                      radius={radiusM}
                      pathOptions={{
                        color: '#d97706',
                        dashArray: '6, 6',
                        weight: 2,
                        fillColor: '#f59e0b',
                        fillOpacity: 0.05,
                      }}
                    />

                    {/* Utilization Heatmap Layer */}
                    {showHeatmap && (() => {
                      const util =
                        siteEq.length > 0
                          ? siteEq.reduce((s, e) => s + (e.engineHours > 0 ? (e.operatingHours / e.engineHours) * 100 : 50), 0) / siteEq.length
                          : 0;
                      const heatColor = util > 70 ? '#ef4444' : util > 50 ? '#f59e0b' : '#10b981';
                      return (
                        <Circle
                          center={[site.lat, site.lng]}
                          radius={radiusM * 0.85}
                          pathOptions={{ color: heatColor, weight: 0, fillColor: heatColor, fillOpacity: Math.min(0.4, util / 180) }}
                        />
                      );
                    })()}

                    {/* Site Portal Marker */}
                    <Marker
                      position={[site.lat, site.lng]}
                      icon={createSiteIcon(site, siteEq.length)}
                      eventHandlers={{
                        click: () => {
                          setSelectedSite(site.siteId);
                        },
                      }}
                    >
                      <Popup className="cat-map-popup">
                        <div className="p-1 space-y-1 text-xs">
                          <div className="font-mono font-black text-amber-600">{site.siteId}</div>
                          <div className="font-bold text-neutral-900">{site.name}</div>
                          <div className="text-neutral-600 text-[10px]">{site.address}</div>
                          <div className="pt-1 border-t text-[10px] grid grid-cols-2 gap-1">
                            <span>Total: <strong>{siteEq.length}</strong></span>
                            <span>Active: <strong>{siteEq.filter((e) => e.status === 'ACTIVE').length}</strong></span>
                            <span>Idle: <strong>{siteEq.filter((e) => e.status === 'IDLE').length}</strong></span>
                            <span>Avail: <strong>{siteEq.filter((e) => e.status === 'AVAILABLE').length}</strong></span>
                          </div>
                          <div className="text-[10px] text-neutral-500">Geofence: {site.geofenceRadius || 5.0} km</div>
                          <button
                            onClick={() => fetchNearby(site.siteId)}
                            className="mt-1 w-full bg-neutral-900 text-white font-bold py-1 rounded text-[10px] cursor-pointer hover:bg-neutral-800"
                          >
                            Find Nearby Equipment →
                          </button>
                        </div>
                      </Popup>
                    </Marker>
                  </React.Fragment>
                );
              })}

              {/* 2. Real-Time Moving Equipment Markers */}
              {filtered.map((asset) => {
                if (!asset.lat || !asset.lng) return null;
                const hasAlerts = !!(activeAlertsMap[asset.equipmentId]?.length);
                const isSelected = activeAssetId === asset.equipmentId;

                return (
                  <Marker
                    key={asset.equipmentId}
                    position={[asset.lat, asset.lng]}
                    icon={createEquipmentIcon(asset, isSelected, hasAlerts)}
                    eventHandlers={{
                      click: () => setActiveAssetId(asset.equipmentId),
                    }}
                  >
                    <Popup className="cat-map-popup">
                      <div className="p-1 space-y-1 text-xs min-w-[200px]">
                        <div className="flex items-center justify-between">
                          <span className="font-mono font-black text-amber-600">{asset.equipmentId}</span>
                          <span className="font-bold text-[10px] uppercase">{asset.status}</span>
                        </div>
                        <div className="font-bold text-neutral-900">{asset.model}</div>
                        <div className="text-[10px] text-neutral-600">{asset.type} • Site: {asset.siteId || 'Unassigned'}</div>
                        <div className="pt-1 border-t grid grid-cols-2 gap-1 text-[10px]">
                          <div>Engine: <strong>{formatNumber(asset.engineHours)}h</strong></div>
                          <div>Fuel: <strong>{asset.fuelLevel}%</strong></div>
                          <div>Speed: <strong>{asset.speed || 0} km/h</strong></div>
                          <div>Health: <strong>{asset.healthScore}%</strong></div>
                        </div>
                        <button
                          onClick={() => setActiveAssetId(asset.equipmentId)}
                          className="mt-1 w-full bg-neutral-900 text-white font-bold py-1 rounded text-[10px] cursor-pointer"
                        >
                          View Dossier →
                        </button>
                      </div>
                    </Popup>
                  </Marker>
                );
              })}

              {/* 3. Movement Trail Polyline */}
              {showTrail && trailPoints.length > 1 && (
                <Polyline positions={trailPoints.map((p) => [p.lat, p.lng])} pathOptions={{ color: '#FFCD11', weight: 3, opacity: 0.85, dashArray: '8, 4' }} />
              )}

              {/* 4. GPS Playback Ghost Marker */}
              {playbackActive && trailPoints[playbackIndex] && (
                <Marker
                  position={[trailPoints[playbackIndex].lat, trailPoints[playbackIndex].lng]}
                  icon={L.divIcon({
                    className: 'playback-ghost',
                    html: '<div style="width:18px;height:18px;border-radius:50%;background:#FFCD11;border:3px solid #fff;box-shadow:0 0 14px rgba(255,205,17,0.9);"></div>',
                    iconSize: [18, 18],
                    iconAnchor: [9, 9],
                  })}
                />
              )}
            </MapContainer>
          </div>
        </Card>

        {/* ── Right Column: Live Machine Dossier (4 cols) ── */}
        <div className="lg:col-span-4 space-y-3">
          <Card className="border-2 border-border shadow-xl flex flex-col" style={{ maxHeight: 'calc(560px + 52px)' }}>
            <CardHeader className="pb-2 border-b border-border flex flex-row items-center justify-between py-3 px-4">
              <div>
                <CardTitle className="text-sm font-black flex items-center gap-2">
                  <Activity className="h-4 w-4 text-cat-yellow" /> Live Machine Dossier
                </CardTitle>
              </div>
              {activeAsset && (
                <div className="flex items-center gap-1.5">{getSiteMatchBadge(activeAsset.siteMatchStatus)}</div>
              )}
            </CardHeader>

            <CardContent className="p-3 space-y-3 flex-1 overflow-y-auto text-xs">
              {!activeAsset ? (
                <div className="py-16 text-center text-muted-foreground space-y-2">
                  <Truck className="h-8 w-8 mx-auto text-cat-yellow opacity-50" />
                  <div>Select any machine marker on the India map to inspect live intelligence.</div>
                </div>
              ) : (
                <>
                  {/* Machine Top Info */}
                  <div className="p-2.5 bg-neutral-950 rounded-xl border border-neutral-800 flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-base font-black text-cat-yellow">{activeAsset.equipmentId}</span>
                        <Badge
                          variant={
                            activeAsset.status === 'AVAILABLE'
                              ? 'available'
                              : activeAsset.status === 'ACTIVE'
                              ? 'active'
                              : activeAsset.status === 'OVERDUE'
                              ? 'overdue'
                              : 'idle'
                          }
                          className="text-[9px] font-black"
                        >
                          {activeAsset.status}
                        </Badge>
                      </div>
                      <div className="font-bold text-sm text-foreground">{activeAsset.model}</div>
                      <div className="text-[10px] text-muted-foreground">
                        {activeAsset.type} • {activeAsset.serialNumber}
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setQrModalEquipment(activeAsset)}
                      className="h-7 text-[10px] font-bold gap-1 text-cat-yellow border-cat-yellow/40"
                    >
                      <QrCode className="h-3 w-3" /> QR
                    </Button>
                  </div>

                  {/* ★ ASSIGNED SITE vs CURRENT DETECTED SITE ★ */}
                  <div className="p-2.5 bg-neutral-900 rounded-lg border border-neutral-800 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground uppercase font-bold text-[9px] flex items-center gap-1">
                        <Target className="h-3 w-3 text-cat-yellow" /> Assigned Site:
                      </span>
                      <span className="font-mono font-bold text-foreground text-[10px]">
                        {activeAsset.siteId ? `${activeAsset.siteId} — ${siteMap.get(activeAsset.siteId)?.name || ''}` : 'None'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground uppercase font-bold text-[9px] flex items-center gap-1">
                        <Crosshair className="h-3 w-3 text-emerald-400" /> Current Site:
                      </span>
                      <span className="font-mono font-bold text-foreground text-[10px]">
                        {activeAsset.detectedSiteId
                          ? `${activeAsset.detectedSiteId} — ${activeAsset.detectedSiteName || siteMap.get(activeAsset.detectedSiteId)?.name || ''}`
                          : 'Outside Known Sites'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between pt-1 border-t border-neutral-800">
                      <span className="text-muted-foreground uppercase font-bold text-[9px] flex items-center gap-1">
                        <MapPin className="h-3 w-3 text-amber-400" /> Distance:
                      </span>
                      <span className="font-mono font-bold text-foreground">
                        {activeAsset.distanceFromAssignedSiteKm !== undefined ? `${activeAsset.distanceFromAssignedSiteKm.toFixed(1)} km` : '—'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground uppercase font-bold text-[9px]">Geofence Radius:</span>
                      <span className="font-mono text-muted-foreground">
                        {siteMap.get(activeAsset.siteId || '')?.geofenceRadius || 5.0} km
                      </span>
                    </div>
                  </div>

                  {/* Real GPS Fix & Freshness */}
                  <div className="p-2 bg-neutral-900 rounded-lg border border-neutral-800 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground uppercase font-bold text-[9px] flex items-center gap-1">
                        <MapPin className="h-3 w-3 text-cat-yellow" /> GPS Fix:
                      </span>
                      <span className="font-mono font-bold text-foreground text-[10px]">
                        {activeAsset.lat?.toFixed(5)}, {activeAsset.lng?.toFixed(5)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground uppercase font-bold text-[9px] flex items-center gap-1">
                        <Clock className="h-3 w-3 text-emerald-400" /> Last Telemetry:
                      </span>
                      <span className={`font-mono font-bold ${isTelemetryStale(activeAsset.lastUpdated) ? 'text-amber-400' : 'text-emerald-400'}`}>
                        {isTelemetryStale(activeAsset.lastUpdated) && '⚠ '}
                        {getSecondsAgo(activeAsset.lastUpdated)}
                      </span>
                    </div>
                    {/* Operator */}
                    {activeAsset.operator && (
                      <div className="flex items-center justify-between pt-1 border-t border-neutral-800">
                        <span className="text-muted-foreground uppercase font-bold text-[9px] flex items-center gap-1">
                          <User className="h-3 w-3 text-blue-400" /> Operator:
                        </span>
                        <span className="font-bold text-foreground text-[10px]">
                          {activeAsset.operator.name} ({activeAsset.operatorId})
                        </span>
                      </div>
                    )}
                    {/* Site Dwell Time */}
                    {dwellInfo && (
                      <div className="flex items-center justify-between pt-1 border-t border-neutral-800">
                        <span className="text-muted-foreground uppercase font-bold text-[9px] flex items-center gap-1">
                          <Timer className="h-3 w-3 text-purple-400" /> Site Dwell:
                        </span>
                        <span className="font-mono font-bold text-foreground text-[10px]">{dwellInfo.dwellFormatted}</span>
                      </div>
                    )}
                  </div>

                  {/* 4 Core Telemetry Metrics */}
                  <div className="grid grid-cols-2 gap-1.5 text-center">
                    {[
                      { icon: <Gauge className="h-3 w-3 text-cat-yellow" />, label: 'Run-Time', value: `${formatNumber(activeAsset.engineHours)} hrs` },
                      { icon: <Fuel className="h-3 w-3 text-blue-400" />, label: 'Fuel Tank', value: `${activeAsset.fuelLevel}%` },
                      { icon: <HeartPulse className="h-3 w-3 text-emerald-400" />, label: 'Health Score', value: `${activeAsset.healthScore}%`, color: 'text-emerald-400' },
                      { icon: <Thermometer className="h-3 w-3 text-amber-400" />, label: 'Temp', value: `${activeAsset.temperature || 82}°C` },
                    ].map((m, i) => (
                      <div key={i} className="p-2 rounded-lg border border-border bg-card">
                        <span className="text-[8px] text-muted-foreground uppercase font-semibold flex items-center justify-center gap-1">
                          {m.icon} {m.label}
                        </span>
                        <div className={`text-sm font-black font-mono mt-0.5 ${m.color || 'text-foreground'}`}>{m.value}</div>
                      </div>
                    ))}
                  </div>

                  {/* Active Risk Alerts */}
                  {activeAssetAlerts.length > 0 && (
                    <div className="p-2.5 bg-red-500/10 border border-red-500/30 rounded-xl space-y-1">
                      <div className="font-bold text-[10px] text-red-400 flex items-center gap-1">
                        <ShieldAlert className="h-3.5 w-3.5" /> Active Risk Anomaly ({activeAssetAlerts.length})
                      </div>
                      {activeAssetAlerts.slice(0, 2).map((alt) => (
                        <p key={alt.alertId || alt._id} className="text-[10px] text-foreground leading-snug">
                          • {alt.message?.substring(0, 120)}
                        </p>
                      ))}
                    </div>
                  )}

                  {/* Advanced Controls Accordion */}
                  {showAdvanced && (
                    <div className="space-y-2 pt-1 border-t border-border">
                      {/* Movement Trail */}
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-muted-foreground flex items-center gap-1">
                          <Route className="h-3 w-3" /> Movement Trail
                        </span>
                        <div className="flex items-center gap-1">
                          {['30m', '1h', '4h'].map((d) => (
                            <button
                              key={d}
                              onClick={() => {
                                setTrailDuration(d);
                                setShowTrail(true);
                              }}
                              className={`px-2 py-0.5 rounded text-[9px] font-bold border ${
                                trailDuration === d && showTrail
                                  ? 'bg-cat-yellow text-cat-black border-cat-yellow'
                                  : 'border-border text-muted-foreground hover:text-foreground'
                              }`}
                            >
                              {d}
                            </button>
                          ))}
                          {showTrail && (
                            <button onClick={() => setShowTrail(false)} className="text-[9px] text-red-400 font-bold ml-1">
                              ✕
                            </button>
                          )}
                        </div>
                      </div>

                      {/* GPS Playback */}
                      {showTrail && trailPoints.length > 1 && (
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold text-muted-foreground flex items-center gap-1">
                            <Play className="h-3 w-3" /> GPS Playback
                          </span>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => {
                                setPlaybackIndex(0);
                                setPlaybackActive(true);
                              }}
                              className="px-2 py-0.5 rounded text-[9px] font-bold border border-border text-foreground hover:bg-cat-yellow hover:text-cat-black"
                            >
                              <Play className="h-3 w-3 inline" />
                            </button>
                            <button
                              onClick={() => setPlaybackActive(false)}
                              className="px-2 py-0.5 rounded text-[9px] font-bold border border-border text-foreground"
                            >
                              <Pause className="h-3 w-3 inline" />
                            </button>
                            <button
                              onClick={() => {
                                setPlaybackActive(false);
                                setPlaybackIndex(0);
                              }}
                              className="px-2 py-0.5 rounded text-[9px] font-bold border border-border text-foreground"
                            >
                              <RotateCw className="h-3 w-3 inline" />
                            </button>
                            {playbackActive && trailPoints[playbackIndex] && (
                              <span className="text-[9px] font-mono text-muted-foreground ml-1">
                                {new Date(trailPoints[playbackIndex].timestamp).toLocaleTimeString()}
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Dossier Navigation Tabs */}
                  <div className="flex items-center gap-1 border-t border-border pt-2">
                    {(['telemetry', 'timeline', 'nearby'] as const).map((tab) => (
                      <button
                        key={tab}
                        onClick={() => setDossierTab(tab)}
                        className={`px-3 py-1 rounded text-[10px] font-bold ${
                          dossierTab === tab
                            ? 'bg-cat-yellow text-cat-black'
                            : 'text-muted-foreground hover:text-foreground border border-border'
                        }`}
                      >
                        {tab === 'telemetry' ? 'Actions' : tab === 'timeline' ? 'Timeline' : 'Nearby'}
                      </button>
                    ))}
                  </div>

                  {dossierTab === 'telemetry' && (
                    <div className="space-y-1.5">
                      <Link to={`/equipment/${activeAsset.equipmentId}`} className="block">
                        <Button variant="cat" size="sm" className="w-full font-black text-xs h-8 gap-1 shadow-md">
                          <ExternalLink className="h-3.5 w-3.5" /> Inspect Full Asset Dossier
                        </Button>
                      </Link>
                      <Link to="/qr-scanner" className="block">
                        <Button variant="outline" size="sm" className="w-full font-bold text-xs h-8 gap-1">
                          <RotateCcw className="h-3.5 w-3.5 text-cat-yellow" /> Check-In / Check-Out Station
                        </Button>
                      </Link>
                      {activeAsset.siteId && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full font-bold text-xs h-8 gap-1"
                          onClick={() => fetchNearby(activeAsset.siteId!, activeAsset.type)}
                        >
                          <ArrowRightLeft className="h-3.5 w-3.5 text-cat-yellow" /> Find Nearby {activeAsset.type}s
                        </Button>
                      )}
                    </div>
                  )}

                  {dossierTab === 'timeline' && (
                    <div className="space-y-1 max-h-40 overflow-y-auto">
                      {activeTimeline.length === 0 ? (
                        <p className="text-[10px] text-muted-foreground text-center py-4">Waiting for live events...</p>
                      ) : (
                        activeTimeline.map((ev) => (
                          <div key={ev.id} className="flex items-start gap-2 text-[10px] py-1 border-b border-border/50 last:border-0">
                            <span className="font-mono text-muted-foreground w-14 shrink-0">
                              {new Date(ev.timestamp).toLocaleTimeString('en-US', { hour12: false })}
                            </span>
                            <span className="text-foreground leading-tight">{ev.message}</span>
                          </div>
                        ))
                      )}
                    </div>
                  )}

                  {dossierTab === 'nearby' && (
                    <div className="space-y-1 max-h-40 overflow-y-auto">
                      {nearbyResults.length === 0 ? (
                        <p className="text-[10px] text-muted-foreground text-center py-4">
                          No nearby equipment found. Try selecting an Indian project site first.
                        </p>
                      ) : (
                        nearbyResults.map((nr) => (
                          <div key={nr.equipmentId} className="p-2 rounded-lg border border-border bg-neutral-950 flex items-center justify-between">
                            <div>
                              <div className="font-mono font-black text-cat-yellow text-[11px]">{nr.equipmentId}</div>
                              <div className="text-[9px] text-muted-foreground">
                                {nr.model} • {nr.currentSiteId}
                              </div>
                            </div>
                            <div className="text-right text-[9px] font-mono">
                              <div className="text-foreground font-bold">{nr.distanceKm?.toFixed(1)} km</div>
                              <div className="text-muted-foreground">
                                Util: {nr.utilization?.toFixed(0)}% | H: {nr.health}%
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Reusable QR Code Modal */}
      <QRCodeModal equipment={qrModalEquipment} open={!!qrModalEquipment} onClose={() => setQrModalEquipment(null)} />
    </div>
  );
}
