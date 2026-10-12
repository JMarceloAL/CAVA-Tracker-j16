// src/screens/Alerts/index.tsx
//
// Configuração dos alertas do servidor (velocidade, ignição fora de
// horário, sem comunicação, corte de alimentação) e das cercas
// virtuais de cada rastreador.

import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    ScrollView,
    Switch,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';

import ScreenHeader from '../../components/ScreenHeader';
import TrackerDropdown from '../../components/TrackerDropdown';
import GeofenceEditorModal from '../../components/GeofenceEditorModal';
import { useTheme } from '../../contexts/ThemeContext';
import { useStoredTrackers } from '../../hooks/useStoredTrackers';
import { getLastLocation } from '../../services/storage/LastlocationStorage';
import {
    createGeofence,
    deleteGeofence,
    fetchAlertSettings,
    fetchGeofences,
    saveAlertSettings,
    updateGeofence,
    type ApiAlertSettings,
    type ApiGeofence,
    type GeofenceInput,
} from '../../services/TrackerApiService';

const HHMM_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;

// Campos numéricos ficam como texto enquanto o usuário digita.
type SettingsForm = {
    speedEnabled: boolean;
    speedLimit: string;
    ignitionEnabled: boolean;
    ignitionStart: string;
    ignitionEnd: string;
    offlineEnabled: boolean;
    offlineMinutes: string;
    powerCutEnabled: boolean;
};

function toForm(settings: ApiAlertSettings): SettingsForm {
    return {
        speedEnabled: settings.speed.enabled,
        speedLimit: String(settings.speed.limitKmh),
        ignitionEnabled: settings.ignition.enabled,
        ignitionStart: settings.ignition.start,
        ignitionEnd: settings.ignition.end,
        offlineEnabled: settings.offline.enabled,
        offlineMinutes: String(settings.offline.minutes),
        powerCutEnabled: settings.powerCut.enabled,
    };
}

export default function AlertsScreen() {
    const { colors } = useTheme();
    const { trackers, selectedTracker, selectTracker } = useStoredTrackers();

    const [form, setForm] = useState<SettingsForm | null>(null);
    const [geofences, setGeofences] = useState<ApiGeofence[]>([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [loadError, setLoadError] = useState<string | null>(null);

    const [editorVisible, setEditorVisible] = useState(false);
    const [editingFence, setEditingFence] = useState<ApiGeofence | null>(null);
    const [editorCenter, setEditorCenter] =
        useState<{ latitude: number; longitude: number } | null>(null);

    const imei = selectedTracker?.imei ?? null;

    const load = useCallback(async () => {
        if (!imei) {
            setForm(null);
            setGeofences([]);
            return;
        }

        setLoading(true);
        setLoadError(null);

        try {
            const [settings, fences] = await Promise.all([
                fetchAlertSettings(imei),
                fetchGeofences(imei),
            ]);

            setForm(toForm(settings));
            setGeofences(fences);
        } catch (error) {
            setForm(null);
            setGeofences([]);
            setLoadError(
                error instanceof Error
                    ? error.message
                    : 'Não foi possível carregar os alertas.'
            );
        } finally {
            setLoading(false);
        }
    }, [imei]);

    useEffect(() => {
        void load();
    }, [load]);

    function update<K extends keyof SettingsForm>(key: K, value: SettingsForm[K]) {
        setForm(previous => (previous ? { ...previous, [key]: value } : previous));
    }

    async function handleSaveSettings() {
        if (!imei || !form) {
            return;
        }

        const speedLimit = Number(form.speedLimit);
        const offlineMinutes = Number(form.offlineMinutes);

        if (form.speedEnabled && (!Number.isInteger(speedLimit) || speedLimit < 10 || speedLimit > 250)) {
            Alert.alert('Velocidade', 'O limite deve ser entre 10 e 250 km/h.');
            return;
        }

        if (
            form.ignitionEnabled &&
            (!HHMM_REGEX.test(form.ignitionStart) || !HHMM_REGEX.test(form.ignitionEnd))
        ) {
            Alert.alert('Ignição', 'Use o formato HH:MM (ex: 22:00 e 06:00).');
            return;
        }

        if (form.offlineEnabled && (!Number.isInteger(offlineMinutes) || offlineMinutes < 5 || offlineMinutes > 1440)) {
            Alert.alert('Sem comunicação', 'Use de 5 a 1440 minutos.');
            return;
        }

        setSaving(true);

        try {
            const saved = await saveAlertSettings(imei, {
                speed: {
                    enabled: form.speedEnabled,
                    limitKmh: Number.isFinite(speedLimit) ? speedLimit : 100,
                },
                ignition: {
                    enabled: form.ignitionEnabled,
                    start: form.ignitionStart,
                    end: form.ignitionEnd,
                },
                offline: {
                    enabled: form.offlineEnabled,
                    minutes: Number.isFinite(offlineMinutes) ? offlineMinutes : 30,
                },
                powerCut: { enabled: form.powerCutEnabled },
            });

            setForm(toForm(saved));
            Alert.alert('Alertas', 'Configurações salvas.');
        } catch (error) {
            Alert.alert(
                'Erro ao salvar',
                error instanceof Error ? error.message : 'Tente novamente.'
            );
        } finally {
            setSaving(false);
        }
    }

    async function openNewFence() {
        if (!selectedTracker) {
            return;
        }

        const last = await getLastLocation(selectedTracker.id);

        setEditorCenter(last ? { latitude: last.latitude, longitude: last.longitude } : null);
        setEditingFence(null);
        setEditorVisible(true);
    }

    function openEditFence(fence: ApiGeofence) {
        setEditorCenter({ latitude: fence.latitude, longitude: fence.longitude });
        setEditingFence(fence);
        setEditorVisible(true);
    }

    async function handleSaveFence(input: GeofenceInput) {
        if (!imei) {
            return;
        }

        if (editingFence) {
            const saved = await updateGeofence(imei, editingFence.id, input);
            setGeofences(list => list.map(item => (item.id === saved.id ? saved : item)));
        } else {
            const saved = await createGeofence(imei, input);
            setGeofences(list => [...list, saved]);
        }

        setEditorVisible(false);
    }

    function handleDeleteFence(fence: ApiGeofence) {
        if (!imei) {
            return;
        }

        Alert.alert('Remover cerca', `Remover a cerca "${fence.name}"?`, [
            { text: 'Cancelar', style: 'cancel' },
            {
                text: 'Remover',
                style: 'destructive',
                onPress: async () => {
                    try {
                        await deleteGeofence(imei, fence.id);
                        setGeofences(list => list.filter(item => item.id !== fence.id));
                    } catch (error) {
                        Alert.alert(
                            'Erro ao remover',
                            error instanceof Error ? error.message : 'Tente novamente.'
                        );
                    }
                },
            },
        ]);
    }

    // ------------------------------------------------------------
    // ESTILOS
    // ------------------------------------------------------------

    const cardStyle = {
        backgroundColor: colors.surface,
        borderRadius: 14,
        padding: 16,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: colors.border,
    };

    const labelStyle = { fontSize: 15, fontWeight: '600' as const, color: colors.text };
    const helpStyle = { fontSize: 12, color: colors.textMuted, marginTop: 2 };

    const inputStyle = {
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.input,
        color: colors.text,
        borderRadius: 8,
        paddingHorizontal: 10,
        paddingVertical: 6,
        minWidth: 70,
        textAlign: 'center' as const,
    };

    function renderToggle(
        title: string,
        help: string,
        value: boolean,
        onChange: (value: boolean) => void,
        children?: React.ReactNode
    ) {
        return (
            <View style={{ paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <View style={{ flex: 1, marginRight: 12 }}>
                        <Text style={labelStyle}>{title}</Text>
                        <Text style={helpStyle}>{help}</Text>
                    </View>
                    <Switch value={value} onValueChange={onChange} />
                </View>

                {value && children ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 10, gap: 8 }}>
                        {children}
                    </View>
                ) : null}
            </View>
        );
    }

    // ------------------------------------------------------------
    // RENDER
    // ------------------------------------------------------------

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
            <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
                <ScreenHeader title="Alertas e cercas" />
            </View>

            {/* O dropdown é absoluto: fica preso a esta área, abaixo do cabeçalho,
                e o conteúdo reserva espaço para ele (paddingTop). */}
            <View style={{ flex: 1 }}>
                <TrackerDropdown
                    trackers={trackers}
                    selectedTracker={selectedTracker}
                    onSelect={selectTracker}
                />

                <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 72, paddingBottom: 40 }}>
                    {!selectedTracker ? (
                        <Text style={helpStyle}>Cadastre ou selecione um rastreador.</Text>
                    ) : !imei ? (
                        <Text style={helpStyle}>
                            Este rastreador não tem IMEI cadastrado — os alertas dependem do servidor.
                        </Text>
                    ) : loading ? (
                        <ActivityIndicator style={{ marginTop: 24 }} color={colors.primary} />
                    ) : loadError || !form ? (
                        <View style={{ alignItems: 'center', marginTop: 24 }}>
                            <Text style={[helpStyle, { textAlign: 'center' }]}>
                                {loadError ?? 'Não foi possível carregar os alertas.'}
                            </Text>
                            <TouchableOpacity onPress={() => void load()} style={{ marginTop: 12 }}>
                                <Text style={{ color: colors.primary, fontWeight: '700' }}>Tentar novamente</Text>
                            </TouchableOpacity>
                        </View>
                    ) : (
                        <>
                            {/* ============ ALERTAS ============ */}
                            <View style={cardStyle}>
                                <Text style={[labelStyle, { fontSize: 17, marginBottom: 4 }]}>Alertas</Text>
                                <Text style={helpStyle}>
                                    Avaliados pelo servidor. Com o Modo Vigilante ligado, chegam como
                                    notificação; todos ficam no Histórico, aba Alertas.
                                </Text>

                                {renderToggle(
                                    'Excesso de velocidade',
                                    'Avisa quando passar do limite.',
                                    form.speedEnabled,
                                    value => update('speedEnabled', value),
                                    <>
                                        <Text style={{ color: colors.text }}>Limite</Text>
                                        <TextInput
                                            style={inputStyle}
                                            keyboardType="numeric"
                                            value={form.speedLimit}
                                            onChangeText={value => update('speedLimit', value.replace(/\D/g, ''))}
                                            maxLength={3}
                                        />
                                        <Text style={{ color: colors.text }}>km/h</Text>
                                    </>
                                )}

                                {renderToggle(
                                    'Ignição fora de horário',
                                    'Avisa se a ignição for ligada dentro deste horário (horário de Brasília).',
                                    form.ignitionEnabled,
                                    value => update('ignitionEnabled', value),
                                    <>
                                        <Text style={{ color: colors.text }}>Das</Text>
                                        <TextInput
                                            style={inputStyle}
                                            value={form.ignitionStart}
                                            onChangeText={value => update('ignitionStart', value)}
                                            placeholder="22:00"
                                            placeholderTextColor={colors.textMuted}
                                            maxLength={5}
                                        />
                                        <Text style={{ color: colors.text }}>às</Text>
                                        <TextInput
                                            style={inputStyle}
                                            value={form.ignitionEnd}
                                            onChangeText={value => update('ignitionEnd', value)}
                                            placeholder="06:00"
                                            placeholderTextColor={colors.textMuted}
                                            maxLength={5}
                                        />
                                    </>
                                )}

                                {renderToggle(
                                    'Sem comunicação',
                                    'Avisa se o rastreador ficar sem enviar dados.',
                                    form.offlineEnabled,
                                    value => update('offlineEnabled', value),
                                    <>
                                        <Text style={{ color: colors.text }}>Após</Text>
                                        <TextInput
                                            style={inputStyle}
                                            keyboardType="numeric"
                                            value={form.offlineMinutes}
                                            onChangeText={value => update('offlineMinutes', value.replace(/\D/g, ''))}
                                            maxLength={4}
                                        />
                                        <Text style={{ color: colors.text }}>minutos</Text>
                                    </>
                                )}

                                {renderToggle(
                                    'Corte de alimentação',
                                    'Avisa se o rastreador for desligado da bateria do veículo (sinal comum de furto).',
                                    form.powerCutEnabled,
                                    value => update('powerCutEnabled', value)
                                )}

                                <TouchableOpacity
                                    onPress={handleSaveSettings}
                                    disabled={saving}
                                    style={{
                                        backgroundColor: colors.primary,
                                        borderRadius: 10,
                                        paddingVertical: 12,
                                        alignItems: 'center',
                                        marginTop: 14,
                                    }}
                                >
                                    {saving ? (
                                        <ActivityIndicator color="#FFF" />
                                    ) : (
                                        <Text style={{ color: '#FFF', fontWeight: '700' }}>Salvar alertas</Text>
                                    )}
                                </TouchableOpacity>
                            </View>

                            {/* ============ CERCAS ============ */}
                            <View style={cardStyle}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <Text style={[labelStyle, { fontSize: 17 }]}>Cercas virtuais</Text>

                                    <TouchableOpacity
                                        onPress={() => void openNewFence()}
                                        style={{
                                            flexDirection: 'row',
                                            alignItems: 'center',
                                            backgroundColor: colors.primary,
                                            borderRadius: 16,
                                            paddingHorizontal: 12,
                                            paddingVertical: 6,
                                        }}
                                    >
                                        <MaterialIcons name="add" size={16} color="#FFF" />
                                        <Text style={{ color: '#FFF', fontWeight: '700', marginLeft: 4 }}>Nova</Text>
                                    </TouchableOpacity>
                                </View>

                                <Text style={[helpStyle, { marginBottom: 8 }]}>
                                    Áreas no mapa (ex: casa, trabalho). Você é avisado quando o veículo entra ou sai.
                                </Text>

                                {geofences.length === 0 ? (
                                    <Text style={[helpStyle, { marginTop: 8 }]}>Nenhuma cerca criada.</Text>
                                ) : (
                                    geofences.map(fence => (
                                        <View
                                            key={fence.id}
                                            style={{
                                                flexDirection: 'row',
                                                alignItems: 'center',
                                                paddingVertical: 10,
                                                borderTopWidth: 1,
                                                borderTopColor: colors.border,
                                            }}
                                        >
                                            <MaterialIcons name="radio-button-checked" size={20} color={colors.primary} />

                                            <TouchableOpacity
                                                style={{ flex: 1, marginLeft: 10 }}
                                                onPress={() => openEditFence(fence)}
                                            >
                                                <Text style={labelStyle}>{fence.name}</Text>
                                                <Text style={helpStyle}>
                                                    Raio {fence.radiusMeters >= 1000
                                                        ? `${fence.radiusMeters / 1000} km`
                                                        : `${fence.radiusMeters} m`}
                                                    {' · '}
                                                    {[
                                                        fence.notifyEnter ? 'entrada' : null,
                                                        fence.notifyExit ? 'saída' : null,
                                                    ].filter(Boolean).join(' e ')}
                                                </Text>
                                            </TouchableOpacity>

                                            <TouchableOpacity onPress={() => handleDeleteFence(fence)} style={{ padding: 6 }}>
                                                <MaterialIcons name="delete-outline" size={20} color="#D95C5C" />
                                            </TouchableOpacity>
                                        </View>
                                    ))
                                )}
                            </View>
                        </>
                    )}
                </ScrollView>
            </View>

            <GeofenceEditorModal
                visible={editorVisible}
                geofence={editingFence}
                initialCenter={editorCenter}
                onClose={() => setEditorVisible(false)}
                onSave={handleSaveFence}
            />
        </SafeAreaView>
    );
}
