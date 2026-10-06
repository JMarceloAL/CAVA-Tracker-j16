import React, { useCallback, useState } from 'react';

import {
    View,
    Text,
    TouchableOpacity,
    FlatList,
    ActivityIndicator,
} from 'react-native';

import AsyncStorage from '@react-native-async-storage/async-storage';

import { useFocusEffect } from '@react-navigation/native';

import { MaterialIcons } from '@expo/vector-icons';

import { getLocationHistory } from '../../services/storage/LastlocationStorage';

import {
    getRoutes,
    type TrackerRoute,
} from '../../services/storage/RouteHistoryStorage';

import { syncTrackerHistory } from '../../services/TrackerHistorySync';

import { normalizeServerDate } from '../../utils/serverDate';
import { eventAppearance } from '../../utils/trackerEvents';

import {
    fetchTrackerEvents,
    type ApiTrackerEvent,
} from '../../services/TrackerApiService';

import type {
    Tracker,
    TrackerLocation,
} from '../../types/Tracker';

import { useTheme } from '../../contexts/ThemeContext';
import { useTrackerSelection } from '../../contexts/TrackerSelectionContext';
import { APP_GREEN } from '../../theme/colors';

import { styles } from './styles';

const STORAGE_KEY = '@cavalleta:trackers';

type TabKey = 'locations' | 'routes' | 'alerts';

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

            <View style={styles.dropdownContainer}>

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

                    <Text
                        style={chevronStyle}
                    >
                        {dropdownOpen
                            ? '▲'
                            : '▼'}
                    </Text>

                </TouchableOpacity>

                {dropdownOpen && (

                    <View
                        style={
                            dropdownListStyle
                        }
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

                    </View>

                )}

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
                                size={16}
                                color={activeTab === 'locations' ? '#FFFFFF' : colors.textMuted}
                            />

                            <Text
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
                                size={16}
                                color={activeTab === 'routes' ? '#FFFFFF' : colors.textMuted}
                            />

                            <Text
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
                                activeTab === 'alerts' && styles.tabButtonActive,
                                activeTab === 'alerts' && { backgroundColor: colors.primary, borderColor: colors.primary },
                            ]}
                            onPress={() => setActiveTab('alerts')}
                        >
                            <MaterialIcons
                                name="notifications"
                                size={16}
                                color={activeTab === 'alerts' ? '#FFFFFF' : colors.textMuted}
                            />

                            <Text
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
        </View>
    );
}