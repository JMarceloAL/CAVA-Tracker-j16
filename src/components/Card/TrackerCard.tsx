import React from 'react';

import { View, Text, TouchableOpacity } from 'react-native';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';

import type { Tracker } from '../../types/Tracker';
import type { ApiTracker } from '../../services/TrackerApiService';
import { buildStatusChips, type StatusChip } from '../../utils/trackerEvents';
import { useTheme } from '../../contexts/ThemeContext';
import { useTrackerSelection } from '../../contexts/TrackerSelectionContext';
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

const CHIP_COLORS: Record<StatusChip['tone'], { fg: string; bg: string; darkBg: string }> = {
    ok: { fg: '#2E8B57', bg: '#E8F5EE', darkBg: '#1E3A2C' },
    warn: { fg: '#C77700', bg: '#FFF4E0', darkBg: '#3D2F14' },
    danger: { fg: '#C0392B', bg: '#FDECEA', darkBg: '#40201D' },
    neutral: { fg: '#6B7280', bg: '#F1F3F5', darkBg: '#2A3240' },
};

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

    return (
        <TouchableOpacity
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

                {/* Painel de status (dados do servidor) */}
                {serverStatus && (
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 6, gap: 4 }}>
                        {buildStatusChips(
                            serverStatus.online,
                            serverStatus.lastSeen,
                            serverStatus.deviceStatus,
                            serverStatus.gps?.satelites
                        ).map(chip => {
                            const palette = CHIP_COLORS[chip.tone];

                            return (
                                <View
                                    key={chip.key}
                                    style={{
                                        flexDirection: 'row',
                                        alignItems: 'center',
                                        paddingHorizontal: 6,
                                        paddingVertical: 2,
                                        borderRadius: 10,
                                        backgroundColor: isDark ? palette.darkBg : palette.bg,
                                    }}
                                >
                                    <MaterialIcons name={chip.icon as any} size={11} color={palette.fg} />
                                    <Text style={{ fontSize: 10, marginLeft: 3, color: palette.fg, fontWeight: '600' }}>
                                        {chip.label}
                                    </Text>
                                </View>
                            );
                        })}
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
    );
}