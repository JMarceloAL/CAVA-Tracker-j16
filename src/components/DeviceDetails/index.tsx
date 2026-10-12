// src/components/DeviceDetails/index.tsx
//
// Painel "Detalhes do aparelho", dentro da aba "Status do aparelho" do card
// do rastreador: bateria (volts/%), alimentação do veículo, sinal e a
// configuração que o servidor leu do próprio J16 (envio do GPS, alarmes,
// telefones, fuso).

import React from 'react';
import { View, Text } from 'react-native';

import type { ApiDeviceConfig, ApiDeviceStatus } from '../../services/TrackerApiService';
import {
    buildDeviceDetails,
    deviceConfigReadAt,
    STATUS_TONE_COLORS,
} from '../../utils/trackerEvents';
import { useTheme } from '../../contexts/ThemeContext';
import { styles } from './styles';

interface Props {
    status?: ApiDeviceStatus;
    config?: ApiDeviceConfig;
}

export default function DeviceDetails({ status, config }: Props) {
    const { colors } = useTheme();

    const sections = buildDeviceDetails(status, config);
    const readAt = deviceConfigReadAt(config);

    return (
        <View style={[styles.container, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
            {sections.length === 0 ? (
                <Text style={[styles.empty, { color: colors.textMuted }]}>
                    O servidor ainda não recebeu detalhes deste aparelho.
                </Text>
            ) : (
                sections.map(section => (
                    <View key={section.key} style={styles.section}>
                        <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>
                            {section.title}
                        </Text>

                        {section.rows.map(row => (
                            <View key={row.key} style={[styles.row, { borderColor: colors.border }]}>
                                <Text style={[styles.label, { color: colors.textMuted }]}>{row.label}</Text>

                                <View style={styles.valueGroup}>
                                    <Text
                                        style={[
                                            styles.value,
                                            { color: row.tone ? STATUS_TONE_COLORS[row.tone].fg : colors.text },
                                        ]}
                                    >
                                        {row.value}
                                    </Text>

                                    {row.hint ? (
                                        <Text style={[styles.hint, { color: colors.textMuted }]}>{row.hint}</Text>
                                    ) : null}
                                </View>
                            </View>
                        ))}
                    </View>
                ))
            )}

            <Text style={[styles.footer, { color: colors.textMuted }]}>
                {readAt ?? 'Configuração ainda não lida do aparelho.'}
            </Text>
        </View>
    );
}
