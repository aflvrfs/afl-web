import React, { useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useStore, newBuilding, newCustomer, newJob } from './store';
import {
  alpha, buildingMeta, buildingTypeOrder, employeePalette, materialUnits, priorityMeta, priorityOrder, spacing,
  statusMeta, statusOrder, useTheme,
} from './theme';
import type { Appointment, Building, BuildingType, Customer, Employee, ID, Job, JobPriority, JobStatus, MaterialItem, TimeEntry } from './types';
import {
  ActionRow, confirm, ConflictWarning, DateRow, FieldError, FormInput, Icon, LabeledValue, Row, Section,
  Segmented, SelectRow, Sheet, showActions, StepperButtons, ToggleRow,
} from './ui';
import { CustomerRow, JobRow } from './rows';
import {
  activeEmployees, addDays, addMinutes, addressOf, buildingsOfCustomer, byId, compareName, conflictsFor, customerMatches,
  customerName, fmt, isBlank, jobMatches, nowISO, parseDecimal, roundToNextQuarter, siteAddress, startOfDay, uid, validate,
} from './utils';
import { isOpenStatus } from './theme';

// MARK: - Schließen mit Animation

/** Hält das Sheet sichtbar, bis die Ausblend-Animation beendet ist, und meldet dann das Ergebnis. */
function useSheet<R>(onDone: (result?: R) => void) {
  const [visible, setVisible] = useState(true);
  const finished = useRef(false);
  const result = useRef<R | undefined>(undefined);
  const finish = () => {
    if (finished.current) return;
    finished.current = true;
    onDone(result.current);
  };
  const close = (r?: R) => {
    result.current = r;
    setVisible(false);
    setTimeout(finish, 450);
  };
  return { visible, close };
}

function useDirtyCancel(hasChanges: boolean, close: () => void) {
  return () => {
    if (hasChanges) {
      confirm('Änderungen verwerfen?', 'Ihre Eingaben gehen verloren.', 'Verwerfen', close);
    } else {
      close();
    }
  };
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

// MARK: - Kunde

export function CustomerForm({ customerId, onDone }: { customerId?: ID; onDone: (savedId?: ID) => void }) {
  const { data, saveCustomer } = useStore();
  const existing = byId(data.customers, customerId);
  const [original] = useState<Customer>(() => existing ?? newCustomer());
  const [draft, setDraft] = useState<Customer>(original);
  const [showErrors, setShowErrors] = useState(false);
  const { visible, close } = useSheet<ID>(onDone);
  const set = (patch: Partial<Customer>) => setDraft((d) => ({ ...d, ...patch }));

  const errors = {
    lastName: isBlank(draft.lastName) && isBlank(draft.company) ? 'Bitte einen Nachnamen oder eine Firma eingeben.' : null,
    phone: validate.phone(draft.phone),
    email: validate.email(draft.email),
    postalCode: validate.postalCode(draft.postalCode),
  };
  const valid = Object.values(errors).every((e) => !e);
  const err = (k: keyof typeof errors) => (showErrors ? errors[k] : null);

  const save = () => {
    setShowErrors(true);
    if (!valid) return;
    saveCustomer({
      ...draft,
      firstName: draft.firstName.trim(), lastName: draft.lastName.trim(), company: draft.company.trim(),
      phone: draft.phone.trim(), email: draft.email.trim().toLowerCase(), street: draft.street.trim(),
      postalCode: draft.postalCode.trim(), city: draft.city.trim(), notes: draft.notes.trim(),
    });
    close(draft.id);
  };

  return (
    <Sheet visible={visible} title={existing ? 'Kunde bearbeiten' : 'Neuer Kunde'} onCancel={useDirtyCancel(!same(draft, original), () => close())} onSave={save}>
      <Section title="Name">
        <FormInput placeholder="Vorname" value={draft.firstName} onChangeText={(v) => set({ firstName: v })} textContentType="givenName" autoFocus={!existing} />
        <View>
          <FormInput placeholder="Nachname" value={draft.lastName} onChangeText={(v) => set({ lastName: v })} textContentType="familyName" />
          <FieldError message={err('lastName')} />
        </View>
        <FormInput placeholder="Firma (optional)" value={draft.company} onChangeText={(v) => set({ company: v })} textContentType="organizationName" />
      </Section>
      <Section title="Kontakt">
        <View>
          <FormInput placeholder="Telefon" value={draft.phone} onChangeText={(v) => set({ phone: v })} keyboardType="phone-pad" textContentType="telephoneNumber" />
          <FieldError message={err('phone')} />
        </View>
        <View>
          <FormInput placeholder="E-Mail" value={draft.email} onChangeText={(v) => set({ email: v })} keyboardType="email-address" autoCapitalize="none" textContentType="emailAddress" />
          <FieldError message={err('email')} />
        </View>
      </Section>
      <Section title="Anschrift">
        <FormInput placeholder="Straße und Hausnummer" value={draft.street} onChangeText={(v) => set({ street: v })} textContentType="fullStreetAddress" />
        <View>
          <PostalCityInputs postalCode={draft.postalCode} city={draft.city} onChange={(p, c) => set({ postalCode: p, city: c })} />
          <FieldError message={err('postalCode')} />
        </View>
      </Section>
      <Section title="Notizen">
        <FormInput placeholder="z. B. Schlüssel beim Nachbarn, Hund im Haus" value={draft.notes} onChangeText={(v) => set({ notes: v })} multiline />
      </Section>
    </Sheet>
  );
}

function PostalCityInputs({ postalCode, city, onChange }: { postalCode: string; city: string; onChange: (p: string, c: string) => void }) {
  const { c } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      <View style={{ width: 96 }}>
        <FormInput placeholder="PLZ" value={postalCode} onChangeText={(v) => onChange(v, city)} keyboardType="number-pad" textContentType="postalCode" />
      </View>
      <View style={{ width: 0.5, height: 26, backgroundColor: c.separator }} />
      <View style={{ flex: 1 }}>
        <FormInput placeholder="Ort" value={city} onChangeText={(v) => onChange(postalCode, v)} textContentType="addressCity" />
      </View>
    </View>
  );
}

// MARK: - Immobilie

const heatingSystems = ['Gas-Brennwert', 'Öl-Brennwert', 'Wärmepumpe Luft/Wasser', 'Wärmepumpe Sole/Wasser', 'Pelletheizung', 'Fernwärme', 'Hybridheizung', 'Nachtspeicher'];

export function BuildingForm({ buildingId, customerId, onDone }: { buildingId?: ID; customerId: ID; onDone: (id?: ID) => void }) {
  const { c } = useTheme();
  const { data, saveBuilding } = useStore();
  const customer = byId(data.customers, customerId);
  const existing = byId(data.buildings, buildingId);
  const [original] = useState<Building>(() => {
    if (existing) return existing;
    const b = newBuilding(customerId);
    if (customer && buildingsOfCustomer(data, customerId).length === 0) {
      b.street = customer.street;
      b.postalCode = customer.postalCode;
      b.city = customer.city;
    }
    return b;
  });
  const [draft, setDraft] = useState<Building>(original);
  const [showErrors, setShowErrors] = useState(false);
  const { visible, close } = useSheet<ID>(onDone);
  const set = (patch: Partial<Building>) => setDraft((d) => ({ ...d, ...patch }));

  const errors = {
    street: validate.required(draft.street, 'Bitte Straße und Hausnummer eingeben.'),
    postalCode: validate.postalCode(draft.postalCode),
    year: validate.year(draft.constructionYear),
  };
  const err = (k: keyof typeof errors) => (showErrors ? errors[k] : null);

  const save = () => {
    setShowErrors(true);
    if (Object.values(errors).some(Boolean)) return;
    saveBuilding({
      ...draft, name: draft.name.trim(), street: draft.street.trim(), postalCode: draft.postalCode.trim(), city: draft.city.trim(),
      heatingSystem: draft.heatingSystem.trim(), constructionYear: draft.constructionYear.trim(), notes: draft.notes.trim(),
    });
    close(draft.id);
  };

  return (
    <Sheet visible={visible} title={existing ? 'Immobilie bearbeiten' : 'Neue Immobilie'} onCancel={useDirtyCancel(!same(draft, original), () => close())} onSave={save}>
      <Section title="Objekt">
        <FormInput placeholder="Bezeichnung, z. B. Ferienwohnung" value={draft.name} onChangeText={(v) => set({ name: v })} />
        <SelectRow<BuildingType>
          label="Art"
          value={draft.type}
          options={buildingTypeOrder.map((t) => ({ value: t, label: buildingMeta[t].title }))}
          onChange={(t) => set({ type: t })}
        />
      </Section>
      <Section title="Adresse">
        <View>
          <FormInput placeholder="Straße und Hausnummer" value={draft.street} onChangeText={(v) => set({ street: v })} textContentType="fullStreetAddress" />
          <FieldError message={err('street')} />
        </View>
        <View>
          <PostalCityInputs postalCode={draft.postalCode} city={draft.city} onChange={(p, ci) => set({ postalCode: p, city: ci })} />
          <FieldError message={err('postalCode')} />
        </View>
        {customer && addressOf(customer) ? (
          <ActionRow icon="arrow-down-circle-outline" label="Anschrift des Kunden übernehmen" onPress={() => set({ street: customer.street, postalCode: customer.postalCode, city: customer.city })} />
        ) : null}
      </Section>
      <Section title="Anlagentechnik">
        <FormInput
          placeholder="z. B. Gas-Brennwert, Vitodens 200"
          value={draft.heatingSystem}
          onChangeText={(v) => set({ heatingSystem: v })}
          right={
            <Pressable hitSlop={10} accessibilityLabel="Anlagentyp wählen" onPress={() => showActions('Heizungsanlage', heatingSystems.map((h) => ({ label: h, onPress: () => set({ heatingSystem: h }) })))}>
              <Icon name="list" size={22} color={c.accent} />
            </Pressable>
          }
        />
        <View>
          <FormInput placeholder="Baujahr der Anlage" value={draft.constructionYear} onChangeText={(v) => set({ constructionYear: v })} keyboardType="number-pad" />
          <FieldError message={err('year')} />
        </View>
      </Section>
      <Section title="Notizen">
        <FormInput placeholder="z. B. Zugang zum Heizungsraum über Garage" value={draft.notes} onChangeText={(v) => set({ notes: v })} multiline />
      </Section>
    </Sheet>
  );
}

// MARK: - Auftrag

const jobTemplates = [
  'Heizungswartung', 'Störung Heizung', 'Thermenwartung', 'Wärmepumpe installieren', 'Heizkörper tauschen', 'Hydraulischer Abgleich',
  'Warmwasser defekt', 'Rohrbruch', 'Abfluss verstopft', 'Badsanierung', 'Klimaanlage warten', 'Gasleitung prüfen',
];
const durations = [30, 60, 90, 120, 180, 240, 480];

interface JobDraft {
  job: Job;
  hasStart: boolean;
  start: Date;
  hasDue: boolean;
  due: Date;
  schedule: boolean;
  apStart: Date;
  apMinutes: number;
}

export function JobForm({ jobId, presetCustomerId, presetBuildingId, onDone }: { jobId?: ID; presetCustomerId?: ID; presetBuildingId?: ID; onDone: (id?: ID) => void }) {
  const theme = useTheme();
  const { c } = theme;
  const { data, saveJob } = useStore();
  const existing = byId(data.jobs, jobId);
  const [original] = useState<JobDraft>(() => {
    const job = existing ?? { ...newJob(), customerId: presetCustomerId ?? byId(data.buildings, presetBuildingId)?.customerId ?? null, buildingId: presetBuildingId ?? null };
    return {
      job,
      hasStart: !!job.startDate,
      start: job.startDate ? new Date(job.startDate) : startOfDay(new Date()),
      hasDue: !!job.dueDate,
      due: job.dueDate ? new Date(job.dueDate) : addDays(startOfDay(new Date()), 7),
      schedule: false,
      apStart: roundToNextQuarter(new Date()),
      apMinutes: data.settings.defaultDuration,
    };
  });
  const [draft, setDraft] = useState<JobDraft>(original);
  const [showErrors, setShowErrors] = useState(false);
  const [pickingCustomer, setPickingCustomer] = useState(false);
  const { visible, close } = useSheet<ID>(onDone);
  const setJob = (patch: Partial<Job>) => setDraft((d) => ({ ...d, job: { ...d.job, ...patch } }));
  const set = (patch: Partial<JobDraft>) => setDraft((d) => ({ ...d, ...patch }));

  const employees = activeEmployees(data);
  const customer = byId(data.customers, draft.job.customerId);
  const buildings = customer ? buildingsOfCustomer(data, customer.id) : [];

  const errors = {
    title: validate.required(draft.job.title, 'Bitte einen Titel eingeben.'),
    customer: draft.job.customerId ? null : 'Bitte einen Kunden auswählen.',
    dates: draft.hasStart && draft.hasDue && draft.due < draft.start ? 'Das Fälligkeitsdatum liegt vor dem Startdatum.' : null,
  };
  const err = (k: keyof typeof errors) => (showErrors ? errors[k] : null);

  const conflicts = !existing && draft.schedule
    ? conflictsFor(draft.apStart, addMinutes(draft.apStart, draft.apMinutes), draft.job.assigneeId, null, data.appointments)
    : [];

  const persist = () => {
    const job: Job = {
      ...draft.job,
      title: draft.job.title.trim(),
      details: draft.job.details.trim(),
      internalNotes: draft.job.internalNotes.trim(),
      startDate: draft.hasStart ? draft.start.toISOString() : null,
      dueDate: draft.hasDue ? draft.due.toISOString() : null,
    };
    const appointment = !existing && draft.schedule
      ? {
        title: job.title,
        start: draft.apStart.toISOString(),
        end: addMinutes(draft.apStart, draft.apMinutes).toISOString(),
        location: siteAddress(data, job),
        notes: '',
        employeeId: job.assigneeId,
      }
      : undefined;
    const id = saveJob(job, appointment);
    close(id);
  };

  const save = () => {
    setShowErrors(true);
    if (Object.values(errors).some(Boolean)) return;
    if (conflicts.length) {
      const name = byId(data.employees, draft.job.assigneeId)?.name ?? 'Der Mitarbeiter';
      confirm('Terminüberschneidung', `${name} ist zu dieser Zeit bereits eingeplant.`, 'Trotzdem speichern', persist, false);
    } else {
      persist();
    }
  };

  return (
    <Sheet visible={visible} title={existing ? 'Auftrag bearbeiten' : 'Neuer Auftrag'} onCancel={useDirtyCancel(!same(draft, original), () => close())} onSave={save}>
      <Section title="Auftrag">
        <View>
          <FormInput
            placeholder="Titel, z. B. Heizungswartung"
            value={draft.job.title}
            onChangeText={(v) => setJob({ title: v })}
            right={
              <Pressable hitSlop={10} accessibilityLabel="Vorlage wählen" onPress={() => showActions('Vorlage', jobTemplates.map((t) => ({ label: t, onPress: () => setJob({ title: t }) })))}>
                <Icon name="list" size={22} color={c.accent} />
              </Pressable>
            }
          />
          <FieldError message={err('title')} />
        </View>
        <FormInput placeholder="Beschreibung" value={draft.job.details} onChangeText={(v) => setJob({ details: v })} multiline />
      </Section>

      <Section title="Kunde">
        <View>
          <Row chevron onPress={() => setPickingCustomer(true)}>
            {customer ? (
              <View>
                <Text style={{ fontSize: 17, color: c.text }}>{customerName(customer)}</Text>
                {addressOf(customer) ? <Text style={{ fontSize: 12, color: c.secondary }}>{addressOf(customer)}</Text> : null}
              </View>
            ) : (
              <Text style={{ fontSize: 17, color: c.accent }}>Kunde auswählen</Text>
            )}
          </Row>
          <FieldError message={err('customer')} />
        </View>
        {buildings.length > 0 ? (
          <SelectRow<string>
            label="Immobilie"
            value={draft.job.buildingId ?? ''}
            options={[{ value: '', label: 'Keine Angabe' }, ...buildings.map((b) => ({ value: b.id, label: b.name.trim() || buildingMeta[b.type].title }))]}
            onChange={(v) => setJob({ buildingId: v || null })}
          />
        ) : null}
      </Section>

      <Section title="Priorität und Status">
        <View style={{ padding: spacing.m }}>
          <Segmented
            values={priorityOrder.map((p) => priorityMeta[p].title)}
            index={priorityOrder.indexOf(draft.job.priority)}
            onChange={(i) => setJob({ priority: priorityOrder[i] as JobPriority })}
          />
        </View>
        <SelectRow<JobStatus>
          label="Status"
          value={draft.job.status}
          options={statusOrder.map((s) => ({ value: s, label: statusMeta[s].title }))}
          onChange={(s) => setJob({ status: s })}
        />
      </Section>

      <Section title="Planung" footer={employees.length === 0 ? 'Mitarbeiter legen Sie unter Einstellungen › Mitarbeiter an.' : undefined}>
        <SelectRow<string>
          label="Mitarbeiter"
          value={draft.job.assigneeId ?? ''}
          options={[{ value: '', label: 'Nicht zugewiesen' }, ...employees.map((e) => ({ value: e.id, label: e.name }))]}
          onChange={(v) => setJob({ assigneeId: v || null })}
        />
        <ToggleRow label="Startdatum" value={draft.hasStart} onChange={(v) => set({ hasStart: v })} />
        {draft.hasStart ? <DateRow label="Beginn" value={draft.start} onChange={(d) => set({ start: d })} /> : null}
        <ToggleRow label="Fälligkeitsdatum" value={draft.hasDue} onChange={(v) => set({ hasDue: v })} />
        {draft.hasDue ? <DateRow label="Fällig bis" value={draft.due} onChange={(d) => set({ due: d })} /> : null}
        {err('dates') ? <View style={{ paddingTop: spacing.s }}><FieldError message={err('dates')} /></View> : null}
      </Section>

      {!existing ? (
        <Section title="Termin">
          <ToggleRow label="Termin im Kalender eintragen" value={draft.schedule} onChange={(v) => set({ schedule: v })} />
          {draft.schedule ? <DateRow label="Beginn" mode="datetime" value={draft.apStart} onChange={(d) => set({ apStart: d })} /> : null}
          {draft.schedule ? (
            <SelectRow<number>
              label="Dauer"
              value={draft.apMinutes}
              options={durations.map((m) => ({ value: m, label: fmt.duration(m * 60) }))}
              onChange={(m) => set({ apMinutes: m })}
            />
          ) : null}
          {conflicts.length ? <ConflictWarning conflicts={conflicts} /> : null}
        </Section>
      ) : null}

      <Section title="Interne Notizen">
        <FormInput placeholder="Nur für Ihr Team sichtbar" value={draft.job.internalNotes} onChangeText={(v) => setJob({ internalNotes: v })} multiline />
      </Section>

      {pickingCustomer ? (
        <CustomerPicker
          selectedId={draft.job.customerId}
          onDone={(id) => {
            setPickingCustomer(false);
            if (id !== undefined && id !== draft.job.customerId) setJob({ customerId: id, buildingId: null });
          }}
        />
      ) : null}
    </Sheet>
  );
}

// MARK: - Kundenauswahl

export function CustomerPicker({ selectedId, onDone }: { selectedId: ID | null; onDone: (id?: ID) => void }) {
  const { c } = useTheme();
  const { data } = useStore();
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false);
  const { visible, close } = useSheet<ID>(onDone);
  const list = useMemo(
    () => data.customers.filter((cu) => customerMatches(cu, search)).sort((a, b) => compareName(customerName(a), customerName(b))),
    [data.customers, search],
  );

  return (
    <Sheet visible={visible} title="Kunde auswählen" onCancel={() => close()}>
      <SearchField value={search} onChange={setSearch} placeholder="Name, Firma, Ort" />
      <Section>
        <ActionRow icon="person-add-outline" label="Neuen Kunden anlegen" onPress={() => setCreating(true)} />
      </Section>
      {data.customers.length === 0 ? (
        <Text style={{ color: c.secondary, textAlign: 'center', marginTop: spacing.xl }}>Noch keine Kunden angelegt.</Text>
      ) : list.length === 0 ? (
        <Text style={{ color: c.secondary, textAlign: 'center', marginTop: spacing.xl }}>Keine Treffer für „{search}“.</Text>
      ) : (
        <Section>
          {list.map((cu) => (
            <Row key={cu.id} onPress={() => close(cu.id)}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={{ flex: 1 }}><CustomerRow customer={cu} /></View>
                {cu.id === selectedId ? <Icon name="checkmark" size={20} color={c.accent} /> : null}
              </View>
            </Row>
          ))}
        </Section>
      )}
      {creating ? (
        <CustomerForm
          onDone={(id) => {
            setCreating(false);
            if (id) close(id);
          }}
        />
      ) : null}
    </Sheet>
  );
}

// MARK: - Auftragsauswahl

export function JobPicker({ selectedId, onDone }: { selectedId: ID | null; onDone: (result?: { id: ID | null }) => void }) {
  const { c } = useTheme();
  const { data } = useStore();
  const [search, setSearch] = useState('');
  const { visible, close } = useSheet<{ id: ID | null }>(onDone);
  const list = data.jobs
    .filter((j) => (search.trim() ? true : isOpenStatus(j.status)))
    .filter((j) => jobMatches(data, j, search))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return (
    <Sheet visible={visible} title="Auftrag auswählen" onCancel={() => close()}>
      <SearchField value={search} onChange={setSearch} placeholder="Titel, Nummer, Kunde" />
      <Section>
        <Row onPress={() => close({ id: null })}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={{ fontSize: 17, color: c.text }}>Ohne Auftrag</Text>
            {selectedId === null ? <Icon name="checkmark" size={20} color={c.accent} /> : null}
          </View>
        </Row>
      </Section>
      {list.length === 0 ? (
        <Text style={{ color: c.secondary, textAlign: 'center', marginTop: spacing.xl, paddingHorizontal: spacing.xl }}>
          {search.trim() ? `Keine Treffer für „${search}“.` : 'Keine offenen Aufträge. Suchen Sie, um auch abgeschlossene Aufträge zu finden.'}
        </Text>
      ) : (
        <Section title={search.trim() ? 'Suchergebnisse' : 'Offene Aufträge'}>
          {list.map((j) => (
            <Row key={j.id} onPress={() => close({ id: j.id })}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.s }}>
                <View style={{ flex: 1 }}><JobRow job={j} /></View>
                {j.id === selectedId ? <Icon name="checkmark" size={20} color={c.accent} /> : null}
              </View>
            </Row>
          ))}
        </Section>
      )}
    </Sheet>
  );
}

export function SearchField({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  const { c } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginHorizontal: spacing.l, marginTop: spacing.m, paddingHorizontal: 10, height: 38, borderRadius: 10, backgroundColor: c.fill }}>
      <Icon name="search" size={17} color={c.secondary} />
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={c.secondary}
        style={{ flex: 1, fontSize: 17, color: c.text }}
        clearButtonMode="while-editing"
        autoCorrect={false}
        returnKeyType="search"
      />
    </View>
  );
}

// MARK: - Arbeitszeit

export function TimeEntryForm({ jobId, entryId, onDone }: { jobId: ID; entryId?: ID; onDone: () => void }) {
  const { data, saveTimeEntry } = useStore();
  const job = byId(data.jobs, jobId);
  const existing = byId(data.timeEntries, entryId);
  const [employeeId, setEmployeeId] = useState<ID | null>(existing ? existing.employeeId : job?.assigneeId ?? null);
  const [start, setStart] = useState(existing ? new Date(existing.start) : addMinutes(new Date(), -60));
  const [end, setEnd] = useState(existing?.end ? new Date(existing.end) : new Date());
  const [breakMinutes, setBreak] = useState(existing?.breakMinutes ?? 0);
  const [note, setNote] = useState(existing?.note ?? '');
  const [showErrors, setShowErrors] = useState(false);
  const { visible, close } = useSheet<void>(() => onDone());

  const span = (end.getTime() - start.getTime()) / 1000;
  const net = Math.max(0, span - breakMinutes * 60);
  let error: string | null = null;
  if (span <= 0) error = 'Das Ende muss nach dem Beginn liegen.';
  else if (span > 24 * 3600) error = 'Ein Eintrag darf höchstens 24 Stunden umfassen.';
  else if (breakMinutes * 60 >= span) error = 'Die Pause ist länger als der Zeitraum.';
  else if (end.getTime() > Date.now() + 5 * 60000) error = 'Arbeitszeit kann nicht in der Zukunft liegen.';

  const save = () => {
    setShowErrors(true);
    if (error) return;
    const entry: TimeEntry = {
      id: existing?.id ?? uid(), jobId, employeeId, start: start.toISOString(), end: end.toISOString(),
      breakMinutes, note: note.trim(), createdAt: existing?.createdAt ?? nowISO(),
    };
    saveTimeEntry(entry);
    close();
  };

  const employees = data.employees.slice().sort((a, b) => compareName(a.name, b.name));

  return (
    <Sheet visible={visible} title={existing ? 'Zeit bearbeiten' : 'Zeit nachtragen'} onCancel={() => close()} onSave={save}>
      <Section>
        <SelectRow<string>
          label="Mitarbeiter"
          value={employeeId ?? ''}
          options={[{ value: '', label: 'Nicht zugeordnet' }, ...employees.map((e) => ({ value: e.id, label: e.name }))]}
          onChange={(v) => setEmployeeId(v || null)}
        />
      </Section>
      <Section title="Zeitraum" footer={`Arbeitszeit netto: ${fmt.duration(net)}`}>
        <DateRow label="Beginn" mode="datetime" value={start} onChange={setStart} />
        <DateRow label="Ende" mode="datetime" value={end} onChange={setEnd} />
        <BreakRow minutes={breakMinutes} onChange={setBreak} />
        {showErrors && error ? <View style={{ paddingTop: spacing.s }}><FieldError message={error} /></View> : null}
      </Section>
      <Section title="Tätigkeit">
        <FormInput placeholder="z. B. Fehlersuche am Brenner" value={note} onChangeText={setNote} multiline />
      </Section>
    </Sheet>
  );
}

function BreakRow({ minutes, onChange }: { minutes: number; onChange: (m: number) => void }) {
  const { c } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.l, paddingVertical: 8, minHeight: 44 }}>
      <Text style={{ fontSize: 17, color: c.text, flex: 1 }}>Pause</Text>
      <Text style={{ fontSize: 17, color: c.secondary, marginRight: spacing.m, fontVariant: ['tabular-nums'] }}>{minutes} Min.</Text>
      <StepperButtons onDecrement={() => onChange(Math.max(0, minutes - 5))} onIncrement={() => onChange(Math.min(240, minutes + 5))} />
    </View>
  );
}

// MARK: - Material

export function MaterialForm({ jobId, itemId, onDone }: { jobId: ID; itemId?: ID; onDone: () => void }) {
  const { c } = useTheme();
  const { data, saveMaterial } = useStore();
  const existing = byId(data.materials, itemId);
  const [name, setName] = useState(existing?.name ?? '');
  const [articleNumber, setArticle] = useState(existing?.articleNumber ?? '');
  const [quantityText, setQuantityText] = useState(existing ? fmt.decimal(existing.quantity) : '1');
  const [unit, setUnit] = useState(existing?.unit ?? 'Stk.');
  const [priceText, setPriceText] = useState(existing?.unitPrice != null ? fmt.decimal(existing.unitPrice) : '');
  const [showErrors, setShowErrors] = useState(false);
  const { visible, close } = useSheet<void>(() => onDone());

  const suggestions = useMemo(() => {
    const seen = new Set<string>();
    return data.materials
      .slice()
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .filter((m) => {
        const key = m.name.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, 20);
  }, [data.materials]);

  const quantity = parseDecimal(quantityText);
  const price = priceText.trim() ? parseDecimal(priceText) : null;
  const errors = {
    name: validate.required(name, 'Bitte eine Bezeichnung eingeben.'),
    quantity: quantity === null || quantity <= 0 ? 'Bitte eine Menge größer als 0 eingeben.' : null,
    price: priceText.trim() && (price === null || price < 0) ? 'Bitte einen gültigen Preis eingeben, z. B. 12,50.' : null,
  };
  const err = (k: keyof typeof errors) => (showErrors ? errors[k] : null);

  const applySuggestion = (m: MaterialItem) => {
    setName(m.name);
    setArticle(m.articleNumber);
    setUnit(m.unit);
    setPriceText(m.unitPrice != null ? fmt.decimal(m.unitPrice) : '');
  };

  const save = () => {
    setShowErrors(true);
    if (Object.values(errors).some(Boolean) || quantity === null) return;
    saveMaterial({
      id: existing?.id ?? uid(), jobId, name: name.trim(), articleNumber: articleNumber.trim(), quantity, unit,
      unitPrice: price, createdAt: existing?.createdAt ?? nowISO(),
    });
    close();
  };

  return (
    <Sheet visible={visible} title={existing ? 'Material bearbeiten' : 'Material erfassen'} onCancel={() => close()} onSave={save}>
      <Section title="Material">
        <View>
          <FormInput placeholder="Bezeichnung, z. B. Kupferrohr 15 mm" value={name} onChangeText={setName} />
          <FieldError message={err('name')} />
        </View>
        <FormInput placeholder="Artikelnummer (optional)" value={articleNumber} onChangeText={setArticle} autoCapitalize="characters" />
        {!existing && suggestions.length > 0 ? (
          <ActionRow
            icon="time-outline"
            label="Zuletzt verwendet"
            onPress={() => showActions('Zuletzt verwendet', suggestions.map((s) => ({ label: s.name, onPress: () => applySuggestion(s) })))}
          />
        ) : null}
      </Section>
      <Section title="Menge">
        <View>
          <FormInput
            placeholder="Menge"
            value={quantityText}
            onChangeText={setQuantityText}
            keyboardType="decimal-pad"
            right={
              <StepperButtons
                onDecrement={() => setQuantityText(fmt.decimal(Math.max(0, (quantity ?? 0) - 1)))}
                onIncrement={() => setQuantityText(fmt.decimal((quantity ?? 0) + 1))}
              />
            }
          />
          <FieldError message={err('quantity')} />
        </View>
        <SelectRow<string> label="Einheit" value={unit} options={materialUnits.map((u) => ({ value: u, label: u }))} onChange={setUnit} />
      </Section>
      <Section title="Preis">
        <View>
          <FormInput
            placeholder="Einzelpreis (optional)"
            value={priceText}
            onChangeText={setPriceText}
            keyboardType="decimal-pad"
            right={<Text style={{ color: c.secondary, fontSize: 17 }}>€</Text>}
          />
          <FieldError message={err('price')} />
        </View>
        {price && quantity && price > 0 && quantity > 0 ? (
          <Row><LabeledValue label="Gesamt" value={fmt.currency(price * quantity)} /></Row>
        ) : null}
      </Section>
    </Sheet>
  );
}

// MARK: - Termin

const quickDurations = [
  { label: '30 Min.', minutes: 30 },
  { label: '1 Std.', minutes: 60 },
  { label: '2 Std.', minutes: 120 },
  { label: '4 Std.', minutes: 240 },
  { label: '8 Std.', minutes: 480 },
];

export function AppointmentForm({
  appointmentId, presetStart, presetJobId, onDone,
}: { appointmentId?: ID; presetStart?: Date; presetJobId?: ID; onDone: () => void }) {
  const { c } = useTheme();
  const { data, saveAppointment } = useStore();
  const existing = byId(data.appointments, appointmentId);
  const [original] = useState<Appointment>(() => {
    if (existing) return existing;
    const start = presetStart ?? roundToNextQuarter(new Date());
    const job = byId(data.jobs, presetJobId);
    return {
      id: uid(),
      title: job?.title ?? '',
      start: start.toISOString(),
      end: addMinutes(start, data.settings.defaultDuration).toISOString(),
      location: job ? siteAddress(data, job) : '',
      notes: '',
      employeeId: job?.assigneeId ?? null,
      jobId: job?.id ?? null,
      createdAt: nowISO(),
    };
  });
  const [draft, setDraft] = useState<Appointment>(original);
  const [showErrors, setShowErrors] = useState(false);
  const [pickingJob, setPickingJob] = useState(false);
  const { visible, close } = useSheet<void>(() => onDone());
  const set = (patch: Partial<Appointment>) => setDraft((d) => ({ ...d, ...patch }));

  const start = new Date(draft.start);
  const end = new Date(draft.end);
  const minutes = Math.round((end.getTime() - start.getTime()) / 60000);
  const employees = activeEmployees(data);
  const currentEmployee = byId(data.employees, draft.employeeId);
  const employeeOptions = [
    { value: '', label: 'Nicht zugewiesen' },
    ...employees.map((e) => ({ value: e.id, label: e.name })),
    ...(currentEmployee && !currentEmployee.isActive ? [{ value: currentEmployee.id, label: currentEmployee.name }] : []),
  ];
  const job = byId(data.jobs, draft.jobId);
  const conflicts = conflictsFor(start, end, draft.employeeId, existing?.id ?? null, data.appointments);

  const errors = {
    title: validate.required(draft.title, 'Bitte einen Titel eingeben.'),
    time: end <= start ? 'Das Ende muss nach dem Beginn liegen.' : minutes > 7 * 24 * 60 ? 'Ein Termin darf höchstens 7 Tage dauern.' : null,
  };
  const err = (k: keyof typeof errors) => (showErrors ? errors[k] : null);

  const setStart = (d: Date) => {
    // Dauer beim Verschieben des Beginns beibehalten
    const duration = Math.max(15, minutes);
    set({ start: d.toISOString(), end: addMinutes(d, duration).toISOString() });
  };

  const persist = () => {
    saveAppointment({ ...draft, title: draft.title.trim(), location: draft.location.trim(), notes: draft.notes.trim() });
    close();
  };

  const save = () => {
    setShowErrors(true);
    if (Object.values(errors).some(Boolean)) return;
    if (conflicts.length) {
      confirm('Terminüberschneidung', `${currentEmployee?.name ?? 'Der Mitarbeiter'} ist zu dieser Zeit bereits eingeplant.`, 'Trotzdem speichern', persist, false);
    } else {
      persist();
    }
  };

  return (
    <Sheet visible={visible} title={existing ? 'Termin bearbeiten' : 'Neuer Termin'} onCancel={useDirtyCancel(!same(draft, original), () => close())} onSave={save}>
      <Section>
        <View>
          <FormInput placeholder="Titel, z. B. Wartung Gastherme" value={draft.title} onChangeText={(v) => set({ title: v })} />
          <FieldError message={err('title')} />
        </View>
      </Section>

      <Section title="Zeit">
        <DateRow label="Beginn" mode="datetime" value={start} onChange={setStart} />
        <DateRow label="Ende" mode="datetime" value={end} minimumDate={start} onChange={(d) => set({ end: d.toISOString() })} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.s, padding: spacing.m }}>
          {quickDurations.map((q) => {
            const active = q.minutes === minutes;
            return (
              <Pressable
                key={q.minutes}
                onPress={() => set({ end: addMinutes(start, q.minutes).toISOString() })}
                style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 99, backgroundColor: active ? c.accent : alpha(c.accent, 0.1) }}
              >
                <Text style={{ fontSize: 13, fontWeight: '500', color: active ? '#FFFFFF' : c.accent }}>{q.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
        {err('time') ? <View style={{ paddingTop: spacing.s }}><FieldError message={err('time')} /></View> : null}
      </Section>

      <Section title="Zuordnung">
        <SelectRow<string> label="Mitarbeiter" value={draft.employeeId ?? ''} options={employeeOptions} onChange={(v) => set({ employeeId: v || null })} />
        {conflicts.length ? <ConflictWarning conflicts={conflicts} /> : null}
        <Row chevron onPress={() => setPickingJob(true)}>
          <LabeledValue label="Auftrag" value={job ? `${fmt.jobNumber(job.number)} ${job.title}` : 'Ohne Auftrag'} />
        </Row>
      </Section>

      <Section title="Ort und Notizen">
        <FormInput placeholder="Adresse" value={draft.location} onChangeText={(v) => set({ location: v })} textContentType="fullStreetAddress" />
        <FormInput placeholder="Notizen" value={draft.notes} onChangeText={(v) => set({ notes: v })} multiline />
      </Section>

      {pickingJob ? (
        <JobPicker
          selectedId={draft.jobId}
          onDone={(result) => {
            setPickingJob(false);
            if (!result) return;
            const picked = byId(data.jobs, result.id);
            setDraft((d) => ({
              ...d,
              jobId: result.id,
              title: picked && isBlank(d.title) ? picked.title : d.title,
              location: picked && isBlank(d.location) ? siteAddress(data, picked) : d.location,
              employeeId: picked && !d.employeeId ? picked.assigneeId : d.employeeId,
            }));
          }}
        />
      ) : null}
    </Sheet>
  );
}

// MARK: - Mitarbeiter

const roles = ['Meister', 'Geselle', 'Monteur', 'Kundendienst', 'Auszubildender', 'Büro'];

export function EmployeeForm({ employeeId, onDone }: { employeeId?: ID; onDone: () => void }) {
  const { c } = useTheme();
  const { data, saveEmployee } = useStore();
  const existing = byId(data.employees, employeeId);
  const [draft, setDraft] = useState<Employee>(() => {
    if (existing) return existing;
    const used = data.employees.map((e) => e.colorHex);
    return {
      id: uid(), name: '', role: '', phone: '', isActive: true, createdAt: nowISO(),
      colorHex: employeePalette.find((p) => !used.includes(p)) ?? employeePalette[0],
    };
  });
  const [showErrors, setShowErrors] = useState(false);
  const { visible, close } = useSheet<void>(() => onDone());
  const set = (patch: Partial<Employee>) => setDraft((d) => ({ ...d, ...patch }));

  const errors = { name: validate.required(draft.name, 'Bitte einen Namen eingeben.'), phone: validate.phone(draft.phone) };

  const save = () => {
    setShowErrors(true);
    if (errors.name || errors.phone) return;
    saveEmployee({ ...draft, name: draft.name.trim(), role: draft.role.trim(), phone: draft.phone.trim() });
    close();
  };

  return (
    <Sheet visible={visible} title={existing ? 'Mitarbeiter bearbeiten' : 'Neuer Mitarbeiter'} onCancel={() => close()} onSave={save}>
      <Section>
        <View>
          <FormInput placeholder="Name" value={draft.name} onChangeText={(v) => set({ name: v })} textContentType="name" autoFocus={!existing} />
          <FieldError message={showErrors ? errors.name : null} />
        </View>
        <FormInput
          placeholder="Funktion, z. B. Monteur"
          value={draft.role}
          onChangeText={(v) => set({ role: v })}
          right={
            <Pressable hitSlop={10} accessibilityLabel="Funktion wählen" onPress={() => showActions('Funktion', roles.map((r) => ({ label: r, onPress: () => set({ role: r }) })))}>
              <Icon name="list" size={22} color={c.accent} />
            </Pressable>
          }
        />
        <View>
          <FormInput placeholder="Telefon (optional)" value={draft.phone} onChangeText={(v) => set({ phone: v })} keyboardType="phone-pad" textContentType="telephoneNumber" />
          <FieldError message={showErrors ? errors.phone : null} />
        </View>
      </Section>
      <Section title="Farbe im Kalender">
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', padding: spacing.m, rowGap: spacing.m }}>
          {employeePalette.map((hex) => {
            const selected = hex === draft.colorHex;
            return (
              <View key={hex} style={{ width: '20%', alignItems: 'center' }}>
                <Pressable
                  onPress={() => set({ colorHex: hex })}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  accessibilityLabel={`Farbe ${hex}`}
                  style={{ width: 44, height: 44, borderRadius: 22, borderWidth: 2, borderColor: selected ? hex : 'transparent', alignItems: 'center', justifyContent: 'center' }}
                >
                  <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: hex, alignItems: 'center', justifyContent: 'center' }}>
                    {selected ? <Icon name="checkmark" size={18} color="#FFFFFF" /> : null}
                  </View>
                </Pressable>
              </View>
            );
          })}
        </View>
      </Section>
      {existing ? (
        <Section footer="Inaktive Mitarbeiter werden bei neuen Aufträgen und Terminen nicht mehr angeboten.">
          <ToggleRow label="Aktiv" value={draft.isActive} onChange={(v) => set({ isActive: v })} />
        </Section>
      ) : null}
    </Sheet>
  );
}
