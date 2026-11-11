export type ID = string;

export type JobStatus = 'new' | 'planned' | 'inProgress' | 'waitingForMaterial' | 'completed' | 'cancelled';
export type JobPriority = 'low' | 'normal' | 'high' | 'urgent';
export type BuildingType = 'singleFamily' | 'multiFamily' | 'apartment' | 'commercial' | 'other';

export interface Customer {
  id: ID;
  firstName: string;
  lastName: string;
  company: string;
  phone: string;
  email: string;
  street: string;
  postalCode: string;
  city: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface Building {
  id: ID;
  customerId: ID;
  name: string;
  type: BuildingType;
  street: string;
  postalCode: string;
  city: string;
  heatingSystem: string;
  constructionYear: string;
  notes: string;
  createdAt: string;
}

export interface Employee {
  id: ID;
  name: string;
  role: string;
  phone: string;
  colorHex: string;
  isActive: boolean;
  createdAt: string;
}

export interface Job {
  id: ID;
  number: number;
  title: string;
  details: string;
  status: JobStatus;
  priority: JobPriority;
  customerId: ID | null;
  buildingId: ID | null;
  assigneeId: ID | null;
  startDate: string | null;
  dueDate: string | null;
  internalNotes: string;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}

export interface TimeEntry {
  id: ID;
  jobId: ID;
  employeeId: ID | null;
  start: string;
  end: string | null;
  breakMinutes: number;
  note: string;
  createdAt: string;
}

export interface MaterialItem {
  id: ID;
  jobId: ID;
  name: string;
  articleNumber: string;
  quantity: number;
  unit: string;
  unitPrice: number | null;
  createdAt: string;
}

export interface JobPhoto {
  id: ID;
  jobId: ID;
  /** Dateiname im App-Dokumentenordner (Pfad wird zur Laufzeit gebildet). */
  fileName: string;
  createdAt: string;
}

export interface Appointment {
  id: ID;
  title: string;
  start: string;
  end: string;
  location: string;
  notes: string;
  employeeId: ID | null;
  jobId: ID | null;
  createdAt: string;
}

export interface Settings {
  userName: string;
  companyName: string;
  workdayStart: number;
  workdayEnd: number;
  defaultDuration: number;
  appLock: boolean;
}

export interface AppData {
  version: 1;
  customers: Customer[];
  buildings: Building[];
  employees: Employee[];
  jobs: Job[];
  timeEntries: TimeEntry[];
  materials: MaterialItem[];
  photos: JobPhoto[];
  appointments: Appointment[];
  settings: Settings;
}

export const defaultSettings: Settings = {
  userName: '',
  companyName: '',
  workdayStart: 7,
  workdayEnd: 17,
  defaultDuration: 60,
  appLock: false,
};

export function emptyData(): AppData {
  return {
    version: 1,
    customers: [],
    buildings: [],
    employees: [],
    jobs: [],
    timeEntries: [],
    materials: [],
    photos: [],
    appointments: [],
    settings: { ...defaultSettings },
  };
}
