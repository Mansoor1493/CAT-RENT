import React, { useEffect, useState, useRef } from 'react';
import { Outlet, NavLink, Link, useNavigate } from 'react-router-dom';
import { useStore } from '@/store/useStore';
import { getSocket, connectSocket } from '@/services/socket';
import api from '@/services/api';
import { Alert, UserRole } from '@/types';
import {
  LayoutDashboard,
  Truck,
  FileText,
  BarChart3,
  Map,
  Bell,
  QrCode,
  TrendingUp,
  AlertTriangle,
  Lightbulb,
  Bot,
  Settings,
  Menu,
  Moon,
  Sun,
  Wifi,
  WifiOff,
  CheckCircle2,
  Volume2,
  VolumeX,
  X,
  ArrowRight,
  ShieldAlert,
  Radio,
  ChevronDown,
  LogOut,
  User as UserIcon,
  Building2,
  FileCheck2,
  ShieldCheck,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface ToastAlert {
  id: string;
  alert: Alert;
  timestamp: number;
}

export default function Layout() {
  const navigate = useNavigate();
  const {
    sidebarOpen,
    toggleSidebar,
    darkMode,
    toggleDarkMode,
    connected,
    setConnected,
    unreadAlerts,
    incrementAlerts,
    setUnreadAlerts,
    user,
    setAuth,
    clearAuth,
  } = useStore();

  // User Profile Dropdown
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  // Notification Bell Dropdown State
  const [bellOpen, setBellOpen] = useState(false);
  const [recentNotifications, setRecentNotifications] = useState<Alert[]>([]);
  const bellDropdownRef = useRef<HTMLDivElement>(null);

  // In-App Toast Queue
  const [toasts, setToasts] = useState<ToastAlert[]>([]);

  // Sound & Desktop Notification Preferences
  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => {
    return localStorage.getItem('catfleet_sound_enabled') !== 'false';
  });
  const [desktopNotifAllowed, setDesktopNotifAllowed] = useState<boolean>(() => {
    return typeof Notification !== 'undefined' && Notification.permission === 'granted';
  });

  // Toggle Sound
  const toggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    localStorage.setItem('catfleet_sound_enabled', String(next));
  };

  // Request Desktop Notification Permission
  const requestDesktopPermission = async () => {
    if (typeof Notification === 'undefined') return;
    try {
      const res = await Notification.requestPermission();
      setDesktopNotifAllowed(res === 'granted');
    } catch (e) {}
  };

  // Play Sound Chime
  const playCriticalChime = () => {
    if (!soundEnabled) return;
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const now = audioCtx.currentTime;
      const osc1 = audioCtx.createOscillator();
      const gain1 = audioCtx.createGain();
      osc1.type = 'triangle';
      osc1.frequency.setValueAtTime(587.33, now);
      gain1.gain.setValueAtTime(0.3, now);
      gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
      osc1.connect(gain1);
      gain1.connect(audioCtx.destination);
      osc1.start(now);
      osc1.stop(now + 0.2);
    } catch (e) {}
  };

  // Show System Notification
  const triggerBrowserNotification = (alert: Alert) => {
    if (desktopNotifAllowed && typeof Notification !== 'undefined') {
      try {
        const notif = new Notification(`🚨 CatRent Risk Alert: ${alert.severity}`, {
          body: `${alert.equipmentId}: ${alert.message}`,
          icon: '/vite.svg',
        });
        notif.onclick = () => {
          window.focus();
          navigate(`/equipment/${alert.equipmentId}`);
        };
      } catch (e) {}
    }
  };

  // Push In-App Floating Toast
  const pushToast = (alert: Alert) => {
    const toastItem: ToastAlert = {
      id: `${alert._id || alert.alertId}-${Date.now()}`,
      alert,
      timestamp: Date.now(),
    };
    setToasts((prev) => [toastItem, ...prev.slice(0, 3)]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== toastItem.id));
    }, 6500);
  };

  // Dismiss Toast
  const dismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Role-Based Navigation Items
  const customerNav = [
    { to: '/customer-dashboard', icon: LayoutDashboard, label: 'Customer Portal' },
    { to: '/equipment', icon: Truck, label: 'Browse Machinery' },
    { to: '/rentals', icon: FileText, label: 'Active Rentals' },
    { to: '/copilot', icon: Bot, label: 'AI Copilot' },
  ];

  const siteManagerNav = [
    { to: '/site-operations', icon: Building2, label: 'Site Operations' },
    { to: '/equipment', icon: Truck, label: 'Assigned Machinery' },
    { to: '/qr-scanner', icon: QrCode, label: 'Check-In / Check-Out' },
    { to: '/map', icon: Map, label: 'Site GPS Map' },
    { to: '/alerts', icon: Bell, label: 'Site Alerts' },
    { to: '/copilot', icon: Bot, label: 'AI Copilot' },
  ];

  const adminNav = [
    { to: '/', icon: LayoutDashboard, label: 'Command Center' },
    { to: '/approvals', icon: FileCheck2, label: 'Rental Approvals' },
    { to: '/equipment', icon: Truck, label: 'Equipment Fleet' },
    { to: '/rentals', icon: FileText, label: 'Rentals Lifecycle' },
    { to: '/map', icon: Map, label: 'Live Fleet Map' },
    { to: '/qr-scanner', icon: QrCode, label: 'Check-In / Check-Out' },
    { to: '/usage', icon: BarChart3, label: 'Usage & Telemetry' },
    { to: '/alerts', icon: Bell, label: 'Risk Alerts' },
    { to: '/anomalies', icon: AlertTriangle, label: 'Anomalies' },
    { to: '/forecast', icon: TrendingUp, label: 'Demand Forecast' },
    { to: '/recommendations', icon: Lightbulb, label: 'Reallocations' },
    { to: '/audit-logs', icon: ShieldCheck, label: 'Audit Logs' },
    { to: '/copilot', icon: Bot, label: 'AI Copilot' },
    { to: '/settings', icon: Settings, label: 'Settings & Exports' },
  ];

  const activeNavItems =
    user?.role === 'CUSTOMER'
      ? customerNav
      : user?.role === 'SITE_MANAGER'
      ? siteManagerNav
      : adminNav;

  // Socket Connection & Real-Time Alert Stream
  useEffect(() => {
    connectSocket();
    const socket = getSocket();

    socket.on('connect', () => {
      setConnected(true);
    });

    socket.on('disconnect', () => {
      setConnected(false);
    });

    // Real-Time Alert listener
    socket.on('alert:new', (alert: Alert) => {
      incrementAlerts();
      setRecentNotifications((prev) => [alert, ...prev.slice(0, 9)]);
      pushToast(alert);
      triggerBrowserNotification(alert);
      if (alert.severity === 'CRITICAL' || alert.severity === 'HIGH') {
        playCriticalChime();
      }
    });

    // Real-Time Rental Request listener
    socket.on('rental:requested', (data: any) => {
      const pseudoAlert: Alert = {
        _id: `req-${Date.now()}`,
        alertId: `REQ-${Date.now()}`,
        type: 'OVERDUE',
        equipmentId: data?.request?.equipmentId || 'EQUIPMENT',
        severity: 'INFO',
        title: 'NEW RENTAL REQUEST',
        message: data?.message || 'New customer rental request received',
        status: 'ACTIVE',
        timestamp: new Date().toISOString(),
      };
      incrementAlerts();
      pushToast(pseudoAlert);
      setRecentNotifications((prev) => [pseudoAlert, ...prev.slice(0, 9)]);
    });

    // Real-Time Rental Approval listener
    socket.on('rental:approved', (data: any) => {
      const pseudoAlert: Alert = {
        _id: `app-${Date.now()}`,
        alertId: `APP-${Date.now()}`,
        type: 'HEALTH_CRITICAL',
        equipmentId: data?.equipmentId || 'EQUIPMENT',
        severity: 'INFO',
        title: 'RENTAL REQUEST APPROVED',
        message: data?.message || 'Your rental request was approved!',
        status: 'ACTIVE',
        timestamp: new Date().toISOString(),
      };
      incrementAlerts();
      pushToast(pseudoAlert);
    });

    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('alert:new');
      socket.off('rental:requested');
      socket.off('rental:approved');
    };
  }, []);

  // Fetch initial unread count & recent alerts
  useEffect(() => {
    api
      .get('/alerts?status=ACTIVE&limit=10')
      .then((res) => {
        if (res.data?.data) {
          setRecentNotifications(res.data.data);
          const unread = res.data.data.filter((a: Alert) => !a.isRead).length;
          setUnreadAlerts(unread);
        }
      })
      .catch(() => {});
  }, []);

  // Mark all notifications read
  const handleMarkAllRead = async () => {
    try {
      await api.post('/alerts/mark-all-read');
      setUnreadAlerts(0);
      setRecentNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    } catch (e) {}
  };

  // Authentic Demo Role Switcher (fetches real JWT token)
  const handleAuthenticRoleSwitch = async (email: string, targetPath: string) => {
    try {
      const res = await api.post('/auth/login', {
        email,
        password: 'catrent2026',
      });
      if (res.data?.data) {
        setAuth(res.data.data.user, res.data.data.token);
        setUserMenuOpen(false);
        navigate(targetPath);
      }
    } catch (e) {
      setUserMenuOpen(false);
    }
  };

  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground">
      {/* Floating In-App Risk Notification Toasts */}
      <div className="fixed top-20 right-6 z-50 flex flex-col gap-2.5 max-w-sm w-full pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className="pointer-events-auto p-4 rounded-xl border-2 border-border bg-card/95 backdrop-blur-md shadow-2xl flex items-start gap-3 animate-in slide-in-from-top-4 duration-200"
          >
            <div
              className={`h-9 w-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
                toast.alert.severity === 'CRITICAL'
                  ? 'bg-red-500/20 text-red-500 border border-red-500/40 animate-pulse'
                  : toast.alert.severity === 'HIGH'
                  ? 'bg-orange-500/20 text-orange-500 border border-orange-500/40'
                  : 'bg-blue-500/20 text-blue-400 border border-blue-500/40'
              }`}
            >
              <ShieldAlert className="h-5 w-5" />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-1">
                <Badge
                  variant={toast.alert.severity === 'CRITICAL' ? 'destructive' : 'secondary'}
                  className="text-[9px] px-1.5 py-0 font-bold"
                >
                  {toast.alert.title || toast.alert.severity}
                </Badge>
                <span className="text-[10px] text-muted-foreground font-mono">Just now</span>
              </div>
              <p className="text-xs font-bold text-foreground mt-1 truncate">
                {toast.alert.equipmentId}: {toast.alert.message}
              </p>
              <button
                onClick={() => {
                  dismissToast(toast.id);
                  navigate(`/equipment/${toast.alert.equipmentId}`);
                }}
                className="text-[11px] text-cat-yellow hover:underline font-bold mt-1.5 flex items-center gap-1 cursor-pointer"
              >
                Inspect Machine Dossier <ArrowRight className="h-3 w-3" />
              </button>
            </div>

            <button
              onClick={() => dismissToast(toast.id)}
              className="text-muted-foreground hover:text-foreground p-0.5 cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>

      {/* Sidebar Navigation */}
      <aside
        className={cn(
          'flex flex-col border-r border-border bg-card transition-all duration-300 z-30',
          sidebarOpen ? 'w-64' : 'w-16'
        )}
      >
        {/* Brand Header */}
        <div className="flex h-16 items-center gap-3 border-b border-border px-4 flex-shrink-0">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-cat-yellow shadow-md flex-shrink-0">
            <Truck className="h-5 w-5 text-cat-black font-black" />
          </div>
          {sidebarOpen && (
            <div className="overflow-hidden">
              <h1 className="text-sm font-black tracking-tight text-foreground">CatRent</h1>
              <p className="text-[10px] font-semibold text-cat-yellow tracking-wider uppercase">
                Smart Rental & Optimization
              </p>
            </div>
          )}
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 overflow-y-auto py-3">
          <ul className="space-y-1 px-2">
            {activeNavItems.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-3 rounded-lg px-3 py-2 text-xs font-semibold transition-colors',
                      isActive
                        ? 'bg-cat-yellow text-cat-black shadow-sm font-bold'
                        : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                    )
                  }
                >
                  <item.icon className="h-4 w-4 flex-shrink-0" />
                  {sidebarOpen && <span className="truncate">{item.label}</span>}
                  {sidebarOpen && item.to === '/alerts' && unreadAlerts > 0 && (
                    <Badge variant="destructive" className="ml-auto text-[10px] px-1.5 py-0">
                      {unreadAlerts}
                    </Badge>
                  )}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        {/* Footer info */}
        {sidebarOpen && (
          <div className="border-t border-border p-3 flex-shrink-0 bg-muted/20">
            <div className="flex items-center justify-between text-[11px] font-semibold text-foreground">
              <span>CatRent Platform</span>
              <span className="text-[10px] text-cat-yellow font-mono font-bold">HACKATHON 2026</span>
            </div>
            <p className="text-[10px] text-muted-foreground mt-0.5">Role: {user?.role || 'CUSTOMER'}</p>
          </div>
        )}
      </aside>

      {/* Main Container */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top App Header */}
        <header className="flex h-16 items-center justify-between border-b border-border px-6 bg-card flex-shrink-0 z-20">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={toggleSidebar} className="h-9 w-9">
              <Menu className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-2">
              {connected ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-bold text-emerald-500 border border-emerald-500/20">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                  Live Socket Stream
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground">
                  <WifiOff className="h-3.5 w-3.5" />
                  Direct REST Mode
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Global Notification Bell & Dropdown */}
            <div className="relative" ref={bellDropdownRef}>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setBellOpen(!bellOpen)}
                className="relative h-9 w-9"
                title="Notifications"
              >
                <Bell className="h-4 w-4" />
                {unreadAlerts > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-black text-white shadow-md animate-pulse">
                    {unreadAlerts > 99 ? '99+' : unreadAlerts}
                  </span>
                )}
              </Button>

              {/* Notification Dropdown Panel */}
              {bellOpen && (
                <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl border-2 border-border bg-card shadow-2xl p-0 overflow-hidden z-50 animate-in fade-in-50 zoom-in-95 duration-150">
                  {/* Dropdown Header */}
                  <div className="p-3.5 bg-neutral-900 border-b border-neutral-800 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <ShieldAlert className="h-4 w-4 text-cat-yellow" />
                      <span className="font-bold text-xs text-foreground">CatRent Live Alerts</span>
                      {unreadAlerts > 0 && (
                        <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                          {unreadAlerts} unread
                        </Badge>
                      )}
                    </div>
                    {unreadAlerts > 0 && (
                      <button
                        onClick={handleMarkAllRead}
                        className="text-[11px] text-cat-yellow hover:underline font-semibold cursor-pointer"
                      >
                        Mark all as read
                      </button>
                    )}
                  </div>

                  {/* Notification List */}
                  <div className="max-h-80 overflow-y-auto divide-y divide-border">
                    {recentNotifications.length === 0 ? (
                      <div className="p-6 text-center text-xs text-muted-foreground">
                        <CheckCircle2 className="h-8 w-8 text-emerald-500 mx-auto mb-2 opacity-50" />
                        <span>No active risk alerts at this time.</span>
                      </div>
                    ) : (
                      recentNotifications.map((notif) => (
                        <div
                          key={notif._id || notif.alertId}
                          onClick={() => {
                            setBellOpen(false);
                            navigate(`/equipment/${notif.equipmentId}`);
                          }}
                          className={`p-3 text-xs hover:bg-muted/40 cursor-pointer transition-colors space-y-1 ${
                            !notif.isRead ? 'bg-cat-yellow/5' : ''
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <Badge
                              variant={
                                notif.severity === 'CRITICAL' || notif.severity === 'HIGH'
                                  ? 'destructive'
                                  : 'secondary'
                              }
                              className="text-[9px] px-1.5 py-0 font-bold"
                            >
                              {notif.title || notif.severity}
                            </Badge>
                            <span className="text-[10px] text-muted-foreground font-mono">
                              {new Date(notif.timestamp).toLocaleTimeString()}
                            </span>
                          </div>
                          <div className="font-bold text-foreground">
                            {notif.equipmentId}: {notif.message}
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  <div className="p-3 bg-neutral-900 border-t border-neutral-800 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={toggleSound}
                        className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground cursor-pointer"
                        title="Toggle Sound"
                      >
                        {soundEnabled ? (
                          <Volume2 className="h-3.5 w-3.5 text-cat-yellow" />
                        ) : (
                          <VolumeX className="h-3.5 w-3.5" />
                        )}
                        <span>Sound {soundEnabled ? 'ON' : 'OFF'}</span>
                      </button>
                    </div>

                    <Link
                      to="/alerts"
                      onClick={() => setBellOpen(false)}
                      className="font-bold text-[11px] text-cat-yellow hover:underline flex items-center gap-1"
                    >
                      View All Alerts →
                    </Link>
                  </div>
                </div>
              )}
            </div>

            {/* Authenticated User Profile & Role Switcher */}
            <div className="relative">
              <button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="flex items-center gap-2 p-1.5 rounded-xl border border-border bg-muted/30 hover:bg-muted/60 transition-all cursor-pointer"
              >
                <div className="h-7 w-7 rounded-lg bg-cat-yellow/20 border border-cat-yellow/40 flex items-center justify-center text-cat-yellow font-black text-xs">
                  {user?.name?.charAt(0) || 'U'}
                </div>
                <div className="hidden md:block text-left text-xs">
                  <div className="font-bold text-foreground truncate max-w-[130px]">
                    {user?.name?.split(' ')[0] || 'User'}
                  </div>
                  <div className="text-[9px] text-cat-yellow font-mono font-bold leading-none">
                    {user?.role || 'CUSTOMER'}
                  </div>
                </div>
                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
              </button>

              {userMenuOpen && (
                <div className="absolute right-0 mt-2 w-72 rounded-2xl border-2 border-border bg-card shadow-2xl p-2 z-50 animate-in fade-in-50 zoom-in-95 duration-150">
                  <div className="p-3 bg-neutral-900 rounded-xl border border-neutral-800 mb-2">
                    <div className="font-bold text-xs text-foreground">{user?.name || 'Authorized User'}</div>
                    <div className="text-[10px] text-muted-foreground truncate">{user?.email || 'user@catrent.io'}</div>
                    <Badge variant="outline" className="mt-1.5 text-[9px] font-mono font-bold text-cat-yellow border-cat-yellow/40">
                      ACTIVE ROLE: {user?.role || 'CUSTOMER'}
                    </Badge>
                  </div>

                  <div className="text-[10px] font-bold text-muted-foreground uppercase px-2 py-1 flex items-center gap-1">
                    <Sparkles className="h-3 w-3 text-cat-yellow" /> DEMO MODE (Switch Role):
                  </div>

                  <div className="space-y-1">
                    {[
                      {
                        role: 'CUSTOMER' as const,
                        name: 'John Doe (Customer)',
                        email: 'customer@example.com',
                        path: '/customer-dashboard',
                        desc: 'Rental requests, status & extensions',
                      },
                      {
                        role: 'ADMIN' as const,
                        name: 'Alex Mercer (Admin)',
                        email: 'admin@example.com',
                        path: '/',
                        desc: 'Full approvals, analytics & telemetry',
                      },
                      {
                        role: 'SITE_MANAGER' as const,
                        name: 'Frank Reynolds (Site Mgr)',
                        email: 'manager@example.com',
                        path: '/site-operations',
                        desc: 'Assigned sites (S002/S005) & check-in/out',
                      },
                    ].map((r) => (
                      <button
                        key={r.role}
                        onClick={() => handleAuthenticRoleSwitch(r.email, r.path)}
                        className={`w-full p-2 rounded-lg text-left text-xs font-semibold flex items-center justify-between transition-colors cursor-pointer ${
                          user?.role === r.role
                            ? 'bg-cat-yellow/15 text-cat-yellow font-bold border border-cat-yellow/30'
                            : 'hover:bg-muted text-foreground'
                        }`}
                      >
                        <div>
                          <div className="font-bold text-xs">{r.name}</div>
                          <div className="text-[9px] text-muted-foreground font-normal">{r.desc}</div>
                        </div>
                        {user?.role === r.role && <CheckCircle2 className="h-3.5 w-3.5 text-cat-yellow flex-shrink-0" />}
                      </button>
                    ))}
                  </div>

                  <div className="border-t border-border mt-2 pt-2">
                    <button
                      onClick={() => {
                        clearAuth();
                        setUserMenuOpen(false);
                        navigate('/login');
                      }}
                      className="w-full p-2 rounded-lg text-left text-xs font-bold text-red-400 hover:bg-red-500/10 flex items-center gap-2 transition-colors cursor-pointer"
                    >
                      <LogOut className="h-3.5 w-3.5" />
                      Sign Out & Go to Login
                    </button>
                  </div>
                </div>
              )}
            </div>

            <Button variant="ghost" size="icon" onClick={toggleDarkMode} className="h-9 w-9">
              {darkMode ? <Sun className="h-4 w-4 text-cat-yellow" /> : <Moon className="h-4 w-4" />}
            </Button>
          </div>
        </header>

        {/* Page Content Viewport */}
        <main className="flex-1 overflow-y-auto p-6 bg-background">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
