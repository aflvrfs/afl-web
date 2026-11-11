import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  AppData, Appointment, Building, Customer, Employee, ID, Job, JobPhoto, JobStatus, MaterialItem, Settings, TimeEntry,
  defaultSettings, emptyData,
} from './types';
import { isOpenStatus } from './theme';
import { nowISO, uid } from './utils';
import { deleteAllPhotoFiles, deletePhotoFile } from './photoStore';

const STORAGE_KEY = 'shkpro.data.v1';

type LoadState = 'loading' | 'ready' | 'error';

export interface Store {
  data: AppData;
  loadState: LoadState;
  loadError: string | null;
  saveError: string | null;
  reload: () => void;

  saveCustomer: (c: Customer) => void;
  deleteCustomer: (id: ID) => void;
  saveBuilding: (b: Building) => void;
  deleteBuilding: (id: ID) => void;
  saveEmployee: (e: Employee) => void;
  deleteEmployee: (id: ID) => void;

  /** Speichert einen Auftrag. Neue Aufträge erhalten eine fortlaufende Nummer. Gibt die ID zurück. */
  saveJob: (job: Job, appointment?: Omit<Appointment, 'id' | 'jobId' | 'createdAt'>) => ID;
  deleteJob: (id: ID) => void;
  setJobStatus: (id: ID, status: JobStatus) => void;
  updateJob: (id: ID, patch: Partial<Job>) => void;

  startTimer: (jobId: ID) => void;
  stopTimer: (entryId: ID) => void;
  saveTimeEntry: (e: TimeEntry) => void;
  deleteTimeEntry: (id: ID) => void;

  saveMaterial: (m: MaterialItem) => void;
  deleteMaterial: (id: ID) => void;

  addPhoto: (photo: JobPhoto) => void;
  deletePhoto: (id: ID) => void;

  saveAppointment: (a: Appointment) => void;
  moveAppointment: (id: ID, minutes: number) => void;
  deleteAppointment: (id: ID) => void;

  updateSettings: (patch: Partial<Settings>) => void;
  deleteAllData: () => Promise<void>;
}

const StoreContext = createContext<Store | null>(null);

export function useStore(): Store {
  const store = useContext(StoreContext);
  if (!store) throw new Error('StoreProvider fehlt');
  return store;
}

function upsert<T extends { id: ID }>(list: T[], item: T): T[] {
  const index = list.findIndex((x) => x.id === item.id);
  if (index === -1) return [...list, item];
  const copy = [...list];
  copy[index] = item;
  return copy;
}

function withStatus(job: Job, status: JobStatus): Job {
  if (job.status === status) return job;
  return {
    ...job,
    status,
    updatedAt: nowISO(),
    completedAt: status === 'completed' ? job.completedAt ?? nowISO() : null,
  };
}

/** Entfernt Auftrag samt Zeiten, Material, Fotos und Terminen. */
function removeJobs(d: AppData, jobIds: Set<ID>): AppData {
  d.photos.filter((p) => jobIds.has(p.jobId)).forEach((p) => deletePhotoFile(p.fileName));
  return {
    ...d,
    jobs: d.jobs.filter((j) => !jobIds.has(j.id)),
    timeEntries: d.timeEntries.filter((e) => !jobIds.has(e.jobId)),
    materials: d.materials.filter((m) => !jobIds.has(m.jobId)),
    photos: d.photos.filter((p) => !jobIds.has(p.jobId)),
    appointments: d.appointments.filter((a) => !a.jobId || !jobIds.has(a.jobId)),
  };
}

function normalize(raw: unknown): AppData {
  const base = emptyData();
  if (!raw || typeof raw !== 'object') return base;
  const r = raw as Partial<AppData>;
  return {
    version: 1,
    customers: r.customers ?? [],
    buildings: r.buildings ?? [],
    employees: r.employees ?? [],
    jobs: r.jobs ?? [],
    timeEntries: r.timeEntries ?? [],
    materials: r.materials ?? [],
    photos: r.photos ?? [],
    appointments: r.appointments ?? [],
    settings: { ...defaultSettings, ...(r.settings ?? {}) },
  };
}

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<AppData>(emptyData);
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const latest = useRef(data);
  const dirty = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const reload = useCallback(async () => {
    setLoadState('loading');
    setLoadError(null);
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      const parsed = normalize(raw ? JSON.parse(raw) : null);
      latest.current = parsed;
      setData(parsed);
      setLoadState('ready');
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : String(e));
      setLoadState('error');
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const persist = useCallback(async () => {
    if (!dirty.current) return;
    dirty.current = false;
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(latest.current));
      setSaveError(null);
    } catch {
      dirty.current = true;
      setSaveError('Änderungen konnten nicht gespeichert werden. Prüfen Sie den freien Speicherplatz.');
    }
  }, []);

  // Kurz verzögert speichern, beim Wechsel in den Hintergrund sofort.
  useEffect(() => {
    if (loadState !== 'ready') return;
    latest.current = data;
    dirty.current = true;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(persist, 300);
  }, [data, loadState, persist]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') persist();
    });
    return () => sub.remove();
  }, [persist]);

  const update = useCallback((fn: (d: AppData) => AppData) => setData((d) => fn(d)), []);

  const store = useMemo<Store>(() => ({
    data,
    loadState,
    loadError,
    saveError,
    reload,

    saveCustomer: (c) => update((d) => ({ ...d, customers: upsert(d.customers, { ...c, updatedAt: nowISO() }) })),

    deleteCustomer: (id) =>
      update((d) => {
        const jobIds = new Set(d.jobs.filter((j) => j.customerId === id).map((j) => j.id));
        const cleaned = removeJobs(d, jobIds);
        return {
          ...cleaned,
          customers: cleaned.customers.filter((c) => c.id !== id),
          buildings: cleaned.buildings.filter((b) => b.customerId !== id),
        };
      }),

    saveBuilding: (b) => update((d) => ({ ...d, buildings: upsert(d.buildings, b) })),

    deleteBuilding: (id) =>
      update((d) => ({
        ...d,
        buildings: d.buildings.filter((b) => b.id !== id),
        jobs: d.jobs.map((j) => (j.buildingId === id ? { ...j, buildingId: null } : j)),
      })),

    saveEmployee: (e) => update((d) => ({ ...d, employees: upsert(d.employees, e) })),

    deleteEmployee: (id) =>
      update((d) => ({
        ...d,
        employees: d.employees.filter((e) => e.id !== id),
        jobs: d.jobs.map((j) => (j.assigneeId === id ? { ...j, assigneeId: null } : j)),
        appointments: d.appointments.map((a) => (a.employeeId === id ? { ...a, employeeId: null } : a)),
        timeEntries: d.timeEntries.map((t) => (t.employeeId === id ? { ...t, employeeId: null } : t)),
      })),

    saveJob: (job, appointment) => {
      const id = job.id || uid();
      update((d) => {
        const exists = d.jobs.some((j) => j.id === id);
        const number = exists ? job.number : d.jobs.reduce((max, j) => Math.max(max, j.number), 0) + 1;
        const previous = d.jobs.find((j) => j.id === id);
        let saved: Job = { ...job, id, number, updatedAt: nowISO() };
        if (previous && previous.status !== job.status) saved = withStatus({ ...saved, status: previous.status }, job.status);
        if (!previous && job.status === 'completed') saved.completedAt = nowISO();
        let appointments = d.appointments;
        if (appointment) {
          appointments = [...appointments, { ...appointment, id: uid(), jobId: id, createdAt: nowISO() }];
          if (saved.status === 'new') saved = withStatus(saved, 'planned');
        }
        return { ...d, jobs: upsert(d.jobs, saved), appointments };
      });
      return id;
    },

    deleteJob: (id) => update((d) => removeJobs(d, new Set([id]))),

    setJobStatus: (id, status) =>
      update((d) => ({
        ...d,
        jobs: d.jobs.map((j) => (j.id === id ? withStatus(j, status) : j)),
        timeEntries: isOpenStatus(status)
          ? d.timeEntries
          : d.timeEntries.map((e) => (e.jobId === id && e.end === null ? { ...e, end: nowISO() } : e)),
      })),

    updateJob: (id, patch) =>
      update((d) => ({ ...d, jobs: d.jobs.map((j) => (j.id === id ? { ...j, ...patch, updatedAt: nowISO() } : j)) })),

    startTimer: (jobId) =>
      update((d) => {
        if (d.timeEntries.some((e) => e.jobId === jobId && e.end === null)) return d;
        const job = d.jobs.find((j) => j.id === jobId);
        const entry: TimeEntry = {
          id: uid(), jobId, employeeId: job?.assigneeId ?? null, start: nowISO(), end: null, breakMinutes: 0, note: '', createdAt: nowISO(),
        };
        const startStates: JobStatus[] = ['new', 'planned', 'waitingForMaterial'];
        return {
          ...d,
          timeEntries: [...d.timeEntries, entry],
          jobs: d.jobs.map((j) => (j.id === jobId
            ? (startStates.includes(j.status) ? withStatus(j, 'inProgress') : { ...j, updatedAt: nowISO() })
            : j)),
        };
      }),

    stopTimer: (entryId) =>
      update((d) => ({ ...d, timeEntries: d.timeEntries.map((e) => (e.id === entryId ? { ...e, end: nowISO() } : e)) })),

    saveTimeEntry: (e) =>
      update((d) => ({
        ...d,
        timeEntries: upsert(d.timeEntries, e),
        jobs: d.jobs.map((j) => (j.id === e.jobId ? { ...j, updatedAt: nowISO() } : j)),
      })),

    deleteTimeEntry: (id) => update((d) => ({ ...d, timeEntries: d.timeEntries.filter((e) => e.id !== id) })),

    saveMaterial: (m) =>
      update((d) => ({
        ...d,
        materials: upsert(d.materials, m),
        jobs: d.jobs.map((j) => (j.id === m.jobId ? { ...j, updatedAt: nowISO() } : j)),
      })),

    deleteMaterial: (id) => update((d) => ({ ...d, materials: d.materials.filter((m) => m.id !== id) })),

    addPhoto: (photo) =>
      update((d) => ({
        ...d,
        photos: [...d.photos, photo],
        jobs: d.jobs.map((j) => (j.id === photo.jobId ? { ...j, updatedAt: nowISO() } : j)),
      })),

    deletePhoto: (id) =>
      update((d) => {
        const photo = d.photos.find((p) => p.id === id);
        if (photo) deletePhotoFile(photo.fileName);
        return { ...d, photos: d.photos.filter((p) => p.id !== id) };
      }),

    saveAppointment: (a) =>
      update((d) => {
        let jobs = d.jobs;
        if (a.jobId) {
          // Auftrag mitplanen: Mitarbeiter übernehmen und Status auf „Geplant“ setzen
          jobs = jobs.map((j) => {
            if (j.id !== a.jobId) return j;
            let next: Job = { ...j, assigneeId: j.assigneeId ?? a.employeeId, updatedAt: nowISO() };
            if (next.status === 'new') next = withStatus(next, 'planned');
            return next;
          });
        }
        return { ...d, appointments: upsert(d.appointments, a), jobs };
      }),

    moveAppointment: (id, minutes) =>
      update((d) => ({
        ...d,
        appointments: d.appointments.map((a) => {
          if (a.id !== id) return a;
          const shift = minutes * 60000;
          return {
            ...a,
            start: new Date(new Date(a.start).getTime() + shift).toISOString(),
            end: new Date(new Date(a.end).getTime() + shift).toISOString(),
          };
        }),
      })),

    deleteAppointment: (id) => update((d) => ({ ...d, appointments: d.appointments.filter((a) => a.id !== id) })),

    updateSettings: (patch) => update((d) => ({ ...d, settings: { ...d.settings, ...patch } })),

    deleteAllData: async () => {
      deleteAllPhotoFiles();
      const fresh = { ...emptyData(), settings: latest.current.settings };
      latest.current = fresh;
      setData(fresh);
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(fresh));
    },
  }), [data, loadState, loadError, saveError, reload, update]);

  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>;
}

export function newCustomer(): Customer {
  const now = nowISO();
  return {
    id: uid(), firstName: '', lastName: '', company: '', phone: '', email: '',
    street: '', postalCode: '', city: '', notes: '', createdAt: now, updatedAt: now,
  };
}

export function newBuilding(customerId: ID): Building {
  return {
    id: uid(), customerId, name: '', type: 'singleFamily', street: '', postalCode: '', city: '',
    heatingSystem: '', constructionYear: '', notes: '', createdAt: nowISO(),
  };
}

export function newJob(): Job {
  const now = nowISO();
  return {
    id: '', number: 0, title: '', details: '', status: 'new', priority: 'normal',
    customerId: null, buildingId: null, assigneeId: null, startDate: null, dueDate: null,
    internalNotes: '', createdAt: now, updatedAt: now, completedAt: null,
  };
}
