import { create } from 'zustand';
import type { DashboardKPIs, User, Alert, UserRole } from '@/types';

interface AppState {
  // Auth
  user: User | null;
  token: string | null;
  setAuth: (user: User, token: string) => void;
  clearAuth: () => void;
  switchRole: (role: UserRole, name: string, email: string) => void;

  // Dashboard
  kpis: DashboardKPIs | null;
  setKPIs: (kpis: DashboardKPIs) => void;

  // Alerts
  unreadAlerts: number;
  setUnreadAlerts: (count: number) => void;
  incrementAlerts: () => void;

  // UI
  sidebarOpen: boolean;
  toggleSidebar: () => void;
  darkMode: boolean;
  toggleDarkMode: () => void;

  // Socket
  connected: boolean;
  setConnected: (connected: boolean) => void;
}

const getInitialUser = (): User => {
  try {
    const saved = localStorage.getItem('catrent_user');
    if (saved) return JSON.parse(saved);
  } catch (e) {}
  return {
    _id: 'USR001',
    userId: 'USR001',
    email: 'admin@catrent.io',
    name: 'Alex Mercer (Admin)',
    role: 'ADMIN',
  };
};

export const useStore = create<AppState>((set) => ({
  // Auth
  user: getInitialUser(),
  token: localStorage.getItem('catrent_token') || 'demo-jwt-token-catrent-2026',
  setAuth: (user, token) => {
    localStorage.setItem('catrent_token', token);
    localStorage.setItem('catrent_user', JSON.stringify(user));
    set({ user, token });
  },
  clearAuth: () => {
    localStorage.removeItem('catrent_token');
    localStorage.removeItem('catrent_user');
    set({ user: null, token: null });
  },
  switchRole: (role: UserRole, name: string, email: string) => {
    const newUser: User = {
      _id: `USR-${role}`,
      userId: `USR-${role}`,
      email,
      name,
      role,
    };
    localStorage.setItem('catrent_user', JSON.stringify(newUser));
    set({ user: newUser });
  },

  // Dashboard
  kpis: null,
  setKPIs: (kpis) => set({ kpis }),

  // Alerts
  unreadAlerts: 0,
  setUnreadAlerts: (count) => set({ unreadAlerts: count }),
  incrementAlerts: () => set((state) => ({ unreadAlerts: state.unreadAlerts + 1 })),

  // UI
  sidebarOpen: true,
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  darkMode: false,
  toggleDarkMode: () =>
    set((state) => {
      const newMode = !state.darkMode;
      document.documentElement.classList.toggle('dark', newMode);
      return { darkMode: newMode };
    }),

  // Socket
  connected: false,
  setConnected: (connected) => set({ connected }),
}));
