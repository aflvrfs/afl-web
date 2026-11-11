import React, { ReactNode } from 'react';
import {
  ActionSheetIOS, Alert, KeyboardAvoidingView, KeyboardTypeOptions, Linking, Modal, Platform, Pressable, ScrollView,
  StyleProp, StyleSheet, Switch, Text, TextInput, TextStyle, View, ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import SegmentedControl from '@react-native-segmented-control/segmented-control';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { alpha, IconName, radius, spacing, statusMeta, statusTint, priorityMeta, priorityTint, useTheme } from './theme';
import type { Appointment, Employee, JobPriority, JobStatus } from './types';
import { apEnd, apStart, fmt, initials } from './utils';

// MARK: - Icon

export function Icon({ name, size = 20, color, style }: { name: IconName; size?: number; color: string; style?: StyleProp<TextStyle> }) {
  return <Ionicons name={name as React.ComponentProps<typeof Ionicons>['name']} size={size} color={color} style={style} />;
}

// MARK: - Aktionen & Dialoge

export interface ActionOption {
  label: string;
  destructive?: boolean;
  onPress: () => void;
}

/** Natives iOS-Aktionsmenü. */
export function showActions(title: string | undefined, options: ActionOption[], message?: string) {
  const labels = [...options.map((o) => o.label), 'Abbrechen'];
  const destructiveIndex = options.findIndex((o) => o.destructive);
  if (Platform.OS === 'ios') {
    ActionSheetIOS.showActionSheetWithOptions(
      {
        title,
        message,
        options: labels,
        cancelButtonIndex: labels.length - 1,
        destructiveButtonIndex: destructiveIndex >= 0 ? destructiveIndex : undefined,
      },
      (index) => {
        if (index < options.length) options[index].onPress();
      },
    );
  } else {
    Alert.alert(title ?? '', message, [
      ...options.map((o) => ({ text: o.label, style: o.destructive ? ('destructive' as const) : ('default' as const), onPress: o.onPress })),
      { text: 'Abbrechen', style: 'cancel' as const },
    ]);
  }
}

export function confirm(title: string, message: string, confirmLabel: string, onConfirm: () => void, destructive = true) {
  Alert.alert(title, message, [
    { text: 'Abbrechen', style: 'cancel' },
    { text: confirmLabel, style: destructive ? 'destructive' : 'default', onPress: onConfirm },
  ]);
}

export function openLink(url: string | null) {
  if (!url) return;
  Linking.openURL(url).catch(() => Alert.alert('Nicht möglich', 'Dieser Link kann auf diesem Gerät nicht geöffnet werden.'));
}

// MARK: - Bildschirm & Abschnitte

export function Screen({ children, contentStyle }: { children: ReactNode; contentStyle?: StyleProp<ViewStyle> }) {
  const { c } = useTheme();
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: c.background }}
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="interactive"
      contentContainerStyle={[{ paddingBottom: spacing.xxl }, contentStyle]}
    >
      {children}
    </ScrollView>
  );
}

/** Gruppierter Abschnitt im iOS-Stil mit automatischen Trennlinien. */
export function Section({
  title, footer, right, children, plain,
}: { title?: string; footer?: string; right?: ReactNode; children: ReactNode; plain?: boolean }) {
  const { c } = useTheme();
  const items = React.Children.toArray(children).filter(Boolean);
  if (plain) {
    return <View style={{ marginHorizontal: spacing.l, marginTop: spacing.l }}>{children}</View>;
  }
  return (
    <View style={{ marginTop: spacing.xl }}>
      {(title || right) && (
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: c.secondary }]}>{title}</Text>
          {right ? <View>{typeof right === 'string' ? <Text style={[styles.sectionTitle, { color: c.secondary }]}>{right}</Text> : right}</View> : null}
        </View>
      )}
      <View style={[styles.sectionBody, { backgroundColor: c.surface }]}>
        {items.map((child, i) => (
          <View key={i}>
            {i > 0 && <View style={[styles.separator, { backgroundColor: c.separator }]} />}
            {child}
          </View>
        ))}
      </View>
      {footer ? <Text style={[styles.footer, { color: c.secondary }]}>{footer}</Text> : null}
    </View>
  );
}

export function Row({
  children, onPress, onLongPress, chevron, style,
}: { children: ReactNode; onPress?: () => void; onLongPress?: () => void; chevron?: boolean; style?: StyleProp<ViewStyle> }) {
  const { c } = useTheme();
  const content = (
    <View style={[styles.row, style]}>
      <View style={{ flex: 1 }}>{children}</View>
      {chevron && <Icon name="chevron-forward" size={16} color={c.tertiary} style={{ marginLeft: spacing.s }} />}
    </View>
  );
  if (!onPress && !onLongPress) return content;
  return (
    <Pressable onPress={onPress} onLongPress={onLongPress} delayLongPress={350} style={({ pressed }) => ({ backgroundColor: pressed ? c.fill : 'transparent' })}>
      {content}
    </Pressable>
  );
}

/** Zeile mit Akzentfarbe für Aktionen („Material erfassen“ …). */
export function ActionRow({ icon, label, onPress, destructive, disabled }: { icon: IconName; label: string; onPress: () => void; destructive?: boolean; disabled?: boolean }) {
  const { c } = useTheme();
  const color = disabled ? c.tertiary : destructive ? c.danger : c.accent;
  return (
    <Row onPress={disabled ? undefined : onPress}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.m }}>
        <Icon name={icon} size={20} color={color} />
        <Text style={{ color, fontSize: 17 }}>{label}</Text>
      </View>
    </Row>
  );
}

export function Card({ children, style, padding = spacing.l }: { children: ReactNode; style?: StyleProp<ViewStyle>; padding?: number }) {
  const { c } = useTheme();
  return <View style={[styles.card, { backgroundColor: c.surface, shadowColor: '#000', padding }, style]}>{children}</View>;
}

export function SectionHeader({ title, actionTitle, onAction }: { title: string; actionTitle?: string; onAction?: () => void }) {
  const { c } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', paddingHorizontal: spacing.xxs, marginBottom: spacing.s }}>
      <Text style={{ fontSize: 20, fontWeight: '600', color: c.text }}>{title}</Text>
      {actionTitle && onAction ? (
        <Pressable onPress={onAction} hitSlop={10}>
          <Text style={{ fontSize: 15, fontWeight: '500', color: c.accent }}>{actionTitle}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/** Karte mit Navigationszeilen (Dashboard, Monatsansicht). */
export function LinkCardList<T>({ items, keyOf, render, onPress }: { items: T[]; keyOf: (t: T) => string; render: (t: T) => ReactNode; onPress: (t: T) => void }) {
  const { c } = useTheme();
  return (
    <Card padding={0}>
      {items.map((item, i) => (
        <View key={keyOf(item)}>
          {i > 0 && <View style={[styles.separator, { backgroundColor: c.separator }]} />}
          <Pressable onPress={() => onPress(item)} style={({ pressed }) => ({ backgroundColor: pressed ? c.fill : 'transparent' })}>
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.l, paddingVertical: spacing.m, gap: spacing.m }}>
              <View style={{ flex: 1 }}>{render(item)}</View>
              <Icon name="chevron-forward" size={14} color={c.tertiary} />
            </View>
          </Pressable>
        </View>
      ))}
    </Card>
  );
}

export function EmptyCard({ icon, text }: { icon: IconName; text: string }) {
  const { c } = useTheme();
  return (
    <Card>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.m }}>
        <Icon name={icon} size={22} color={c.tertiary} />
        <Text style={{ color: c.secondary, fontSize: 15, flex: 1 }}>{text}</Text>
      </View>
    </Card>
  );
}

export function EmptyState({ icon, title, message, actionTitle, onAction }: { icon: IconName; title: string; message: string; actionTitle?: string; onAction?: () => void }) {
  const { c } = useTheme();
  return (
    <View style={{ alignItems: 'center', paddingHorizontal: spacing.xxl, paddingVertical: 48, gap: spacing.s }}>
      <Icon name={icon} size={44} color={c.tertiary} />
      <Text style={{ fontSize: 20, fontWeight: '600', color: c.text, textAlign: 'center', marginTop: spacing.s }}>{title}</Text>
      <Text style={{ fontSize: 15, color: c.secondary, textAlign: 'center', lineHeight: 20 }}>{message}</Text>
      {actionTitle && onAction ? <PrimaryButton title={actionTitle} onPress={onAction} style={{ marginTop: spacing.m, alignSelf: 'center', paddingHorizontal: spacing.xl }} /> : null}
    </View>
  );
}

// MARK: - Buttons

export function PrimaryButton({ title, icon, onPress, color, style }: { title: string; icon?: IconName; onPress: () => void; color?: string; style?: StyleProp<ViewStyle> }) {
  const { c } = useTheme();
  const bg = color ?? c.accent;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.primary, { backgroundColor: bg, opacity: pressed ? 0.85 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] }, style]}>
      {icon ? <Icon name={icon} size={18} color="#FFFFFF" /> : null}
      <Text style={{ color: '#FFFFFF', fontSize: 17, fontWeight: '600' }}>{title}</Text>
    </Pressable>
  );
}

export function HeaderButton({ icon, title, onPress, bold, accessibilityLabel }: { icon?: IconName; title?: string; onPress: () => void; bold?: boolean; accessibilityLabel?: string }) {
  const { c } = useTheme();
  return (
    <Pressable onPress={onPress} hitSlop={10} accessibilityRole="button" accessibilityLabel={accessibilityLabel ?? title} style={{ paddingHorizontal: 4 }}>
      {icon ? <Icon name={icon} size={24} color={c.accent} /> : <Text style={{ color: c.accent, fontSize: 17, fontWeight: bold ? '600' : '400' }}>{title}</Text>}
    </Pressable>
  );
}

export function QuickAction({ title, icon, onPress }: { title: string; icon: IconName; onPress: () => void }) {
  const { c } = useTheme();
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.card, { flex: 1, backgroundColor: c.surface, alignItems: 'center', paddingVertical: 14, shadowColor: '#000', transform: [{ scale: pressed ? 0.97 : 1 }], opacity: pressed ? 0.85 : 1 }]}>
      <View style={{ width: 40, height: 40, borderRadius: radius.control, backgroundColor: alpha(c.accent, 0.1), alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={icon} size={20} color={c.accent} />
      </View>
      <Text style={{ fontSize: 12, fontWeight: '500', color: c.text, marginTop: spacing.s }}>{title}</Text>
    </Pressable>
  );
}

export function StatTile({ value, title, icon, tint, onPress }: { value: number; title: string; icon: IconName; tint?: string; onPress?: () => void }) {
  const { c } = useTheme();
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.card, { flex: 1, backgroundColor: c.surface, padding: 14, shadowColor: '#000', transform: [{ scale: pressed ? 0.97 : 1 }] }]}>
      <Icon name={icon} size={17} color={tint ?? c.accent} />
      <Text style={{ fontSize: 24, fontWeight: '600', color: c.text, marginTop: spacing.s, fontVariant: ['tabular-nums'] }}>{value}</Text>
      <Text style={{ fontSize: 12, color: c.secondary }} numberOfLines={2}>{title}</Text>
    </Pressable>
  );
}

export function ContactButton({ title, icon, url }: { title: string; icon: IconName; url: string | null }) {
  const { c } = useTheme();
  const color = url ? c.accent : c.tertiary;
  return (
    <Pressable disabled={!url} onPress={() => openLink(url)} style={({ pressed }) => ({ flex: 1, alignItems: 'center', paddingVertical: spacing.m, borderRadius: radius.control, backgroundColor: c.surface, gap: spacing.xs, opacity: pressed ? 0.7 : 1 })}>
      <Icon name={icon} size={20} color={color} />
      <Text style={{ fontSize: 12, fontWeight: '500', color }}>{title}</Text>
    </Pressable>
  );
}

export function FilterChip({ title, onRemove }: { title: string; onRemove: () => void }) {
  const { c } = useTheme();
  return (
    <Pressable onPress={onRemove} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 99, backgroundColor: alpha(c.accent, 0.1) }} accessibilityLabel={`Filter ${title} entfernen`}>
      <Text style={{ color: c.accent, fontSize: 13, fontWeight: '500' }}>{title}</Text>
      <Icon name="close" size={13} color={c.accent} />
    </Pressable>
  );
}

// MARK: - Badges

export function StatusBadge({ status }: { status: JobStatus }) {
  const theme = useTheme();
  const tint = statusTint(status, theme);
  return (
    <View style={{ backgroundColor: alpha(tint, 0.13), borderRadius: 99, paddingHorizontal: 8, paddingVertical: 3 }}>
      <Text style={{ color: tint, fontSize: 12, fontWeight: '600' }} numberOfLines={1}>{statusMeta[status].title}</Text>
    </View>
  );
}

export function PriorityLabel({ priority, size = 13 }: { priority: JobPriority; size?: number }) {
  const theme = useTheme();
  const tint = priorityTint(priority, theme);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
      <Icon name={priorityMeta[priority].icon} size={size + 1} color={tint} />
      <Text style={{ color: tint, fontSize: size, fontWeight: '500' }}>{priorityMeta[priority].title}</Text>
    </View>
  );
}

export function Avatar({ name, color, size = 40 }: { name: string; color?: string; size?: number }) {
  const { c } = useTheme();
  const tint = color ?? c.accent;
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: alpha(tint, 0.14), alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: tint, fontWeight: '600', fontSize: size * 0.38 }}>{initials(name)}</Text>
    </View>
  );
}

export function EmployeeTag({ employee, size = 12 }: { employee: Employee; size?: number }) {
  const { c } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
      <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: employee.colorHex }} />
      <Text style={{ fontSize: size, color: c.secondary }} numberOfLines={1}>{employee.name}</Text>
    </View>
  );
}

export function InfoRow({ icon, title, value, valueColor }: { icon: IconName; title: string; value: string; valueColor?: string }) {
  const { c } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.m }}>
      <Icon name={icon} size={20} color={c.secondary} style={{ width: 22 }} />
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 12, color: c.secondary }}>{title}</Text>
        <Text style={{ fontSize: 17, color: valueColor ?? c.text }}>{value}</Text>
      </View>
    </View>
  );
}

export function FieldError({ message }: { message: string | null | undefined }) {
  const { c } = useTheme();
  if (!message) return null;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: spacing.l, paddingBottom: spacing.s }}>
      <Icon name="alert-circle-outline" size={15} color={c.danger} />
      <Text style={{ color: c.danger, fontSize: 13, flex: 1 }}>{message}</Text>
    </View>
  );
}

export function ConflictWarning({ conflicts }: { conflicts: Appointment[] }) {
  const { c } = useTheme();
  if (!conflicts.length) return null;
  return (
    <View style={{ paddingHorizontal: spacing.l, paddingVertical: spacing.m, gap: 4 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <Icon name="warning" size={16} color={c.warning} />
        <Text style={{ color: c.warning, fontWeight: '600', fontSize: 15 }}>
          {conflicts.length === 1 ? 'Überschneidung mit einem Termin' : `Überschneidung mit ${conflicts.length} Terminen`}
        </Text>
      </View>
      {conflicts.slice(0, 3).map((a) => (
        <Text key={a.id} style={{ color: c.secondary, fontSize: 12 }}>
          {fmt.relativeDay(apStart(a))}, {fmt.timeRange(apStart(a), apEnd(a))}: {a.title}
        </Text>
      ))}
    </View>
  );
}

// MARK: - Formulare

/** Natives Blatt (Page Sheet) mit Abbrechen/Sichern-Leiste. */
export function Sheet({
  visible, title, onCancel, onSave, saveLabel = 'Sichern', children, scroll = true,
}: { visible: boolean; title: string; onCancel: () => void; onSave?: () => void; saveLabel?: string; children: ReactNode; scroll?: boolean }) {
  const { c } = useTheme();
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onCancel}>
      <View style={{ flex: 1, backgroundColor: c.background }}>
        <View style={[styles.sheetHeader, { borderBottomColor: c.separator, backgroundColor: c.background }]}>
          <View style={{ flex: 1, alignItems: 'flex-start' }}><HeaderButton title="Abbrechen" onPress={onCancel} /></View>
          <Text style={{ fontSize: 17, fontWeight: '600', color: c.text }} numberOfLines={1}>{title}</Text>
          <View style={{ flex: 1, alignItems: 'flex-end' }}>{onSave ? <HeaderButton title={saveLabel} bold onPress={onSave} /> : null}</View>
        </View>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding" keyboardVerticalOffset={56}>
          {scroll ? (
            <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive" contentContainerStyle={{ paddingBottom: 48 }}>
              {children}
            </ScrollView>
          ) : (
            children
          )}
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

export function FormInput({
  value, onChangeText, placeholder, keyboardType, multiline, autoCapitalize, autoFocus, textContentType, style, right,
}: {
  value: string;
  onChangeText: (v: string) => void;
  placeholder: string;
  keyboardType?: KeyboardTypeOptions;
  multiline?: boolean;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  autoFocus?: boolean;
  textContentType?: React.ComponentProps<typeof TextInput>['textContentType'];
  style?: StyleProp<TextStyle>;
  right?: ReactNode;
}) {
  const { c } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: multiline ? 'flex-start' : 'center', paddingHorizontal: spacing.l }}>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={c.tertiary}
        keyboardType={keyboardType}
        multiline={multiline}
        autoCapitalize={autoCapitalize}
        autoFocus={autoFocus}
        textContentType={textContentType}
        autoCorrect={keyboardType !== 'email-address'}
        style={[{ flex: 1, fontSize: 17, color: c.text, paddingVertical: 12, minHeight: multiline ? 88 : 44, textAlignVertical: multiline ? 'top' : 'center' }, style]}
      />
      {right}
    </View>
  );
}

export function LabeledValue({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  const { c } = useTheme();
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.m }}>
      <Text style={{ fontSize: 17, color: c.text }}>{label}</Text>
      <Text style={{ fontSize: 17, color: valueColor ?? c.secondary, flexShrink: 1, textAlign: 'right' }} numberOfLines={1}>{value}</Text>
    </View>
  );
}

/** Auswahl über das native Aktionsmenü. */
export function SelectRow<T>({ label, value, options, onChange, icon }: { label: string; value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; icon?: IconName }) {
  const { c } = useTheme();
  const current = options.find((o) => o.value === value)?.label ?? '—';
  return (
    <Row onPress={() => showActions(label, options.map((o) => ({ label: o.label, onPress: () => onChange(o.value) })))}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.m }}>
        {icon ? <Icon name={icon} size={20} color={c.secondary} /> : null}
        <Text style={{ fontSize: 17, color: c.text }}>{label}</Text>
        <View style={{ flex: 1, flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 4 }}>
          <Text style={{ fontSize: 17, color: c.secondary, flexShrink: 1 }} numberOfLines={1}>{current}</Text>
          <Icon name="chevron-expand" size={16} color={c.tertiary} />
        </View>
      </View>
    </Row>
  );
}

export function DateRow({ label, value, onChange, mode = 'date', minimumDate }: { label: string; value: Date; onChange: (d: Date) => void; mode?: 'date' | 'time' | 'datetime'; minimumDate?: Date }) {
  const theme = useTheme();
  return (
    <View style={[styles.row, { justifyContent: 'space-between' }]}>
      <Text style={{ fontSize: 17, color: theme.c.text }}>{label}</Text>
      <DateTimePicker
        value={value}
        mode={mode}
        display="compact"
        locale="de-DE"
        minuteInterval={5}
        minimumDate={minimumDate}
        accentColor={theme.c.accent}
        themeVariant={theme.dark ? 'dark' : 'light'}
        onChange={(_, d) => {
          if (d) onChange(d);
        }}
      />
    </View>
  );
}

export function ToggleRow({ label, value, onChange, icon }: { label: string; value: boolean; onChange: (v: boolean) => void; icon?: IconName }) {
  const { c } = useTheme();
  return (
    <View style={[styles.row, { justifyContent: 'space-between' }]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.m, flex: 1 }}>
        {icon ? <Icon name={icon} size={20} color={c.secondary} /> : null}
        <Text style={{ fontSize: 17, color: c.text, flexShrink: 1 }}>{label}</Text>
      </View>
      <Switch value={value} onValueChange={onChange} trackColor={{ true: c.accent, false: undefined }} />
    </View>
  );
}

export function Segmented({ values, index, onChange, style }: { values: string[]; index: number; onChange: (i: number) => void; style?: StyleProp<ViewStyle> }) {
  return (
    <SegmentedControl
      values={values}
      selectedIndex={index}
      onChange={(e) => onChange(e.nativeEvent.selectedSegmentIndex)}
      style={[{ height: 32 }, style]}
    />
  );
}

export function StepperButtons({ onDecrement, onIncrement }: { onDecrement: () => void; onIncrement: () => void }) {
  const { c } = useTheme();
  const btn = (icon: IconName, onPress: () => void, label: string) => (
    <Pressable onPress={onPress} accessibilityLabel={label} style={({ pressed }) => ({ width: 44, height: 32, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.5 : 1 })}>
      <Icon name={icon} size={18} color={c.text} />
    </Pressable>
  );
  return (
    <View style={{ flexDirection: 'row', backgroundColor: c.fill, borderRadius: 8, alignItems: 'center' }}>
      {btn('remove', onDecrement, 'Weniger')}
      <View style={{ width: StyleSheet.hairlineWidth, height: 18, backgroundColor: c.separator }} />
      {btn('add', onIncrement, 'Mehr')}
    </View>
  );
}

export function SaveError({ message }: { message: string | null }) {
  const { c } = useTheme();
  if (!message) return null;
  return (
    <View style={{ margin: spacing.l, padding: spacing.m, borderRadius: radius.control, backgroundColor: alpha(c.danger, 0.1), flexDirection: 'row', gap: spacing.s }}>
      <Icon name="warning" size={18} color={c.danger} />
      <Text style={{ color: c.danger, flex: 1 }}>{message}</Text>
    </View>
  );
}

export function useBottomInset(): number {
  return useSafeAreaInsets().bottom;
}

export const styles = StyleSheet.create({
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', paddingHorizontal: spacing.xl + 8, paddingBottom: 6 },
  sectionTitle: { fontSize: 13 },
  sectionBody: { marginHorizontal: spacing.l, borderRadius: radius.card - 2, overflow: 'hidden' },
  separator: { height: StyleSheet.hairlineWidth, marginLeft: spacing.l },
  footer: { fontSize: 13, paddingHorizontal: spacing.xl + 8, paddingTop: 6, lineHeight: 18 },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.l, paddingVertical: 11, minHeight: 44 },
  card: { borderRadius: radius.card, shadowOpacity: 0.05, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } },
  primary: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.s, borderRadius: 12, paddingVertical: 14 },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.l, height: 56, borderBottomWidth: StyleSheet.hairlineWidth },
});
