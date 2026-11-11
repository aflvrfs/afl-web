import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, StyleSheet, Text, View } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import { spacing, useTheme } from './theme';
import { Icon, PrimaryButton } from './ui';

export async function biometryName(): Promise<string> {
  try {
    const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
    if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) return 'Face ID';
    if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) return 'Touch ID';
    if (types.includes(LocalAuthentication.AuthenticationType.IRIS)) return 'Optic ID';
  } catch {
    // ignorieren
  }
  return 'Gerätecode';
}

/**
 * Sperrt die App beim Start und nach dem Wechsel in den Hintergrund (falls aktiviert)
 * und verdeckt Inhalte im App-Umschalter.
 */
export function LockGate({ enabled, children }: { enabled: boolean; children: React.ReactNode }) {
  const { c } = useTheme();
  const [locked, setLocked] = useState(enabled);
  const [obscured, setObscured] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState('Face ID');
  const busy = useRef(false);
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;
  const lockedRef = useRef(locked);
  lockedRef.current = locked;

  useEffect(() => {
    biometryName().then(setName);
  }, []);

  const authenticate = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    try {
      const enrolled = await LocalAuthentication.getEnrolledLevelAsync();
      if (enrolled === LocalAuthentication.SecurityLevel.NONE) {
        // Ohne Gerätecode ist keine Sperre möglich.
        setLocked(false);
        return;
      }
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'SHK Pro entsperren',
        cancelLabel: 'Abbrechen',
        disableDeviceFallback: false,
      });
      if (result.success) {
        setLocked(false);
        setError(null);
      } else {
        setError('Nicht entsperrt. Tippen Sie auf „Entsperren“, um es erneut zu versuchen.');
      }
    } catch {
      setError('Entsperren ist gerade nicht möglich. Bitte erneut versuchen.');
    } finally {
      busy.current = false;
    }
  }, []);

  useEffect(() => {
    if (enabled && locked) authenticate();
    // nur beim ersten Anzeigen
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!enabled) setLocked(false);
  }, [enabled]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        setObscured(false);
        if (enabledRef.current && lockedRef.current) setTimeout(authenticate, 100);
      } else if (state === 'inactive') {
        setObscured(true);
      } else {
        setObscured(true);
        if (enabledRef.current && !busy.current) setLocked(true);
      }
    });
    return () => sub.remove();
  }, [authenticate]);

  return (
    <View style={{ flex: 1 }}>
      {children}
      {enabled && locked ? (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: c.background, alignItems: 'center', justifyContent: 'center', padding: spacing.xl }]}>
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.l }}>
            <Icon name="lock-closed" size={40} color={c.accent} />
            <Text style={{ fontSize: 20, fontWeight: '600', color: c.text }}>SHK Pro ist gesperrt</Text>
            <Text style={{ fontSize: 15, color: c.secondary, textAlign: 'center' }}>Entsperren Sie die App mit {name}.</Text>
            {error ? <Text style={{ fontSize: 13, color: c.danger, textAlign: 'center' }}>{error}</Text> : null}
          </View>
          <PrimaryButton title="Entsperren" onPress={authenticate} style={{ alignSelf: 'stretch', marginHorizontal: spacing.xl, marginBottom: 48 }} />
        </View>
      ) : obscured ? (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: c.background, alignItems: 'center', justifyContent: 'center' }]}>
          <Icon name="water" size={48} color={c.accent} />
        </View>
      ) : null}
    </View>
  );
}
