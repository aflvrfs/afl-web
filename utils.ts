import type { AppData, Appointment, Building, Customer, Employee, ID, Job, TimeEntry } from './types';
import { isOpenStatus } from './theme';

// MARK: IDs & Text

export function uid(): ID {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

export const trim = (s: string) => s.trim();
export const isBlank = (s: string | null | undefined) => !s || s.trim().length === 0;

export function initials(name: string): string {
  const letters = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p.charAt(0))
    .join('');
  return letters ? letters.toUpperCase() : '?';
}

// MARK: Datum

export const nowISO = () => new Date().toISOString();

export function startOfDay(d: Date): Date {
  const r = new Date(d);
  r.setHours(0, 0, 0, 0);
  return r;
}

export function addDays(d: Date, days: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + days);
  return r;
}

export function addMinutes(d: Date, minutes: number): Date {
  return new Date(d.getTime() + minutes * 60000);
}

export function addMonths(d: Date, months: number): Date {
  const r = new Date(d);
  const day = r.getDate();
  r.setDate(1);
  r.setMonth(r.getMonth() + months);
  const last = new Date(r.getFullYear(), r.getMonth() + 1, 0).getDate();
  r.setDate(Math.min(day, last));
  return r;
}

export function endOfDay(d: Date): Date {
  return addDays(startOfDay(d), 1);
}

export function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export const isToday = (d: Date) => isSameDay(d, new Date());

/** Montag als Wochenbeginn. */
export function startOfWeek(d: Date): Date {
  const r = startOfDay(d);
  const offset = (r.getDay() + 6) % 7;
  return addDays(r, -offset);
}

export function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

export function daysInMonth(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
}

export function setTime(d: Date, hour: number, minute = 0): Date {
  const r = new Date(d);
  r.setHours(hour, minute, 0, 0);
  return r;
}

export function roundToNextQuarter(d: Date): Date {
  const r = new Date(d);
  r.setSeconds(0, 0);
  const add = (15 - (r.getMinutes() % 15)) % 15;
  return addMinutes(r, add);
}

/** ISO-8601-Kalenderwoche. */
export function isoWeek(d: Date): number {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

// MARK: Formatierung (deutsch)

const weekdaysLong = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
const weekdaysShort = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
const monthsLong = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
const monthsShort = ['Jan.', 'Feb.', 'März', 'Apr.', 'Mai', 'Juni', 'Juli', 'Aug.', 'Sep.', 'Okt.', 'Nov.', 'Dez.'];
export const weekdaySymbolsMondayFirst = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);

export const fmt = {
  date: (d: Date) => `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`,
  dateShort: (d: Date) => `${d.getDate()}.${d.getMonth() + 1}.`,
  time: (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`,
  dateTime: (d: Date) => `${fmt.date(d)}, ${fmt.time(d)}`,
  weekdayDate: (d: Date) => `${weekdaysLong[d.getDay()]}, ${d.getDate()}. ${monthsLong[d.getMonth()]}`,
  dayMonthShort: (d: Date) => `${weekdaysShort[d.getDay()]}., ${d.getDate()}. ${monthsShort[d.getMonth()]}`,
  monthYear: (d: Date) => `${monthsLong[d.getMonth()]} ${d.getFullYear()}`,
  hour: (h: number) => `${pad(h)}:00`,
  timeRange: (a: Date, b: Date) => `${fmt.time(a)} – ${fmt.time(b)}`,
  relativeDay(d: Date): string {
    const today = new Date();
    if (isSameDay(d, today)) return 'Heute';
    if (isSameDay(d, addDays(today, 1))) return 'Morgen';
    if (isSameDay(d, addDays(today, -1))) return 'Gestern';
    return fmt.dayMonthShort(d);
  },
  duration(seconds: number): string {
    const total = Math.floor(Math.max(0, seconds) / 60);
    const h = Math.floor(total / 60);
    const m = total % 60;
    if (h === 0) return `${m} Min.`;
    return m === 0 ? `${h} Std.` : `${h} Std. ${m} Min.`;
  },
  clock(seconds: number): string {
    const t = Math.floor(Math.max(0, seconds));
    return `${Math.floor(t / 3600)}:${pad(Math.floor((t % 3600) / 60))}:${pad(t % 60)}`;
  },
  decimal(v: number): string {
    const rounded = Math.round(v * 100) / 100;
    return String(rounded).replace('.', ',');
  },
  currency(v: number): string {
    const fixed = (Math.round(v * 100) / 100).toFixed(2);
    const [intPart, dec] = fixed.split('.');
    const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return `${grouped},${dec} €`;
  },
  jobNumber: (n: number) => `A-${String(n).padStart(4, '0')}`,
};

// MARK: Validierung

export const validate = {
  required: (v: string, message: string) => (isBlank(v) ? message : null),
  email(v: string): string | null {
    const t = v.trim();
    if (!t) return null;
    return /^[A-Z0-9a-z._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}$/.test(t) ? null : 'Bitte eine gültige E-Mail-Adresse eingeben.';
  },
  phone(v: string): string | null {
    const t = v.trim();
    if (!t) return null;
    if (!/^[+0-9 /\-()]+$/.test(t)) return 'Die Telefonnummer enthält ungültige Zeichen.';
    if (t.replace(/\D/g, '').length < 5) return 'Die Telefonnummer ist zu kurz.';
    return null;
  },
  postalCode(v: string): string | null {
    const t = v.trim();
    if (!t) return null;
    return /^\d{4,5}$/.test(t) ? null : 'Bitte eine gültige Postleitzahl eingeben.';
  },
  year(v: string): string | null {
    const t = v.trim();
    if (!t) return null;
    const current = new Date().getFullYear();
    const y = Number(t);
    return /^\d{4}$/.test(t) && y >= 1800 && y <= current ? null : `Bitte ein Baujahr zwischen 1800 und ${current} eingeben.`;
  },
};

export function parseDecimal(v: string): number | null {
  const t = v.trim().replace(',', '.');
  if (!t || !/^-?\d*\.?\d+$/.test(t)) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

// MARK: Links

export const links = {
  phone(n: string): string | null {
    const digits = n.replace(/[^\d+]/g, '');
    return digits.length < 3 ? null : `tel:${digits}`;
  },
  email: (e: string) => (isBlank(e) ? null : `mailto:${e.trim()}`),
  maps: (address: string) => (isBlank(address) ? null : `https://maps.apple.com/?q=${encodeURIComponent(address.trim())}`),
};

// MARK: Kunden & Immobilien

export function fullName(c: Customer): string {
  return [c.firstName, c.lastName].filter((s) => !isBlank(s)).join(' ');
}

export function customerName(c: Customer): string {
  const name = fullName(c);
  if (name) return name;
  return isBlank(c.company) ? 'Unbenannter Kunde' : c.company;
}

export const cityLine = (o: { postalCode: string; city: string }) => `${o.postalCode} ${o.city}`.trim();

export function addressOf(o: { street: string; postalCode: string; city: string }): string {
  return [o.street.trim(), cityLine(o)].filter(Boolean).join(', ');
}

export function customerMatches(c: Customer, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return [fullName(c), c.company, c.street, c.postalCode, c.city, c.phone, c.email].some((v) => v.toLowerCase().includes(q));
}

export function buildingName(b: Building): string {
  if (!isBlank(b.name)) return b.name;
  const titles: Record<string, string> = {
    singleFamily: 'Einfamilienhaus',
    multiFamily: 'Mehrfamilienhaus',
    apartment: 'Wohnung',
    commercial: 'Gewerbeobjekt',
    other: 'Sonstiges',
  };
  return titles[b.type] ?? 'Immobilie';
}

export const compareName = (a: string, b: string) => a.localeCompare(b, 'de', { sensitivity: 'base' });

// MARK: Abfragen

export const byId = <T extends { id: ID }>(list: T[], id: ID | null | undefined): T | undefined =>
  id ? list.find((x) => x.id === id) : undefined;

export function jobsOfCustomer(data: AppData, customerId: ID): Job[] {
  return data.jobs.filter((j) => j.customerId === customerId).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function openJobCount(data: AppData, customerId: ID): number {
  return data.jobs.filter((j) => j.customerId === customerId && isOpenStatus(j.status)).length;
}

export function buildingsOfCustomer(data: AppData, customerId: ID): Building[] {
  return data.buildings.filter((b) => b.customerId === customerId).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export function entryDuration(e: TimeEntry, now = Date.now()): number {
  const end = e.end ? new Date(e.end).getTime() : now;
  return Math.max(0, (end - new Date(e.start).getTime()) / 1000 - e.breakMinutes * 60);
}

export function jobWorkSeconds(data: AppData, jobId: ID, now = Date.now()): number {
  return data.timeEntries.filter((e) => e.jobId === jobId).reduce((sum, e) => sum + entryDuration(e, now), 0);
}

export function runningEntry(data: AppData, jobId: ID): TimeEntry | undefined {
  return data.timeEntries.find((e) => e.jobId === jobId && e.end === null);
}

export function jobMaterialTotal(data: AppData, jobId: ID): number {
  return data.materials.filter((m) => m.jobId === jobId).reduce((s, m) => s + (m.unitPrice ?? 0) * m.quantity, 0);
}

export function isOverdue(job: Job): boolean {
  if (!job.dueDate || !isOpenStatus(job.status)) return false;
  return new Date(job.dueDate) < startOfDay(new Date());
}

export function siteAddress(data: AppData, job: Job): string {
  const b = byId(data.buildings, job.buildingId);
  if (b && addressOf(b)) return addressOf(b);
  const c = byId(data.customers, job.customerId);
  return c ? addressOf(c) : '';
}

export function jobMatches(data: AppData, job: Job, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const c = byId(data.customers, job.customerId);
  const b = byId(data.buildings, job.buildingId);
  return [job.title, job.details, fmt.jobNumber(job.number), c ? customerName(c) : '', c?.company ?? '', b ? buildingName(b) : '']
    .some((v) => v.toLowerCase().includes(q));
}

export function employeeColor(data: AppData, employeeId: ID | null, fallback: string): string {
  return byId(data.employees, employeeId)?.colorHex ?? fallback;
}

// MARK: Termine

export const apStart = (a: Appointment) => new Date(a.start);
export const apEnd = (a: Appointment) => new Date(a.end);

export function intersectsDay(a: Appointment, day: Date): boolean {
  return apStart(a) < endOfDay(day) && apEnd(a) > startOfDay(day);
}

export function conflictsFor(
  start: Date,
  end: Date,
  employeeId: ID | null,
  excludingId: ID | null,
  all: Appointment[],
): Appointment[] {
  if (!employeeId) return [];
  return all
    .filter((a) => a.id !== excludingId && a.employeeId === employeeId && apStart(a) < end && start < apEnd(a))
    .sort((a, b) => a.start.localeCompare(b.start));
}

export function conflictingIds(all: Appointment[]): Set<ID> {
  const result = new Set<ID>();
  const sorted = [...all].sort((a, b) => a.start.localeCompare(b.start));
  for (let i = 0; i < sorted.length; i++) {
    const first = sorted[i];
    if (!first.employeeId) continue;
    for (let j = i + 1; j < sorted.length && apStart(sorted[j]) < apEnd(first); j++) {
      if (sorted[j].employeeId === first.employeeId) {
        result.add(first.id);
        result.add(sorted[j].id);
      }
    }
  }
  return result;
}

export interface Positioned {
  appointment: Appointment;
  column: number;
  columns: number;
}

/** Verteilt sich überschneidende Termine auf nebeneinanderliegende Spalten. */
export function layoutDay(items: Appointment[]): Positioned[] {
  const sorted = [...items].sort((a, b) => (a.start === b.start ? b.end.localeCompare(a.end) : a.start.localeCompare(b.start)));
  const result: Positioned[] = [];
  let cluster: { appointment: Appointment; column: number }[] = [];
  let columnEnds: number[] = [];
  let clusterEnd = -Infinity;
  const flush = () => {
    const count = Math.max(columnEnds.length, 1);
    cluster.forEach((c) => result.push({ ...c, columns: count }));
    cluster = [];
    columnEnds = [];
  };
  for (const a of sorted) {
    const s = apStart(a).getTime();
    const e = apEnd(a).getTime();
    if (cluster.length && s >= clusterEnd) flush();
    const idx = columnEnds.findIndex((end) => end <= s);
    if (idx >= 0) {
      columnEnds[idx] = e;
      cluster.push({ appointment: a, column: idx });
    } else {
      columnEnds.push(e);
      cluster.push({ appointment: a, column: columnEnds.length - 1 });
    }
    clusterEnd = Math.max(clusterEnd, e);
  }
  flush();
  return result;
}

export function plannedSecondsOnDay(a: Appointment, day: Date): number {
  const s = Math.max(apStart(a).getTime(), startOfDay(day).getTime());
  const e = Math.min(apEnd(a).getTime(), endOfDay(day).getTime());
  return Math.max(0, (e - s) / 1000);
}

export function activeEmployees(data: AppData): Employee[] {
  return data.employees.filter((e) => e.isActive).sort((a, b) => compareName(a.name, b.name));
}
