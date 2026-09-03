import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: string | Date): string {
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function formatDateTime(date: string | Date): string {
  return new Date(date).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    AVAILABLE: 'bg-status-available text-white',
    RENTED: 'bg-status-rented text-white',
    ACTIVE: 'bg-status-active text-white',
    IDLE: 'bg-status-idle text-white',
    OVERDUE: 'bg-status-overdue text-white',
    MAINTENANCE: 'bg-status-maintenance text-white',
    IN_TRANSIT: 'bg-status-intransit text-white',
    UNASSIGNED: 'bg-status-unassigned text-white',
  };
  return colors[status] || 'bg-gray-500 text-white';
}

export function getSeverityColor(severity: string): string {
  const colors: Record<string, string> = {
    LOW: 'bg-blue-100 text-blue-800',
    MEDIUM: 'bg-yellow-100 text-yellow-800',
    HIGH: 'bg-orange-100 text-orange-800',
    CRITICAL: 'bg-red-100 text-red-800',
  };
  return colors[severity] || 'bg-gray-100 text-gray-800';
}

export function formatNumber(num: number, decimals = 0): string {
  return num.toLocaleString('en-US', { maximumFractionDigits: decimals });
}

export function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

export function calculateUtilization(operatingHours: number, availableHours: number): number {
  if (availableHours === 0) return 0;
  return (operatingHours / availableHours) * 100;
}
