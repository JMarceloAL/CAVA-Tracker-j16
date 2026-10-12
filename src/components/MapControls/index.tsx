import React from 'react';

import {
    View,
    TouchableOpacity,
    Switch,
    ActivityIndicator,
    Text,
} from 'react-native';

import { Ionicons } from '@expo/vector-icons';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import Octicons from '@expo/vector-icons/Octicons';

import { useTheme } from '../../contexts/ThemeContext';
import { styles } from './styles';

type Props = {
    onOpenExternalMap: () => void;

    onShowLastLocation: () => void;

    onRequestSmsLocation: () => void;

    smsLoading: boolean;

    // ============================================================
    // TEMPO REAL
    // ============================================================

    realTimeEnabled: boolean;

    onToggleRealTime: (
        value: boolean
    ) => void;

    checkingRealTime?: boolean;

    realTimeDisabled?: boolean;

    // ============================================================
    // VIGILANTE
    // ============================================================

    vigilanteEnabled: boolean;

    onToggleVigilante: (
        value: boolean
    ) => void;

    checkingVigilante?: boolean;

    vigilanteDisabled?: boolean;

    // ============================================================
    // VIAGEM (Tempo real com o rastreador em movimento)
    // ============================================================

    /** Já formatados pela tela do mapa; null esconde a faixa. */
    tripInfo?: {
        speed: string;
        distance: string;
    } | null;
};

export default function MapControls({
    onOpenExternalMap,
    onShowLastLocation,
    onRequestSmsLocation,
    smsLoading,

    realTimeEnabled,
    onToggleRealTime,
    checkingRealTime = false,
    realTimeDisabled = false,

    vigilanteEnabled,
    onToggleVigilante,
    checkingVigilante = false,
    vigilanteDisabled = false,

    tripInfo = null,
}: Props) {
    const { colors } = useTheme();

    const primaryButtonStyle = { backgroundColor: colors.primary };

    return (
        <View style={styles.container}>
            {/* ==================================================
                TEMPO REAL
            ================================================== */}

            <View style={styles.switchWrapper}>
                <Ionicons
                    name="radio-outline"
                    size={25}
                    color={
                        realTimeEnabled
                            ? colors.primary
                            : '#999'
                    }
                    style={styles.signalIcon}
                />

                {checkingRealTime ? (
                    <ActivityIndicator
                        size="small"
                        color={colors.primary}
                        style={styles.switch}
                    />
                ) : (
                    <Switch
                        style={styles.switch}
                        value={
                            realTimeEnabled
                        }
                        onValueChange={
                            onToggleRealTime
                        }
                        disabled={
                            checkingRealTime ||
                            realTimeDisabled
                        }
                    />
                )}
            </View>

            {/* ==================================================
                MODO VIGILANTE
            ================================================== */}

            <View
                style={
                    styles.vigilanteSwitchWrapper
                }
            >
                <Ionicons
                    name="shield-checkmark-outline"
                    size={25}
                    color={
                        vigilanteEnabled
                            ? colors.primary
                            : '#999'
                    }
                    style={styles.signalIcon}
                />

                {checkingVigilante ? (
                    <ActivityIndicator
                        size="small"
                        color={colors.primary}
                        style={styles.switch}
                    />
                ) : (
                    <Switch
                        style={styles.switch}
                        value={
                            vigilanteEnabled
                        }
                        onValueChange={
                            onToggleVigilante
                        }
                        disabled={
                            checkingVigilante ||
                            vigilanteDisabled
                        }
                    />
                )}
            </View>

            {/* ==================================================
                VIAGEM: logo abaixo de Tempo real e Vigilante
                ● Em movimento | 23 km/h | 230 m
            ================================================== */}

            {tripInfo && (
                <View
                    style={[
                        styles.tripBar,
                        { backgroundColor: colors.surface, borderColor: colors.border },
                    ]}
                >
                    <View style={[styles.tripDot, { backgroundColor: colors.primary }]} />
                    <Text style={[styles.tripStatus, { color: colors.primary }]}>
                        Em movimento
                    </Text>

                    <View style={[styles.tripDivider, { backgroundColor: colors.border }]} />

                    <Text style={[styles.tripValue, { color: colors.text }]}>
                        {tripInfo.speed}
                    </Text>

                    <View style={[styles.tripDivider, { backgroundColor: colors.border }]} />

                    <Text style={[styles.tripValue, { color: colors.text }]}>
                        {tripInfo.distance}
                    </Text>
                </View>
            )}

            {/* ==================================================
                HISTÓRICO
            ================================================== */}

            <TouchableOpacity
                style={[styles.his, primaryButtonStyle]}
                onPress={
                    onShowLastLocation
                }
                activeOpacity={0.8}
            >
                <Octicons
                    name="history"
                    size={24}
                    color="white"
                />
            </TouchableOpacity>

            {/* ==================================================
                SMS / LOCALIZAÇÃO
            ================================================== */}

            <TouchableOpacity
                style={[styles.sms, primaryButtonStyle]}
                onPress={
                    onRequestSmsLocation
                }
                activeOpacity={0.8}
                disabled={smsLoading}
            >
                {smsLoading ? (
                    <ActivityIndicator
                        size="small"
                        color="#fff"
                    />
                ) : (
                    <FontAwesome
                        name="map-marker"
                        size={24}
                        color="white"
                    />
                )}
            </TouchableOpacity>

            {/* ==================================================
                MAPA EXTERNO
            ================================================== */}

            <TouchableOpacity
                style={[styles.fab, primaryButtonStyle]}
                onPress={
                    onOpenExternalMap
                }
                activeOpacity={0.8}
            >
                <Ionicons
                    name="paper-plane"
                    size={24}
                    color="white"
                    style={{
                        marginRight: 2,
                        marginTop: 3,
                    }}
                />
            </TouchableOpacity>
        </View>
    );
}
