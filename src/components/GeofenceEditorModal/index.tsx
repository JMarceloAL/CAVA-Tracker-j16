// src/components/GeofenceEditorModal/index.tsx
//
// Criar/editar uma cerca virtual: toque no mapa para posicionar o
// centro, escolha o raio e se quer aviso ao entrar e/ou sair.

import React, { useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Modal,
    ScrollView,
    Switch,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
    Camera,
    GeoJSONSource,
    Layer,
    Map,
    Marker,
} from '@maplibre/maplibre-react-native';

import { useTheme } from '../../contexts/ThemeContext';
import type {
    ApiGeofence,
    GeofenceInput,
} from '../../services/TrackerApiService';
import { circlePolygon } from '../../utils/geo';
import { getMapStyleUrl } from '../../utils/mapStyle';

const RADIUS_OPTIONS = [100, 200, 500, 1000, 2000, 5000];

type Props = {
    visible: boolean;
    /** Cerca sendo editada (null = nova). */
    geofence: ApiGeofence | null;
    /** Centro inicial do mapa para uma cerca nova. */
    initialCenter: { latitude: number; longitude: number } | null;
    onClose: () => void;
    onSave: (input: GeofenceInput) => Promise<void>;
};

function formatRadius(meters: number) {
    return meters >= 1000
        ? `${(meters / 1000).toString().replace('.', ',')} km`
        : `${meters} m`;
}

export default function GeofenceEditorModal({
    visible,
    geofence,
    initialCenter,
    onClose,
    onSave,
}: Props) {
    const { colors, isDark } = useTheme();

    const [name, setName] = useState('');
    const [center, setCenter] = useState<{ latitude: number; longitude: number } | null>(null);
    const [radiusMeters, setRadiusMeters] = useState(200);
    const [notifyEnter, setNotifyEnter] = useState(true);
    const [notifyExit, setNotifyExit] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (!visible) {
            return;
        }

        setName(geofence?.name ?? '');
        setCenter(
            geofence
                ? { latitude: geofence.latitude, longitude: geofence.longitude }
                : initialCenter
        );
        setRadiusMeters(geofence?.radiusMeters ?? 200);
        setNotifyEnter(geofence?.notifyEnter ?? true);
        setNotifyExit(geofence?.notifyExit ?? true);
        setSaving(false);
    }, [visible, geofence, initialCenter]);

    const circle = useMemo(
        () =>
            center
                ? circlePolygon(center.latitude, center.longitude, radiusMeters)
                : null,
        [center, radiusMeters]
    );

    // Centro de abertura do mapa (Brasília se não houver referência).
    const mapCenter: [number, number] = center
        ? [center.longitude, center.latitude]
        : initialCenter
            ? [initialCenter.longitude, initialCenter.latitude]
            : [-47.8825, -15.7942];

    function handleMapPress(event: any) {
        const lngLat = event?.nativeEvent?.lngLat;

        if (Array.isArray(lngLat) && lngLat.length === 2) {
            setCenter({ longitude: Number(lngLat[0]), latitude: Number(lngLat[1]) });
        }
    }

    async function handleSave() {
        if (!name.trim()) {
            Alert.alert('Nome', 'Dê um nome para a cerca (ex: Casa, Trabalho).');
            return;
        }

        if (!center) {
            Alert.alert('Local', 'Toque no mapa para escolher o centro da cerca.');
            return;
        }

        if (!notifyEnter && !notifyExit) {
            Alert.alert('Avisos', 'Escolha avisar ao entrar, ao sair, ou ambos.');
            return;
        }

        setSaving(true);

        try {
            await onSave({
                name: name.trim(),
                latitude: center.latitude,
                longitude: center.longitude,
                radiusMeters,
                notifyEnter,
                notifyExit,
            });
        } catch (error) {
            Alert.alert(
                'Erro ao salvar cerca',
                error instanceof Error ? error.message : 'Tente novamente.'
            );
        } finally {
            setSaving(false);
        }
    }

    const textStyle = { color: colors.text };
    const mutedStyle = { color: colors.textMuted, fontSize: 12 };

    return (
        <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
            <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
                <View style={{ height: '50%' }}>
                    {visible && (
                        <Map
                            style={{ flex: 1 }}
                            mapStyle={getMapStyleUrl(isDark)}
                            androidView="texture"
                            compass={false}
                            onPress={handleMapPress}
                        >
                            <Camera
                                initialViewState={{
                                    center: mapCenter,
                                    zoom: 14,
                                }}
                            />

                            {circle && (
                                <GeoJSONSource id="geofence-editor-source" data={circle}>
                                    <Layer
                                        id="geofence-editor-fill"
                                        type="fill"
                                        paint={{
                                            'fill-color': colors.primary,
                                            'fill-opacity': 0.2,
                                        }}
                                    />
                                    <Layer
                                        id="geofence-editor-line"
                                        type="line"
                                        paint={{
                                            'line-color': colors.primary,
                                            'line-width': 2,
                                        }}
                                    />
                                </GeoJSONSource>
                            )}

                            {center && (
                                <Marker
                                    id="geofence-editor-center"
                                    lngLat={[center.longitude, center.latitude]}
                                >
                                    <View
                                        style={{
                                            width: 16,
                                            height: 16,
                                            borderRadius: 8,
                                            backgroundColor: colors.primary,
                                            borderWidth: 2,
                                            borderColor: '#FFFFFF',
                                        }}
                                    />
                                </Marker>
                            )}
                        </Map>
                    )}

                    <View
                        style={{
                            position: 'absolute',
                            top: 10,
                            left: 10,
                            right: 10,
                            padding: 8,
                            borderRadius: 10,
                            backgroundColor: 'rgba(0,0,0,0.6)',
                        }}
                    >
                        <Text style={{ color: '#FFF', fontSize: 12, textAlign: 'center' }}>
                            Toque no mapa para posicionar o centro da cerca
                        </Text>
                    </View>
                </View>

                <ScrollView contentContainerStyle={{ padding: 16 }}>
                    <Text style={[textStyle, { fontSize: 18, fontWeight: '700', marginBottom: 12 }]}>
                        {geofence ? 'Editar cerca' : 'Nova cerca'}
                    </Text>

                    <TextInput
                        placeholder="Nome (ex: Casa, Trabalho)"
                        placeholderTextColor={colors.textMuted}
                        value={name}
                        onChangeText={value => setName(value.slice(0, 40))}
                        style={{
                            borderWidth: 1,
                            borderColor: colors.border,
                            backgroundColor: colors.input,
                            color: colors.text,
                            borderRadius: 10,
                            paddingHorizontal: 12,
                            paddingVertical: 10,
                            marginBottom: 14,
                        }}
                    />

                    <Text style={[textStyle, { fontWeight: '600', marginBottom: 8 }]}>
                        Raio: {formatRadius(radiusMeters)}
                    </Text>

                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
                        {RADIUS_OPTIONS.map(option => {
                            const selected = option === radiusMeters;

                            return (
                                <TouchableOpacity
                                    key={option}
                                    onPress={() => setRadiusMeters(option)}
                                    style={{
                                        paddingHorizontal: 12,
                                        paddingVertical: 6,
                                        borderRadius: 16,
                                        borderWidth: 1,
                                        borderColor: selected ? colors.primary : colors.border,
                                        backgroundColor: selected ? colors.primary : 'transparent',
                                    }}
                                >
                                    <Text style={{ color: selected ? '#FFF' : colors.text, fontSize: 13 }}>
                                        {formatRadius(option)}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
                    </View>

                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                        <Text style={textStyle}>Avisar quando ENTRAR</Text>
                        <Switch value={notifyEnter} onValueChange={setNotifyEnter} />
                    </View>

                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                        <Text style={textStyle}>Avisar quando SAIR</Text>
                        <Switch value={notifyExit} onValueChange={setNotifyExit} />
                    </View>

                    {!center && (
                        <Text style={[mutedStyle, { marginBottom: 8 }]}>
                            Nenhum local escolhido ainda.
                        </Text>
                    )}

                    <TouchableOpacity
                        onPress={handleSave}
                        disabled={saving}
                        style={{
                            backgroundColor: colors.primary,
                            borderRadius: 10,
                            paddingVertical: 12,
                            alignItems: 'center',
                            marginTop: 8,
                        }}
                    >
                        {saving ? (
                            <ActivityIndicator color="#FFF" />
                        ) : (
                            <Text style={{ color: '#FFF', fontWeight: '700' }}>Salvar cerca</Text>
                        )}
                    </TouchableOpacity>

                    <TouchableOpacity
                        onPress={onClose}
                        disabled={saving}
                        style={{ paddingVertical: 12, alignItems: 'center' }}
                    >
                        <Text style={{ color: colors.textMuted }}>Cancelar</Text>
                    </TouchableOpacity>
                </ScrollView>
            </SafeAreaView>
        </Modal>
    );
}
