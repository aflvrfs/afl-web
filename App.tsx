import React from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { DarkTheme, DefaultTheme, NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StoreProvider, useStore } from './store';
import { spacing, useTheme } from './theme';
import { EmptyState, Icon, PrimaryButton } from './ui';
import type { StackParams } from './rows';
import { DashboardScreen } from './DashboardScreen';
import { BuildingDetailScreen, CustomerDetailScreen, CustomerListScreen } from './CustomerScreens';
import { JobDetailScreen, JobListScreen } from './JobScreens';
import { AppointmentDetailScreen, CalendarScreen } from './CalendarScreens';
import { EmployeesScreen, SettingsScreen } from './SettingsScreens';
import { LockGate } from './AppLock';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator<StackParams>();

type RootName = 'Dashboard' | 'Customers' | 'Jobs' | 'Calendar' | 'Settings';

/** Jeder Tab hat einen eigenen nativen Stack mit denselben Detailseiten. */
function TabStack({ root }: { root: RootName }) {
  const { c } = useTheme();
  const titles: Record<RootName, string> = {
    Dashboard: 'Dashboard',
    Customers: 'Kunden',
    Jobs: 'Aufträge',
    Calendar: 'Kalender',
    Settings: 'Einstellungen',
  };
  const component = {
    Dashboard: DashboardScreen,
    Customers: CustomerListScreen,
    Jobs: JobListScreen,
    Calendar: CalendarScreen,
    Settings: SettingsScreen,
  }[root];

  return (
    <Stack.Navigator
      screenOptions={{
        headerTintColor: c.accent,
        headerTitleStyle: { color: c.text },
        headerBackTitle: 'Zurück',
        contentStyle: { backgroundColor: c.background },
        headerShadowVisible: true,
      }}
    >
      <Stack.Screen
        name={root}
        component={component}
        options={{
          title: titles[root],
          headerShown: root !== 'Dashboard',
          headerLargeTitle: root === 'Customers' || root === 'Jobs' || root === 'Settings',
          headerLargeTitleShadowVisible: false,
          headerTransparent: false,
          headerStyle: { backgroundColor: root === 'Calendar' ? c.surface : c.background },
          headerShadowVisible: root !== 'Calendar',
        }}
      />
      <Stack.Screen name="CustomerDetail" component={CustomerDetailScreen} options={{ title: 'Kunde' }} />
      <Stack.Screen name="BuildingDetail" component={BuildingDetailScreen} options={{ title: 'Immobilie' }} />
      <Stack.Screen name="JobDetail" component={JobDetailScreen} options={{ title: 'Auftrag' }} />
      <Stack.Screen name="AppointmentDetail" component={AppointmentDetailScreen} options={{ title: 'Termin' }} />
      {root === 'Settings' ? <Stack.Screen name="Employees" component={EmployeesScreen} options={{ title: 'Mitarbeiter' }} /> : null}
    </Stack.Navigator>
  );
}

const DashboardTab = () => <TabStack root="Dashboard" />;
const CustomersTab = () => <TabStack root="Customers" />;
const JobsTab = () => <TabStack root="Jobs" />;
const CalendarTab = () => <TabStack root="Calendar" />;
const SettingsTab = () => <TabStack root="Settings" />;

const tabIcons: Record<string, [string, string]> = {
  DashboardTab: ['grid', 'grid-outline'],
  CustomersTab: ['people', 'people-outline'],
  JobsTab: ['construct', 'construct-outline'],
  CalendarTab: ['calendar', 'calendar-outline'],
  SettingsTab: ['settings', 'settings-outline'],
};

function Tabs() {
  const { c } = useTheme();
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: c.accent,
        tabBarInactiveTintColor: '#8E8E93',
        tabBarIcon: ({ focused, color, size }) => (
          <Icon name={tabIcons[route.name][focused ? 0 : 1]} size={size} color={color} />
        ),
      })}
    >
      <Tab.Screen name="DashboardTab" component={DashboardTab} options={{ title: 'Dashboard' }} />
      <Tab.Screen name="CustomersTab" component={CustomersTab} options={{ title: 'Kunden' }} />
      <Tab.Screen name="JobsTab" component={JobsTab} options={{ title: 'Aufträge' }} />
      <Tab.Screen name="CalendarTab" component={CalendarTab} options={{ title: 'Kalender' }} />
      <Tab.Screen name="SettingsTab" component={SettingsTab} options={{ title: 'Einstellungen' }} />
    </Tab.Navigator>
  );
}

function SaveErrorBanner() {
  const { c } = useTheme();
  const { saveError } = useStore();
  if (!saveError) return null;
  return (
    <View style={{ position: 'absolute', top: 54, left: spacing.l, right: spacing.l, backgroundColor: c.danger, borderRadius: 12, padding: spacing.m, flexDirection: 'row', gap: spacing.s }}>
      <Icon name="warning" size={18} color="#FFFFFF" />
      <Text style={{ color: '#FFFFFF', flex: 1, fontSize: 13 }}>{saveError}</Text>
    </View>
  );
}

function Root() {
  const theme = useTheme();
  const { c } = theme;
  const { loadState, loadError, reload, data } = useStore();

  if (loadState === 'loading') {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: c.background, gap: spacing.l }}>
        <ActivityIndicator />
        <Text style={{ color: c.secondary }}>Daten werden geladen …</Text>
      </View>
    );
  }

  if (loadState === 'error') {
    return (
      <View style={{ flex: 1, justifyContent: 'center', backgroundColor: c.background }}>
        <EmptyState
          icon="alert-circle-outline"
          title="Daten konnten nicht geladen werden"
          message={`Der Datenspeicher ist gerade nicht erreichbar. Ihre Daten bleiben erhalten.\n\nFehler: ${loadError ?? 'unbekannt'}`}
        />
        <PrimaryButton title="Erneut versuchen" onPress={reload} style={{ marginHorizontal: spacing.xxl }} />
      </View>
    );
  }

  const navTheme = theme.dark
    ? { ...DarkTheme, colors: { ...DarkTheme.colors, primary: c.accent, background: c.background, card: c.surface } }
    : { ...DefaultTheme, colors: { ...DefaultTheme.colors, primary: c.accent, background: c.background } };

  return (
    <LockGate enabled={data.settings.appLock}>
      <NavigationContainer theme={navTheme}>
        <Tabs />
      </NavigationContainer>
      <SaveErrorBanner />
    </LockGate>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <StoreProvider>
        <StatusBar style="auto" />
        <Root />
      </StoreProvider>
    </SafeAreaProvider>
  );
}
