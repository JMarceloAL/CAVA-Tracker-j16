import React, { useState } from 'react';

import { View, Text, TouchableOpacity } from 'react-native';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';

import type { Tracker } from '../../types/Tracker';
import type { ApiTracker } from '../../services/TrackerApiService';
import { buildStatusChips, formatTimeAgo, STATUS_TONE_COLORS } from '../../utils/trackerEvents';
import { useTheme } from '../../contexts/ThemeContext';
import { useTrackerSelection } from '../../contexts/TrackerSelectionContext';
import Collapsible from '../Collapsible';
import { RotatingChevron } from '../AnimatedDropdown';
import DeviceDetails from '../DeviceDetails';
import { styles } from './styles';

interface Props {
    tracker: Tracker;
    onDelete(id: string): void;
    onLocate(id: string): void;
    onEdit(tracker: Tracker): void;
    onPress?(tracker: Tracker): void;
    /** Dados do servidor (online, ignição, alimentação...). */
    serverStatus?: ApiTracker | null;
}

/**
 * Formata o número pra exibição, ex: "61999999999" -> "(61) 99999-9999".
 * Se não bater com 10/11 dígitos (formato já normalizado de forma
 * diferente, por exemplo), mostra o valor original sem quebrar a tela.
 */
function formatPhone(phone: string) {
    const digits = phone.replace(/\D/g, '');

    if (digits.length === 11) {
        return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
    }

    if (digits.length === 10) {
        return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
    }

    return phone;
}

export default function TrackerCard({
    tracker,
    onDelete,
    onLocate,
    onEdit,
    onPress,
    serverStatus,
}: Props) {
    const { isDark, colors } = useTheme();
    const { selectedTrackerId, setSelectedTrackerId } = useTrackerSelection();
    const hasImei = Boolean(tracker.imei);

    // Card compacto: fechado mostra só nome, telefone e online/offline.
    // A aba "Status do aparelho" abre os selos e os detalhes (bateria,
    // sinal, configuração lida do J16).
    const [expanded, setExpanded] = useState(false);

    const online = serverStatus?.online === true;
    const onlineColors = STATUS_TONE_COLORS[online ? 'ok' : 'danger'];

    return (
        <View
            style={[
                styles.card,
                isDark && styles.darkCard,
                selectedTrackerId === tracker.id && styles.selectedCard,
                selectedTrackerId === tracker.id && isDark && styles.darkSelectedCard,
                selectedTrackerId === tracker.id && {
                    borderColor: colors.primary,
                    shadowColor: colors.primary,
                    shadowOpacity: 0.35,
                    shadowRadius: 12,
                    shadowOffset: { width: 0, height: 5 },
                    elevation: 5,
                },
            ]}
        >
            <TouchableOpacity
                style={styles.cardRow}
                activeOpacity={0.7}
                onPress={() => {
                    setSelectedTrackerId(tracker.id);
                    onPress?.(tracker);
                }}
            >
                <View style={[styles.avatar, isDark && styles.darkAvatar]}>
                    <Ionicons name="radio-outline" size={22} color={colors.primary} />
                </View>

                <View style={styles.info}>
                    <Text style={[styles.name, isDark && styles.darkName]} numberOfLines={1}>
                        {tracker.name}
                    </Text>

                    <View style={styles.metaRow}>
                        <MaterialIcons name="phone" size={12} color={isDark ? '#AFB9C7' : '#75806D'} />
                        <Text style={[styles.phone, isDark && styles.darkPhone]}>{formatPhone(tracker.phone)}</Text>
                    </View>

                    {/* Online / offline (o resto fica na aba "Status do aparelho") */}
                    {serverStatus && (
                        <View style={styles.statusRow}>
                            <View style={[styles.statusDot, { backgroundColor: onlineColors.fg }]} />
                            <Text style={[styles.statusText, { color: onlineColors.fg }]}>
                                {online ? 'ONLINE' : `OFFLINE · ${formatTimeAgo(serverStatus.lastSeen).toUpperCase()}`}
                            </Text>
                        </View>
                    )}
                </View>

                <View style={styles.actions}>
                    <TouchableOpacity
                        style={[styles.actionButton, isDark ? styles.darkEditButton : { backgroundColor: '#EDF5E4' }]}
                        onPress={() => onEdit(tracker)}
                    >
                        <MaterialIcons name="edit" size={18} color={colors.primary} />
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.actionButton, isDark ? styles.darkDeleteButton : { backgroundColor: '#FBEAEA' }]}
                        onPress={() => onDelete(tracker.id)}
                    >
                        <MaterialIcons name="delete-outline" size={18} color="#D95C5C" />
                    </TouchableOpacity>
                </View>

                <MaterialIcons
                    name="chevron-right"
                    size={20}
                    color={isDark ? '#AFB9C7' : '#C7CCC0'}
                    style={styles.chevron}
                />
            </TouchableOpacity>

            {serverStatus && (
                <>
                    <TouchableOpacity
                        style={[styles.expandTab, { borderTopColor: colors.border }]}
                        onPress={() => setExpanded(prev => !prev)}
                        activeOpacity={0.7}
                        accessibilityRole="button"
                        accessibilityState={{ expanded }}
                    >
                        <Text style={[styles.expandTabText, { color: colors.primary }]}>
                            {expanded ? 'Recolher' : 'Status do aparelho'}
                        </Text>

                        <RotatingChevron open={expanded}>
                            <MaterialIcons
                                name="expand-more"
                                size={20}
                                color={colors.primary}
                            />
                        </RotatingChevron>
                    </TouchableOpacity>

                    <Collapsible open={expanded}>
                        <View style={styles.expandedContent}>
                            <View style={styles.chipsRow}>
                                {buildStatusChips(
                                    serverStatus.online,
                                    serverStatus.lastSeen,
                                    serverStatus.deviceStatus,
                                    serverStatus.gps?.satelites
                                )
                                    // online/offline já aparece no card fechado
                                    .filter(chip => chip.key !== 'online')
                                    .map(chip => {
                                    const palette = STATUS_TONE_COLORS[chip.tone];

                                    return (
                                        <View
                                            key={chip.key}
                                            style={[styles.chip, { backgroundColor: isDark ? palette.darkBg : palette.bg }]}
                                        >
                                            <MaterialIcons name={chip.icon as any} size={11} color={palette.fg} />
                                            <Text style={[styles.chipText, { color: palette.fg }]}>
                                                {chip.label}
                                            </Text>
                                        </View>
                                    );
                                })}
                            </View>

                            <DeviceDetails
                                status={serverStatus.deviceStatus}
                                config={serverStatus.deviceConfig}
                            />
                        </View>
                    </Collapsible>
                </>
            )}
        </View>
    );
}