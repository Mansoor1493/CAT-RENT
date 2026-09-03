import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import api from '@/services/api';
import { useStore } from '@/store/useStore';
import { UserRole } from '@/types';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Truck,
  ShieldCheck,
  UserCheck,
  Key,
  Lock,
  Mail,
  ArrowRight,
  Eye,
  EyeOff,
  Sparkles,
  Zap,
  CheckCircle2,
  AlertCircle,
  Building2,
  HardHat,
  User,
} from 'lucide-react';

const DEMO_USERS: {
  role: UserRole;
  name: string;
  email: string;
  password?: string;
  desc: string;
  badge: string;
  targetPath: string;
}[] = [
  {
    role: 'CUSTOMER',
    name: 'John Doe (Customer)',
    email: 'customer@example.com',
    password: 'catrent2026',
    desc: 'Browse equipment, submit rental requests & request extensions',
    badge: 'CUSTOMER PORTAL',
    targetPath: '/customer-dashboard',
  },
  {
    role: 'ADMIN',
    name: 'Alex Mercer (Admin)',
    email: 'admin@example.com',
    password: 'catrent2026',
    desc: 'Review & approve rental requests, fleet analytics & controls',
    badge: 'SUPER ADMIN',
    targetPath: '/',
  },
  {
    role: 'SITE_MANAGER',
    name: 'Frank Reynolds (Site Mgr)',
    email: 'manager@example.com',
    password: 'catrent2026',
    desc: 'Assigned sites (S002/S005) machinery, check-in/out & telemetry',
    badge: 'SITE SUPERINTENDENT',
    targetPath: '/site-operations',
  },
];

export default function LoginPage() {
  const navigate = useNavigate();
  const setAuth = useStore((state) => state.setAuth);

  const [email, setEmail] = useState('customer@example.com');
  const [password, setPassword] = useState('catrent2026');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const loginMutation = useMutation({
    mutationFn: async (payload: { email: string; password?: string; role?: UserRole; name?: string; targetPath?: string }) => {
      setError(null);
      try {
        const res = await api.post('/auth/login', {
          email: payload.email,
          password: payload.password || 'catrent2026',
        });
        return { data: res.data?.data, targetPath: payload.targetPath };
      } catch (err: any) {
        throw err;
      }
    },
    onSuccess: ({ data, targetPath }) => {
      if (data) {
        setSuccessMsg(`Welcome back, ${data.user.name}!`);
        setAuth(data.user, data.token);
        setTimeout(() => {
          if (targetPath) {
            navigate(targetPath);
          } else if (data.user.role === 'CUSTOMER') {
            navigate('/customer-dashboard');
          } else if (data.user.role === 'SITE_MANAGER') {
            navigate('/site-operations');
          } else {
            navigate('/');
          }
        }, 350);
      }
    },
    onError: (err: any) => {
      setError(err.response?.data?.message || 'Authentication failed. Please verify credentials.');
    },
  });

  const handleDemoLogin = (demo: typeof DEMO_USERS[0]) => {
    setEmail(demo.email);
    setPassword(demo.password || 'catrent2026');
    loginMutation.mutate({
      email: demo.email,
      password: demo.password || 'catrent2026',
      role: demo.role,
      name: demo.name,
      targetPath: demo.targetPath,
    });
  };

  return (
    <div className="min-h-screen bg-neutral-950 flex flex-col justify-center items-center p-4 relative overflow-hidden">
      {/* Background Graphic Grid */}
      <div className="absolute inset-0 bg-[radial-gradient(#262626_1px,transparent_1px)] [background-size:24px_24px] opacity-40 pointer-events-none" />

      <div className="w-full max-w-md space-y-6 relative z-10">
        {/* Header Branding */}
        <div className="text-center space-y-2">
          <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-cat-yellow text-cat-black font-black shadow-2xl shadow-cat-yellow/20 border-2 border-cat-yellow">
            <Truck className="h-9 w-9" />
          </div>
          <h1 className="text-3xl font-black tracking-tight text-white flex items-center justify-center gap-2">
            CatRent
          </h1>
          <p className="text-xs font-semibold text-neutral-400 max-w-xs mx-auto">
            Smart Rental Tracking, Utilization & Predictive Asset Optimization
          </p>
        </div>

        {/* Success / Error Feedback */}
        {successMsg && (
          <div className="p-3.5 bg-emerald-500/15 border-2 border-emerald-500/50 rounded-xl text-xs font-bold text-emerald-400 flex items-center gap-2 shadow-lg animate-in fade-in">
            <CheckCircle2 className="h-4 w-4 text-emerald-400 flex-shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {error && (
          <div className="p-3.5 bg-red-500/15 border-2 border-red-500/50 rounded-xl text-xs font-bold text-red-400 flex items-center gap-2 shadow-lg animate-in fade-in">
            <AlertCircle className="h-4 w-4 text-red-400 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* 1-Click Role Login Selector */}
        <Card className="border-2 border-cat-yellow/50 bg-neutral-900 shadow-2xl overflow-hidden">
          <CardHeader className="pb-3 bg-neutral-950/70 border-b border-neutral-800">
            <CardTitle className="text-xs font-black uppercase tracking-wider flex items-center justify-between text-white">
              <span className="flex items-center gap-1.5 text-cat-yellow">
                <Sparkles className="h-4 w-4" /> DEMO MODE: 1-Click Role Access
              </span>
              <Badge variant="default" className="text-[9px] px-2 py-0 bg-cat-yellow text-cat-black font-black">
                True RBAC JWT
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 space-y-2">
            {DEMO_USERS.map((demo) => (
              <button
                key={demo.role}
                onClick={() => handleDemoLogin(demo)}
                disabled={loginMutation.isPending}
                className="w-full p-2.5 rounded-xl border border-neutral-800 bg-neutral-950/90 hover:bg-neutral-800 hover:border-cat-yellow/70 text-left transition-all flex items-center justify-between group cursor-pointer shadow-sm hover:shadow-md"
              >
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="font-black text-xs text-white group-hover:text-cat-yellow transition-colors">
                      {demo.name}
                    </span>
                    <span className="text-[8px] font-bold px-1.5 py-0.2 rounded bg-neutral-800 text-neutral-300 border border-neutral-700 font-mono">
                      {demo.badge}
                    </span>
                  </div>
                  <div className="text-[10px] text-neutral-400">{demo.desc}</div>
                </div>
                <div className="h-7 w-7 rounded-lg bg-neutral-900 group-hover:bg-cat-yellow group-hover:text-cat-black flex items-center justify-center text-neutral-500 transition-all flex-shrink-0">
                  <ArrowRight className="h-3.5 w-3.5" />
                </div>
              </button>
            ))}
          </CardContent>
        </Card>

        {/* Credentials Form Login */}
        <Card className="border border-neutral-800 bg-neutral-900/80 shadow-xl">
          <CardContent className="p-4 space-y-3">
            <div>
              <label className="text-xs font-bold text-neutral-300 uppercase flex items-center gap-1.5">
                <Mail className="h-3.5 w-3.5 text-cat-yellow" /> Email Address
              </label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="customer@example.com"
                className="mt-1 bg-neutral-950 border-neutral-800 text-xs h-9 font-semibold text-white focus:ring-2 focus:ring-cat-yellow"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-neutral-300 uppercase flex items-center gap-1.5">
                <Lock className="h-3.5 w-3.5 text-cat-yellow" /> Password
              </label>
              <div className="relative mt-1">
                <Input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="bg-neutral-950 border-neutral-800 text-xs h-9 font-mono pr-10 text-white focus:ring-2 focus:ring-cat-yellow"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2.5 top-2.5 text-neutral-400 hover:text-white transition-colors cursor-pointer"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <Button
              variant="cat"
              size="sm"
              className="w-full font-black text-xs h-10 mt-2 shadow-lg gap-2"
              onClick={() => loginMutation.mutate({ email, password })}
              disabled={loginMutation.isPending}
            >
              {loginMutation.isPending ? (
                <>Authenticating Industrial Credentials...</>
              ) : (
                <>
                  <Zap className="h-4 w-4" /> Sign In with Credentials
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Footer Note */}
        <div className="text-center text-[10px] text-neutral-500 font-mono">
          CATERPILLAR HACKATHON 2026 • CATRENT SECURE RBAC GATEWAY
        </div>
      </div>
    </div>
  );
}
