import React, { useLayoutEffect, useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useStore } from './store';
import { alpha, buildingMeta, isOpenStatus, spacing, useTheme } from './theme';
import type { Customer } from './types';
import {
  ActionRow, Avatar, confirm, ContactButton, EmptyState, FilterChip, HeaderButton, Icon, InfoRow, openLink, Row, Screen, Section,
  showActions,
} from './ui';
import { BuildingForm, CustomerForm, JobForm } from './forms';
import { BuildingRow, CustomerRow, JobRow, StackParams, useNav } from './rows';
import {
  addressOf, buildingName, buildingsOfCustomer, byId, cityLine, compareName, customerMatches, customerName, fmt, fullName,
  isBlank, jobsOfCustomer, links, openJobCount,
} from './utils';

type Filter = 'all' | 'openJobs' | 'business' | 'private';
const filterTitles: Record<Filter, string> = {
  all: 'Alle Kunden',
  openJobs: 'Mit offenen Aufträgen',
  business: 'Gewerbekunden',
  private: 'Privatkunden',
};

export function deletionMessage(data: ReturnType<typeof useStore>['data'], customer: Customer): string {
  const jobs = jobsOfCustomer(data, customer.id).length;
  const buildings = buildingsOfCustomer(data, customer.id).length;
  const parts: string[] = [];
  if (jobs) parts.push(jobs === 1 ? '1 Auftrag' : `${jobs} Aufträge`);
  if (buildings) parts.push(buildings === 1 ? '1 Immobilie' : `${buildings} Immobilien`);
  return parts.length
    ? `${customerName(customer)} wird dauerhaft gelöscht – einschließlich ${parts.join(' und ')}.`
    : `${customerName(customer)} wird dauerhaft gelöscht.`;
}

// MARK: - Liste

export function CustomerListScreen() {
  const navigation = useNav();
  const { data, deleteCustomer } = useStore();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [sort, setSort] = useState<'name' | 'newest'>('name');
  const [creating, setCreating] = useState(false);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerSearchBarOptions: {
        placeholder: 'Name, Firma, Ort oder Telefon',
        hideWhenScrolling: false,
        cancelButtonText: 'Abbrechen',
        onChangeText: (e) => setSearch(e.nativeEvent.text),
        onCancelButtonPress: () => setSearch(''),
      },
      headerRight: () => (
        <View style={{ flexDirection: 'row', gap: 18 }}>
          <HeaderButton
            icon={filter === 'all' ? 'filter-circle-outline' : 'filter-circle'}
            accessibilityLabel="Filtern und sortieren"
            onPress={() =>
              showActions('Filtern und sortieren', [
                ...(Object.keys(filterTitles) as Filter[]).map((f) => ({ label: `${f === filter ? '✓ ' : ''}${filterTitles[f]}`, onPress: () => setFilter(f) })),
                { label: `${sort === 'name' ? '✓ ' : ''}Sortieren nach Name`, onPress: () => setSort('name') },
                { label: `${sort === 'newest' ? '✓ ' : ''}Zuletzt angelegt zuerst`, onPress: () => setSort('newest') },
              ])
            }
          />
          <HeaderButton icon="add" accessibilityLabel="Neuer Kunde" onPress={() => setCreating(true)} />
        </View>
      ),
    });
  }, [navigation, filter, sort]);

  const list = useMemo(() => {
    let result = data.customers.filter((cu) => customerMatches(cu, search));
    if (filter === 'openJobs') result = result.filter((cu) => openJobCount(data, cu.id) > 0);
    if (filter === 'business') result = result.filter((cu) => !isBlank(cu.company));
    if (filter === 'private') result = result.filter((cu) => isBlank(cu.company));
    return result.sort((a, b) => (sort === 'name' ? compareName(customerName(a), customerName(b)) : b.createdAt.localeCompare(a.createdAt)));
  }, [data, search, filter, sort]);

  const onLongPress = (customer: Customer) =>
    showActions(customerName(customer), [
      { label: 'Bearbeiten', onPress: () => navigation.navigate('CustomerDetail', { id: customer.id }) },
      { label: 'Kunde löschen', destructive: true, onPress: () => confirm('Kunde löschen?', deletionMessage(data, customer), 'Löschen', () => deleteCustomer(customer.id)) },
    ]);

  return (
    <Screen>
      {filter !== 'all' && (
        <View style={{ flexDirection: 'row', paddingHorizontal: spacing.l, paddingTop: spacing.m }}>
          <FilterChip title={filterTitles[filter]} onRemove={() => setFilter('all')} />
        </View>
      )}
      {data.customers.length === 0 ? (
        <EmptyState
          icon="people-outline"
          title="Noch keine Kunden"
          message="Legen Sie Ihren ersten Kunden an, um Aufträge und Termine zuzuordnen."
          actionTitle="Kunden anlegen"
          onAction={() => setCreating(true)}
        />
      ) : list.length === 0 ? (
        <EmptyState
          icon={search ? 'search' : 'filter-outline'}
          title="Keine Treffer"
          message={search ? `Kein Kunde passt zu „${search}“.` : `Kein Kunde entspricht dem Filter „${filterTitles[filter]}“.`}
        />
      ) : (
        <Section footer={list.length === 1 ? '1 Kunde' : `${list.length} Kunden`}>
          {list.map((cu) => (
            <Row key={cu.id} chevron onPress={() => navigation.navigate('CustomerDetail', { id: cu.id })} onLongPress={() => onLongPress(cu)}>
              <CustomerRow customer={cu} />
            </Row>
          ))}
        </Section>
      )}
      {creating && <CustomerForm onDone={() => setCreating(false)} />}
    </Screen>
  );
}

// MARK: - Detail

export function CustomerDetailScreen({ route }: NativeStackScreenProps<StackParams, 'CustomerDetail'>) {
  const { c } = useTheme();
  const navigation = useNav();
  const { data, deleteCustomer } = useStore();
  const customer = byId(data.customers, route.params.id);
  const [sheet, setSheet] = useState<'edit' | 'building' | 'job' | null>(null);

  useLayoutEffect(() => {
    navigation.setOptions({
      title: customer ? customerName(customer) : 'Kunde',
      headerRight: () => (customer ? <HeaderButton title="Bearbeiten" onPress={() => setSheet('edit')} /> : null),
    });
  }, [navigation, customer]);

  if (!customer) {
    return <Screen><EmptyState icon="person-outline" title="Kunde nicht gefunden" message="Dieser Kunde wurde gelöscht." /></Screen>;
  }

  const name = customerName(customer);
  const buildings = buildingsOfCustomer(data, customer.id);
  const jobs = jobsOfCustomer(data, customer.id);
  const openJobs = jobs.filter((j) => isOpenStatus(j.status));
  const closedJobs = jobs.filter((j) => !isOpenStatus(j.status));
  const address = addressOf(customer);
  const copy = (text: string) => showActions(undefined, [{ label: 'Kopieren', onPress: () => Clipboard.setStringAsync(text) }]);

  return (
    <Screen>
      <View style={{ paddingHorizontal: spacing.l, paddingTop: spacing.l, gap: spacing.l }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.l }}>
          <Avatar name={name} size={60} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 22, fontWeight: '600', color: c.text }}>{name}</Text>
            {!isBlank(customer.company) && fullName(customer) ? <Text style={{ fontSize: 15, color: c.secondary }}>{customer.company}</Text> : null}
          </View>
        </View>
        <View style={{ flexDirection: 'row', gap: spacing.s }}>
          <ContactButton title="Anrufen" icon="call" url={links.phone(customer.phone)} />
          <ContactButton title="E-Mail" icon="mail" url={links.email(customer.email)} />
          <ContactButton title="Route" icon="car" url={links.maps(address)} />
        </View>
      </View>

      <Section title="Kontakt">
        {isBlank(customer.phone) && isBlank(customer.email) && !address ? (
          <Row><Text style={{ color: c.secondary, fontSize: 17 }}>Keine Kontaktdaten hinterlegt</Text></Row>
        ) : null}
        {!isBlank(customer.phone) ? (
          <Row onPress={() => openLink(links.phone(customer.phone))} onLongPress={() => copy(customer.phone)}>
            <InfoRow icon="call-outline" title="Telefon" value={customer.phone} />
          </Row>
        ) : null}
        {!isBlank(customer.email) ? (
          <Row onPress={() => openLink(links.email(customer.email))} onLongPress={() => copy(customer.email)}>
            <InfoRow icon="mail-outline" title="E-Mail" value={customer.email} />
          </Row>
        ) : null}
        {address ? (
          <Row onPress={() => openLink(links.maps(address))} onLongPress={() => copy(address)}>
            <InfoRow icon="location-outline" title="Anschrift" value={[customer.street, cityLine(customer)].filter((s) => !isBlank(s)).join('\n')} />
          </Row>
        ) : null}
      </Section>

      <Section title="Immobilien">
        {buildings.map((b) => (
          <Row key={b.id} chevron onPress={() => navigation.navigate('BuildingDetail', { id: b.id })}>
            <BuildingRow building={b} />
          </Row>
        ))}
        <ActionRow icon="add" label="Immobilie hinzufügen" onPress={() => setSheet('building')} />
      </Section>

      <Section title="Auftragshistorie" right={`${jobs.length}`}>
        <ActionRow icon="add" label="Neuer Auftrag" onPress={() => setSheet('job')} />
        {[...openJobs, ...closedJobs].map((j) => (
          <Row key={j.id} chevron onPress={() => navigation.navigate('JobDetail', { id: j.id })}>
            <JobRow job={j} showCustomer={false} />
          </Row>
        ))}
      </Section>

      {!isBlank(customer.notes) ? (
        <Section title="Notizen">
          <Row><Text selectable style={{ fontSize: 17, color: c.text }}>{customer.notes}</Text></Row>
        </Section>
      ) : null}

      <Section footer={`Kunde seit ${fmt.date(new Date(customer.createdAt))}`}>
        <ActionRow
          icon="trash-outline"
          label="Kunde löschen"
          destructive
          onPress={() =>
            confirm('Kunde löschen?', deletionMessage(data, customer), 'Löschen', () => {
              navigation.goBack();
              setTimeout(() => deleteCustomer(customer.id), 350);
            })
          }
        />
      </Section>

      {sheet === 'edit' && <CustomerForm customerId={customer.id} onDone={() => setSheet(null)} />}
      {sheet === 'building' && <BuildingForm customerId={customer.id} onDone={() => setSheet(null)} />}
      {sheet === 'job' && <JobForm presetCustomerId={customer.id} onDone={() => setSheet(null)} />}
    </Screen>
  );
}

// MARK: - Immobilie

export function BuildingDetailScreen({ route }: NativeStackScreenProps<StackParams, 'BuildingDetail'>) {
  const { c } = useTheme();
  const navigation = useNav();
  const { data, deleteBuilding } = useStore();
  const building = byId(data.buildings, route.params.id);
  const [sheet, setSheet] = useState<'edit' | 'job' | null>(null);

  useLayoutEffect(() => {
    navigation.setOptions({
      title: building ? buildingName(building) : 'Immobilie',
      headerRight: () => (building ? <HeaderButton title="Bearbeiten" onPress={() => setSheet('edit')} /> : null),
    });
  }, [navigation, building]);

  if (!building) {
    return <Screen><EmptyState icon="home-outline" title="Immobilie nicht gefunden" message="Diese Immobilie wurde gelöscht." /></Screen>;
  }
  const meta = buildingMeta[building.type];
  const customer = byId(data.customers, building.customerId);
  const jobs = data.jobs.filter((j) => j.buildingId === building.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const address = addressOf(building);

  return (
    <Screen>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.l, paddingHorizontal: spacing.l, paddingTop: spacing.l }}>
        <View style={{ width: 52, height: 52, borderRadius: 12, backgroundColor: alpha(c.accent, 0.1), alignItems: 'center', justifyContent: 'center' }}>
          <Icon name={meta.icon} size={26} color={c.accent} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 20, fontWeight: '600', color: c.text }}>{buildingName(building)}</Text>
          <Text style={{ fontSize: 15, color: c.secondary }}>{meta.title}</Text>
        </View>
      </View>

      <Section title="Adresse">
        {address ? (
          <Row onPress={() => openLink(links.maps(address))}>
            <InfoRow icon="car-outline" title="Route starten" value={address} />
          </Row>
        ) : (
          <Row><Text style={{ color: c.secondary, fontSize: 17 }}>Keine Adresse hinterlegt</Text></Row>
        )}
      </Section>

      {!isBlank(building.heatingSystem) || !isBlank(building.constructionYear) ? (
        <Section title="Anlagentechnik">
          {!isBlank(building.heatingSystem) ? <Row><InfoRow icon="flame-outline" title="Heizungsanlage" value={building.heatingSystem} /></Row> : null}
          {!isBlank(building.constructionYear) ? <Row><InfoRow icon="calendar-outline" title="Baujahr" value={building.constructionYear} /></Row> : null}
        </Section>
      ) : null}

      {!isBlank(building.notes) ? (
        <Section title="Notizen"><Row><Text style={{ fontSize: 17, color: c.text }}>{building.notes}</Text></Row></Section>
      ) : null}

      {customer ? (
        <Section title="Eigentümer">
          <Row chevron onPress={() => navigation.navigate('CustomerDetail', { id: customer.id })}><CustomerRow customer={customer} /></Row>
        </Section>
      ) : null}

      <Section title="Aufträge">
        <ActionRow icon="add" label="Neuer Auftrag für diese Immobilie" onPress={() => setSheet('job')} />
        {jobs.map((j) => (
          <Row key={j.id} chevron onPress={() => navigation.navigate('JobDetail', { id: j.id })}>
            <JobRow job={j} showCustomer={false} />
          </Row>
        ))}
      </Section>

      <Section footer="Aufträge bleiben beim Löschen erhalten.">
        <ActionRow
          icon="trash-outline"
          label="Immobilie löschen"
          destructive
          onPress={() =>
            confirm('Immobilie löschen?', `${buildingName(building)} wird entfernt.`, 'Löschen', () => {
              navigation.goBack();
              setTimeout(() => deleteBuilding(building.id), 350);
            })
          }
        />
      </Section>

      {sheet === 'edit' && <BuildingForm buildingId={building.id} customerId={building.customerId} onDone={() => setSheet(null)} />}
      {sheet === 'job' && <JobForm presetCustomerId={building.customerId} presetBuildingId={building.id} onDone={() => setSheet(null)} />}
    </Screen>
  );
}
