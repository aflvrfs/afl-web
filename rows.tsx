import React from 'react';
import { Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useStore } from './store';
import { alpha, buildingMeta, isOpenStatus, priorityMeta, spacing, useTheme } from './theme';
import type { Appointment, Building, Customer, Employee, ID, Job } from './types';
import { Avatar, EmployeeTag, Icon, PriorityLabel, StatusBadge } from './ui';
import {
  addressOf, apEnd, apStart, buildingName, byId, customerName, fmt, isOverdue, openJobCount,
} from './utils';

// MARK: - Navigation

export type StackParams = {
  Dashboard: undefined;
  Customers: undefined;
  Jobs: undefined;
  Calendar: undefined;
  Settings: undefined;
  Employees: undefined;
  CustomerDetail: { id: ID };
  BuildingDetail: { id: ID };
  JobDetail: { id: ID };
  AppointmentDetail: { id: ID };
};

export type Nav = NativeStackNavigationProp<StackParams>;
export const useNav = () => useNavigation<Nav>();

// MARK: - Zeilen

export function CustomerRow({ customer }: { customer: Customer }) {
  const { c } = useTheme();
  const { data } = useStore();
  const open = openJobCount(data, customer.id);
  const name = customerName(customer);
  const parts: string[] = [];
  if (customer.company.trim() && name !== customer.company) parts.push(customer.company);
  if (customer.city.trim()) parts.push(customer.city);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.m }}>
      <Avatar name={name} />
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 17, fontWeight: '500', color: c.text }} numberOfLines={1}>{name}</Text>
        {parts.length > 0 && <Text style={{ fontSize: 15, color: c.secondary }} numberOfLines={1}>{parts.join(', ')}</Text>}
      </View>
      {open > 0 && (
        <View style={{ backgroundColor: alpha(c.accent, 0.12), borderRadius: 99, paddingHorizontal: 8, paddingVertical: 3 }} accessibilityLabel={`${open} offene Aufträge`}>
          <Text style={{ color: c.accent, fontSize: 12, fontWeight: '600' }}>{open}</Text>
        </View>
      )}
    </View>
  );
}

export function JobRow({ job, showCustomer = true }: { job: Job; showCustomer?: boolean }) {
  const { c } = useTheme();
  const { data } = useStore();
  const customer = byId(data.customers, job.customerId);
  const assignee = byId(data.employees, job.assigneeId);
  const overdue = isOverdue(job);
  const showPriority = priorityMeta[job.priority].rank >= 2;
  return (
    <View style={{ gap: 4 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s }}>
        <Text style={{ flex: 1, fontSize: 17, fontWeight: '600', color: c.text }} numberOfLines={1}>{job.title}</Text>
        <StatusBadge status={job.status} />
      </View>
      <Text style={{ fontSize: 15, color: c.secondary }} numberOfLines={1}>
        {fmt.jobNumber(job.number)}{showCustomer && customer ? `   ${customerName(customer)}` : ''}
      </Text>
      {(showPriority || job.dueDate || assignee) && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.m, flexWrap: 'wrap' }}>
          {showPriority && <PriorityLabel priority={job.priority} size={12} />}
          {job.dueDate && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
              <Icon name={overdue ? 'alert-circle-outline' : 'calendar-outline'} size={13} color={overdue ? c.danger : c.secondary} />
              <Text style={{ fontSize: 12, color: overdue ? c.danger : c.secondary }}>{fmt.relativeDay(new Date(job.dueDate))}</Text>
            </View>
          )}
          {assignee && <EmployeeTag employee={assignee} />}
        </View>
      )}
    </View>
  );
}

export function AppointmentRow({ appointment, hasConflict, showDate }: { appointment: Appointment; hasConflict?: boolean; showDate?: boolean }) {
  const { c } = useTheme();
  const { data } = useStore();
  const employee = byId(data.employees, appointment.employeeId);
  const job = byId(data.jobs, appointment.jobId);
  const customer = job ? byId(data.customers, job.customerId) : undefined;
  const range = fmt.timeRange(apStart(appointment), apEnd(appointment));
  const subtitle = job
    ? [fmt.jobNumber(job.number), customer ? customerName(customer) : null].filter(Boolean).join(', ')
    : appointment.location.trim() || null;
  const tint = employee?.colorHex ?? c.accent;
  return (
    <View style={{ flexDirection: 'row', gap: spacing.m, alignItems: 'stretch' }}>
      <View style={{ width: 4, borderRadius: 2, backgroundColor: tint }} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ fontSize: 12, color: c.secondary, fontVariant: ['tabular-nums'] }}>
          {showDate ? `${fmt.relativeDay(apStart(appointment))}, ${range}` : range}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
          {hasConflict && <Icon name="warning" size={13} color={c.danger} />}
          <Text style={{ fontSize: 15, fontWeight: '600', color: c.text, flexShrink: 1 }} numberOfLines={1}>{appointment.title}</Text>
        </View>
        {subtitle ? <Text style={{ fontSize: 12, color: c.secondary }} numberOfLines={1}>{subtitle}</Text> : null}
      </View>
      {employee && <View style={{ alignSelf: 'center' }}><Avatar name={employee.name} color={employee.colorHex} size={28} /></View>}
    </View>
  );
}

export function BuildingRow({ building }: { building: Building }) {
  const { c } = useTheme();
  const meta = buildingMeta[building.type];
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.m }}>
      <View style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: alpha(c.accent, 0.1), alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={meta.icon} size={18} color={c.accent} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 17, fontWeight: '500', color: c.text }} numberOfLines={1}>{buildingName(building)}</Text>
        <Text style={{ fontSize: 15, color: c.secondary }} numberOfLines={1}>{addressOf(building) || meta.title}</Text>
      </View>
    </View>
  );
}

export function EmployeeRow({ employee }: { employee: Employee }) {
  const { c } = useTheme();
  const { data } = useStore();
  const open = data.jobs.filter((j) => j.assigneeId === employee.id && isOpenStatus(j.status)).length;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.m, opacity: employee.isActive ? 1 : 0.6 }}>
      <Avatar name={employee.name} color={employee.colorHex} size={38} />
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 17, fontWeight: '500', color: c.text }}>{employee.name}</Text>
        {employee.role.trim() ? <Text style={{ fontSize: 15, color: c.secondary }}>{employee.role}</Text> : null}
      </View>
      {open > 0 && <Text style={{ fontSize: 12, color: c.secondary }}>{open === 1 ? '1 Auftrag' : `${open} Aufträge`}</Text>}
    </View>
  );
}
