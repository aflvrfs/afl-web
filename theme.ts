import { useMemo } from 'react';
import { useColorScheme } from 'react-native';
import type { BuildingType, JobPriority, JobStatus } from './types';

export type IconName = string;

const light = {
  accent: '#17607A',
  background: '#F2F2F7',
  surface: '#FFFFFF',
  surfaceAlt: '#F2F2F7',
  text: '#000000',
  secondary: 'rgba(60,60,67,0.6)',
  tertiary: 'rgba(60,60,67,0.3)',
  separator: 'rgba(60,60,67,0.2)',
  fill: 'rgba(120,120,128,0.12)',
  offHours: 'rgba(120,120,128,0.10)',
  danger: '#BF3B30',
  warning: '#B86E0B',
  success: '#2B7F52',
  onAccent: '#FFFFFF',
  shadow: 'rgba(0,0,0,0.05)',
};

const dark: typeof light = {
  accent: '#5AA9C0',
  background: '#000000',
  surface: '#1C1C1E',
  surfaceAlt: '#2C2C2E',
  text: '#FFFFFF',
  secondary: 'rgba(235,235,245,0.6)',
  tertiary: 'rgba(235,235,245,0.3)',
  separator: 'rgba(84,84,88,0.6)',
  fill: 'rgba(120,120,128,0.24)',
  offHours: 'rgba(120,120,128,0.18)',
  danger: '#E5675C',
  warning: '#E2A045',
  success: '#5BBE86',
  onAccent: '#FFFFFF',
  shadow: 'rgba(0,0,0,0)',
};

export type Colors = typeof light;

export interface Theme {
  dark: boolean;
  c: Colors;
}

export function useTheme(): Theme {
  const scheme = useColorScheme();
  return useMemo(() => ({ dark: scheme === 'dark', c: scheme === 'dark' ? dark : light }), [scheme]);
}

export const spacing = { xxs: 4, xs: 6, s: 8, m: 12, l: 16, xl: 24, xxl: 32 };
export const radius = { card: 14, control: 10, block: 6 };

/** Hex-Farbe mit Transparenz. */
export function alpha(hex: string, a: number): string {
  const clean = hex.replace('#', '');
  const value = parseInt(clean.length === 6 ? clean : '17607A', 16);
  const r = (value >> 16) & 255;
  const g = (value >> 8) & 255;
  const b = value & 255;
  return `rgba(${r},${g},${b},${a})`;
}

export const employeePalette = [
  '#17607A', '#2F64A0', '#2B7F52', '#B86E0B', '#7D4E99',
  '#BF3B30', '#4F6272', '#8C6D1F', '#2E7D7A', '#A34B76',
];

// MARK: Status

interface StatusMeta {
  title: string;
  icon: IconName;
  light: string;
  dark: string;
  nextActionTitle: string;
}

export const statusOrder: JobStatus[] = ['new', 'planned', 'inProgress', 'waitingForMaterial', 'completed', 'cancelled'];

export const statusMeta: Record<JobStatus, StatusMeta> = {
  new: { title: 'Neu', icon: 'file-tray-outline', light: '#4F6272', dark: '#9AAAB8', nextActionTitle: 'Arbeit beginnen' },
  planned: { title: 'Geplant', icon: 'calendar-outline', light: '#2F64A0', dark: '#6E9FD6', nextActionTitle: 'Arbeit beginnen' },
  inProgress: { title: 'In Bearbeitung', icon: 'construct-outline', light: '#B06F0A', dark: '#E2A045', nextActionTitle: 'Auftrag abschließen' },
  waitingForMaterial: { title: 'Wartet auf Material', icon: 'cube-outline', light: '#7D4E99', dark: '#B68FD0', nextActionTitle: 'Arbeit fortsetzen' },
  completed: { title: 'Abgeschlossen', icon: 'checkmark-circle-outline', light: '#2B7F52', dark: '#5BBE86', nextActionTitle: '' },
  cancelled: { title: 'Storniert', icon: 'close-circle-outline', light: '#7C828C', dark: '#9EA4AD', nextActionTitle: '' },
};

export function statusTint(status: JobStatus, theme: Theme): string {
  return theme.dark ? statusMeta[status].dark : statusMeta[status].light;
}

export function isOpenStatus(status: JobStatus): boolean {
  return status !== 'completed' && status !== 'cancelled';
}

export function nextStatus(status: JobStatus): JobStatus | null {
  switch (status) {
    case 'new':
    case 'planned':
    case 'waitingForMaterial':
      return 'inProgress';
    case 'inProgress':
      return 'completed';
    default:
      return null;
  }
}

// MARK: Priorität

export const priorityOrder: JobPriority[] = ['low', 'normal', 'high', 'urgent'];

export const priorityMeta: Record<JobPriority, { title: string; icon: IconName; rank: number }> = {
  low: { title: 'Niedrig', icon: 'arrow-down', rank: 0 },
  normal: { title: 'Normal', icon: 'remove', rank: 1 },
  high: { title: 'Hoch', icon: 'arrow-up', rank: 2 },
  urgent: { title: 'Dringend', icon: 'alert-circle', rank: 3 },
};

export function priorityTint(priority: JobPriority, theme: Theme): string {
  if (priority === 'urgent') return theme.c.danger;
  if (priority === 'high') return theme.c.warning;
  return theme.c.secondary;
}

// MARK: Immobilien

export const buildingTypeOrder: BuildingType[] = ['singleFamily', 'multiFamily', 'apartment', 'commercial', 'other'];

export const buildingMeta: Record<BuildingType, { title: string; icon: IconName }> = {
  singleFamily: { title: 'Einfamilienhaus', icon: 'home-outline' },
  multiFamily: { title: 'Mehrfamilienhaus', icon: 'business-outline' },
  apartment: { title: 'Wohnung', icon: 'key-outline' },
  commercial: { title: 'Gewerbeobjekt', icon: 'storefront-outline' },
  other: { title: 'Sonstiges', icon: 'location-outline' },
};

export const materialUnits = ['Stk.', 'm', 'kg', 'l', 'Pkg.', 'Satz'];
