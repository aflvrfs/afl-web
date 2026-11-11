import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { GestureResponderEvent, Pressable, ScrollView, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useStore } from './store';
import { alpha, spacing, statusMeta, statusTint, useTheme } from './theme';
import type { Appointment, ID, Job } from './types';
import {
  ActionRow, Card, confirm, EmptyCard, EmptyState, EmployeeTag, HeaderButton, Icon, InfoRow, LinkCardList, openLink, Row, Screen,
  Section, SectionHeader, Segmented, showActions,
} from './ui';
import { AppointmentForm } from './forms';
import { AppointmentRow, JobRow, StackParams, useNav } from './rows';
import {
  addDays, addMonths, apEnd, apStart, byId, conflictingIds, conflictsFor, daysInMonth, fmt, intersectsDay, isBlank,
  isSameDay, isToday, isoWeek, layoutDay, links, plannedSecondsOnDay, roundToNextQuarter, setTime, startOfDay, startOfMonth,
  startOfWeek, weekdaySymbolsMondayFirst,
} from './utils';
import { isOpenStatus } from './theme';

type Mode = 'day' | 'week' | 'month';
const HOUR = 64;
const GUTTER = 52;

type CalendarSheet = { kind: 'new'; start: Date } | { kind: 'edit'; id: ID };

export function CalendarScreen() {
  const { c } = useTheme();
  const navigation = useNav();
  const { data, moveAppointment, deleteAppointment } = useStore();
  const [mode, setMode] = useState<Mode>('day');
  const [date, setDate] = useState(new Date());
  const [employeeFilter, setEmployeeFilter] = useState<ID | null>(null);
  const [sheet, setSheet] = useState<CalendarSheet | null>(null);
  const { workdayStart, workdayEnd } = data.settings;

  const defaultStart = () => (isToday(date) ? roundToNextQuarter(new Date()) : setTime(date, workdayStart));

  useLayoutEffect(() => {
    navigation.setOptions({
      headerLeft: () => <HeaderButton title="Heute" onPress={() => setDate(new Date())} />,
      headerRight: () => (
        <View style={{ flexDirection: 'row', gap: 18 }}>
          <HeaderButton
            icon={employeeFilter ? 'people' : 'people-outline'}
            accessibilityLabel="Nach Mitarbeiter filtern"
            onPress={() =>
              showActions('Mitarbeiter', [
                { label: `${employeeFilter === null ? '✓ ' : ''}Alle Mitarbeiter`, onPress: () => setEmployeeFilter(null) },
                ...data.employees.map((e) => ({ label: `${employeeFilter === e.id ? '✓ ' : ''}${e.name}`, onPress: () => setEmployeeFilter(e.id) })),
              ])
            }
          />
          <HeaderButton icon="add" accessibilityLabel="Neuer Termin" onPress={() => setSheet({ kind: 'new', start: defaultStart() })} />
        </View>
      ),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigation, employeeFilter, data.employees, date, workdayStart]);

  const visible = useMemo(
    () => (employeeFilter ? data.appointments.filter((a) => a.employeeId === employeeFilter) : data.appointments),
    [data.appointments, employeeFilter],
  );
  const conflicts = useMemo(() => conflictingIds(data.appointments), [data.appointments]);

  const shift = (dir: number) => {
    if (mode === 'day') setDate((d) => addDays(d, dir));
    else if (mode === 'week') setDate((d) => addDays(d, 7 * dir));
    else setDate((d) => addMonths(d, dir));
  };

  const title =
    mode === 'day'
      ? fmt.weekdayDate(date)
      : mode === 'week'
        ? `KW ${isoWeek(date)}, ${fmt.dateShort(startOfWeek(date))} – ${fmt.dateShort(addDays(startOfWeek(date), 6))}`
        : fmt.monthYear(date);

  const openMenu = (a: Appointment) =>
    showActions(a.title, [
      { label: 'Bearbeiten', onPress: () => setSheet({ kind: 'edit', id: a.id }) },
      { label: '30 Minuten später', onPress: () => moveAppointment(a.id, 30) },
      { label: '1 Stunde später', onPress: () => moveAppointment(a.id, 60) },
      { label: '1 Stunde früher', onPress: () => moveAppointment(a.id, -60) },
      { label: 'Auf morgen', onPress: () => moveAppointment(a.id, 24 * 60) },
      { label: 'Auf nächste Woche', onPress: () => moveAppointment(a.id, 7 * 24 * 60) },
      { label: 'Termin löschen', destructive: true, onPress: () => confirm('Termin löschen?', `„${a.title}“ wird aus dem Kalender entfernt.`, 'Löschen', () => deleteAppointment(a.id)) },
    ]);

  const dueJobs = data.jobs.filter(
    (j) => isOpenStatus(j.status) && ((j.dueDate && isSameDay(new Date(j.dueDate), date)) || (j.startDate && isSameDay(new Date(j.startDate), date))),
  );

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <View>
        <View style={{ backgroundColor: c.surface, paddingHorizontal: spacing.l, paddingTop: spacing.s, paddingBottom: spacing.m, gap: spacing.m }}>
          <Segmented values={['Tag', 'Woche', 'Monat']} index={['day', 'week', 'month'].indexOf(mode)} onChange={(i) => setMode((['day', 'week', 'month'] as Mode[])[i])} />
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Pressable onPress={() => shift(-1)} hitSlop={10} accessibilityLabel="Zurück" style={{ padding: 6 }}>
              <Icon name="chevron-back" size={22} color={c.accent} />
            </Pressable>
            <Text style={{ flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '600', color: c.text }} numberOfLines={1} adjustsFontSizeToFit>{title}</Text>
            <Pressable onPress={() => shift(1)} hitSlop={10} accessibilityLabel="Weiter" style={{ padding: 6 }}>
              <Icon name="chevron-forward" size={22} color={c.accent} />
            </Pressable>
          </View>
          {mode === 'day' ? <WeekStrip date={date} onSelect={setDate} appointments={visible} /> : null}
        </View>
      </View>
      <View style={{ height: 0.5, backgroundColor: c.separator }} />

      {mode === 'day' ? (
        <DayTimeline
          date={date}
          appointments={visible.filter((a) => intersectsDay(a, date))}
          conflicts={conflicts}
          dueJobs={dueJobs}
          workStart={workdayStart}
          workEnd={workdayEnd}
          onCreate={(start) => setSheet({ kind: 'new', start })}
          onOpen={(a) => navigation.navigate('AppointmentDetail', { id: a.id })}
          onMenu={openMenu}
          onOpenJob={(j) => navigation.navigate('JobDetail', { id: j.id })}
        />
      ) : mode === 'week' ? (
        <WeekAgenda
          weekStart={startOfWeek(date)}
          appointments={visible}
          conflicts={conflicts}
          onOpen={(a) => navigation.navigate('AppointmentDetail', { id: a.id })}
          onMenu={openMenu}
          onSelectDay={(d) => {
            setDate(d);
            setMode('day');
          }}
        />
      ) : (
        <MonthGrid
          month={date}
          selected={date}
          onSelect={setDate}
          appointments={visible}
          conflicts={conflicts}
          onOpen={(a) => navigation.navigate('AppointmentDetail', { id: a.id })}
        />
      )}

      {sheet?.kind === 'new' && <AppointmentForm presetStart={sheet.start} onDone={() => setSheet(null)} />}
      {sheet?.kind === 'edit' && <AppointmentForm appointmentId={sheet.id} onDone={() => setSheet(null)} />}
    </View>
  );
}

// MARK: - Wochenleiste

function WeekStrip({ date, onSelect, appointments }: { date: Date; onSelect: (d: Date) => void; appointments: Appointment[] }) {
  const { c } = useTheme();
  const start = startOfWeek(date);
  return (
    <View style={{ flexDirection: 'row' }}>
      {weekdaySymbolsMondayFirst.map((symbol, i) => {
        const day = addDays(start, i);
        const selected = isSameDay(day, date);
        const today = isToday(day);
        const has = appointments.some((a) => intersectsDay(a, day));
        return (
          <Pressable key={symbol} onPress={() => onSelect(day)} style={{ flex: 1, alignItems: 'center', gap: 4 }} accessibilityLabel={fmt.weekdayDate(day)} accessibilityState={{ selected }}>
            <Text style={{ fontSize: 11, color: c.secondary, fontWeight: '500' }}>{symbol}</Text>
            <View style={{ width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: selected ? c.accent : 'transparent' }}>
              <Text style={{ fontSize: 15, fontWeight: selected || today ? '600' : '400', color: selected ? '#FFFFFF' : today ? c.accent : c.text }}>{day.getDate()}</Text>
            </View>
            <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: has ? c.secondary : 'transparent' }} />
          </Pressable>
        );
      })}
    </View>
  );
}

// MARK: - Tag

function DayTimeline({
  date, appointments, conflicts, dueJobs, workStart, workEnd, onCreate, onOpen, onMenu, onOpenJob,
}: {
  date: Date;
  appointments: Appointment[];
  conflicts: Set<ID>;
  dueJobs: Job[];
  workStart: number;
  workEnd: number;
  onCreate: (d: Date) => void;
  onOpen: (a: Appointment) => void;
  onMenu: (a: Appointment) => void;
  onOpenJob: (j: Job) => void;
}) {
  const theme = useTheme();
  const { c } = theme;
  const { data } = useStore();
  const scrollRef = useRef<ScrollView>(null);
  const [width, setWidth] = useState(0);
  const [now, setNow] = useState(new Date());
  const [headerHeight, setHeaderHeight] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const hour = isToday(date) ? Math.max(0, new Date().getHours() - 1) : Math.max(0, workStart - 1);
    const t = setTimeout(() => scrollRef.current?.scrollTo({ y: headerHeight + hour * HOUR, animated: false }), 50);
    return () => clearTimeout(t);
  }, [date, workStart, headerHeight]);

  const workload = useMemo(() => {
    const map = new Map<string, { name: string; color: string; seconds: number }>();
    for (const a of appointments) {
      const seconds = plannedSecondsOnDay(a, date);
      const emp = byId(data.employees, a.employeeId);
      const key = emp?.id ?? '_';
      const entry = map.get(key) ?? { name: emp?.name ?? 'Ohne Zuordnung', color: emp?.colorHex ?? c.secondary, seconds: 0 };
      entry.seconds += seconds;
      map.set(key, entry);
    }
    return [...map.values()].filter((w) => w.seconds > 0);
  }, [appointments, date, data.employees, c.secondary]);

  const positioned = layoutDay(appointments);
  const dayStart = startOfDay(date).getTime();
  const area = Math.max(0, width - GUTTER - spacing.s);

  return (
    <ScrollView ref={scrollRef} style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 40 }}>
      <View onLayout={(e) => setHeaderHeight(e.nativeEvent.layout.height)}>
        {workload.length ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.m, paddingHorizontal: spacing.l, paddingVertical: spacing.s, alignItems: 'center' }}>
            <Text style={{ fontSize: 12, fontWeight: '600', color: c.secondary }}>Geplant</Text>
            {workload.map((w) => (
              <View key={w.name} style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: w.color }} />
                <Text style={{ fontSize: 12, color: c.text }}>{w.name} {fmt.duration(w.seconds)}</Text>
              </View>
            ))}
          </ScrollView>
        ) : null}
        {dueJobs.length ? (
          <View style={{ paddingHorizontal: spacing.l, paddingVertical: spacing.s, gap: spacing.xs }}>
            <Text style={{ fontSize: 12, fontWeight: '600', color: c.secondary }}>Aufträge mit Beginn oder Fälligkeit an diesem Tag</Text>
            {dueJobs.map((j) => (
              <Pressable key={j.id} onPress={() => onOpenJob(j)} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: spacing.s, padding: 10, borderRadius: 10, backgroundColor: c.surface, opacity: pressed ? 0.7 : 1 })}>
                <Icon name={statusMeta[j.status].icon} size={16} color={statusTint(j.status, theme)} />
                <Text style={{ flex: 1, fontSize: 15, color: c.text }} numberOfLines={1}>{j.title}</Text>
                <Text style={{ fontSize: 12, color: c.secondary }}>{j.dueDate && isSameDay(new Date(j.dueDate), date) ? 'fällig' : 'Beginn'}</Text>
                <Icon name="chevron-forward" size={13} color={c.tertiary} />
              </Pressable>
            ))}
          </View>
        ) : null}
      </View>

      <View style={{ height: HOUR * 24, marginTop: 10 }} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
        {Array.from({ length: 24 }, (_, hour) => {
          const working = hour >= workStart && hour < workEnd;
          return (
            <Pressable
              key={hour}
              onPress={(e: GestureResponderEvent) => onCreate(setTime(date, hour, e.nativeEvent.locationY < HOUR / 2 ? 0 : 30))}
              accessibilityLabel={`${hour} Uhr, Termin anlegen`}
              style={{ height: HOUR, flexDirection: 'row' }}
            >
              <Text style={{ width: GUTTER - 8, textAlign: 'right', fontSize: 11, color: working ? c.secondary : c.tertiary, marginTop: -7, fontVariant: ['tabular-nums'] }}>{fmt.hour(hour)}</Text>
              <View style={{ flex: 1, marginLeft: 8, borderTopWidth: 0.5, borderTopColor: c.separator, backgroundColor: working ? 'transparent' : c.offHours }} />
            </Pressable>
          );
        })}

        {positioned.map(({ appointment: a, column, columns }) => {
          const s = Math.max(apStart(a).getTime(), dayStart);
          const e = Math.min(apEnd(a).getTime(), dayStart + 86400000);
          const top = ((s - dayStart) / 3600000) * HOUR;
          const height = Math.max(((e - s) / 3600000) * HOUR, 28) - 2;
          const colWidth = area / columns;
          const conflict = conflicts.has(a.id);
          const emp = byId(data.employees, a.employeeId);
          const tint = emp?.colorHex ?? c.accent;
          const job = byId(data.jobs, a.jobId);
          const compact = height < 46;
          return (
            <Pressable
              key={a.id}
              onPress={() => onOpen(a)}
              onLongPress={() => onMenu(a)}
              delayLongPress={350}
              accessibilityLabel={`${a.title}, ${fmt.timeRange(apStart(a), apEnd(a))}${conflict ? ', Überschneidung' : ''}`}
              style={({ pressed }) => ({
                position: 'absolute', top: top + 1, left: GUTTER + column * colWidth, width: Math.max(colWidth - 3, 20), height,
                backgroundColor: alpha(tint, theme.dark ? 0.3 : 0.15), borderLeftWidth: 3, borderLeftColor: tint, borderRadius: 4,
                borderWidth: conflict ? 1 : 0, borderColor: conflict ? c.danger : 'transparent',
                paddingHorizontal: 6, paddingVertical: 3, overflow: 'hidden', opacity: pressed ? 0.75 : 1,
              })}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                {conflict ? <Icon name="warning" size={11} color={c.danger} /> : null}
                <Text style={{ fontSize: 12, fontWeight: '600', color: c.text, flexShrink: 1 }} numberOfLines={compact ? 1 : 2}>{a.title}</Text>
              </View>
              {!compact ? <Text style={{ fontSize: 11, color: c.secondary, fontVariant: ['tabular-nums'] }}>{fmt.timeRange(apStart(a), apEnd(a))}</Text> : null}
              {!compact && job ? <Text style={{ fontSize: 11, color: c.secondary }} numberOfLines={1}>{fmt.jobNumber(job.number)}</Text> : null}
            </Pressable>
          );
        })}

        {isToday(date) ? (
          <View pointerEvents="none" style={{ position: 'absolute', left: GUTTER - 4, right: 0, top: ((now.getTime() - dayStart) / 3600000) * HOUR - 4, flexDirection: 'row', alignItems: 'center' }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: c.danger }} />
            <View style={{ flex: 1, height: 1.5, backgroundColor: c.danger }} />
          </View>
        ) : null}
      </View>
    </ScrollView>
  );
}

// MARK: - Woche

function WeekAgenda({
  weekStart, appointments, conflicts, onOpen, onMenu, onSelectDay,
}: {
  weekStart: Date;
  appointments: Appointment[];
  conflicts: Set<ID>;
  onOpen: (a: Appointment) => void;
  onMenu: (a: Appointment) => void;
  onSelectDay: (d: Date) => void;
}) {
  const { c } = useTheme();
  return (
    <Screen>
      {Array.from({ length: 7 }, (_, i) => {
        const day = addDays(weekStart, i);
        const items = appointments.filter((a) => intersectsDay(a, day)).sort((a, b) => a.start.localeCompare(b.start));
        const planned = items.reduce((sum, a) => sum + plannedSecondsOnDay(a, day), 0);
        return (
          <View key={i}>
            <Pressable onPress={() => onSelectDay(day)} style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.xl + 8, marginTop: spacing.xl, marginBottom: 6, gap: spacing.s }} accessibilityHint="Tagesansicht öffnen">
              <Text style={{ fontSize: 15, fontWeight: '600', color: isToday(day) ? c.accent : c.text }}>{fmt.dayMonthShort(day)}</Text>
              {isToday(day) ? <Text style={{ fontSize: 12, fontWeight: '600', color: c.accent }}>Heute</Text> : null}
              <View style={{ flex: 1 }} />
              {planned > 0 ? <Text style={{ fontSize: 12, color: c.secondary }}>{fmt.duration(planned)}</Text> : null}
              <Icon name="chevron-forward" size={13} color={c.tertiary} />
            </Pressable>
            <View style={{ marginHorizontal: spacing.l, borderRadius: 12, overflow: 'hidden', backgroundColor: c.surface }}>
              {items.length === 0 ? (
                <Text style={{ padding: spacing.l, fontSize: 15, color: c.tertiary }}>Keine Termine</Text>
              ) : (
                items.map((a, idx) => (
                  <View key={a.id}>
                    {idx > 0 ? <View style={{ height: 0.5, marginLeft: spacing.l, backgroundColor: c.separator }} /> : null}
                    <Row chevron onPress={() => onOpen(a)} onLongPress={() => onMenu(a)}>
                      <AppointmentRow appointment={a} hasConflict={conflicts.has(a.id)} />
                    </Row>
                  </View>
                ))
              )}
            </View>
          </View>
        );
      })}
    </Screen>
  );
}

// MARK: - Monat

function MonthGrid({
  month, selected, onSelect, appointments, conflicts, onOpen,
}: {
  month: Date;
  selected: Date;
  onSelect: (d: Date) => void;
  appointments: Appointment[];
  conflicts: Set<ID>;
  onOpen: (a: Appointment) => void;
}) {
  const { c } = useTheme();
  const { data } = useStore();
  const first = startOfMonth(month);
  const leading = (first.getDay() + 6) % 7;
  const cells: (Date | null)[] = [...Array(leading).fill(null), ...Array.from({ length: daysInMonth(first) }, (_, i) => addDays(first, i))];
  while (cells.length % 7) cells.push(null);
  const selectedItems = appointments.filter((a) => intersectsDay(a, selected)).sort((a, b) => a.start.localeCompare(b.start));

  return (
    <Screen>
      <View style={{ padding: spacing.l, gap: spacing.l }}>
        <Card padding={spacing.m}>
          <View style={{ flexDirection: 'row', marginBottom: spacing.s }}>
            {weekdaySymbolsMondayFirst.map((s) => (
              <Text key={s} style={{ flex: 1, textAlign: 'center', fontSize: 11, fontWeight: '600', color: c.secondary }}>{s}</Text>
            ))}
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            {cells.map((day, i) => {
              if (!day) return <View key={i} style={{ width: `${100 / 7}%`, height: 48 }} />;
              const items = appointments.filter((a) => isSameDay(apStart(a), day));
              const isSel = isSameDay(day, selected);
              const today = isToday(day);
              const conflict = items.some((a) => conflicts.has(a.id));
              return (
                <Pressable key={i} onPress={() => onSelect(day)} style={{ width: `${100 / 7}%`, height: 48, alignItems: 'center', paddingTop: 2 }} accessibilityLabel={`${fmt.weekdayDate(day)}, ${items.length} Termine${conflict ? ', Überschneidung' : ''}`}>
                  <View style={{ width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: isSel ? c.accent : 'transparent', borderWidth: !isSel && today ? 1.2 : 0, borderColor: c.accent }}>
                    <Text style={{ fontSize: 15, fontWeight: isSel || today ? '600' : '400', color: isSel ? '#FFFFFF' : today ? c.accent : c.text }}>{day.getDate()}</Text>
                  </View>
                  <View style={{ flexDirection: 'row', gap: 3, height: 6, marginTop: 3, alignItems: 'center' }}>
                    {items.slice(0, 3).map((a) => (
                      <View key={a.id} style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: byId(data.employees, a.employeeId)?.colorHex ?? c.accent }} />
                    ))}
                    {conflict ? <Text style={{ fontSize: 8, fontWeight: '900', color: c.danger }}>!</Text> : null}
                  </View>
                </Pressable>
              );
            })}
          </View>
        </Card>

        <View>
          <SectionHeader title={fmt.weekdayDate(selected)} />
          {selectedItems.length === 0 ? (
            <EmptyCard icon="calendar-outline" text="Keine Termine an diesem Tag." />
          ) : (
            <LinkCardList
              items={selectedItems}
              keyOf={(a) => a.id}
              onPress={onOpen}
              render={(a) => <AppointmentRow appointment={a} hasConflict={conflicts.has(a.id)} />}
            />
          )}
        </View>
      </View>
    </Screen>
  );
}

// MARK: - Termindetail

export function AppointmentDetailScreen({ route }: NativeStackScreenProps<StackParams, 'AppointmentDetail'>) {
  const { c } = useTheme();
  const navigation = useNav();
  const { data, moveAppointment, deleteAppointment } = useStore();
  const appointment = byId(data.appointments, route.params.id);
  const [editing, setEditing] = useState(false);

  useLayoutEffect(() => {
    navigation.setOptions({
      title: 'Termin',
      headerRight: () => (appointment ? <HeaderButton title="Bearbeiten" onPress={() => setEditing(true)} /> : null),
    });
  }, [navigation, appointment]);

  if (!appointment) {
    return <Screen><EmptyState icon="calendar-outline" title="Termin nicht gefunden" message="Dieser Termin wurde gelöscht." /></Screen>;
  }
  const start = apStart(appointment);
  const end = apEnd(appointment);
  const employee = byId(data.employees, appointment.employeeId);
  const job = byId(data.jobs, appointment.jobId);
  const conflicts = conflictsFor(start, end, appointment.employeeId, appointment.id, data.appointments);

  return (
    <Screen>
      <View style={{ paddingHorizontal: spacing.l, paddingTop: spacing.l, gap: 6 }}>
        <Text style={{ fontSize: 24, fontWeight: '600', color: c.text }}>{appointment.title}</Text>
        <Text style={{ fontSize: 15, color: c.secondary }}>{fmt.weekdayDate(start)}</Text>
        <Text style={{ fontSize: 15, color: c.secondary, fontVariant: ['tabular-nums'] }}>
          {fmt.timeRange(start, end)} Uhr, {fmt.duration((end.getTime() - start.getTime()) / 1000)}
        </Text>
        {employee ? <View style={{ marginTop: 4 }}><EmployeeTag employee={employee} size={15} /></View> : null}
      </View>

      {conflicts.length ? (
        <Section title="⚠︎ Überschneidung" footer={`${employee?.name ?? 'Der Mitarbeiter'} ist zur gleichen Zeit bereits eingeplant.`}>
          {conflicts.map((o) => (
            <Row key={o.id} chevron onPress={() => navigation.push('AppointmentDetail', { id: o.id })}>
              <AppointmentRow appointment={o} showDate hasConflict />
            </Row>
          ))}
        </Section>
      ) : null}

      {job ? (
        <Section title="Auftrag">
          <Row chevron onPress={() => navigation.navigate('JobDetail', { id: job.id })}><JobRow job={job} /></Row>
        </Section>
      ) : null}

      {!isBlank(appointment.location) ? (
        <Section title="Ort">
          <Row onPress={() => openLink(links.maps(appointment.location))}>
            <InfoRow icon="car-outline" title="Route starten" value={appointment.location} />
          </Row>
        </Section>
      ) : null}

      {!isBlank(appointment.notes) ? (
        <Section title="Notizen"><Row><Text style={{ fontSize: 17, color: c.text }}>{appointment.notes}</Text></Row></Section>
      ) : null}

      <Section title="Verschieben">
        <ActionRow icon="time-outline" label="1 Stunde später" onPress={() => moveAppointment(appointment.id, 60)} />
        <ActionRow icon="arrow-forward-circle-outline" label="Auf morgen, gleiche Uhrzeit" onPress={() => moveAppointment(appointment.id, 24 * 60)} />
        <ActionRow icon="calendar-outline" label="Auf nächste Woche" onPress={() => moveAppointment(appointment.id, 7 * 24 * 60)} />
      </Section>

      <Section>
        <ActionRow
          icon="trash-outline"
          label="Termin löschen"
          destructive
          onPress={() =>
            confirm('Termin löschen?', `„${appointment.title}“ wird aus dem Kalender entfernt.`, 'Löschen', () => {
              navigation.goBack();
              setTimeout(() => deleteAppointment(appointment.id), 350);
            })
          }
        />
      </Section>

      {editing && <AppointmentForm appointmentId={appointment.id} onDone={() => setEditing(false)} />}
    </Screen>
  );
}
