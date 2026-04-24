import React, { useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, TextInputProps, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../contexts/ThemeContext';

export function Screen({ children, scroll = true }: { children: React.ReactNode; scroll?: boolean }) {
  const { colors } = useTheme();
  const content = scroll ? (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bgBase }} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.content, { flex: 1, backgroundColor: colors.bgBase }]}>{children}</View>
  );
  return <SafeAreaView style={{ flex: 1, backgroundColor: colors.bgBase }}>{content}</SafeAreaView>;
}

export function Card({ children, style }: { children: React.ReactNode; style?: any }) {
  const { colors } = useTheme();
  return <View style={[styles.card, { backgroundColor: colors.bgCard, borderColor: colors.borderSubtle }, style]}>{children}</View>;
}

export function AppText({ children, variant = 'body', style, numberOfLines }: { children: React.ReactNode; variant?: 'title' | 'section' | 'body' | 'muted' | 'caption'; style?: any; numberOfLines?: number; }) {
  const { colors } = useTheme();
  const map: any = {
    title: { fontSize: 26, fontWeight: '700', color: colors.textPrimary },
    section: { fontSize: 18, fontWeight: '700', color: colors.textPrimary },
    body: { fontSize: 14, color: colors.textPrimary },
    muted: { fontSize: 13, color: colors.textMuted },
    caption: { fontSize: 12, color: colors.textSecondary },
  };
  return <Text style={[map[variant], style]} numberOfLines={numberOfLines}>{children}</Text>;
}

export function Input({ label, required, style, ...props }: TextInputProps & { label?: string; required?: boolean }) {
  const { colors } = useTheme();
  return (
    <View style={{ gap: 6 }}>
      {label ? (
        <View style={{ flexDirection: 'row', gap: 3 }}>
          <AppText variant="caption" style={{ fontWeight: '600' }}>{label}</AppText>
          {required ? <AppText variant="caption" style={{ color: '#ef4444', fontWeight: '700' }}>*</AppText> : null}
        </View>
      ) : null}
      <TextInput
        placeholderTextColor={colors.textMuted}
        style={[styles.input, { backgroundColor: colors.bgCard, borderColor: colors.borderSubtle, color: colors.textPrimary }, style]}
        {...props}
      />
    </View>
  );
}

export function Checkbox({ value, onValueChange, label, sublabel }: {
  value: boolean;
  onValueChange: (v: boolean) => void;
  label: string;
  sublabel?: React.ReactNode;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={() => onValueChange(!value)}
      style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}
    >
      <View style={{
        width: 22, height: 22, borderRadius: 6, borderWidth: 2,
        borderColor: value ? colors.accentNeon : colors.borderSubtle,
        backgroundColor: value ? `${colors.accentNeon}22` : 'transparent',
        alignItems: 'center', justifyContent: 'center', marginTop: 1, flexShrink: 0,
      }}>
        {value ? <Ionicons name="checkmark" size={14} color={colors.accentNeon} /> : null}
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <AppText variant="caption" style={{ fontWeight: '600', lineHeight: 18 }}>{label}</AppText>
        {sublabel ? sublabel : null}
      </View>
    </Pressable>
  );
}

export function Button({ title, onPress, loading, disabled, variant = 'primary', style }: { title: string; onPress?: () => void; loading?: boolean; disabled?: boolean; variant?: 'primary' | 'secondary' | 'ghost' | 'danger'; style?: any; }) {
  const { colors } = useTheme();
  const palette: any = {
    primary: { bg: colors.accentNeon, border: colors.accentNeon, text: colors.bgBase },
    secondary: { bg: colors.bgCard, border: colors.borderSubtle, text: colors.textPrimary },
    ghost: { bg: 'transparent', border: 'transparent', text: colors.textSecondary },
    danger: { bg: colors.bgCard, border: colors.danger, text: colors.danger },
  }[variant];
  return (
    <Pressable onPress={onPress} disabled={disabled || loading} style={({ pressed }) => [styles.button, { backgroundColor: palette.bg, borderColor: palette.border, opacity: disabled ? 0.55 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] }, style]}>
      {loading ? <ActivityIndicator color={variant === 'primary' ? colors.bgBase : colors.accentNeon} /> : <Text style={{ color: palette.text, fontWeight: '600', fontSize: 15 }}>{title}</Text>}
    </Pressable>
  );
}

export function SectionHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', gap: 12, marginBottom: 12 }}>
      <View style={{ flex: 1 }}>
        <AppText variant="section">{title}</AppText>
        {subtitle ? <AppText variant="caption" style={{ marginTop: 2 }}>{subtitle}</AppText> : null}
      </View>
      {action}
    </View>
  );
}

export function EmptyState({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <Card style={{ alignItems: 'center', paddingVertical: 24 }}>
      <AppText variant="body" style={{ fontWeight: '600', textAlign: 'center' }}>{title}</AppText>
      {subtitle ? <AppText variant="muted" style={{ textAlign: 'center', marginTop: 6 }}>{subtitle}</AppText> : null}
    </Card>
  );
}

export function SelectField({ label, value, options, onSelect, placeholder, loading, searchable, required }: {
  label?: string;
  value: string;
  options: { value: string; label: string }[];
  onSelect: (value: string) => void;
  placeholder?: string;
  loading?: boolean;
  searchable?: boolean;
  required?: boolean;
}) {
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const selected = options.find((o) => o.value === value);

  const filtered = useMemo(() => {
    if (!searchable || !query.trim()) return options;
    const q = query.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    return options.filter((o) =>
      o.label.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').includes(q)
    );
  }, [options, query, searchable]);

  function handleOpen() {
    if (!loading) { setQuery(''); setOpen(true); }
  }

  return (
    <View style={{ gap: 6 }}>
      {label ? (
        <View style={{ flexDirection: 'row', gap: 3 }}>
          <AppText variant="caption" style={{ fontWeight: '600' }}>{label}</AppText>
          {required ? <AppText variant="caption" style={{ color: '#ef4444', fontWeight: '700' }}>*</AppText> : null}
        </View>
      ) : null}
      <Pressable
        onPress={handleOpen}
        style={[styles.input, { backgroundColor: colors.bgCard, borderColor: colors.borderSubtle, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]}
      >
        <Text style={{ color: selected ? colors.textPrimary : colors.textMuted, fontSize: 15, flex: 1 }} numberOfLines={1}>
          {loading ? 'Carregando...' : (selected ? selected.label : (placeholder || 'Selecione...'))}
        </Text>
        {loading ? <ActivityIndicator size="small" color={colors.textMuted} /> : <Ionicons name="chevron-down" size={16} color={colors.textMuted} />}
      </Pressable>
      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, justifyContent: 'flex-end' }}>
          <Pressable style={{ ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.6)' }} onPress={() => setOpen(false)} />
          <View style={{ backgroundColor: colors.bgCard, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '75%' }}>
            <View style={{ padding: 16, borderBottomWidth: 1, borderBottomColor: colors.borderSubtle, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <AppText variant="section">{label || 'Selecione'}</AppText>
              <Pressable onPress={() => setOpen(false)} style={{ padding: 4 }}>
                <Ionicons name="close" size={22} color={colors.textMuted} />
              </Pressable>
            </View>
            {searchable ? (
              <View style={{ paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.borderSubtle }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.bgBase, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: colors.borderSubtle }}>
                  <Ionicons name="search" size={16} color={colors.textMuted} />
                  <TextInput
                    value={query}
                    onChangeText={setQuery}
                    placeholder="Buscar..."
                    placeholderTextColor={colors.textMuted}
                    style={{ flex: 1, color: colors.textPrimary, fontSize: 15 }}
                    autoFocus
                  />
                  {query.length > 0 ? (
                    <Pressable onPress={() => setQuery('')}>
                      <Ionicons name="close-circle" size={16} color={colors.textMuted} />
                    </Pressable>
                  ) : null}
                </View>
              </View>
            ) : null}
            {loading ? <LoadingBlock /> : (
              <FlatList
                data={filtered}
                keyExtractor={(item) => item.value}
                renderItem={({ item }) => (
                  <Pressable
                    onPress={() => { onSelect(item.value); setOpen(false); }}
                    style={{ padding: 16, borderBottomWidth: 1, borderBottomColor: `${colors.borderSubtle}60`, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
                  >
                    <Text style={{ color: colors.textPrimary, fontSize: 15, flex: 1 }}>{item.label}</Text>
                    {item.value === value ? <Ionicons name="checkmark" size={18} color={colors.accentNeon} /> : null}
                  </Pressable>
                )}
                keyboardShouldPersistTaps="handled"
                ListEmptyComponent={
                  <View style={{ padding: 24, alignItems: 'center' }}>
                    <AppText variant="muted">Nenhum resultado para "{query}"</AppText>
                  </View>
                }
              />
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

export function LoadingBlock() {
  const { colors } = useTheme();
  return <View style={{ paddingVertical: 32, alignItems: 'center' }}><ActivityIndicator size="large" color={colors.accentNeon} /></View>;
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 100, gap: 16 },
  card: { borderWidth: 1, borderRadius: 20, padding: 16, gap: 10 },
  input: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15 },
  button: { minHeight: 48, borderWidth: 1, borderRadius: 14, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16, paddingVertical: 12 },
});
