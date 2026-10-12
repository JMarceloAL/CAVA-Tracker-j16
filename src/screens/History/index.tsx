import React, { useCallback, useEffect, useState } from 'react';

import {
    View,
    Text,
    TouchableOpacity,
    FlatList,
    ActivityIndicator,
    type LayoutRectangle,
} from 'react-native';

import AsyncStorage from '@react-native-async-storage/async-storage';

import { useFocusEffect } from '@react-navigation/native';

import { MaterialIcons } from '@expo/vector-icons';

import { DropdownPanel, RotatingChevron } from '../../components/AnimatedDropdown';

import { getLocationHistory } from '../../services/storage/LastlocationStorage';

import {
    getRoutes,
    type TrackerRoute,
} from '../../services/storage/RouteHistoryStorage';

import { syncTrackerHistory } from '../../services/TrackerHistorySync';

import { normalizeServerDate } from '../../utils/serverDate';
import { eventAppearance } from '../../utils/trackerEvents';

import {
    fetchDayPositions,
    fetchTrackerEvents,
    type ApiDayPosition,
    type ApiTrackerEvent,
} from '../../services/TrackerApiService';

import {
    formatDayLabel,
    shiftDay,
    summarizeDay,
    toMapPoints,
    todayKey,
} from '../../utils/dayTrack';

import type {
    Tracker,
    TrackerLocation,
} from '../../types/Tracker';

import { useTheme } from '../../contexts/ThemeContext';
import { useTrackerSelection } from '../../contexts/TrackerSelectionContext';
import { APP_GREEN } from '../../theme/colors';

import { styles } from './styles';

const STORAGE_KEY = '@cavalleta:trackers';

type TabKey = 'locations' | 'routes' | 'day' | 'alerts';

export default function History({ navigation }: any) {

    // ============================================================
    // TEMA
    // ============================================================

    const { isDark, colors } = useTheme();
    const { selectedTrackerId, setSelectedTrackerId, resolveSelectedTracker } = useTrackerSelection();

    // ============================================================
    // ESTADOS
    // ============================================================

    const [trackers, setTrackers] =
        useState<Tracker[]>([]);

    const [dropdownOpen, setDropdownOpen] =
        useState(false);

    // Posição do seletor, para a lista abrir logo abaixo dele.
    const [dropdownFrame, setDropdownFrame] =
        useState<LayoutRectangle | null>(null);

    const [selectedTracker, setSelectedTracker] =
        useState<Tracker | null>(null);

    const [activeTab, setActiveTab] =
        useState<TabKey>('locations');

    const [history, setHistory] =
        useState<TrackerLocation[]>([]);

    const [routes, setRoutes] =
        useState<TrackerRoute[]>([]);

    const [loadingData, setLoadingData] =
        useState(false);

    // Alertas e alarmes registrados pelo servidor.
    const [events, setEvents] =
        useState<ApiTrackerEvent[]>([]);

    const [eventsError, setEventsError] =
        useState<string | null>(null);

    // Aviso exibido quando não foi possível sincronizar com o
    // servidor (API fora do ar) ou quando o rastreador não tem
    // IMEI cadastrado (nesses casos os dados vêm só do cache local).
    const [syncError, setSyncError] =
        useState<string | null>(null);

    // Trajeto do dia: todas as posições de um dia, do servidor.
    const [dayKey, setDayKey] =
        useState<string>(todayKey());

    const [dayPositions, setDayPositions] =
        useState<ApiDayPosition[]>([]);

    const [dayLoading, setDayLoading] =
        useState(false);

    const [dayError, setDayError] =
        useState<string | null>(null);

    // ============================================================
    // ESTILOS DINÂMICOS
    // ============================================================

    const containerStyle = [
        styles.container,
        isDark && styles.darkContainer,
    ];

    const titleStyle = [
        styles.title,
        isDark && styles.darkTitle,
    ];

    const dropdownHeaderStyle = [
        styles.dropdownHeader,
        { backgroundColor: colors.surface, borderColor: colors.border },
        isDark && styles.darkDropdownHeader,
    ];

    const dropdownHeaderTextStyle = [
        styles.dropdownHeaderText,
        { color: colors.text },
        isDark && styles.darkDropdownHeaderText,
    ];

    const chevronStyle = [
        styles.chevron,
        isDark && styles.darkChevron,
    ];

    const dropdownListStyle = [
        styles.dropdownList,
        isDark && styles.darkDropdownList,
    ];

    const emptyTextStyle = [
        styles.emptyText,
        isDark && styles.darkEmptyText,
    ];

    const folderStyle = [
        styles.folder,
        { backgroundColor: colors.surface, borderColor: colors.border },
        isDark && styles.darkFolder,
    ];

    const folderHeaderStyle = [
        styles.folderHeader,
        isDark && styles.darkFolderHeader,
    ];

    const folderHeaderTextStyle = [
        styles.folderHeaderText,
        isDark && styles.darkFolderHeaderText,
    ];

    // ============================================================
    // CARREGA RASTREADORES
    // ============================================================

    useFocusEffect(
        useCallback(() => {
            loadTrackers();
        }, [])
    );

    async function loadTrackers() {
        try {
            const stored =
                await AsyncStorage.getItem(STORAGE_KEY);

            const list: Tracker[] =
                stored
                    ? JSON.parse(stored)
                    : [];

            setTrackers(list);

            if (list.length === 0) {
                setSelectedTracker(null);
                setSelectedTrackerId(null);
                setHistory([]);
                setRoutes([]);
                return;
            }

            const nextTracker =
                resolveSelectedTracker(list);

            if (!nextTracker) {
                setSelectedTracker(null);
                setSelectedTrackerId(null);
                setHistory([]);
                setRoutes([]);
                return;
            }

            const trackerToLoad = nextTracker;

            if (!selectedTracker || selectedTracker.id !== trackerToLoad.id) {
                setSelectedTracker(trackerToLoad);
                setSelectedTrackerId(trackerToLoad.id);
                await handleSelectTracker(trackerToLoad);
            }
        } catch (error) {
            console.warn(
                'Erro ao carregar rastreadores',
                error
            );
        }
    }

    // ============================================================
    // CARREGA APENAS DO CACHE LOCAL
    // ============================================================
    //
    // Usado como fallback quando a sincronização com o servidor
    // falha, e também como único caminho quando o rastreador não
    // tem IMEI cadastrado (nesse caso nunca há dado no servidor).
    //

    async function loadFromLocalCache(tracker: Tracker) {
        try {
            const [locationResult, routesResult] =
                await Promise.all([
                    getLocationHistory(tracker.id),
                    getRoutes(tracker.id),
                ]);

            setHistory(locationResult);
            setRoutes(routesResult);
        } catch (error) {
            console.warn(
                'Erro ao carregar cache local',
                error
            );
        }
    }

    // ============================================================
    // SELECIONAR RASTREADOR
    // ============================================================

    async function handleSelectTracker(
        tracker: Tracker
    ) {
        setSelectedTracker(tracker);
        setSelectedTrackerId(tracker.id);

        setDropdownOpen(false);

        setLoadingData(true);

        setSyncError(null);

        setEvents([]);
        setEventsError(null);

        // Alertas vêm só do servidor (sem cache local) — carregados
        // em paralelo, sem segurar o resto da tela.
        if (tracker.imei) {
            void fetchTrackerEvents(tracker.imei, { limit: 100 })
                .then(setEvents)
                .catch(() =>
                    setEventsError(
                        'Não foi possível carregar os alertas do servidor.'
                    )
                );
        }

        // Sem IMEI não há como consultar o servidor — usa direto
        // o cache local, sem tentar a rede.
        if (!tracker.imei) {
            setSyncError(
                'Este rastreador não tem IMEI cadastrado. Mostrando apenas os dados salvos no aparelho.'
            );

            await loadFromLocalCache(tracker);

            setLoadingData(false);

            return;
        }

        try {
            // Busca localizações paradas e rotas no servidor e já
            // sobrescreve o cache local com o resultado.
            const { locations, routes: syncedRoutes } =
                await syncTrackerHistory(
                    tracker.id,
                    tracker.imei
                );

            setHistory(locations);
            setRoutes(syncedRoutes);
        } catch (error) {
            console.warn(
                'Erro ao sincronizar histórico com o servidor, usando cache local',
                error
            );

            setSyncError(
                'Não foi possível atualizar com o servidor. Mostrando dados salvos localmente.'
            );

            // Fallback: mantém o que já estava salvo localmente.
            await loadFromLocalCache(tracker);
        } finally {
            setLoadingData(false);
        }
    }

    // ============================================================
    // TRAJETO DO DIA
    // ============================================================
    //
    // Carrega quando a aba "Dia" está aberta, e de novo ao trocar de
    // rastreador ou de dia.
    //

    useEffect(() => {
        const imei = selectedTracker?.imei;

        if (activeTab !== 'day' || !imei) {
            return;
        }

        let cancelled = false;

        setDayLoading(true);
        setDayError(null);
        setDayPositions([]);

        fetchDayPositions(imei, dayKey)
            .then(points => {
                if (!cancelled) {
                    setDayPositions(points);
                }
            })
            .catch(() => {
                if (!cancelled) {
                    setDayError('Não foi possível carregar o trajeto do servidor.');
                }
            })
            .finally(() => {
                if (!cancelled) {
                    setDayLoading(false);
                }
            });

        return () => {
            cancelled = true;
        };
    }, [activeTab, dayKey, selectedTracker?.imei]);

    function handleShowDayOnMap() {
        if (!selectedTracker || dayPositions.length < 2) {
            return;
        }

        navigation.navigate(
            'MapScreen',
            {
                trackerId:
                    selectedTracker.id,

                routePoints:
                    toMapPoints(dayPositions),
            }
        );
    }

    function formatTime(value: string | null) {
        if (!value) {
            return '—';
        }

        const date = new Date(value);

        return isNaN(date.getTime())
            ? value
            : date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    }

    // ============================================================
    // ABRIR LOCALIZAÇÃO NO MAPA
    // ============================================================

    function handleSelectLocation(
        location: TrackerLocation
    ) {
        if (!selectedTracker) {
            return;
        }

        navigation.navigate(
            'MapScreen',
            {
                trackerId:
                    selectedTracker.id,

                historyLocation:
                    location,
            }
        );
    }

    // ============================================================
    // ABRIR ROTA NO MAPA
    // ============================================================

    function handleSelectRoute(
        trackerRoute: TrackerRoute
    ) {
        if (!selectedTracker) {
            return;
        }

        navigation.navigate(
            'MapScreen',
            {
                trackerId:
                    selectedTracker.id,

                routePoints:
                    trackerRoute.points,
            }
        );
    }

    // ============================================================
    // DATA
    // ============================================================

    function formatDate(value?: string) {

        if (!value) {
            return 'Data não disponível';
        }

        // Cache antigo pode ter datas no formato UTC do servidor
        // ("AAAA-MM-DD HH:mm:ss", sem fuso).
        const date =
            new Date(normalizeServerDate(value));

        if (isNaN(date.getTime())) {
            return value;
        }

        return date.toLocaleString(
            'pt-BR'
        );
    }

    // ============================================================
    // DISTÂNCIA
    // ============================================================

    function formatDistance(
        km: number
    ) {
        return `${km
            .toFixed(2)
            .replace('.', ',')} km`;
    }

    function formatRouteDuration(
        startTime?: string,
        endTime?: string
    ) {
        if (!startTime) {
            return 'Duração não disponível';
        }

        const start = new Date(startTime);
        const end = new Date(endTime ?? startTime);

        if (isNaN(start.getTime()) || isNaN(end.getTime())) {
            return 'Duração não disponível';
        }

        const diffMs = Math.max(0, end.getTime() - start.getTime());
        const totalSeconds = Math.floor(diffMs / 1000);
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;

        if (hours > 0) {
            return `Tempo: ${hours}h ${minutes}m`;
        }

        if (minutes > 0) {
            return `Tempo: ${minutes}m ${seconds}s`;
        }

        return `Tempo: ${seconds}s`;
    }

    // ============================================================
    // ABA "DIA"
    // ============================================================

    function renderDayTab() {
        if (!selectedTracker?.imei) {
            return (
                <Text style={emptyTextStyle}>
                    Este rastreador não tem IMEI cadastrado — o trajeto vem do servidor.
                </Text>
            );
        }

        const summary = summarizeDay(dayPositions);
        const isToday = dayKey === todayKey();

        const statStyle = [styles.dayStatValue, { color: colors.text }];
        const statLabelStyle = [styles.dayStatLabel, { color: colors.textMuted }];

        return (
            <View>
                {/* Navegação entre os dias */}
                <View style={styles.dayNav}>
                    <TouchableOpacity
                        style={[styles.dayNavButton, { borderColor: colors.border, backgroundColor: colors.surfaceAlt }]}
                        onPress={() => setDayKey(prev => shiftDay(prev, -1))}
                        accessibilityLabel="Dia anterior"
                    >
                        <MaterialIcons name="chevron-left" size={22} color={colors.text} />
                    </TouchableOpacity>

                    <View style={styles.dayNavLabelGroup}>
                        <Text style={[styles.dayNavLabel, { color: colors.text }]}>
                            {formatDayLabel(dayKey)}
                        </Text>
                        <Text style={[styles.dayNavSub, { color: colors.textMuted }]}>
                            {dayKey.split('-').reverse().join('/')}
                        </Text>
                    </View>

                    <TouchableOpacity
                        style={[
                            styles.dayNavButton,
                            { borderColor: colors.border, backgroundColor: colors.surfaceAlt },
                            isToday && styles.dayNavButtonDisabled,
                        ]}
                        onPress={() => setDayKey(prev => shiftDay(prev, 1))}
                        disabled={isToday}
                        accessibilityLabel="Próximo dia"
                    >
                        <MaterialIcons name="chevron-right" size={22} color={colors.text} />
                    </TouchableOpacity>
                </View>

                {dayLoading ? (
                    <ActivityIndicator
                        style={{ marginTop: 20 }}
                        color={isDark ? colors.primary : undefined}
                    />
                ) : dayError ? (
                    <Text style={emptyTextStyle}>{dayError}</Text>
                ) : summary.total === 0 ? (
                    <Text style={emptyTextStyle}>
                        Nenhuma posição registrada neste dia.
                    </Text>
                ) : (
                    <>
                        <View style={styles.dayStats}>
                            <View style={[styles.dayStat, { borderColor: colors.border }]}>
                                <Text style={statStyle}>
                                    {summary.distanceKm.toFixed(1).replace('.', ',')} km
                                </Text>
                                <Text style={statLabelStyle}>percorridos</Text>
                            </View>

                            <View style={[styles.dayStat, { borderColor: colors.border }]}>
                                <Text style={statStyle}>{summary.maxSpeed} km/h</Text>
                                <Text style={statLabelStyle}>velocidade máx.</Text>
                            </View>

                            <View style={[styles.dayStat, { borderColor: colors.border }]}>
                                <Text style={statStyle}>
                                    {formatTime(summary.firstAt)}–{formatTime(summary.lastAt)}
                                </Text>
                                <Text style={statLabelStyle}>primeira e última</Text>
                            </View>
                        </View>

                        <Text style={[styles.dayNote, { color: colors.textMuted }]}>
                            {summary.total} posições
                            {summary.late > 0
                                ? ` · ${summary.late} chegaram atrasadas (sem sinal na hora) e preenchem o trajeto`
                                : ''}
                        </Text>

                        <TouchableOpacity
                            style={[
                                styles.dayMapButton,
                                { backgroundColor: colors.primary },
                                summary.total < 2 && { opacity: 0.5 },
                            ]}
                            onPress={handleShowDayOnMap}
                            disabled={summary.total < 2}
                            activeOpacity={0.85}
                        >
                            <MaterialIcons name="map" size={18} color={colors.buttonText} />
                            <Text style={[styles.dayMapButtonText, { color: colors.buttonText }]}>
                                Ver trajeto no mapa
                            </Text>
                        </TouchableOpacity>
                    </>
                )}
            </View>
        );
    }

    // ============================================================
    // RENDER
    // ============================================================

    return (
        <View style={containerStyle}>

            {/* ================================================== */}
            {/* TÍTULO */}
            {/* ================================================== */}

            <Text style={titleStyle}>
                Histórico
            </Text>

            {/* ================================================== */}
            {/* DROPDOWN */}
            {/* ================================================== */}

            <View
                style={styles.dropdownContainer}
                onLayout={event =>
                    setDropdownFrame(
                        event.nativeEvent.layout
                    )
                }
            >

                <TouchableOpacity
                    style={dropdownHeaderStyle}
                    onPress={() =>
                        setDropdownOpen(
                            prev => !prev
                        )
                    }
                >

                    <Text
                        style={
                            dropdownHeaderTextStyle
                        }
                        numberOfLines={1}
                    >
                        {selectedTracker
                            ? selectedTracker.name
                            : 'Selecione um rastreador'}
                    </Text>

                    <RotatingChevron open={dropdownOpen}>
                        <Text style={chevronStyle}>
                            ▼
                        </Text>
                    </RotatingChevron>

                </TouchableOpacity>

            </View>

            {!selectedTracker ? (
                <View
                    style={{
                        flex: 1,
                        justifyContent: 'center',
                        alignItems: 'center',
                        padding: 32,
                    }}
                >
                    <Text style={{ fontSize: 42, marginBottom: 14 }}>📜</Text>

                    <Text
                        style={{
                            textAlign: 'center',
                            color: isDark ? colors.text : '#1F241C',
                            fontSize: 17,
                            fontWeight: '700',
                            marginBottom: 8,
                        }}
                    >
                        Nenhum rastreador selecionado.
                    </Text>

                    <Text
                        style={{
                            textAlign: 'center',
                            color: isDark ? colors.textMuted : '#6C7D6A',
                            fontSize: 13,
                            lineHeight: 20,
                        }}
                    >
                        Selecione um rastreador no menu acima para visualizar locais e rotas salvas.
                    </Text>
                </View>
            ) : (
                <>
                    <View style={styles.tabRow}>
                        <TouchableOpacity
                            style={[
                                styles.tabButton,
                                isDark && styles.darkTabButton,
                                activeTab === 'locations' && styles.tabButtonActive,
                                activeTab === 'locations' && { backgroundColor: colors.primary, borderColor: colors.primary },
                            ]}
                            onPress={() => setActiveTab('locations')}
                        >
                            <MaterialIcons
                                name="place"
                                size={20}
                                color={activeTab === 'locations' ? '#FFFFFF' : colors.textMuted}
                            />

                            <Text
                                numberOfLines={1}
                                adjustsFontSizeToFit
                                minimumFontScale={0.8}
                                style={[
                                    styles.tabButtonText,
                                    { color: activeTab === 'locations' ? '#FFFFFF' : colors.textMuted },
                                    isDark && styles.darkTabButtonText,
                                    activeTab === 'locations' && styles.tabButtonTextActive,
                                ]}
                            >
                                Localizações
                            </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[
                                styles.tabButton,
                                isDark && styles.darkTabButton,
                                activeTab === 'routes' && styles.tabButtonActive,
                                activeTab === 'routes' && { backgroundColor: colors.primary, borderColor: colors.primary },
                            ]}
                            onPress={() => setActiveTab('routes')}
                        >
                            <MaterialIcons
                                name="alt-route"
                                size={20}
                                color={activeTab === 'routes' ? '#FFFFFF' : colors.textMuted}
                            />

                            <Text
                                numberOfLines={1}
                                adjustsFontSizeToFit
                                minimumFontScale={0.8}
                                style={[
                                    styles.tabButtonText,
                                    { color: activeTab === 'routes' ? '#FFFFFF' : colors.textMuted },
                                    isDark && styles.darkTabButtonText,
                                    activeTab === 'routes' && styles.tabButtonTextActive,
                                ]}
                            >
                                Rotas
                            </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[
                                styles.tabButton,
                                isDark && styles.darkTabButton,
                                activeTab === 'day' && styles.tabButtonActive,
                                activeTab === 'day' && { backgroundColor: colors.primary, borderColor: colors.primary },
                            ]}
                            onPress={() => setActiveTab('day')}
                        >
                            <MaterialIcons
                                name="today"
                                size={20}
                                color={activeTab === 'day' ? '#FFFFFF' : colors.textMuted}
                            />

                            <Text
                                numberOfLines={1}
                                adjustsFontSizeToFit
                                minimumFontScale={0.8}
                                style={[
                                    styles.tabButtonText,
                                    { color: activeTab === 'day' ? '#FFFFFF' : colors.textMuted },
                                    isDark && styles.darkTabButtonText,
                                    activeTab === 'day' && styles.tabButtonTextActive,
                                ]}
                            >
                                Dia
                            </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[
                                styles.tabButton,
                                isDark && styles.darkTabButton,
                                activeTab === 'alerts' && styles.tabButtonActive,
                                activeTab === 'alerts' && { backgroundColor: colors.primary, borderColor: colors.primary },
                            ]}
                            onPress={() => setActiveTab('alerts')}
                        >
                            <MaterialIcons
                                name="notifications"
                                size={20}
                                color={activeTab === 'alerts' ? '#FFFFFF' : colors.textMuted}
                            />

                            <Text
                                numberOfLines={1}
                                adjustsFontSizeToFit
                                minimumFontScale={0.8}
                                style={[
                                    styles.tabButtonText,
                                    { color: activeTab === 'alerts' ? '#FFFFFF' : colors.textMuted },
                                    isDark && styles.darkTabButtonText,
                                    activeTab === 'alerts' && styles.tabButtonTextActive,
                                ]}
                            >
                                Alertas
                            </Text>
                        </TouchableOpacity>
                    </View>

                    <View style={folderStyle}>
                        <View style={folderHeaderStyle}>
                            <MaterialIcons
                                name={
                                    activeTab === 'locations'
                                        ? 'folder-open'
                                        : activeTab === 'alerts'
                                            ? 'notifications'
                                            : activeTab === 'day'
                                                ? 'today'
                                                : 'alt-route'
                                }
                                size={20}
                                color={colors.primary}
                            />

                            <Text style={folderHeaderTextStyle} numberOfLines={1}>
                                {activeTab === 'locations'
                                    ? `Últimas localizações — ${selectedTracker.name}`
                                    : activeTab === 'alerts'
                                        ? `Alertas e alarmes — ${selectedTracker.name}`
                                        : activeTab === 'day'
                                            ? `Trajeto do dia — ${selectedTracker.name}`
                                            : `Rotas percorridas — ${selectedTracker.name}`}
                            </Text>
                        </View>

                        {syncError && (
                            <Text
                                style={[
                                    emptyTextStyle,
                                    {
                                        fontSize: 12,
                                        marginTop: 4,
                                        marginBottom: 8,
                                    },
                                ]}
                            >
                                {syncError}
                            </Text>
                        )}

                        {loadingData ? (
                            <ActivityIndicator
                                style={{ marginTop: 20 }}
                                color={isDark ? colors.primary : undefined}
                            />
                        ) : activeTab === 'locations' ? (
                            history.length === 0 ? (
                                <Text style={emptyTextStyle}>
                                    Nenhuma localização registrada ainda para este rastreador.
                                </Text>
                            ) : (
                                <FlatList
                                    data={history}
                                    keyExtractor={(_, index) => String(index)}
                                    renderItem={({ item, index }) => (
                                        <TouchableOpacity
                                            style={[
                                                styles.historyItem,
                                                isDark && styles.darkHistoryItem,
                                            ]}
                                            onPress={() => handleSelectLocation(item)}
                                            activeOpacity={0.7}
                                        >
                                            <MaterialIcons
                                                name="place"
                                                size={20}
                                                color={isDark ? '#AEB8C5' : '#888'}
                                                style={{ marginRight: 8 }}
                                            />

                                            <View style={{ flex: 1 }}>
                                                <Text
                                                    style={[
                                                        styles.historyItemTitle,
                                                        isDark && styles.darkHistoryItemTitle,
                                                    ]}
                                                >
                                                    {index === 0 ? 'Localização mais recente' : `${index}ª localização anterior`}
                                                </Text>

                                                <Text
                                                    style={[
                                                        styles.historyItemCoords,
                                                        isDark && styles.darkHistoryItemCoords,
                                                    ]}
                                                >
                                                    lat {item.latitude.toFixed(5)}, lon {item.longitude.toFixed(5)}
                                                </Text>

                                                <Text
                                                    style={[
                                                        styles.historyItemDate,
                                                        isDark && styles.darkHistoryItemDate,
                                                    ]}
                                                >
                                                    {formatDate(item.lastUpdate)}
                                                </Text>
                                            </View>

                                            <MaterialIcons
                                                name="chevron-right"
                                                size={20}
                                                color={isDark ? '#667384' : '#CCCCCC'}
                                            />
                                        </TouchableOpacity>
                                    )}
                                />
                            )
                        ) : activeTab === 'day' ? (
                            renderDayTab()
                        ) : activeTab === 'alerts' ? (
                            eventsError || !selectedTracker.imei ? (
                                <Text style={emptyTextStyle}>
                                    {selectedTracker.imei
                                        ? eventsError
                                        : 'Este rastreador não tem IMEI cadastrado — os alertas vêm do servidor.'}
                                </Text>
                            ) : events.length === 0 ? (
                                <Text style={emptyTextStyle}>
                                    Nenhum alerta registrado ainda. Configure os alertas no menu "Alertas e cercas".
                                </Text>
                            ) : (
                                <FlatList
                                    data={events}
                                    keyExtractor={item => item.id}
                                    renderItem={({ item }) => {
                                        const appearance = eventAppearance(item);
                                        const hasPosition =
                                            typeof item.latitude === 'number' &&
                                            typeof item.longitude === 'number';

                                        return (
                                            <TouchableOpacity
                                                style={[
                                                    styles.historyItem,
                                                    isDark && styles.darkHistoryItem,
                                                ]}
                                                disabled={!hasPosition}
                                                onPress={() =>
                                                    handleSelectLocation({
                                                        latitude: item.latitude as number,
                                                        longitude: item.longitude as number,
                                                        lastUpdate: item.createdAt,
                                                    })
                                                }
                                                activeOpacity={0.7}
                                            >
                                                <MaterialIcons
                                                    name={appearance.icon as any}
                                                    size={22}
                                                    color={appearance.color}
                                                    style={{ marginRight: 8 }}
                                                />

                                                <View style={{ flex: 1 }}>
                                                    <Text
                                                        style={[
                                                            styles.historyItemTitle,
                                                            isDark && styles.darkHistoryItemTitle,
                                                        ]}
                                                    >
                                                        {item.title}
                                                    </Text>

                                                    <Text
                                                        style={[
                                                            styles.historyItemCoords,
                                                            isDark && styles.darkHistoryItemCoords,
                                                        ]}
                                                    >
                                                        {item.message}
                                                    </Text>

                                                    <Text
                                                        style={[
                                                            styles.historyItemDate,
                                                            isDark && styles.darkHistoryItemDate,
                                                        ]}
                                                    >
                                                        {formatDate(item.createdAt)}
                                                    </Text>
                                                </View>

                                                {hasPosition && (
                                                    <MaterialIcons
                                                        name="chevron-right"
                                                        size={20}
                                                        color={isDark ? '#667384' : '#CCCCCC'}
                                                    />
                                                )}
                                            </TouchableOpacity>
                                        );
                                    }}
                                />
                            )
                        ) : routes.length === 0 ? (
                            <Text style={emptyTextStyle}>
                                Nenhuma rota registrada ainda. O servidor grava as rotas automaticamente sempre que o rastreador se desloca.
                            </Text>
                        ) : (
                            <FlatList
                                data={routes}
                                keyExtractor={item => item.id}
                                renderItem={({ item }) => (
                                    <TouchableOpacity
                                        style={[
                                            styles.historyItem,
                                            isDark && styles.darkHistoryItem,
                                        ]}
                                        onPress={() => handleSelectRoute(item)}
                                        activeOpacity={0.7}
                                    >
                                        <MaterialIcons
                                            name="alt-route"
                                            size={20}
                                            color={isDark ? '#AEB8C5' : '#888'}
                                            style={{ marginRight: 8 }}
                                        />

                                        <View style={{ flex: 1 }}>
                                            <Text
                                                style={[
                                                    styles.historyItemTitle,
                                                    isDark && styles.darkHistoryItemTitle,
                                                ]}
                                            >
                                                {formatDistance(item.distanceKm)}
                                            </Text>

                                            <Text
                                                style={[
                                                    styles.historyItemCoords,
                                                    isDark && styles.darkHistoryItemCoords,
                                                ]}
                                            >
                                                {formatRouteDuration(item.startTime, item.endTime)}
                                            </Text>

                                            <Text
                                                style={[
                                                    styles.historyItemDate,
                                                    isDark && styles.darkHistoryItemDate,
                                                ]}
                                            >
                                                {formatDate(item.startTime)} {' • '} até {formatDate(item.endTime)}
                                            </Text>
                                        </View>

                                        <MaterialIcons
                                            name="chevron-right"
                                            size={20}
                                            color={isDark ? '#667384' : '#CCCCCC'}
                                        />
                                    </TouchableOpacity>
                                )}
                            />
                        )}
                    </View>
                </>
            )}

            {/* ================================================== */}
            {/* LISTA DO DROPDOWN — fica por último e absoluta para */}
            {/* sobrepor o conteúdo em vez de empurrá-lo para baixo */}
            {/* ================================================== */}

            {dropdownFrame && (

                <DropdownPanel
                    open={dropdownOpen}
                    style={[
                        dropdownListStyle,
                        styles.dropdownListFloating,
                        {
                            top: dropdownFrame.y + dropdownFrame.height + 4,
                            left: dropdownFrame.x,
                            width: dropdownFrame.width,
                        },
                    ]}
                >

                    <FlatList
                        data={trackers}
                        keyExtractor={
                            item => item.id
                        }
                        style={{
                            maxHeight: 220,
                        }}
                        ListEmptyComponent={

                            <Text
                                style={
                                    emptyTextStyle
                                }
                            >
                                Nenhum rastreador
                                cadastrado.
                            </Text>

                        }
                        renderItem={({
                            item,
                        }) => (

                            <TouchableOpacity
                                style={[
                                    styles.dropdownItem,
                                    isDark &&
                                    styles.darkDropdownItem,
                                ]}
                                onPress={() =>
                                    handleSelectTracker(
                                        item
                                    )
                                }
                            >

                                <Text
                                    style={[
                                        styles.dropdownItemText,
                                        isDark &&
                                        styles.darkDropdownItemText,
                                    ]}
                                >
                                    {item.name}
                                </Text>

                                <Text
                                    style={[
                                        styles.dropdownItemSubtext,
                                        isDark &&
                                        styles.darkDropdownItemSubtext,
                                    ]}
                                >
                                    {item.phone}
                                </Text>

                            </TouchableOpacity>

                        )}
                    />

                </DropdownPanel>

            )}
        </View>
    );
}
