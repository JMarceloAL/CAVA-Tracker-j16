// src/screens/Reports/index.tsx
//
// Relatórios por período: km por dia, tempo em movimento, velocidade
// máxima e número de rotas — com exportação em CSV e PDF.

import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    ScrollView,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { File, Paths } from 'expo-file-system';

import ScreenHeader from '../../components/ScreenHeader';
import TrackerDropdown from '../../components/TrackerDropdown';
import { useTheme } from '../../contexts/ThemeContext';
import { useStoredTrackers } from '../../hooks/useStoredTrackers';
import {
    fetchReport,
    type ApiReport,
} from '../../services/TrackerApiService';

type PeriodKey = '7d' | '30d' | 'month' | 'lastMonth';

const PERIODS: { key: PeriodKey; label: string }[] = [
    { key: '7d', label: '7 dias' },
    { key: '30d', label: '30 dias' },
    { key: 'month', label: 'Este mês' },
    { key: 'lastMonth', label: 'Mês passado' },
];

const DAY_MS = 24 * 60 * 60 * 1000;

// Datas no horário de Brasília (o servidor agrupa assim).
function brasiliaToday(): Date {
    return new Date(Date.now() - 3 * 60 * 60 * 1000);
}

function dateKey(date: Date): string {
    return date.toISOString().slice(0, 10);
}

function periodRange(period: PeriodKey): { from: string; to: string } {
    const today = brasiliaToday();

    switch (period) {
        case '30d':
            return { from: dateKey(new Date(today.getTime() - 29 * DAY_MS)), to: dateKey(today) };

        case 'month':
            return {
                from: dateKey(new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1))),
                to: dateKey(today),
            };

        case 'lastMonth':
            return {
                from: dateKey(new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 1, 1))),
                to: dateKey(new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 0))),
            };

        case '7d':
        default:
            return { from: dateKey(new Date(today.getTime() - 6 * DAY_MS)), to: dateKey(today) };
    }
}

function formatKm(km: number): string {
    return `${km.toFixed(km >= 100 ? 0 : 1).replace('.', ',')} km`;
}

function formatDuration(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.round((seconds % 3600) / 60);

    if (hours === 0) return `${minutes} min`;

    return `${hours}h ${String(minutes).padStart(2, '0')}min`;
}

/** "2026-10-06" -> "06/10" */
function formatDay(key: string, withYear = false): string {
    const [year, month, day] = key.split('-');

    return withYear ? `${day}/${month}/${year}` : `${day}/${month}`;
}

function weekday(key: string): string {
    return ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'][
        new Date(`${key}T12:00:00Z`).getUTCDay()
    ];
}

function escapeHtml(value: string): string {
    return value.replace(/[&<>"]/g, char => (
        { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[char] as string
    ));
}

export default function ReportsScreen() {
    const { colors } = useTheme();
    const { trackers, selectedTracker, selectTracker } = useStoredTrackers();

    const [period, setPeriod] = useState<PeriodKey>('7d');
    const [report, setReport] = useState<ApiReport | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [exporting, setExporting] = useState<'csv' | 'pdf' | null>(null);

    const imei = selectedTracker?.imei ?? null;

    const load = useCallback(async () => {
        if (!imei) {
            setReport(null);
            return;
        }

        const { from, to } = periodRange(period);

        setLoading(true);
        setError(null);

        try {
            setReport(await fetchReport(imei, from, to));
        } catch (err) {
            setReport(null);
            setError(err instanceof Error ? err.message : 'Não foi possível gerar o relatório.');
        } finally {
            setLoading(false);
        }
    }, [imei, period]);

    useEffect(() => {
        void load();
    }, [load]);

    // ------------------------------------------------------------
    // EXPORTAÇÃO
    // ------------------------------------------------------------

    function fileBaseName() {
        const name = (selectedTracker?.name ?? 'rastreador')
            .normalize('NFD')
            .replace(/[^\w-]+/g, '_');

        return `relatorio_${name}_${report?.from}_a_${report?.to}`;
    }

    async function share(uri: string, mimeType: string) {
        if (!(await Sharing.isAvailableAsync())) {
            Alert.alert('Exportar', 'Compartilhamento não disponível neste aparelho.');
            return;
        }

        await Sharing.shareAsync(uri, { mimeType, dialogTitle: 'Exportar relatório' });
    }

    async function handleExportCsv() {
        if (!report) return;

        setExporting('csv');

        try {
            // Separador ";" e vírgula decimal: abre direto no Excel em português.
            const lines = [
                'Data;Distância (km);Tempo em movimento (min);Velocidade máxima (km/h);Rotas',
                ...report.days.map(day =>
                    [
                        formatDay(day.date, true),
                        day.distanceKm.toFixed(2).replace('.', ','),
                        Math.round(day.movingSeconds / 60),
                        day.maxSpeed,
                        day.routes,
                    ].join(';')
                ),
                [
                    'TOTAL',
                    report.totals.distanceKm.toFixed(2).replace('.', ','),
                    Math.round(report.totals.movingSeconds / 60),
                    report.totals.maxSpeed,
                    report.totals.routes,
                ].join(';'),
            ];

            const file = new File(Paths.cache, `${fileBaseName()}.csv`);

            if (file.exists) {
                file.delete();
            }

            file.create();
            // BOM: o Excel reconhece os acentos (UTF-8).
            file.write('﻿' + lines.join('\r\n'));

            await share(file.uri, 'text/csv');
        } catch (err) {
            Alert.alert('Erro ao exportar CSV', err instanceof Error ? err.message : 'Tente novamente.');
        } finally {
            setExporting(null);
        }
    }

    async function handleExportPdf() {
        if (!report) return;

        setExporting('pdf');

        try {
            const rows = report.days
                .map(day => `
                    <tr${day.routes === 0 ? ' class="empty"' : ''}>
                        <td>${formatDay(day.date, true)} (${weekday(day.date)})</td>
                        <td>${formatKm(day.distanceKm)}</td>
                        <td>${formatDuration(day.movingSeconds)}</td>
                        <td>${day.maxSpeed} km/h</td>
                        <td>${day.routes}</td>
                    </tr>`)
                .join('');

            const html = `
                <html><head><meta charset="utf-8" />
                <style>
                    body { font-family: sans-serif; color: #1F241C; padding: 24px; }
                    h1 { font-size: 20px; margin: 0 0 4px; }
                    .sub { color: #6B7280; margin-bottom: 20px; }
                    .cards { display: flex; gap: 12px; margin-bottom: 20px; }
                    .card { flex: 1; border: 1px solid #E5E7EB; border-radius: 8px; padding: 10px; }
                    .card b { display: block; font-size: 18px; }
                    .card span { color: #6B7280; font-size: 11px; }
                    table { width: 100%; border-collapse: collapse; font-size: 12px; }
                    th, td { border-bottom: 1px solid #E5E7EB; padding: 6px; text-align: left; }
                    th { background: #F2F7EC; }
                    tr.empty td { color: #9CA3AF; }
                </style></head><body>
                    <h1>Relatório — ${escapeHtml(selectedTracker?.name ?? '')}</h1>
                    <div class="sub">Período: ${formatDay(report.from, true)} a ${formatDay(report.to, true)}</div>
                    <div class="cards">
                        <div class="card"><b>${formatKm(report.totals.distanceKm)}</b><span>Distância</span></div>
                        <div class="card"><b>${formatDuration(report.totals.movingSeconds)}</b><span>Em movimento</span></div>
                        <div class="card"><b>${report.totals.maxSpeed} km/h</b><span>Velocidade máxima</span></div>
                        <div class="card"><b>${report.totals.routes}</b><span>Rotas</span></div>
                    </div>
                    <table>
                        <tr><th>Dia</th><th>Distância</th><th>Em movimento</th><th>Vel. máxima</th><th>Rotas</th></tr>
                        ${rows}
                    </table>
                </body></html>`;

            const { uri } = await Print.printToFileAsync({ html });

            await share(uri, 'application/pdf');
        } catch (err) {
            Alert.alert('Erro ao exportar PDF', err instanceof Error ? err.message : 'Tente novamente.');
        } finally {
            setExporting(null);
        }
    }

    // ------------------------------------------------------------
    // RENDER
    // ------------------------------------------------------------

    const cardStyle = {
        backgroundColor: colors.surface,
        borderRadius: 14,
        padding: 14,
        borderWidth: 1,
        borderColor: colors.border,
    };

    const mutedStyle = { color: colors.textMuted, fontSize: 12 };

    const maxDayKm = Math.max(1, ...(report?.days.map(day => day.distanceKm) ?? [0]));

    function totalCard(icon: string, value: string, label: string) {
        return (
            <View style={[cardStyle, { width: '48%', marginBottom: 10 }]}>
                <MaterialIcons name={icon as any} size={20} color={colors.primary} />
                <Text style={{ color: colors.text, fontSize: 18, fontWeight: '700', marginTop: 4 }}>{value}</Text>
                <Text style={mutedStyle}>{label}</Text>
            </View>
        );
    }

    function exportButton(kind: 'csv' | 'pdf', label: string, icon: string, onPress: () => void) {
        return (
            <TouchableOpacity
                onPress={onPress}
                disabled={exporting !== null}
                style={{
                    flex: 1,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: colors.primary,
                    borderRadius: 10,
                    paddingVertical: 11,
                    opacity: exporting && exporting !== kind ? 0.6 : 1,
                }}
            >
                {exporting === kind ? (
                    <ActivityIndicator color="#FFF" />
                ) : (
                    <>
                        <MaterialIcons name={icon as any} size={18} color="#FFF" />
                        <Text style={{ color: '#FFF', fontWeight: '700', marginLeft: 6 }}>{label}</Text>
                    </>
                )}
            </TouchableOpacity>
        );
    }

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
            <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
                <ScreenHeader title="Relatórios" />
            </View>

            <TrackerDropdown
                trackers={trackers}
                selectedTracker={selectedTracker}
                onSelect={selectTracker}
            />

            <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
                {/* Período */}
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
                    {PERIODS.map(item => {
                        const selected = item.key === period;

                        return (
                            <TouchableOpacity
                                key={item.key}
                                onPress={() => setPeriod(item.key)}
                                style={{
                                    paddingHorizontal: 14,
                                    paddingVertical: 7,
                                    borderRadius: 16,
                                    borderWidth: 1,
                                    borderColor: selected ? colors.primary : colors.border,
                                    backgroundColor: selected ? colors.primary : colors.surface,
                                }}
                            >
                                <Text style={{ color: selected ? '#FFF' : colors.text, fontWeight: '600' }}>
                                    {item.label}
                                </Text>
                            </TouchableOpacity>
                        );
                    })}
                </View>

                {!selectedTracker ? (
                    <Text style={mutedStyle}>Cadastre ou selecione um rastreador.</Text>
                ) : !imei ? (
                    <Text style={mutedStyle}>Este rastreador não tem IMEI cadastrado — os relatórios vêm do servidor.</Text>
                ) : loading ? (
                    <ActivityIndicator style={{ marginTop: 24 }} color={colors.primary} />
                ) : error || !report ? (
                    <View style={{ alignItems: 'center', marginTop: 24 }}>
                        <Text style={[mutedStyle, { textAlign: 'center' }]}>{error ?? 'Sem dados.'}</Text>
                        <TouchableOpacity onPress={() => void load()} style={{ marginTop: 12 }}>
                            <Text style={{ color: colors.primary, fontWeight: '700' }}>Tentar novamente</Text>
                        </TouchableOpacity>
                    </View>
                ) : (
                    <>
                        <Text style={[mutedStyle, { marginBottom: 10 }]}>
                            {formatDay(report.from, true)} a {formatDay(report.to, true)}
                            {' · '}
                            {report.totals.activeDays} {report.totals.activeDays === 1 ? 'dia com uso' : 'dias com uso'}
                        </Text>

                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }}>
                            {totalCard('route', formatKm(report.totals.distanceKm), 'Distância percorrida')}
                            {totalCard('timer', formatDuration(report.totals.movingSeconds), 'Tempo em movimento')}
                            {totalCard('speed', `${report.totals.maxSpeed} km/h`, 'Velocidade máxima')}
                            {totalCard('alt-route', String(report.totals.routes), 'Rotas')}
                        </View>

                        <View style={{ flexDirection: 'row', gap: 10, marginVertical: 12 }}>
                            {exportButton('csv', 'Exportar CSV', 'table-chart', () => void handleExportCsv())}
                            {exportButton('pdf', 'Exportar PDF', 'picture-as-pdf', () => void handleExportPdf())}
                        </View>

                        {/* Por dia (mais recente primeiro) */}
                        <View style={cardStyle}>
                            <Text style={{ color: colors.text, fontWeight: '700', fontSize: 16, marginBottom: 8 }}>
                                Por dia
                            </Text>

                            {[...report.days].reverse().map(day => (
                                <View key={day.date} style={{ paddingVertical: 7 }}>
                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                                        <Text style={{ color: day.routes ? colors.text : colors.textMuted }}>
                                            {formatDay(day.date)} ({weekday(day.date)})
                                        </Text>
                                        <Text style={{ color: day.routes ? colors.text : colors.textMuted, fontWeight: '600' }}>
                                            {day.routes ? formatKm(day.distanceKm) : '—'}
                                        </Text>
                                    </View>

                                    {day.routes > 0 && (
                                        <>
                                            <View style={{ height: 6, borderRadius: 3, backgroundColor: colors.border, marginTop: 4 }}>
                                                <View
                                                    style={{
                                                        height: 6,
                                                        borderRadius: 3,
                                                        backgroundColor: colors.primary,
                                                        width: `${Math.max(3, (day.distanceKm / maxDayKm) * 100)}%`,
                                                    }}
                                                />
                                            </View>
                                            <Text style={[mutedStyle, { marginTop: 3 }]}>
                                                {formatDuration(day.movingSeconds)} em movimento · máx {day.maxSpeed} km/h · {day.routes} {day.routes === 1 ? 'rota' : 'rotas'}
                                            </Text>
                                        </>
                                    )}
                                </View>
                            ))}
                        </View>
                    </>
                )}
            </ScrollView>
        </SafeAreaView>
    );
}
