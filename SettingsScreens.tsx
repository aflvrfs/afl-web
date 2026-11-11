import React, { useEffect, useLayoutEffect, useState } from 'react';
import { Alert, Text, TextInput, View } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import Constants from 'expo-constants';
import { useStore } from './store';
import { spacing, useTheme } from './theme';
import type { Employee } from './types';
import { ActionRow, confirm, EmptyState, HeaderButton, LabeledValue, Row, Screen, Section, SelectRow, showActions, ToggleRow } from './ui';
import { EmployeeForm } from './forms';
import { EmployeeRow, useNav } from './rows';
import { compareName, fmt } from './utils';
import { biometryName } from './AppLock';

function SettingsInput({ value, placeholder, onCommit, textContentType }: { value: string; placeholder: string; onCommit: (v: string) => void; textContentType?: 'name' | 'organizationName' }) {
  const { c } = useTheme();
  const [text, setText] = useState(value);
  useEffect(() => setText(value), [value]);
  return (
    <TextInput
      value={text}
      onChangeText={setText}
      onEndEditing={() => onCommit(text.trim())}
      placeholder={placeholder}
      placeholderTextColor={c.tertiary}
      textContentType={textContentType}
      returnKeyType="done"
      style={{ fontSize: 17, color: c.text, paddingHorizontal: spacing.l, paddingVertical: 12, minHeight: 44 }}
    />
  );
}

export function SettingsScreen() {
  const navigation = useNav();
  const { data, updateSettings, deleteAllData } = useStore();
  const { settings } = data;
  const [bioName, setBioName] = useState('Face ID');

  useEffect(() => {
    biometryName().then(setBioName);
  }, []);

  const hours = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => from + i);
  const activeCount = data.employees.filter((e) => e.isActive).length;

  const toggleLock = async (value: boolean) => {
    if (!value) {
      updateSettings({ appLock: false });
      return;
    }
    const enrolled = await LocalAuthentication.isEnrolledAsync().catch(() => false);
    const level = await LocalAuthentication.getEnrolledLevelAsync().catch(() => LocalAuthentication.SecurityLevel.NONE);
    if (!enrolled && level === LocalAuthentication.SecurityLevel.NONE) {
      Alert.alert('App-Sperre nicht möglich', 'Richten Sie zuerst einen Gerätecode in den iOS-Einstellungen ein.');
      return;
    }
    const result = await LocalAuthentication.authenticateAsync({ promptMessage: 'App-Sperre für SHK Pro aktivieren', cancelLabel: 'Abbrechen' });
    if (result.success) updateSettings({ appLock: true });
  };

  const deleteEverything = () =>
    confirm('Alle Daten löschen?', 'Kunden, Aufträge, Termine, Fotos und Mitarbeiter werden von diesem Gerät entfernt.', 'Weiter', () =>
      setTimeout(
        () =>
          confirm('Wirklich alles löschen?', 'Dieser Schritt kann nicht rückgängig gemacht werden.', 'Endgültig löschen', () => {
            deleteAllData()
              .then(() => Alert.alert('Erledigt', 'Alle Daten wurden gelöscht.'))
              .catch(() => Alert.alert('Fehler', 'Die Daten konnten nicht vollständig gelöscht werden. Bitte erneut versuchen.'));
          }),
        300,
      ),
    );

  return (
    <Screen>
      <Section title="Profil" footer="Ihr Vorname wird für die Begrüßung im Dashboard verwendet.">
        <SettingsInput value={settings.userName} placeholder="Ihr Name" textContentType="name" onCommit={(v) => updateSettings({ userName: v })} />
        <SettingsInput value={settings.companyName} placeholder="Firmenname" textContentType="organizationName" onCommit={(v) => updateSettings({ companyName: v })} />
      </Section>

      <Section title="Team">
        <Row chevron onPress={() => navigation.navigate('Employees')}>
          <LabeledValue label="Mitarbeiter" value={activeCount === 1 ? '1 aktiv' : `${activeCount} aktiv`} />
        </Row>
      </Section>

      <Section title="Arbeitszeiten" footer="Zeiten außerhalb der Arbeitszeit werden im Kalender abgesetzt dargestellt.">
        <SelectRow<number>
          label="Arbeitsbeginn"
          value={settings.workdayStart}
          options={hours(4, 12).map((h) => ({ value: h, label: fmt.hour(h) }))}
          onChange={(h) => updateSettings({ workdayStart: h, workdayEnd: settings.workdayEnd <= h ? Math.min(23, h + 1) : settings.workdayEnd })}
        />
        <SelectRow<number>
          label="Arbeitsende"
          value={settings.workdayEnd}
          options={hours(12, 23).map((h) => ({ value: h, label: fmt.hour(h) }))}
          onChange={(h) => updateSettings({ workdayEnd: h, workdayStart: h <= settings.workdayStart ? Math.max(4, h - 1) : settings.workdayStart })}
        />
        <SelectRow<number>
          label="Standard-Termindauer"
          value={settings.defaultDuration}
          options={[30, 45, 60, 90, 120, 180, 240].map((m) => ({ value: m, label: fmt.duration(m * 60) }))}
          onChange={(m) => updateSettings({ defaultDuration: m })}
        />
      </Section>

      <Section
        title="Datenschutz"
        footer="Alle Daten werden ausschließlich lokal auf diesem Gerät gespeichert und durch die iOS-Datenverschlüsselung geschützt. Es findet keine Übertragung an Dritte statt. Beim Wechsel in den App-Umschalter werden Inhalte ausgeblendet."
      >
        <ToggleRow label={`App mit ${bioName} sperren`} icon="lock-closed-outline" value={settings.appLock} onChange={toggleLock} />
      </Section>

      <Section title="Daten">
        <Row><LabeledValue label="Kunden" value={`${data.customers.length}`} /></Row>
        <Row><LabeledValue label="Aufträge" value={`${data.jobs.length}`} /></Row>
        <Row><LabeledValue label="Termine" value={`${data.appointments.length}`} /></Row>
        <Row><LabeledValue label="Fotos" value={`${data.photos.length}`} /></Row>
        <ActionRow icon="trash-outline" label="Alle Daten löschen" destructive onPress={deleteEverything} />
      </Section>

      <Section>
        <Row><LabeledValue label="Version" value={Constants.expoConfig?.version ?? '1.0.0'} /></Row>
      </Section>
    </Screen>
  );
}

export function EmployeesScreen() {
  const navigation = useNav();
  const { data, deleteEmployee } = useStore();
  const [sheet, setSheet] = useState<{ id?: string } | null>(null);
  const sorted = [...data.employees].sort((a, b) => compareName(a.name, b.name));
  const active = sorted.filter((e) => e.isActive);
  const inactive = sorted.filter((e) => !e.isActive);
  const { c } = useTheme();

  useLayoutEffect(() => {
    navigation.setOptions({
      title: 'Mitarbeiter',
      headerRight: () => <HeaderButton icon="add" accessibilityLabel="Mitarbeiter hinzufügen" onPress={() => setSheet({})} />,
    });
  }, [navigation]);

  const menu = (e: Employee) =>
    showActions(e.name, [
      { label: 'Bearbeiten', onPress: () => setSheet({ id: e.id }) },
      {
        label: 'Löschen',
        destructive: true,
        onPress: () =>
          confirm(
            'Mitarbeiter löschen?',
            `${e.name} wird entfernt. Zugewiesene Aufträge und Termine bleiben erhalten, sind danach aber niemandem zugeordnet. Tipp: Stattdessen auf „inaktiv“ setzen.`,
            'Löschen',
            () => deleteEmployee(e.id),
          ),
      },
    ]);

  return (
    <Screen>
      {data.employees.length === 0 ? (
        <EmptyState
          icon="people-outline"
          title="Noch keine Mitarbeiter"
          message="Mitarbeiter können Aufträgen und Terminen zugewiesen werden und erhalten im Kalender eine eigene Farbe."
          actionTitle="Mitarbeiter anlegen"
          onAction={() => setSheet({})}
        />
      ) : (
        <>
          <Section title="Aktiv" footer="Tippen zum Bearbeiten, gedrückt halten zum Löschen.">
            {active.length === 0 ? <Row><Text style={{ color: c.secondary, fontSize: 17 }}>Keine aktiven Mitarbeiter</Text></Row> : null}
            {active.map((e) => (
              <Row key={e.id} onPress={() => setSheet({ id: e.id })} onLongPress={() => menu(e)}><EmployeeRow employee={e} /></Row>
            ))}
          </Section>
          {inactive.length ? (
            <Section title="Inaktiv" footer="Inaktive Mitarbeiter erscheinen nicht mehr in der Auswahl, bleiben aber in bestehenden Aufträgen erhalten.">
              {inactive.map((e) => (
                <Row key={e.id} onPress={() => setSheet({ id: e.id })} onLongPress={() => menu(e)}><EmployeeRow employee={e} /></Row>
              ))}
            </Section>
          ) : null}
        </>
      )}
      <View />
      {sheet && <EmployeeForm employeeId={sheet.id} onDone={() => setSheet(null)} />}
    </Screen>
  );
}
