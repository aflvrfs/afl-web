import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Image, Modal, Pressable, ScrollView, Share, Text, TextInput, View, useWindowDimensions } from 'react-native';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useStore } from './store';
import {
  alpha, buildingMeta, isOpenStatus, nextStatus, priorityMeta, priorityOrder, spacing, statusMeta, statusOrder, statusTint, useTheme,
} from './theme';
import type { Job, JobPhoto, JobPriority, JobStatus, MaterialItem, TimeEntry } from './types';
import {
  ActionRow, confirm, EmptyState, FilterChip, HeaderButton, Icon, InfoRow, LabeledValue, openLink, PrimaryButton, PriorityLabel, Row,
  Screen, Section, Segmented, SelectRow, showActions, EmployeeTag,
} from './ui';
import { AppointmentForm, JobForm, MaterialForm, TimeEntryForm } from './forms';
import { AppointmentRow, JobRow, StackParams, useNav } from './rows';
import {
  activeEmployees, buildingName, byId, customerName, entryDuration, fmt, isBlank, isOverdue, jobMatches, jobMaterialTotal,
  jobWorkSeconds, links, nowISO, runningEntry, siteAddress, uid,
} from './utils';
import { importPhoto, photoUri } from './photoStore';

type Scope = 'open' | 'all' | 'done';
type Sort = 'date' | 'priority' | 'newest';
const sortTitles: Record<Sort, string> = { date: 'Termin / Fälligkeit', priority: 'Priorität', newest: 'Zuletzt angelegt' };

const success = () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);

// MARK: - Liste

export function JobListScreen() {
  const navigation = useNav();
  const { data, setJobStatus, deleteJob } = useStore();
  const [search, setSearch] = useState('');
  const [scope, setScope] = useState<Scope>('open');
  const [statusFilter, setStatusFilter] = useState<JobStatus | null>(null);
  const [priorityFilter, setPriorityFilter] = useState<JobPriority | null>(null);
  const [employeeFilter, setEmployeeFilter] = useState<string | null>(null);
  const [sort, setSort] = useState<Sort>('date');
  const [creating, setCreating] = useState(false);
  const hasFilters = !!(statusFilter || priorityFilter || employeeFilter);

  const openFilterMenu = () =>
    showActions('Filtern und sortieren', [
      { label: 'Nach Status filtern …', onPress: () => setTimeout(() => showActions('Status', [
        { label: 'Alle Status', onPress: () => setStatusFilter(null) },
        ...statusOrder.map((s) => ({ label: statusMeta[s].title, onPress: () => setStatusFilter(s) })),
      ]), 300) },
      { label: 'Nach Priorität filtern …', onPress: () => setTimeout(() => showActions('Priorität', [
        { label: 'Alle Prioritäten', onPress: () => setPriorityFilter(null) },
        ...priorityOrder.map((p) => ({ label: priorityMeta[p].title, onPress: () => setPriorityFilter(p) })),
      ]), 300) },
      ...(data.employees.length ? [{ label: 'Nach Mitarbeiter filtern …', onPress: () => setTimeout(() => showActions('Mitarbeiter', [
        { label: 'Alle Mitarbeiter', onPress: () => setEmployeeFilter(null) },
        ...data.employees.map((e) => ({ label: e.name, onPress: () => setEmployeeFilter(e.id) })),
      ]), 300) }] : []),
      { label: `Sortierung: ${sortTitles[sort]} …`, onPress: () => setTimeout(() => showActions('Sortierung', (Object.keys(sortTitles) as Sort[]).map((s) => ({ label: sortTitles[s], onPress: () => setSort(s) }))), 300) },
      ...(hasFilters ? [{ label: 'Filter zurücksetzen', destructive: true, onPress: () => { setStatusFilter(null); setPriorityFilter(null); setEmployeeFilter(null); } }] : []),
    ]);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerSearchBarOptions: {
        placeholder: 'Titel, Nummer oder Kunde',
        hideWhenScrolling: false,
        cancelButtonText: 'Abbrechen',
        onChangeText: (e) => setSearch(e.nativeEvent.text),
        onCancelButtonPress: () => setSearch(''),
      },
      headerRight: () => (
        <View style={{ flexDirection: 'row', gap: 18 }}>
          <HeaderButton icon={hasFilters ? 'filter-circle' : 'filter-circle-outline'} accessibilityLabel="Filtern und sortieren" onPress={openFilterMenu} />
          <HeaderButton icon="add" accessibilityLabel="Neuer Auftrag" onPress={() => setCreating(true)} />
        </View>
      ),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigation, hasFilters, sort, statusFilter, priorityFilter, employeeFilter, data.employees]);

  const list = useMemo(() => {
    let result = data.jobs.filter((j) => (scope === 'all' ? true : scope === 'open' ? isOpenStatus(j.status) : !isOpenStatus(j.status)));
    if (statusFilter) result = result.filter((j) => j.status === statusFilter);
    if (priorityFilter) result = result.filter((j) => j.priority === priorityFilter);
    if (employeeFilter) result = result.filter((j) => j.assigneeId === employeeFilter);
    result = result.filter((j) => jobMatches(data, j, search));
    const dateOf = (j: Job) => j.dueDate ?? j.startDate ?? '9999';
    return result.sort((a, b) => {
      if (sort === 'date') return dateOf(a).localeCompare(dateOf(b));
      if (sort === 'priority') {
        const diff = priorityMeta[b.priority].rank - priorityMeta[a.priority].rank;
        return diff !== 0 ? diff : b.createdAt.localeCompare(a.createdAt);
      }
      return b.createdAt.localeCompare(a.createdAt);
    });
  }, [data, scope, statusFilter, priorityFilter, employeeFilter, search, sort]);

  const rowMenu = (job: Job) => {
    const next = nextStatus(job.status);
    showActions(job.title, [
      ...(next ? [{ label: `Status: ${statusMeta[next].title}`, onPress: () => { setJobStatus(job.id, next); success(); } }] : []),
      { label: 'Status ändern …', onPress: () => setTimeout(() => showActions('Status ändern', statusOrder.filter((s) => s !== job.status).map((s) => ({
        label: statusMeta[s].title, onPress: () => { setJobStatus(job.id, s); success(); },
      }))), 300) },
      { label: 'Auftrag löschen', destructive: true, onPress: () => confirm('Auftrag löschen?', `${fmt.jobNumber(job.number)} „${job.title}“ wird mit Zeiten, Material, Fotos und Terminen dauerhaft gelöscht.`, 'Löschen', () => deleteJob(job.id)) },
    ]);
  };

  return (
    <Screen>
      <View style={{ paddingHorizontal: spacing.l, paddingTop: spacing.m, gap: spacing.s }}>
        <Segmented values={['Offen', 'Alle', 'Erledigt']} index={['open', 'all', 'done'].indexOf(scope)} onChange={(i) => setScope((['open', 'all', 'done'] as Scope[])[i])} />
        {hasFilters ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.s }}>
            {statusFilter ? <FilterChip title={statusMeta[statusFilter].title} onRemove={() => setStatusFilter(null)} /> : null}
            {priorityFilter ? <FilterChip title={priorityMeta[priorityFilter].title} onRemove={() => setPriorityFilter(null)} /> : null}
            {employeeFilter ? <FilterChip title={byId(data.employees, employeeFilter)?.name ?? 'Mitarbeiter'} onRemove={() => setEmployeeFilter(null)} /> : null}
          </ScrollView>
        ) : null}
      </View>

      {data.jobs.length === 0 ? (
        <EmptyState
          icon="construct-outline"
          title="Noch keine Aufträge"
          message="Erfassen Sie Ihren ersten Auftrag – mit Kunde, Termin und Mitarbeiter."
          actionTitle="Auftrag anlegen"
          onAction={() => setCreating(true)}
        />
      ) : list.length === 0 ? (
        <EmptyState icon={search ? 'search' : 'filter-outline'} title="Keine Aufträge" message={search ? `Kein Auftrag passt zu „${search}“.` : 'Für diese Auswahl gibt es keine Aufträge.'} />
      ) : (
        <Section footer={`${list.length === 1 ? '1 Auftrag' : `${list.length} Aufträge`}. Gedrückt halten für Status und Löschen.`}>
          {list.map((j) => (
            <Row key={j.id} chevron onPress={() => navigation.navigate('JobDetail', { id: j.id })} onLongPress={() => rowMenu(j)}>
              <JobRow job={j} />
            </Row>
          ))}
        </Section>
      )}
      {creating && <JobForm onDone={(id) => { setCreating(false); if (id) navigation.navigate('JobDetail', { id }); }} />}
    </Screen>
  );
}

// MARK: - Detail

type Sheet =
  | { kind: 'edit' }
  | { kind: 'time'; entryId?: string }
  | { kind: 'material'; itemId?: string }
  | { kind: 'appointment' }
  | { kind: 'photo'; photo: JobPhoto };

export function JobDetailScreen({ route }: NativeStackScreenProps<StackParams, 'JobDetail'>) {
  const theme = useTheme();
  const { c } = theme;
  const navigation = useNav();
  const store = useStore();
  const { data } = store;
  const job = byId(data.jobs, route.params.id);
  const [sheet, setSheet] = useState<Sheet | null>(null);

  useLayoutEffect(() => {
    navigation.setOptions({
      title: job ? fmt.jobNumber(job.number) : 'Auftrag',
      headerRight: () => (job ? <HeaderButton title="Bearbeiten" onPress={() => setSheet({ kind: 'edit' })} /> : null),
    });
  }, [navigation, job?.number, job]);

  if (!job) {
    return <Screen><EmptyState icon="construct-outline" title="Auftrag nicht gefunden" message="Dieser Auftrag wurde gelöscht." /></Screen>;
  }

  const customer = byId(data.customers, job.customerId);
  const building = byId(data.buildings, job.buildingId);
  const address = siteAddress(data, job);
  const next = nextStatus(job.status);
  const tint = statusTint(job.status, theme);
  const overdue = isOverdue(job);
  const appointments = data.appointments.filter((a) => a.jobId === job.id).sort((a, b) => a.start.localeCompare(b.start));
  const employees = activeEmployees(data);
  const assignee = byId(data.employees, job.assigneeId);
  const employeeOptions = [
    { value: '', label: 'Nicht zugewiesen' },
    ...employees.map((e) => ({ value: e.id, label: e.name })),
    ...(assignee && !assignee.isActive ? [{ value: assignee.id, label: assignee.name }] : []),
  ];

  const changeStatus = (status: JobStatus) => {
    if (status === job.status) return;
    store.setJobStatus(job.id, status);
    success();
  };

  return (
    <Screen>
      <View style={{ paddingHorizontal: spacing.l, paddingTop: spacing.l, gap: spacing.m }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={{ fontSize: 15, color: c.secondary, fontVariant: ['tabular-nums'] }}>{fmt.jobNumber(job.number)}</Text>
          {job.priority !== 'normal' ? <PriorityLabel priority={job.priority} size={15} /> : null}
        </View>
        <Text style={{ fontSize: 24, fontWeight: '600', color: c.text }}>{job.title}</Text>
        <Pressable
          accessibilityLabel={`Status: ${statusMeta[job.status].title}. Ändern`}
          onPress={() => showActions('Status ändern', statusOrder.filter((s) => s !== job.status).map((s) => ({ label: statusMeta[s].title, onPress: () => changeStatus(s) })))}
          style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: spacing.s, padding: 13, borderRadius: 10, backgroundColor: alpha(tint, 0.11), opacity: pressed ? 0.7 : 1 })}
        >
          <Icon name={statusMeta[job.status].icon} size={18} color={tint} />
          <Text style={{ color: tint, fontWeight: '600', fontSize: 15, flex: 1 }}>{statusMeta[job.status].title}</Text>
          <Text style={{ color: c.secondary, fontSize: 12 }}>Status ändern</Text>
          <Icon name="chevron-expand" size={15} color={c.secondary} />
        </Pressable>
        {next ? (
          <PrimaryButton
            title={statusMeta[job.status].nextActionTitle}
            icon={next === 'completed' ? 'checkmark' : 'play'}
            onPress={() => changeStatus(next)}
          />
        ) : null}
      </View>

      <Section title="Kunde und Einsatzort">
        {customer ? (
          <Row chevron onPress={() => navigation.navigate('CustomerDetail', { id: customer.id })}>
            <InfoRow icon="person-outline" title="Kunde" value={customerName(customer)} />
          </Row>
        ) : (
          <Row><Text style={{ color: c.secondary, fontSize: 17 }}>Kein Kunde zugeordnet</Text></Row>
        )}
        {customer && links.phone(customer.phone) ? (
          <Row onPress={() => openLink(links.phone(customer.phone))}>
            <InfoRow icon="call-outline" title="Anrufen" value={customer.phone} />
          </Row>
        ) : null}
        {building ? (
          <Row chevron onPress={() => navigation.navigate('BuildingDetail', { id: building.id })}>
            <InfoRow icon={buildingMeta[building.type].icon} title="Immobilie" value={buildingName(building)} />
          </Row>
        ) : null}
        {address ? (
          <Row onPress={() => openLink(links.maps(address))}>
            <InfoRow icon="car-outline" title="Route zum Einsatzort" value={address} />
          </Row>
        ) : null}
      </Section>

      <Section title="Planung">
        <SelectRow<string>
          label="Mitarbeiter"
          icon="person-circle-outline"
          value={job.assigneeId ?? ''}
          options={employeeOptions}
          onChange={(v) => store.updateJob(job.id, { assigneeId: v || null })}
        />
        {job.startDate ? <Row><InfoRow icon="calendar-outline" title="Beginn" value={fmt.date(new Date(job.startDate))} /></Row> : null}
        {job.dueDate ? (
          <Row>
            <InfoRow
              icon={overdue ? 'alert-circle-outline' : 'flag-outline'}
              title={overdue ? 'Überfällig seit' : 'Fällig bis'}
              value={fmt.date(new Date(job.dueDate))}
              valueColor={overdue ? c.danger : undefined}
            />
          </Row>
        ) : null}
        {appointments.map((a) => (
          <Row key={a.id} chevron onPress={() => navigation.navigate('AppointmentDetail', { id: a.id })}>
            <AppointmentRow appointment={a} showDate />
          </Row>
        ))}
        <ActionRow icon="calendar-number-outline" label="Termin planen" onPress={() => setSheet({ kind: 'appointment' })} />
      </Section>

      {!isBlank(job.details) ? (
        <Section title="Beschreibung">
          <Row><Text selectable style={{ fontSize: 17, color: c.text, lineHeight: 23 }}>{job.details}</Text></Row>
        </Section>
      ) : null}

      <TimeTrackingSection job={job} onEdit={(entryId) => setSheet({ kind: 'time', entryId })} />
      <MaterialSection job={job} onEdit={(itemId) => setSheet({ kind: 'material', itemId })} />
      <PhotosSection job={job} onOpen={(photo) => setSheet({ kind: 'photo', photo })} />
      <NotesSection job={job} />

      <Section>
        <Row><LabeledValue label="Angelegt" value={fmt.dateTime(new Date(job.createdAt))} /></Row>
        <Row><LabeledValue label="Zuletzt geändert" value={fmt.dateTime(new Date(job.updatedAt))} /></Row>
        {job.completedAt ? <Row><LabeledValue label="Abgeschlossen" value={fmt.dateTime(new Date(job.completedAt))} /></Row> : null}
        <ActionRow
          icon="trash-outline"
          label="Auftrag löschen"
          destructive
          onPress={() =>
            confirm('Auftrag löschen?', 'Arbeitszeiten, Material, Fotos und Termine dieses Auftrags werden ebenfalls gelöscht.', 'Löschen', () => {
              navigation.goBack();
              setTimeout(() => store.deleteJob(job.id), 350);
            })
          }
        />
      </Section>

      {sheet?.kind === 'edit' && <JobForm jobId={job.id} onDone={() => setSheet(null)} />}
      {sheet?.kind === 'time' && <TimeEntryForm jobId={job.id} entryId={sheet.entryId} onDone={() => setSheet(null)} />}
      {sheet?.kind === 'material' && <MaterialForm jobId={job.id} itemId={sheet.itemId} onDone={() => setSheet(null)} />}
      {sheet?.kind === 'appointment' && <AppointmentForm presetJobId={job.id} onDone={() => setSheet(null)} />}
      {sheet?.kind === 'photo' && <PhotoViewer photo={sheet.photo} onClose={() => setSheet(null)} />}
    </Screen>
  );
}

// MARK: - Zeiterfassung

function useTicker(active: boolean): number {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [active]);
  return now;
}

function TimeTrackingSection({ job, onEdit }: { job: Job; onEdit: (entryId?: string) => void }) {
  const { c } = useTheme();
  const { data, startTimer, stopTimer, deleteTimeEntry } = useStore();
  const running = runningEntry(data, job.id);
  const now = useTicker(!!running);
  const entries = data.timeEntries.filter((e) => e.jobId === job.id && e.end !== null).sort((a, b) => b.start.localeCompare(a.start));

  const entryMenu = (entry: TimeEntry) =>
    showActions('Arbeitszeit', [
      { label: 'Bearbeiten', onPress: () => onEdit(entry.id) },
      { label: 'Löschen', destructive: true, onPress: () => confirm('Eintrag löschen?', 'Dieser Zeiteintrag wird entfernt.', 'Löschen', () => deleteTimeEntry(entry.id)) },
    ]);

  return (
    <Section title="Arbeitszeit" right={fmt.duration(jobWorkSeconds(data, job.id, now))}>
      {running ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', padding: spacing.l, gap: spacing.m }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 12, color: c.secondary }}>Läuft seit {fmt.time(new Date(running.start))} Uhr</Text>
            <Text style={{ fontSize: 26, fontWeight: '600', color: c.text, fontVariant: ['tabular-nums'] }}>{fmt.clock(entryDuration(running, now))}</Text>
          </View>
          <PrimaryButton title="Stopp" icon="stop" color={c.danger} onPress={() => { stopTimer(running.id); success(); }} style={{ paddingHorizontal: spacing.xl }} />
        </View>
      ) : isOpenStatus(job.status) ? (
        <ActionRow icon="play-circle" label="Zeiterfassung starten" onPress={() => { startTimer(job.id); success(); }} />
      ) : null}
      {entries.map((entry) => {
        const employee = byId(data.employees, entry.employeeId);
        return (
          <Row key={entry.id} onPress={() => onEdit(entry.id)} onLongPress={() => entryMenu(entry)}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.m }}>
              <View style={{ flex: 1, gap: 3 }}>
                <Text style={{ fontSize: 15, color: c.text }}>
                  {fmt.relativeDay(new Date(entry.start))}, {fmt.timeRange(new Date(entry.start), new Date(entry.end ?? now))}
                </Text>
                <View style={{ flexDirection: 'row', gap: spacing.s, flexWrap: 'wrap' }}>
                  {employee ? <EmployeeTag employee={employee} /> : null}
                  {entry.breakMinutes > 0 ? <Text style={{ fontSize: 12, color: c.secondary }}>{entry.breakMinutes} Min. Pause</Text> : null}
                  {!isBlank(entry.note) ? <Text style={{ fontSize: 12, color: c.secondary }} numberOfLines={1}>{entry.note}</Text> : null}
                </View>
              </View>
              <Text style={{ fontSize: 15, fontWeight: '500', color: c.text, fontVariant: ['tabular-nums'] }}>{fmt.duration(entryDuration(entry))}</Text>
            </View>
          </Row>
        );
      })}
      <ActionRow icon="add" label="Zeit nachtragen" onPress={() => onEdit()} />
    </Section>
  );
}

// MARK: - Material

function MaterialSection({ job, onEdit }: { job: Job; onEdit: (itemId?: string) => void }) {
  const { c } = useTheme();
  const { data, deleteMaterial } = useStore();
  const items = data.materials.filter((m) => m.jobId === job.id).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const total = jobMaterialTotal(data, job.id);

  const itemMenu = (item: MaterialItem) =>
    showActions(item.name, [
      { label: 'Bearbeiten', onPress: () => onEdit(item.id) },
      { label: 'Löschen', destructive: true, onPress: () => confirm('Material löschen?', `${item.name} wird entfernt.`, 'Löschen', () => deleteMaterial(item.id)) },
    ]);

  return (
    <Section title="Material" right={total > 0 ? fmt.currency(total) : undefined}>
      {items.map((item) => (
        <Row key={item.id} onPress={() => onEdit(item.id)} onLongPress={() => itemMenu(item)}>
          <View style={{ flexDirection: 'row', gap: spacing.m }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 15, fontWeight: '500', color: c.text }}>{item.name}</Text>
              {!isBlank(item.articleNumber) ? <Text style={{ fontSize: 12, color: c.secondary }}>Art.-Nr. {item.articleNumber}</Text> : null}
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={{ fontSize: 15, color: c.text, fontVariant: ['tabular-nums'] }}>{fmt.decimal(item.quantity)} {item.unit}</Text>
              {item.unitPrice != null ? <Text style={{ fontSize: 12, color: c.secondary }}>{fmt.currency(item.unitPrice * item.quantity)}</Text> : null}
            </View>
          </View>
        </Row>
      ))}
      <ActionRow icon="add" label="Material erfassen" onPress={() => onEdit()} />
    </Section>
  );
}

// MARK: - Fotos

function PhotosSection({ job, onOpen }: { job: Job; onOpen: (p: JobPhoto) => void }) {
  const { c } = useTheme();
  const { data, addPhoto } = useStore();
  const [importing, setImporting] = useState(false);
  const { width } = useWindowDimensions();
  const photos = data.photos.filter((p) => p.jobId === job.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const size = Math.floor((width - spacing.l * 2 - spacing.m * 2 - spacing.s * 3) / 4);

  const store = (assets: ImagePicker.ImagePickerAsset[]) => {
    let failed = 0;
    assets.forEach((asset) => {
      const id = uid();
      const fileName = `${id}.jpg`;
      try {
        importPhoto(asset.uri, fileName);
        addPhoto({ id, jobId: job.id, fileName, createdAt: nowISO() });
      } catch {
        failed += 1;
      }
    });
    if (failed) Alert.alert('Fotos', failed === 1 ? 'Ein Foto konnte nicht gespeichert werden.' : `${failed} Fotos konnten nicht gespeichert werden.`);
  };

  const fromLibrary = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Kein Zugriff auf Fotos', 'Erlauben Sie den Zugriff in den iOS-Einstellungen.');
      return;
    }
    setImporting(true);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: true, selectionLimit: 10, quality: 0.6, exif: false });
      if (!result.canceled) store(result.assets);
    } catch {
      Alert.alert('Fotos', 'Die Fotos konnten nicht geladen werden.');
    } finally {
      setImporting(false);
    }
  };

  const fromCamera = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Kein Zugriff auf die Kamera', 'Erlauben Sie den Zugriff in den iOS-Einstellungen.');
      return;
    }
    setImporting(true);
    try {
      const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.6, exif: false });
      if (!result.canceled) store(result.assets);
    } catch {
      Alert.alert('Kamera', 'Die Kamera ist auf diesem Gerät nicht verfügbar.');
    } finally {
      setImporting(false);
    }
  };

  return (
    <Section title={photos.length ? `Fotos (${photos.length})` : 'Fotos'}>
      <View style={{ padding: spacing.m, gap: spacing.m }}>
        {photos.length === 0 && !importing ? (
          <Text style={{ fontSize: 15, color: c.secondary }}>Dokumentieren Sie Vorher-/Nachher-Zustand, Typenschilder oder Schäden.</Text>
        ) : (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.s }}>
            {photos.map((p) => (
              <Pressable key={p.id} onPress={() => onOpen(p)} accessibilityLabel={`Foto vom ${fmt.dateTime(new Date(p.createdAt))}`}>
                <Image source={{ uri: photoUri(p.fileName) }} style={{ width: size, height: size, borderRadius: 10, backgroundColor: c.fill }} />
              </Pressable>
            ))}
            {importing ? (
              <View style={{ width: size, height: size, borderRadius: 10, backgroundColor: c.fill, alignItems: 'center', justifyContent: 'center' }}>
                <ActivityIndicator />
              </View>
            ) : null}
          </View>
        )}
        <View style={{ flexDirection: 'row', gap: spacing.xl }}>
          <Pressable onPress={fromLibrary} disabled={importing} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Icon name="images-outline" size={20} color={c.accent} />
            <Text style={{ color: c.accent, fontSize: 17 }}>Mediathek</Text>
          </Pressable>
          <Pressable onPress={fromCamera} disabled={importing} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Icon name="camera-outline" size={20} color={c.accent} />
            <Text style={{ color: c.accent, fontSize: 17 }}>Kamera</Text>
          </Pressable>
        </View>
      </View>
    </Section>
  );
}

function PhotoViewer({ photo, onClose }: { photo: JobPhoto; onClose: () => void }) {
  const { deletePhoto } = useStore();
  const { width, height } = useWindowDimensions();
  const uri = photoUri(photo.fileName);
  const [visible, setVisible] = useState(true);
  const closing = useRef(false);
  const close = (after?: () => void) => {
    if (closing.current) return;
    closing.current = true;
    setVisible(false);
    setTimeout(() => {
      onClose();
      after?.();
    }, 400);
  };

  return (
    <Modal visible={visible} animationType="fade" presentationStyle="fullScreen" onRequestClose={() => close()}>
      <View style={{ flex: 1, backgroundColor: '#000' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 56, paddingHorizontal: spacing.l, paddingBottom: spacing.m }}>
          <Pressable onPress={() => close()} hitSlop={10}><Text style={{ color: '#fff', fontSize: 17 }}>Schließen</Text></Pressable>
          <Text style={{ color: '#fff', fontSize: 15, fontWeight: '600' }}>{fmt.dateTime(new Date(photo.createdAt))}</Text>
          <View style={{ flexDirection: 'row', gap: 22 }}>
            <Pressable hitSlop={10} accessibilityLabel="Teilen" onPress={() => Share.share({ url: uri }).catch(() => undefined)}>
              <Icon name="share-outline" size={23} color="#fff" />
            </Pressable>
            <Pressable
              hitSlop={10}
              accessibilityLabel="Foto löschen"
              onPress={() => confirm('Foto löschen?', 'Das Foto wird dauerhaft entfernt.', 'Löschen', () => close(() => deletePhoto(photo.id)))}
            >
              <Icon name="trash-outline" size={23} color="#fff" />
            </Pressable>
          </View>
        </View>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ flexGrow: 1, alignItems: 'center', justifyContent: 'center' }}
          maximumZoomScale={4}
          minimumZoomScale={1}
          centerContent
          showsHorizontalScrollIndicator={false}
          showsVerticalScrollIndicator={false}
        >
          <Image source={{ uri }} style={{ width, height: height - 160 }} resizeMode="contain" />
        </ScrollView>
      </View>
    </Modal>
  );
}

// MARK: - Notizen

function NotesSection({ job }: { job: Job }) {
  const { c } = useTheme();
  const { updateJob } = useStore();
  const [text, setText] = useState(job.internalNotes);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const focused = useRef(false);

  // Nur übernehmen, wenn gerade nicht getippt wird (z. B. nach Bearbeiten im Formular).
  useEffect(() => {
    if (!focused.current) setText(job.internalNotes);
  }, [job.internalNotes]);

  const onChange = (value: string) => {
    setText(value);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => updateJob(job.id, { internalNotes: value }), 600);
  };

  return (
    <Section title="Interne Notizen" footer="Nur für Ihr Team sichtbar. Wird automatisch gespeichert.">
      <TextInput
        value={text}
        onChangeText={onChange}
        onFocus={() => {
          focused.current = true;
        }}
        onBlur={() => {
          focused.current = false;
          if (timer.current) clearTimeout(timer.current);
          if (text !== job.internalNotes) updateJob(job.id, { internalNotes: text });
        }}
        placeholder="Interne Notiz hinzufügen"
        placeholderTextColor={c.tertiary}
        multiline
        style={{ fontSize: 17, color: c.text, minHeight: 80, padding: spacing.l, paddingTop: 12, textAlignVertical: 'top' }}
      />
    </Section>
  );
}

