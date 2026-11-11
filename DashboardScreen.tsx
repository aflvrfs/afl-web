import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useStore } from './store';
import { isOpenStatus, priorityMeta, spacing, statusMeta, useTheme } from './theme';
import type { Appointment, Customer, Job } from './types';
import { EmptyCard, Icon, LinkCardList, QuickAction, Screen, SectionHeader, StatTile } from './ui';
import { AppointmentForm, CustomerForm, JobForm } from './forms';
import { AppointmentRow, CustomerRow, JobRow, useNav } from './rows';
import { addDays, apStart, fmt, intersectsDay, isOverdue, startOfDay } from './utils';

type TabNav = { navigate: (tab: 'CustomersTab' | 'JobsTab' | 'CalendarTab') => void };

export function DashboardScreen() {
  const { c } = useTheme();
  const navigation = useNav();
  const tabs = useNavigation().getParent() as unknown as TabNav | undefined;
  const { data } = useStore();
  const [sheet, setSheet] = useState<'job' | 'customer' | 'appointment' | null>(null);

  const now = new Date();
  const openJobs = data.jobs.filter((j) => isOpenStatus(j.status));
  const running = data.jobs
    .filter((j) => j.status === 'inProgress' || j.status === 'waitingForMaterial')
    .sort((a, b) => priorityMeta[b.priority].rank - priorityMeta[a.priority].rank || b.updatedAt.localeCompare(a.updatedAt));
  const sorted = [...data.appointments].sort((a, b) => a.start.localeCompare(b.start));
  const today = sorted.filter((a) => intersectsDay(a, now));
  const tomorrow = addDays(startOfDay(now), 1);
  const limit = addDays(tomorrow, 7);
  const upcoming = sorted.filter((a) => apStart(a) >= tomorrow && apStart(a) < limit);
  const recentCustomers = [...data.customers].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 4);
  const urgent = openJobs.filter((j) => j.priority === 'urgent' || isOverdue(j)).length;

  const hour = now.getHours();
  const base = hour >= 5 && hour < 11 ? 'Guten Morgen' : hour >= 11 && hour < 17 ? 'Guten Tag' : hour >= 17 && hour < 23 ? 'Guten Abend' : 'Hallo';
  const firstName = data.settings.userName.trim().split(/\s+/)[0] ?? '';
  const greeting = firstName ? `${base}, ${firstName}` : base;

  const goTab = (tab: 'CustomersTab' | 'JobsTab' | 'CalendarTab') => tabs?.navigate(tab);
  const openJob = (j: Job) => navigation.navigate('JobDetail', { id: j.id });
  const openAppointment = (a: Appointment) => navigation.navigate('AppointmentDetail', { id: a.id });
  const openCustomer = (cu: Customer) => navigation.navigate('CustomerDetail', { id: cu.id });

  return (
    <Screen contentStyle={{ paddingTop: spacing.s, paddingHorizontal: spacing.l, gap: spacing.xl }}>
      <View style={{ paddingHorizontal: spacing.xxs, gap: 2, marginTop: spacing.m }}>
        <Text style={{ fontSize: 15, fontWeight: '500', color: c.secondary }}>{fmt.weekdayDate(now)}</Text>
        <Text style={{ fontSize: 30, fontWeight: '700', color: c.text }} numberOfLines={2}>{greeting}</Text>
        {data.settings.companyName.trim() ? <Text style={{ fontSize: 15, color: c.secondary }}>{data.settings.companyName}</Text> : null}
      </View>

      <View style={{ gap: spacing.s }}>
        <View style={{ flexDirection: 'row', gap: spacing.m }}>
          <StatTile value={openJobs.length} title="Offene Aufträge" icon="file-tray-full-outline" onPress={() => goTab('JobsTab')} />
          <StatTile value={today.length} title="Termine heute" icon="calendar-outline" onPress={() => goTab('CalendarTab')} />
          <StatTile value={running.length} title="In Arbeit" icon={statusMeta.inProgress.icon} tint={c.warning} onPress={() => goTab('JobsTab')} />
        </View>
        {urgent > 0 ? (
          <Pressable onPress={() => goTab('JobsTab')} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: spacing.xxs }}>
            <Icon name="warning" size={15} color={c.danger} />
            <Text style={{ color: c.danger, fontSize: 13, fontWeight: '500' }}>
              {urgent === 1 ? '1 Auftrag ist dringend oder überfällig' : `${urgent} Aufträge sind dringend oder überfällig`}
            </Text>
          </Pressable>
        ) : null}
      </View>

      <View style={{ flexDirection: 'row', gap: spacing.m }}>
        <QuickAction title="Auftrag" icon="add-circle-outline" onPress={() => setSheet('job')} />
        <QuickAction title="Kunde" icon="person-add-outline" onPress={() => setSheet('customer')} />
        <QuickAction title="Termin" icon="calendar-number-outline" onPress={() => setSheet('appointment')} />
      </View>

      <View>
        <SectionHeader title="Heute" actionTitle="Kalender" onAction={() => goTab('CalendarTab')} />
        {today.length === 0 ? (
          <EmptyCard icon="sunny-outline" text="Heute stehen keine Termine an." />
        ) : (
          <LinkCardList items={today} keyOf={(a) => a.id} onPress={openAppointment} render={(a) => <AppointmentRow appointment={a} />} />
        )}
      </View>

      <View>
        <SectionHeader title="Laufende Aufträge" actionTitle="Alle" onAction={() => goTab('JobsTab')} />
        {running.length === 0 ? (
          <EmptyCard icon="construct-outline" text="Aktuell ist kein Auftrag in Bearbeitung." />
        ) : (
          <LinkCardList items={running.slice(0, 5)} keyOf={(j) => j.id} onPress={openJob} render={(j) => <JobRow job={j} />} />
        )}
      </View>

      <View>
        <SectionHeader title="Nächste 7 Tage" />
        {upcoming.length === 0 ? (
          <EmptyCard icon="calendar-outline" text="Keine weiteren Termine geplant." />
        ) : (
          <LinkCardList items={upcoming.slice(0, 6)} keyOf={(a) => a.id} onPress={openAppointment} render={(a) => <AppointmentRow appointment={a} showDate />} />
        )}
      </View>

      <View>
        <SectionHeader title="Neue Kunden" actionTitle="Alle" onAction={() => goTab('CustomersTab')} />
        {recentCustomers.length === 0 ? (
          <EmptyCard icon="people-outline" text="Noch keine Kunden angelegt." />
        ) : (
          <LinkCardList items={recentCustomers} keyOf={(cu) => cu.id} onPress={openCustomer} render={(cu) => <CustomerRow customer={cu} />} />
        )}
      </View>

      {sheet === 'job' && <JobForm onDone={(id) => { setSheet(null); if (id) navigation.navigate('JobDetail', { id }); }} />}
      {sheet === 'customer' && <CustomerForm onDone={() => setSheet(null)} />}
      {sheet === 'appointment' && <AppointmentForm onDone={() => setSheet(null)} />}
    </Screen>
  );
}
