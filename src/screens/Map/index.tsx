
import React, {
    useState,
    useEffect,
    useCallback,
    useRef,
} from 'react';

import {
    View,
    ActivityIndicator,
    Text,
    Linking,
    Alert,
} from 'react-native';

import AsyncStorage from '@react-native-async-storage/async-storage';

import {
    useFocusEffect,
    useRoute,
    useNavigation,
} from '@react-navigation/native';

import TrackerMap, {
    type TrackerMapHandle,
} from '../../components/TrackerMap';

import TrackerDropdown from '../../components/TrackerDropdown';

import MapControls from '../../components/MapControls';

import RecenterButton from '../../components/RecenterButton';

import {
    useRealTime,
} from '../../contexts/RealTimeContext';

import {
    useTrackerServiceProvider,
} from '../../contexts/TrackerServiceContext';

import {
    requestSmsPermissions,
} from '../../services/Smsgateway';

import {
    requestNotificationPermissions,
} from '../../services/NotificationService';

import {
    saveLastLocation,
    getLastLocation,
    saveStoppedLocation,
} from '../../services/storage/LastlocationStorage';

import {
    checkRealtimeAvailability,
} from '../../services/TrackerApiService';

import {
    isIgnoringBatteryOptimizations,
    requestIgnoreBatteryOptimizations,
} from '../../services/VigilanteBackground';
import { useTrackerSelection } from '../../contexts/TrackerSelectionContext';

import type {
    Tracker,
    TrackerLocation,
} from '../../types/Tracker';

import { styles } from './styles';
import { useTheme } from '../../contexts/ThemeContext';

const STORAGE_KEY =
    '@cavalleta:trackers';

/** Velocidade do rastreador (km/h, como vem do servidor) arredondada. */
function formatSpeedKmh(value: number | undefined) {
    const speed = Number(value);

    return Number.isFinite(speed) ? Math.max(0, Math.round(speed)) : 0;
}

/**
 * Distância da viagem para o painel do mapa: abaixo de 1 km em
 * metros ("230 m"), acima em km com vírgula ("1,25 km").
 */
function formatTripDistance(valueKm: number): { value: string; unit: string } {
    const km = Number.isFinite(valueKm) ? Math.max(0, valueKm) : 0;

    const meters = Math.round(km * 1000);

    if (meters < 1000) {
        return { value: String(meters), unit: 'm' };
    }

    const decimals = km >= 100 ? 0 : km >= 10 ? 1 : 2;

    return {
        value: km.toFixed(decimals).replace('.', ','),
        unit: 'km',
    };
}

function isSameTracker(
    a: Tracker | null | undefined,
    b: Tracker | null | undefined
) {
    return (
        !!a &&
        !!b &&
        a.id === b.id &&
        a.name === b.name &&
        a.phone === b.phone &&
        a.imei === b.imei
    );
}

export default function MapScreen() {
    const { colors, isDark } = useTheme();

    // ============================================================
    // CONTEXT
    // ============================================================

    const {
        setSelectedTrackerId,
        resolveSelectedTracker,
    } = useTrackerSelection();

    const {
        isMoving,
        currentTripDistanceKm,

        realTimeEnabled:
        globalRealTimeEnabled,

        activeTrackerId,

        latestLocation,

        routePoints,

        startRealTime,

        stopRealTime,

        realTimeError,

        // Vigilante
        vigilanteEnabled:
        globalVigilanteEnabled,

        activeVigilanteTrackerId,

        startVigilante,

        stopVigilante,

        vigilanteError,
    } = useRealTime();

    // ============================================================
    // NAVEGAÇÃO
    // ============================================================

    const route =
        useRoute<any>();

    const navigation =
        useNavigation<any>();

    // ============================================================
    // SERVIÇO SMS
    // ============================================================

    const {
        getService,
    } = useTrackerServiceProvider();

    // ============================================================
    // MAPA
    // ============================================================

    const mapRef =
        useRef<TrackerMapHandle>(
            null
        );

    // ============================================================
    // TRACKERS
    // ============================================================

    const [
        trackers,
        setTrackers,
    ] = useState<Tracker[]>([]);

    const [
        selectedTracker,
        setSelectedTracker,
    ] =
        useState<Tracker | null>(
            null
        );

    // ============================================================
    // LOCALIZAÇÃO
    // ============================================================

    const [
        location,
        setLocation,
    ] =
        useState<TrackerLocation | null>(
            null
        );

    // De qual rastreador é a localização exibida. Evita mostrar a
    // posição de um rastreador como se fosse de outro, e evita que o
    // cache local sobrescreva uma posição mais nova (Tempo Real,
    // histórico, SMS).
    const locationOwnerRef =
        useRef<string | null>(null);

    const showLocation =
        useCallback(
            (
                next: TrackerLocation | null,
                ownerId: string | null
            ) => {
                locationOwnerRef.current =
                    next ? ownerId : null;

                setLocation(next);
            },
            []
        );

    // Pedido de localização por SMS vindo da tela SMS (botão
    // "Localização"), executado assim que o rastreador estiver
    // selecionado.
    const [
        autoRequestTrackerId,
        setAutoRequestTrackerId,
    ] = useState<string | null>(null);

    // ============================================================
    // HISTÓRICO
    // ============================================================

    const [
        historyRoutePoints,
        setHistoryRoutePoints,
    ] =
        useState<TrackerLocation[]>(
            []
        );

    const [
        isHistoricalRoute,
        setIsHistoricalRoute,
    ] = useState(false);

    // ============================================================
    // LOADING
    // ============================================================

    const [
        loading,
        setLoading,
    ] = useState(true);

    // ============================================================
    // TEMPO REAL
    // ============================================================

    const [
        realTimeEnabled,
        setRealTimeEnabled,
    ] = useState(false);

    const [
        checkingRealTime,
        setCheckingRealTime,
    ] = useState(false);

    // ============================================================
    // SMS
    // ============================================================

    const [
        smsLoading,
        setSmsLoading,
    ] = useState(false);

    // ============================================================
    // VIGILANTE
    // ============================================================

    const [
        checkingVigilante,
        setCheckingVigilante,
    ] = useState(false);

    // ============================================================
    // MODO SEGUIR
    // ============================================================

    const [
        followEnabled,
        setFollowEnabled,
    ] = useState(true);

    // ============================================================
    // CARREGAR TRACKERS
    // ============================================================

    const loadTrackers =
        useCallback(
            async () => {
                try {
                    const stored =
                        await AsyncStorage.getItem(
                            STORAGE_KEY
                        );

                    const list: Tracker[] =
                        stored
                            ? JSON.parse(
                                stored
                            )
                            : [];

                    setTrackers(list);

                    const requestedId =
                        route.params
                            ?.trackerId;

                    const autoRequest =
                        route.params
                            ?.autoRequestLocation === true;

                    const requestedTracker =
                        requestedId
                            ? list.find(tracker => tracker.id === requestedId)
                            : undefined;

                    // Consome os parâmetros de navegação. Se ficassem
                    // nos params, toda vez que a aba Mapa ganhasse foco
                    // o app voltaria pra esse rastreador — desfazendo a
                    // escolha feita no dropdown e desligando o Tempo Real.
                    if (requestedId || autoRequest) {
                        navigation.setParams({
                            trackerId: undefined,
                            autoRequestLocation: undefined,
                        });
                    }

                    const nextTracker =
                        requestedTracker ??
                        resolveSelectedTracker(list);

                    setSelectedTracker(
                        previous =>
                            isSameTracker(previous, nextTracker)
                                ? previous
                                : nextTracker ?? null
                    );

                    if (nextTracker) {
                        setSelectedTrackerId(nextTracker.id);

                        if (autoRequest && requestedTracker) {
                            setAutoRequestTrackerId(nextTracker.id);
                        }
                    }
                } catch (error) {
                    console.warn(
                        'Erro ao carregar rastreadores:',
                        error
                    );
                } finally {
                    setLoading(false);
                }
            },
            [
                route.params?.trackerId,
                route.params?.autoRequestLocation,
                navigation,
                resolveSelectedTracker,
                setSelectedTrackerId,
            ]
        );

    useFocusEffect(
        useCallback(() => {
            void loadTrackers();
        }, [loadTrackers])
    );

    // ============================================================
    // SINCRONIZA TEMPO REAL
    // ============================================================

    useEffect(() => {
        setRealTimeEnabled(
            globalRealTimeEnabled
        );
    }, [
        globalRealTimeEnabled,
    ]);

    // ============================================================
    // ERRO TEMPO REAL
    // ============================================================

    useEffect(() => {
        if (!realTimeError) {
            return;
        }

        Alert.alert(
            '📡 Conexão perdida',
            realTimeError
        );
    }, [
        realTimeError,
    ]);

    // ============================================================
    // ERRO VIGILANTE
    // ============================================================

    useEffect(() => {
        if (!vigilanteError) {
            return;
        }

        Alert.alert(
            '🛡️ Modo Vigilante',
            vigilanteError
        );
    }, [
        vigilanteError,
    ]);

    // ============================================================
    // TROCA DE TRACKER
    // ============================================================

    const selectedTrackerId =
        selectedTracker?.id ?? null;

    useEffect(() => {
        if (!selectedTrackerId) {
            return;
        }

        setSelectedTrackerId(selectedTrackerId);

        // A tela já está mostrando uma posição desse rastreador
        // (Tempo Real, histórico, SMS) — nada a fazer.
        if (
            locationOwnerRef.current ===
            selectedTrackerId
        ) {
            return;
        }

        // Trocou de rastreador: sai da rota histórica do anterior e
        // mostra a última posição conhecida deste — ou nenhuma, se
        // não houver (antes ficava a posição do rastreador anterior).
        setHistoryRoutePoints([]);
        setIsHistoricalRoute(false);
        setFollowEnabled(true);

        let cancelled = false;

        void getLastLocation(
            selectedTrackerId
        ).then(last => {
            if (
                cancelled ||
                locationOwnerRef.current ===
                selectedTrackerId
            ) {
                return;
            }

            showLocation(
                last,
                selectedTrackerId
            );
        });

        return () => {
            cancelled = true;
        };
    }, [
        selectedTrackerId,
        setSelectedTrackerId,
        showLocation,
    ]);

    // Tempo Real / Vigilante de outro rastreador são desligados ao
    // trocar de rastreador.
    useEffect(() => {
        if (!selectedTrackerId) {
            return;
        }

        if (
            globalRealTimeEnabled &&
            selectedTrackerId !==
            activeTrackerId
        ) {
            stopRealTime();
        }

        if (
            globalVigilanteEnabled &&
            selectedTrackerId !==
            activeVigilanteTrackerId
        ) {
            stopVigilante();
        }
    }, [
        selectedTrackerId,
        globalRealTimeEnabled,
        activeTrackerId,
        globalVigilanteEnabled,
        activeVigilanteTrackerId,
        stopRealTime,
        stopVigilante,
    ]);

    // Localização por SMS pedida pela tela SMS.
    useEffect(() => {
        if (
            !autoRequestTrackerId ||
            selectedTrackerId !==
            autoRequestTrackerId
        ) {
            return;
        }

        setAutoRequestTrackerId(null);

        void handleRequestSmsLocation();
    }, [
        autoRequestTrackerId,
        selectedTrackerId,
    ]);

    // ============================================================
    // LOCALIZAÇÃO DO TEMPO REAL
    // ============================================================

    useEffect(() => {
        if (isHistoricalRoute) {
            return;
        }

        if (
            globalRealTimeEnabled &&
            latestLocation &&
            selectedTracker?.id ===
            activeTrackerId
        ) {
            showLocation(
                latestLocation,
                activeTrackerId
            );
        }
    }, [
        latestLocation,
        globalRealTimeEnabled,
        activeTrackerId,
        selectedTracker,
        isHistoricalRoute,
        showLocation,
    ]);

    // ============================================================
    // HISTORY -> LOCATION
    // ============================================================

    useEffect(() => {
        const historyLocation =
            route.params
                ?.historyLocation;

        if (!historyLocation) {
            return;
        }

        stopRealTime();

        setRealTimeEnabled(false);

        stopVigilante();

        setHistoryRoutePoints([]);

        setIsHistoricalRoute(false);

        setFollowEnabled(true);

        showLocation(
            historyLocation,
            route.params?.trackerId ??
            selectedTracker?.id ??
            null
        );

        navigation.setParams({
            historyLocation:
                undefined,
        });
    }, [
        route.params?.historyLocation,
        navigation,
        stopRealTime,
        stopVigilante,
        showLocation,
    ]);

    // ============================================================
    // HISTORY -> ROUTE
    // ============================================================

    useFocusEffect(
        useCallback(() => {
            const incomingRoute =
                route.params?.routePoints;

            if (
                !Array.isArray(incomingRoute) ||
                incomingRoute.length < 2
            ) {
                return;
            }

            console.log(
                '[MapScreen] Nova rota histórica recebida:',
                incomingRoute.length,
                'pontos'
            );

            // ========================================================
            // DESLIGA MODOS QUE NÃO PODEM RODAR JUNTO COM HISTÓRICO
            // ========================================================

            stopRealTime();
            stopVigilante();

            setRealTimeEnabled(false);

            // ========================================================
            // DEFINE A ROTA HISTÓRICA
            // ========================================================

            setHistoryRoutePoints(
                [...incomingRoute]
            );

            setIsHistoricalRoute(true);

            // ========================================================
            // POSIÇÃO FINAL DA ROTA
            // ========================================================

            const lastPoint =
                incomingRoute[
                incomingRoute.length - 1
                ];

            if (lastPoint) {
                showLocation(
                    lastPoint,
                    route.params?.trackerId ??
                    selectedTracker?.id ??
                    null
                );
            }

            // ========================================================
            // MAPA LIVRE / SEGUIDOR
            // ========================================================

            setFollowEnabled(true);

            // ========================================================
            // CONSUME O PARAMETRO
            //
            // Isso é importante para não deixar a mesma rota
            // pendurada nos params da navegação.
            // ========================================================

            navigation.setParams({
                routePoints: undefined,
            });
        }, [
            route.params?.routePoints,
            navigation,
            stopRealTime,
            stopVigilante,
            showLocation,
        ])
    );

    // ============================================================
    // MAPA EXTERNO
    // ============================================================

    function handleOpenExternalMap() {
        if (!location) {
            Alert.alert(
                'Aviso',
                'Nenhuma localização disponível ainda.'
            );

            return;
        }

        const url =
            `https://www.google.com/maps?q=` +
            `${location.latitude},${location.longitude}`;

        Linking.openURL(url).catch(
            error => {
                console.warn(
                    'Erro ao abrir mapa externo:',
                    error
                );

                Alert.alert(
                    'Erro',
                    'Não foi possível abrir o mapa externo.'
                );
            }
        );
    }

    // ============================================================
    // ÚLTIMA LOCALIZAÇÃO
    // ============================================================

    async function handleShowLastLocation() {
        if (!selectedTracker) {
            Alert.alert(
                'Aviso',
                'Selecione um rastreador primeiro.'
            );

            return;
        }

        setHistoryRoutePoints([]);

        setIsHistoricalRoute(
            false
        );

        const last =
            await getLastLocation(
                selectedTracker.id
            );

        if (!last) {
            Alert.alert(
                'Última localização',
                'Nenhuma localização registrada para este rastreador.'
            );

            return;
        }

        setFollowEnabled(true);

        showLocation(
            last,
            selectedTracker.id
        );
    }

    // ============================================================
    // SMS
    // ============================================================

    async function handleRequestSmsLocation() {
        if (!selectedTracker) {
            Alert.alert(
                'Aviso',
                'Selecione um rastreador primeiro.'
            );

            return;
        }

        if (!selectedTracker.phone) {
            Alert.alert(
                'Telefone necessário',
                'Este rastreador não possui um telefone cadastrado.'
            );

            return;
        }

        setSmsLoading(true);

        try {
            await requestSmsPermissions();

            const service =
                getService(
                    selectedTracker.phone
                );

            const reply =
                await service.getLocation();

            const newLocation:
                TrackerLocation = {
                latitude: Number(reply.latitude),
                longitude: Number(reply.longitude),
                speed: Number(
                    'speed' in reply && reply.speed != null
                        ? reply.speed
                        : 0
                ),
                lastUpdate:
                    'timestamp' in reply
                        ? reply.timestamp
                        : new Date().toISOString(),
            };

            setHistoryRoutePoints([]);

            setIsHistoricalRoute(
                false
            );

            setFollowEnabled(true);

            showLocation(
                newLocation,
                selectedTracker.id
            );

            await saveLastLocation(
                selectedTracker.id,
                newLocation
            );

            if (
                !newLocation.speed ||
                newLocation.speed <= 2
            ) {
                await saveStoppedLocation(
                    selectedTracker.id,
                    newLocation
                );
            }
        } catch (error: any) {
            if (
                error?.code ===
                'NO_SIGNAL'
            ) {
                Alert.alert(
                    '📡 Sem sinal de GPS',
                    'O rastreador não conseguiu obter sua localização. Verifique se o dispositivo está em local aberto e tente novamente em alguns instantes.'
                );
            } else {
                Alert.alert(
                    'Erro ao buscar localização',
                    error instanceof Error
                        ? error.message
                        : 'Não foi possível obter a localização.'
                );
            }
        } finally {
            setSmsLoading(false);
        }
    }

    // ============================================================
    // TEMPO REAL
    // ============================================================

    async function handleToggleRealTime(
        value: boolean
    ) {
        if (!value) {
            stopRealTime();

            setRealTimeEnabled(false);

            return;
        }

        if (!selectedTracker) {
            Alert.alert(
                'Rastreador necessário',
                'Selecione um rastreador primeiro.'
            );

            return;
        }

        if (!selectedTracker.imei) {
            Alert.alert(
                'IMEI necessário',
                'O Tempo Real precisa do IMEI do rastreador.'
            );

            return;
        }

        setHistoryRoutePoints([]);

        setIsHistoricalRoute(false);

        setCheckingRealTime(true);

        try {
            const result =
                await checkRealtimeAvailability(
                    selectedTracker.imei
                );

            if (
                result.status ===
                'no-connection'
            ) {
                stopRealTime();

                setRealTimeEnabled(
                    false
                );

                Alert.alert(
                    '📡 Sem conexão',
                    'Não foi possível conectar ao servidor.'
                );

                return;
            }

            const started =
                await startRealTime(
                    selectedTracker.id,
                    selectedTracker.name,
                    selectedTracker.imei
                );

            if (!started) {
                setRealTimeEnabled(
                    false
                );

                Alert.alert(
                    '📡 Erro',
                    'Não foi possível iniciar o Tempo Real.'
                );

                return;
            }

            setRealTimeEnabled(
                true
            );

            setFollowEnabled(
                true
            );

            if (
                result.status ===
                'available' &&
                result.location
            ) {
                showLocation(
                    result.location,
                    selectedTracker.id
                );

                await saveLastLocation(
                    selectedTracker.id,
                    result.location
                );
            }

            if (
                result.status ===
                'no-location'
            ) {
                Alert.alert(
                    '📍 Aguardando localização',
                    'A API está conectada, mas o rastreador ainda não enviou uma localização válida. O Tempo Real continuará tentando automaticamente.'
                );
            }
        } catch (error: any) {
            stopRealTime();

            setRealTimeEnabled(
                false
            );

            const message =
                error?.message
                    ?.toLowerCase?.() ??
                '';

            if (
                message.includes(
                    'failed to fetch'
                ) ||
                message.includes(
                    'network'
                ) ||
                message.includes(
                    'offline'
                )
            ) {
                Alert.alert(
                    '📡 Sem conexão com o servidor',
                    'Não foi possível conectar à API do rastreador. Verifique a internet ou o servidor.'
                );

                return;
            }

            Alert.alert(
                'Erro no Tempo Real',
                error instanceof Error
                    ? error.message
                    : 'Não foi possível ativar o Tempo Real.'
            );
        } finally {
            setCheckingRealTime(
                false
            );
        }
    }

    // ============================================================
    // MODO VIGILANTE
    // ============================================================

    async function handleToggleVigilante(
        value: boolean
    ) {
        // --------------------------------------------------------
        // DESLIGAR
        // --------------------------------------------------------

        if (!value) {
            stopVigilante();

            return;
        }

        // --------------------------------------------------------
        // TRACKER
        // --------------------------------------------------------

        if (!selectedTracker) {
            Alert.alert(
                'Rastreador necessário',
                'Selecione um rastreador primeiro.'
            );

            return;
        }

        // --------------------------------------------------------
        // IMEI
        // --------------------------------------------------------

        if (!selectedTracker.imei) {
            Alert.alert(
                'IMEI necessário',
                'O Modo Vigilante precisa do IMEI do rastreador.'
            );

            return;
        }

        // --------------------------------------------------------
        // NOTIFICAÇÕES
        // --------------------------------------------------------

        const granted =
            await requestNotificationPermissions();

        if (!granted) {
            Alert.alert(
                'Permissão necessária',
                'Ative as notificações para usar o Modo Vigilante.'
            );

            return;
        }

        setCheckingVigilante(
            true
        );

        try {
            const started =
                await startVigilante(
                    selectedTracker.id,
                    selectedTracker.name,
                    selectedTracker.imei
                );

            if (!started) {
                Alert.alert(
                    '🛡️ Erro de conexão',
                    'Não foi possível ativar o Modo Vigilante.'
                );

                return;
            }

            /*
             * O estado verdadeiro vem do Context.
             *
             * Não usamos mais setVigilanteEnabled()
             * localmente.
             */
            setFollowEnabled(true);

            // Com a otimização de bateria ligada, alguns aparelhos
            // ainda pausam o app mesmo com o serviço em primeiro
            // plano — pede a exceção (uma vez; depois fica salva).
            if (!isIgnoringBatteryOptimizations()) {
                Alert.alert(
                    '🛡️ Vigilante em segundo plano',
                    'Para o Modo Vigilante continuar avisando com a tela bloqueada, permita que o app não seja restringido pela economia de bateria.',
                    [
                        { text: 'Agora não', style: 'cancel' },
                        {
                            text: 'Permitir',
                            onPress: () => {
                                try {
                                    requestIgnoreBatteryOptimizations();
                                } catch (error) {
                                    console.warn('Erro ao abrir ajuste de bateria:', error);
                                }
                            },
                        },
                    ]
                );
            }
        } catch (error) {
            console.warn(
                'Erro ao iniciar Modo Vigilante:',
                error
            );

            Alert.alert(
                '🛡️ Erro',
                'Não foi possível ativar o Modo Vigilante.'
            );
        } finally {
            setCheckingVigilante(
                false
            );
        }
    }

    // ============================================================
    // RECENTRALIZAR
    // ============================================================

    function handleRecenter() {
        setFollowEnabled(true);

        mapRef.current?.centerOnTracker();
    }

    // ============================================================
    // USUÁRIO ARRASTOU MAPA
    // ============================================================

    function handleUserPanned() {
        setFollowEnabled(false);
    }

    // ============================================================
    // ROTA EXIBIDA
    // ============================================================

    // Rota histórica, ou o trajeto do Tempo Real do rastreador
    // exibido (desenhado sem prender a câmera).
    const showingLiveTrail =
        !isHistoricalRoute &&
        realTimeEnabled &&
        selectedTracker?.id ===
        activeTrackerId;

    const displayedRoutePoints =
        isHistoricalRoute
            ? historyRoutePoints
            : showingLiveTrail
                ? routePoints
                : [];

    const tripDistance =
        formatTripDistance(currentTripDistanceKm);

    // ============================================================
    // RENDER
    // ============================================================

    return (
        <View
            style={{
                flex: 1,
            }}
        >
            {loading ? (
                <View
                    style={{
                        flex: 1,
                        justifyContent:
                            'center',
                        alignItems:
                            'center',
                    }}
                >
                    <ActivityIndicator />
                </View>
            ) : location ? (
                <TrackerMap
                    ref={mapRef}
                    location={location}
                    routePoints={
                        displayedRoutePoints
                    }
                    fitRoute={
                        isHistoricalRoute
                    }
                    followEnabled={
                        followEnabled
                    }
                    onUserPanned={
                        handleUserPanned
                    }
                />
            ) : (
                <View
                    style={{
                        flex: 1,
                        justifyContent:
                            'center',
                        alignItems:
                            'center',
                        padding: 32,
                        backgroundColor: isDark
                            ? colors.background
                            : '#FFFFFF',
                    }}
                >
                    <View
                        style={{
                            width: 92,
                            height: 92,
                            borderRadius: 46,
                            backgroundColor: isDark
                                ? colors.surface
                                : '#F2F7EC',
                            justifyContent: 'center',
                            alignItems: 'center',
                            marginBottom: 18,
                            borderWidth: 1,
                            borderColor: isDark ? colors.border : '#E7F0DF',
                        }}
                    >
                        <Text style={{ fontSize: 36, opacity: 0.9 }}>
                            {selectedTracker ? '📍' : '🛰️'}
                        </Text>
                    </View>

                    <Text
                        style={{
                            textAlign:
                                'center',
                            color: isDark
                                ? colors.text
                                : '#1F241C',
                            fontSize: 17,
                            fontWeight: '700',
                            marginBottom: 8,
                        }}
                    >
                        {selectedTracker
                            ? 'Nenhuma localização recebida ainda.'
                            : 'Nenhum rastreador cadastrado.'}
                    </Text>

                    <Text
                        style={{
                            textAlign:
                                'center',
                            color: isDark
                                ? colors.textMuted
                                : '#6C7D6A',
                            fontSize: 13,
                            lineHeight: 20,
                        }}
                    >
                        {selectedTracker
                            ? 'Aguarde a próxima atualização do rastreador para visualizar a rota e a posição no mapa.'
                            : 'Cadastre um rastreador para começar a acompanhar sua localização e histórico.'}
                    </Text>
                </View>
            )}

            {/* ==================================================
                DROPDOWN
            ================================================== */}

            <TrackerDropdown
                trackers={trackers}
                selectedTracker={
                    selectedTracker
                }
                onSelect={
                    setSelectedTracker
                }
            />

            {/* ==================================================
                RECENTRALIZAR
            ================================================== */}

            {location && (
                <RecenterButton
                    followEnabled={
                        followEnabled
                    }
                    onPress={
                        handleRecenter
                    }
                />
            )}

            {/* ==================================================
                CONTROLES
            ================================================== */}

            <MapControls
                onOpenExternalMap={
                    handleOpenExternalMap
                }

                onShowLastLocation={
                    handleShowLastLocation
                }

                onRequestSmsLocation={
                    handleRequestSmsLocation
                }

                smsLoading={
                    smsLoading
                }

                realTimeEnabled={
                    realTimeEnabled
                }

                onToggleRealTime={
                    handleToggleRealTime
                }

                checkingRealTime={
                    checkingRealTime
                }

                realTimeDisabled={
                    false
                }

                vigilanteEnabled={
                    globalVigilanteEnabled
                }

                onToggleVigilante={
                    handleToggleVigilante
                }

                tripInfo={
                    realTimeEnabled &&
                        !isHistoricalRoute &&
                        isMoving
                        ? {
                            speed: `${formatSpeedKmh(latestLocation?.speed)} km/h`,
                            distance: `${tripDistance.value} ${tripDistance.unit}`,
                        }
                        : null
                }

                checkingVigilante={
                    checkingVigilante
                }

                vigilanteDisabled={
                    false
                }
            />
        </View>
    );
}
