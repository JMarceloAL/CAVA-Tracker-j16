import React, {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useRef,
    useState,
} from 'react';

import {
    checkRealtimeAvailability,
    fetchTrackerData,
    fetchTrackerEvents,
    type ApiTrackerEvent,
} from '../services/TrackerApiService';

import type {
    TrackerLocation,
} from '../types/Tracker';

import {
    sendMovementNotification,
    sendTrackerEventNotification,
} from '../services/NotificationService';

import {
    RealtimeSocket,
    type RealtimeMessage,
} from '../services/RealtimeSocket';

import {
    saveLastLocation,
} from '../services/storage/LastlocationStorage';

import {
    normalizeServerDate,
} from '../utils/serverDate';

import {
    addStopRequestedListener,
    startVigilanteBackground,
    stopVigilanteBackground,
} from '../services/VigilanteBackground';

interface RealTimeContextData {
    // ============================================================
    // TEMPO REAL
    // ============================================================

    realTimeEnabled: boolean;

    activeTrackerId: string | null;

    activeTrackerName: string | null;

    latestLocation: TrackerLocation | null;

    isMoving: boolean;

    currentTripDistanceKm: number;

    routePoints: TrackerLocation[];

    realTimeError: string | null;

    setRealTimeEnabled: (
        enabled: boolean,
        trackerId?: string,
        trackerName?: string,
        imei?: string
    ) => void;

    startRealTime: (
        trackerId: string,
        trackerName: string,
        imei: string
    ) => Promise<boolean>;

    stopRealTime: () => void;

    updateLocation: (
        location: TrackerLocation
    ) => void;

    // ============================================================
    // MODO VIGILANTE
    // ============================================================

    vigilanteEnabled: boolean;

    activeVigilanteTrackerId: string | null;

    activeVigilanteTrackerName: string | null;

    vigilanteError: string | null;

    startVigilante: (
        trackerId: string,
        trackerName: string,
        imei: string
    ) => Promise<boolean>;

    stopVigilante: () => void;
}

const RealTimeContext =
    createContext<RealTimeContextData | undefined>(
        undefined
    );

const POLLING_INTERVAL = 5000;

const VIGILANTE_POLLING_INTERVAL = 5000;

const MOVEMENT_DISTANCE_METERS = 10;

// O Vigilante usa um raio maior: com o veículo parado, a oscilação
// normal do GPS passa fácil de 10 m e geraria alerta falso de
// movimento. 30 m é o mesmo raio que o servidor usa.
const VIGILANTE_MOVEMENT_DISTANCE_METERS = 30;

// Falhas de rede seguidas toleradas antes de desligar o Tempo Real
// ou o Vigilante (3 x 5 s = ~15 s sem resposta do servidor).
const MAX_CONSECUTIVE_FAILURES = 3;

// Com o WebSocket conectado, os dados chegam sozinhos na hora — o
// polling HTTP vira só uma garantia, a cada 30 s.
const SOCKET_FALLBACK_POLL_MS = 30 * 1000;

const MOVEMENT_SPEED_KMH = 3;

const RECENT_ROUTE_WINDOW_MS = 10 * 60 * 1000;

// ============================================================
// DISTÂNCIA
// ============================================================

function calculateDistanceKm(
    first: TrackerLocation,
    second: TrackerLocation
): number {
    const earthRadiusKm = 6371;

    const lat1 =
        (first.latitude * Math.PI) / 180;

    const lat2 =
        (second.latitude * Math.PI) / 180;

    const deltaLat =
        ((second.latitude - first.latitude) *
            Math.PI) /
        180;

    const deltaLng =
        ((second.longitude - first.longitude) *
            Math.PI) /
        180;

    const a =
        Math.sin(deltaLat / 2) *
        Math.sin(deltaLat / 2) +
        Math.cos(lat1) *
        Math.cos(lat2) *
        Math.sin(deltaLng / 2) *
        Math.sin(deltaLng / 2);

    const c =
        2 *
        Math.atan2(
            Math.sqrt(a),
            Math.sqrt(1 - a)
        );

    return earthRadiusKm * c;
}

function resolveVigilanteState(
    tracker: {
        movement?: {
            moving?: boolean;
            alarmPending?: boolean;
        } | null;
        gps?: {
            velocidade?: number | null;
            latitude?: number | null;
            longitude?: number | null;
        } | null;
        routes?: Array<{
            startSource?: string | null;
            startedAt?: string | null;
        }> | null;
    },
    previousLocation: TrackerLocation | null
): {
    moving: boolean;
    alarmPending: boolean;
} {
    const movement = tracker.movement;
    const gps = tracker.gps;
    const speedKmh = Number(gps?.velocidade ?? 0);

    const latestRoute =
        Array.isArray(tracker.routes) &&
            tracker.routes.length > 0
            ? tracker.routes[0]
            : null;

    const hasRecentAlarmRoute =
        !!latestRoute &&
        latestRoute.startSource === 'ALARM_AND_SPEED' &&
        !!latestRoute.startedAt &&
        Date.now() - Date.parse(latestRoute.startedAt) <= RECENT_ROUTE_WINDOW_MS;

    let moving =
        movement?.moving ??
        speedKmh > MOVEMENT_SPEED_KMH;

    if (
        !movement?.moving &&
        previousLocation &&
        typeof gps?.latitude === 'number' &&
        typeof gps?.longitude === 'number'
    ) {
        const distanceKm = calculateDistanceKm(
            previousLocation,
            {
                latitude: gps.latitude,
                longitude: gps.longitude,
                speed: speedKmh,
                lastUpdate: new Date().toISOString(),
            }
        );

        moving = moving || distanceKm * 1000 > VIGILANTE_MOVEMENT_DISTANCE_METERS;
    }

    const alarmPending =
        movement?.alarmPending ??
        hasRecentAlarmRoute;

    return {
        moving,
        alarmPending,
    };
}

// ============================================================
// PROVIDER
// ============================================================

export function RealTimeProvider({
    children,
}: {
    children: React.ReactNode;
}) {
    // ============================================================
    // TEMPO REAL
    // ============================================================

    const [
        realTimeEnabled,
        setRealTimeEnabledState,
    ] = useState(false);

    const [
        activeTrackerId,
        setActiveTrackerId,
    ] = useState<string | null>(null);

    const [
        activeTrackerName,
        setActiveTrackerName,
    ] = useState<string | null>(null);

    const [
        latestLocation,
        setLatestLocation,
    ] = useState<TrackerLocation | null>(
        null
    );

    const [
        isMoving,
        setIsMoving,
    ] = useState(false);

    const [
        currentTripDistanceKm,
        setCurrentTripDistanceKm,
    ] = useState(0);

    const [
        routePoints,
        setRoutePoints,
    ] = useState<TrackerLocation[]>([]);

    const [
        realTimeError,
        setRealTimeError,
    ] = useState<string | null>(null);

    const activeImeiRef =
        useRef<string | null>(null);

    // Id do rastreador do Tempo Real, pra salvar a última posição
    // no cache local a cada leitura do polling.
    const activeTrackerIdRef =
        useRef<string | null>(null);

    const pollingRef =
        useRef<ReturnType<typeof setInterval> | null>(
            null
        );

    const checkingRef =
        useRef(false);

    const realTimeFailuresRef =
        useRef(0);

    const realTimeSocketRef =
        useRef<RealtimeSocket | null>(null);

    const lastRealTimePollRef =
        useRef(0);

    const previousLocationRef =
        useRef<TrackerLocation | null>(null);

    const tripDistanceRef =
        useRef(0);

    // ============================================================
    // ATUALIZA LOCALIZAÇÃO
    // ============================================================

    const updateLocation = useCallback(
        (newLocation: TrackerLocation) => {
            const previous =
                previousLocationRef.current;

            if (previous) {
                const distanceKm =
                    calculateDistanceKm(
                        previous,
                        newLocation
                    );

                const distanceMeters =
                    distanceKm * 1000;

                const speed =
                    typeof newLocation.speed ===
                        'number'
                        ? newLocation.speed
                        : 0;

                const moving =
                    distanceMeters >=
                    MOVEMENT_DISTANCE_METERS ||
                    speed >= MOVEMENT_SPEED_KMH;

                if (moving) {
                    tripDistanceRef.current +=
                        distanceKm;

                    setCurrentTripDistanceKm(
                        tripDistanceRef.current
                    );

                    setIsMoving(true);

                    setRoutePoints(
                        previousPoints => {
                            const last =
                                previousPoints[
                                previousPoints.length -
                                1
                                ];

                            if (
                                last &&
                                last.latitude ===
                                newLocation.latitude &&
                                last.longitude ===
                                newLocation.longitude
                            ) {
                                return previousPoints;
                            }

                            return [
                                ...previousPoints,
                                newLocation,
                            ];
                        }
                    );
                } else {
                    setIsMoving(false);
                }
            } else {
                setRoutePoints([
                    newLocation,
                ]);
            }

            previousLocationRef.current =
                newLocation;

            setLatestLocation(
                newLocation
            );
        },
        []
    );

    // ============================================================
    // WEBSOCKET TEMPO REAL
    // ============================================================

    const handleRealTimeMessage =
        useCallback(
            (message: RealtimeMessage) => {
                if (message.tipo !== 'LOCATION') {
                    return;
                }

                const latitude = Number(message.latitude);
                const longitude = Number(message.longitude);

                if (
                    !Number.isFinite(latitude) ||
                    !Number.isFinite(longitude)
                ) {
                    return;
                }

                const location: TrackerLocation = {
                    latitude,
                    longitude,
                    speed: Number(message.velocidade ?? 0),
                    satellites:
                        typeof message.satelites === 'number'
                            ? message.satelites
                            : undefined,
                    lastUpdate:
                        normalizeServerDate(
                            typeof message.dataUTC === 'string'
                                ? message.dataUTC
                                : undefined
                        ) ??
                        new Date().toISOString(),
                };

                updateLocation(location);

                if (activeTrackerIdRef.current) {
                    void saveLastLocation(
                        activeTrackerIdRef.current,
                        location
                    );
                }
            },
            [updateLocation]
        );

    // ============================================================
    // LIMPAR TEMPO REAL
    // ============================================================

    const clearPolling =
        useCallback(() => {
            if (pollingRef.current) {
                clearInterval(
                    pollingRef.current
                );

                pollingRef.current =
                    null;
            }

            // Todo caminho que desliga o Tempo Real passa por aqui.
            realTimeSocketRef.current?.close();
            realTimeSocketRef.current = null;
        }, []);

    const clearRoute =
        useCallback(() => {
            setRoutePoints([]);

            previousLocationRef.current =
                null;

            tripDistanceRef.current =
                0;

            setCurrentTripDistanceKm(0);

            setIsMoving(false);
        }, []);

    // ============================================================
    // POLLING TEMPO REAL
    // ============================================================

    const pollLocation =
        useCallback(async () => {
            const imei =
                activeImeiRef.current;

            if (
                !imei ||
                checkingRef.current
            ) {
                return;
            }

            if (
                realTimeSocketRef.current?.isConnected &&
                Date.now() - lastRealTimePollRef.current <
                SOCKET_FALLBACK_POLL_MS
            ) {
                return;
            }

            lastRealTimePollRef.current = Date.now();

            checkingRef.current = true;

            // Só desliga depois de várias falhas seguidas — uma
            // oscilação isolada do 4G não derruba o Tempo Real.
            const registerFailure = () => {
                realTimeFailuresRef.current += 1;

                if (
                    realTimeFailuresRef.current <
                    MAX_CONSECUTIVE_FAILURES
                ) {
                    return;
                }

                clearPolling();

                setRealTimeEnabledState(
                    false
                );

                activeImeiRef.current =
                    null;

                setRealTimeError(
                    'A conexão com o servidor foi perdida. O Tempo Real foi desligado.'
                );
            };

            try {
                const availability =
                    await checkRealtimeAvailability(
                        imei
                    );

                if (
                    availability.status ===
                    'no-connection'
                ) {
                    registerFailure();

                    return;
                }

                realTimeFailuresRef.current = 0;

                if (
                    availability.status ===
                    'no-location'
                ) {
                    return;
                }

                if (
                    availability.status ===
                    'available' &&
                    availability.location
                ) {
                    updateLocation(
                        availability.location
                    );

                    if (activeTrackerIdRef.current) {
                        void saveLastLocation(
                            activeTrackerIdRef.current,
                            availability.location
                        );
                    }
                }
            } catch (error) {
                console.warn(
                    'Erro no polling do Tempo Real:',
                    error
                );

                registerFailure();
            } finally {
                checkingRef.current =
                    false;
            }
        }, [
            clearPolling,
            updateLocation,
        ]);

    // ============================================================
    // SET TEMPO REAL
    // ============================================================

    const setRealTimeEnabled =
        useCallback(
            (
                enabled: boolean,
                trackerId?: string,
                trackerName?: string,
                imei?: string
            ) => {
                if (!enabled) {
                    clearPolling();

                    activeImeiRef.current =
                        null;

                    setRealTimeEnabledState(
                        false
                    );

                    return;
                }

                setRealTimeError(null);

                setRealTimeEnabledState(
                    true
                );

                if (trackerId) {
                    setActiveTrackerId(
                        trackerId
                    );

                    activeTrackerIdRef.current =
                        trackerId;
                }

                if (trackerName) {
                    setActiveTrackerName(
                        trackerName
                    );
                }

                if (imei) {
                    activeImeiRef.current =
                        imei;
                }
            },
            [clearPolling]
        );

    // ============================================================
    // INICIAR TEMPO REAL
    // ============================================================

    const startRealTime =
        useCallback(
            async (
                trackerId: string,
                trackerName: string,
                imei: string
            ): Promise<boolean> => {
                clearPolling();

                setRealTimeError(null);

                setActiveTrackerId(
                    trackerId
                );

                setActiveTrackerName(
                    trackerName
                );

                activeImeiRef.current =
                    imei;

                activeTrackerIdRef.current =
                    trackerId;

                realTimeFailuresRef.current = 0;

                clearRoute();

                setLatestLocation(null);

                try {
                    const availability =
                        await checkRealtimeAvailability(
                            imei
                        );

                    if (
                        availability.status ===
                        'no-connection'
                    ) {
                        activeImeiRef.current =
                            null;

                        setRealTimeEnabledState(
                            false
                        );

                        setRealTimeError(
                            'Não foi possível conectar ao servidor. O Tempo Real não foi iniciado.'
                        );

                        return false;
                    }

                    if (
                        availability.status ===
                        'available' &&
                        availability.location
                    ) {
                        updateLocation(
                            availability.location
                        );
                    }

                    setRealTimeEnabledState(
                        true
                    );

                    pollingRef.current =
                        setInterval(() => {
                            void pollLocation();
                        }, POLLING_INTERVAL);

                    // Posição em tempo real pelo WebSocket; o polling
                    // acima vira garantia enquanto ele estiver conectado.
                    realTimeSocketRef.current =
                        new RealtimeSocket(imei, {
                            onMessage: handleRealTimeMessage,
                        });

                    return true;
                } catch (error) {
                    console.warn(
                        'Erro ao iniciar Tempo Real:',
                        error
                    );

                    activeImeiRef.current =
                        null;

                    setRealTimeEnabledState(
                        false
                    );

                    setRealTimeError(
                        'Não foi possível conectar ao servidor. Verifique a conexão e tente novamente.'
                    );

                    return false;
                }
            },
            [
                clearPolling,
                clearRoute,
                pollLocation,
                updateLocation,
                handleRealTimeMessage,
            ]
        );

    // ============================================================
    // PARAR TEMPO REAL
    // ============================================================

    const stopRealTime =
        useCallback(() => {
            clearPolling();

            activeImeiRef.current =
                null;

            activeTrackerIdRef.current =
                null;

            previousLocationRef.current =
                null;

            setRealTimeEnabledState(
                false
            );

            setLatestLocation(null);

            setIsMoving(false);

            setCurrentTripDistanceKm(0);

            setActiveTrackerId(null);

            setActiveTrackerName(null);

            tripDistanceRef.current =
                0;

            setRoutePoints([]);

            setRealTimeError(null);
        }, [clearPolling]);

    // ============================================================
    // VIGILANTE
    // ============================================================

    const [
        vigilanteEnabled,
        setVigilanteEnabledState,
    ] = useState(false);

    const [
        activeVigilanteTrackerId,
        setActiveVigilanteTrackerId,
    ] = useState<string | null>(null);

    const [
        activeVigilanteTrackerName,
        setActiveVigilanteTrackerName,
    ] = useState<string | null>(null);

    const [
        vigilanteError,
        setVigilanteError,
    ] = useState<string | null>(null);

    const vigilanteImeiRef =
        useRef<string | null>(null);

    const vigilanteTrackerNameRef =
        useRef('O rastreador');

    const vigilanteTrackerIdRef =
        useRef<string | null>(null);

    const vigilantePollingRef =
        useRef<ReturnType<typeof setInterval> | null>(
            null
        );

    const vigilanteCheckingRef =
        useRef(false);

    const vigilanteFailuresRef =
        useRef(0);

    const vigilanteSocketRef =
        useRef<RealtimeSocket | null>(null);

    const lastVigilantePollRef =
        useRef(0);

    // Eventos (alertas/alarmes do servidor) já notificados, e o
    // horário do mais recente — evita notificar duas vezes o mesmo
    // evento (chega pelo WebSocket E pelo polling).
    const notifiedEventIdsRef =
        useRef<Set<string>>(new Set());

    const vigilanteEventsSinceRef =
        useRef<string | null>(null);

    const vigilanteMovingRef =
        useRef(false);

    const vigilanteAlarmRef =
        useRef(false);

    const vigilantePreviousLocationRef =
        useRef<TrackerLocation | null>(null);

    // ============================================================
    // LIMPAR VIGILANTE
    // ============================================================

    const clearVigilantePolling =
        useCallback(() => {
            if (
                vigilantePollingRef.current
            ) {
                clearInterval(
                    vigilantePollingRef.current
                );

                vigilantePollingRef.current =
                    null;
            }

            // Todo caminho que desliga o Vigilante passa por aqui.
            vigilanteSocketRef.current?.close();
            vigilanteSocketRef.current = null;
        }, []);

    // ============================================================
    // EVENTOS DO SERVIDOR (alertas e alarmes)
    // ============================================================

    const notifyVigilanteEvent =
        useCallback((event: ApiTrackerEvent) => {
            if (
                !event?.id ||
                notifiedEventIdsRef.current.has(event.id)
            ) {
                return;
            }

            notifiedEventIdsRef.current.add(event.id);

            if (
                !vigilanteEventsSinceRef.current ||
                event.createdAt > vigilanteEventsSinceRef.current
            ) {
                vigilanteEventsSinceRef.current =
                    event.createdAt;
            }

            void sendTrackerEventNotification(
                vigilanteTrackerNameRef.current,
                event
            );
        }, []);

    const handleVigilanteMessage =
        useCallback(
            (message: RealtimeMessage) => {
                if (message.tipo === 'EVENT' && message.event) {
                    notifyVigilanteEvent(
                        message.event as ApiTrackerEvent
                    );
                    return;
                }

                // Servidor confirmou início/fim de movimento (rota).
                if (message.tipo === 'MOVEMENT') {
                    if (
                        message.moving === true &&
                        !vigilanteMovingRef.current
                    ) {
                        void sendMovementNotification(
                            vigilanteTrackerNameRef.current
                        );
                    }

                    vigilanteMovingRef.current =
                        message.moving === true;
                }
            },
            [notifyVigilanteEvent]
        );

    // ============================================================
    // POLLING VIGILANTE
    // ============================================================

    const pollVigilante =
        useCallback(async () => {
            const imei =
                vigilanteImeiRef.current;

            if (
                !imei ||
                vigilanteCheckingRef.current
            ) {
                return;
            }

            if (
                vigilanteSocketRef.current?.isConnected &&
                Date.now() - lastVigilantePollRef.current <
                SOCKET_FALLBACK_POLL_MS
            ) {
                return;
            }

            lastVigilantePollRef.current = Date.now();

            vigilanteCheckingRef.current =
                true;

            try {
                const tracker =
                    await fetchTrackerData(
                        imei
                    );

                vigilanteFailuresRef.current = 0;

                // Alertas/alarmes gerados pelo servidor desde a última
                // consulta (garantia, caso o WebSocket tenha caído).
                const events =
                    await fetchTrackerEvents(imei, {
                        limit: 20,
                        since:
                            vigilanteEventsSinceRef.current ??
                            undefined,
                    });

                [...events]
                    .reverse()
                    .forEach(notifyVigilanteEvent);

                // Rastreador offline NÃO desliga o Vigilante: o J16
                // costuma entrar em modo sleep / perder o GPRS com o
                // veículo parado — exatamente quando a vigilância
                // importa. O polling continua e, quando ele voltar a
                // mandar dados (ex: movimento), a notificação sai.

                const status = resolveVigilanteState(
                    tracker,
                    vigilantePreviousLocationRef.current
                );

                if (
                    status.moving &&
                    !vigilanteMovingRef.current
                ) {
                    void sendMovementNotification(
                        vigilanteTrackerNameRef.current
                    );
                }

                // Alarmes são notificados pelos eventos do servidor
                // (com o tipo do alarme), não mais por alarmPending.

                vigilanteMovingRef.current =
                    status.moving;

                vigilanteAlarmRef.current =
                    status.alarmPending;

                if (
                    tracker.gps &&
                    typeof tracker.gps.latitude === 'number' &&
                    typeof tracker.gps.longitude === 'number'
                ) {
                    const currentLocation: TrackerLocation = {
                        latitude: tracker.gps.latitude,
                        longitude: tracker.gps.longitude,
                        speed: Number(tracker.gps.velocidade ?? 0),
                        satellites: tracker.gps.satelites,
                        lastUpdate:
                            normalizeServerDate(tracker.gps.dataUTC) ??
                            new Date().toISOString(),
                    };

                    vigilantePreviousLocationRef.current =
                        currentLocation;

                    if (vigilanteTrackerIdRef.current) {
                        void saveLastLocation(
                            vigilanteTrackerIdRef.current,
                            currentLocation
                        );
                    }
                }
            } catch (error) {
                console.warn(
                    'Erro no polling do Modo Vigilante:',
                    error
                );

                vigilanteFailuresRef.current += 1;

                if (
                    vigilanteFailuresRef.current <
                    MAX_CONSECUTIVE_FAILURES
                ) {
                    return;
                }

                clearVigilantePolling();

                setVigilanteEnabledState(
                    false
                );

                vigilanteImeiRef.current =
                    null;

                setVigilanteError(
                    'A conexão com o servidor foi perdida. O Modo Vigilante foi desligado.'
                );
            } finally {
                vigilanteCheckingRef.current =
                    false;
            }
        }, [
            clearVigilantePolling,
            notifyVigilanteEvent,
        ]);

    // ============================================================
    // INICIAR VIGILANTE
    // ============================================================

    const startVigilante =
        useCallback(
            async (
                trackerId: string,
                trackerName: string,
                imei: string
            ): Promise<boolean> => {
                clearVigilantePolling();

                setVigilanteError(null);

                vigilanteCheckingRef.current =
                    false;

                setActiveVigilanteTrackerId(
                    trackerId
                );

                setActiveVigilanteTrackerName(
                    trackerName
                );

                vigilanteTrackerNameRef.current =
                    trackerName;

                vigilanteTrackerIdRef.current =
                    trackerId;

                vigilanteImeiRef.current =
                    imei;

                vigilanteFailuresRef.current = 0;

                try {
                    // Pode iniciar com o rastreador offline (em modo
                    // sleep, por exemplo) — basta o servidor responder.
                    const tracker =
                        await fetchTrackerData(
                            imei
                        );

                    const initialStatus = resolveVigilanteState(
                        tracker,
                        vigilantePreviousLocationRef.current
                    );

                    vigilanteMovingRef.current =
                        initialStatus.moving;

                    vigilanteAlarmRef.current =
                        initialStatus.alarmPending;

                    if (
                        tracker.gps &&
                        typeof tracker.gps.latitude === 'number' &&
                        typeof tracker.gps.longitude === 'number'
                    ) {
                        vigilantePreviousLocationRef.current = {
                            latitude: tracker.gps.latitude,
                            longitude: tracker.gps.longitude,
                            speed: Number(tracker.gps.velocidade ?? 0),
                            lastUpdate:
                                normalizeServerDate(tracker.gps.dataUTC) ??
                                new Date().toISOString(),
                        };
                    }

                    // Só notifica eventos criados a partir de agora.
                    notifiedEventIdsRef.current = new Set();

                    const latestEvents =
                        await fetchTrackerEvents(imei, { limit: 1 })
                            .catch(() => []);

                    vigilanteEventsSinceRef.current =
                        latestEvents[0]?.createdAt ??
                        new Date().toISOString();

                    setVigilanteEnabledState(
                        true
                    );

                    /*
                     * Faz uma primeira consulta imediatamente.
                     * Depois continua a cada 5 segundos.
                     */
                    vigilantePollingRef.current =
                        setInterval(() => {
                            void pollVigilante();
                        }, VIGILANTE_POLLING_INTERVAL);

                    // Alertas e movimento na hora, pelo WebSocket.
                    vigilanteSocketRef.current =
                        new RealtimeSocket(imei, {
                            onMessage: handleVigilanteMessage,
                        });

                    return true;
                } catch (error) {
                    console.warn(
                        'Erro ao iniciar Modo Vigilante:',
                        error
                    );

                    vigilanteImeiRef.current =
                        null;

                    setVigilanteEnabledState(
                        false
                    );

                    setActiveVigilanteTrackerId(
                        null
                    );

                    setActiveVigilanteTrackerName(
                        null
                    );

                    setVigilanteError(
                        'Não foi possível conectar ao servidor. Verifique a conexão e tente novamente.'
                    );

                    return false;
                }
            },
            [
                clearVigilantePolling,
                pollVigilante,
                handleVigilanteMessage,
            ]
        );

    // ============================================================
    // PARAR VIGILANTE
    // ============================================================

    const stopVigilante =
        useCallback(() => {
            clearVigilantePolling();

            vigilanteImeiRef.current =
                null;

            vigilanteTrackerIdRef.current =
                null;

            vigilanteMovingRef.current =
                false;

            vigilanteAlarmRef.current =
                false;

            vigilanteCheckingRef.current =
                false;

            vigilantePreviousLocationRef.current =
                null;

            setVigilanteEnabledState(
                false
            );

            setActiveVigilanteTrackerId(
                null
            );

            setActiveVigilanteTrackerName(
                null
            );

            setVigilanteError(null);
        }, [
            clearVigilantePolling,
        ]);

    // ============================================================
    // VIGILANTE EM SEGUNDO PLANO (serviço em primeiro plano)
    // ============================================================
    //
    // Segue o estado do Vigilante: qualquer caminho que liga ou
    // desliga o Vigilante (botão, logout, exclusão do rastreador,
    // falhas de rede, reset) liga/desliga o serviço junto.

    useEffect(() => {
        if (!vigilanteEnabled) {
            stopVigilanteBackground();
            return;
        }

        startVigilanteBackground(
            activeVigilanteTrackerName ??
            'o rastreador'
        );
    }, [
        vigilanteEnabled,
        activeVigilanteTrackerName,
    ]);

    // Botão "Desligar" da notificação do serviço.
    useEffect(() => {
        const subscription =
            addStopRequestedListener(() => {
                stopVigilante();
            });

        return () => {
            subscription.remove();
        };
    }, [
        stopVigilante,
    ]);

    // ============================================================
    // CLEANUP
    // ============================================================

    useEffect(() => {
        return () => {
            clearPolling();
            clearVigilantePolling();
        };
    }, [
        clearPolling,
        clearVigilantePolling,
    ]);

    // ============================================================
    // VALUE
    // ============================================================

    const value: RealTimeContextData = {
        // Tempo Real
        realTimeEnabled,
        activeTrackerId,
        activeTrackerName,
        latestLocation,
        isMoving,
        currentTripDistanceKm,
        routePoints,
        realTimeError,
        setRealTimeEnabled,
        startRealTime,
        stopRealTime,
        updateLocation,

        // Vigilante
        vigilanteEnabled,
        activeVigilanteTrackerId,
        activeVigilanteTrackerName,
        vigilanteError,
        startVigilante,
        stopVigilante,
    };

    return (
        <RealTimeContext.Provider
            value={value}
        >
            {children}
        </RealTimeContext.Provider>
    );
}

// ============================================================
// HOOK
// ============================================================

export function useRealTime(): RealTimeContextData {
    const context =
        useContext(RealTimeContext);

    if (!context) {
        throw new Error(
            'useRealTime deve ser usado dentro de um RealTimeProvider.'
        );
    }

    return context;
}
