// src/services/TrackerApiService.ts

import type { TrackerLocation } from '../types/Tracker';
import { normalizeServerDate } from '../utils/serverDate';

const API_URL = (
    process.env.EXPO_PUBLIC_API_URL ??
    process.env.API_URL ??
    'https://mybombs.ddns.net:3000'
).replace(/\/$/, '');

const API_KEY = process.env.EXPO_PUBLIC_API_KEY;

const DEFAULT_TIMEOUT_MS = 8000;

export function normalizeImei(imei: string): string {
    const digits = String(imei).replace(/\D/g, '');

    return digits.padStart(16, '0');
}

/**
 * Faz a chamada à API sempre com timeout (AbortController).
 *
 * Sem isso, se o servidor cair de um jeito que não recuse a
 * conexão na hora (porta filtrada, processo travado etc.), o
 * fetch() fica pendurado indefinidamente — e qualquer polling
 * que dependa dele (como o Modo Vigilante) nunca detecta a
 * queda e nunca sai do estado de "carregando".
 */
type ApiRequestOptions = {
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
    body?: unknown;
};

async function apiFetch(
    path: string,
    timeoutMs: number = DEFAULT_TIMEOUT_MS,
    { method = 'GET', body }: ApiRequestOptions = {}
) {
    const controller = new AbortController();

    const timeout = setTimeout(
        () => controller.abort(),
        timeoutMs
    );

    try {
        const response = await fetch(
            `${API_URL}/api${path}`,
            {
                method,
                headers: {
                    'x-api-key': API_KEY ?? '',
                    Accept: 'application/json',
                    ...(body !== undefined
                        ? { 'Content-Type': 'application/json' }
                        : {}),
                },
                body:
                    body !== undefined
                        ? JSON.stringify(body)
                        : undefined,
                signal: controller.signal,
            }
        );

        if (!response.ok) {
            const errorBody = await response
                .json()
                .catch(() => null);

            const error: any = new Error(
                errorBody?.error ??
                `Erro ${response.status} ao consultar a API`
            );

            error.status = response.status;

            throw error;
        }

        return await response.json();
    } catch (error: any) {
        if (error?.name === 'AbortError') {
            const timeoutError: any = new Error(
                `Tempo esgotado ao consultar a API (${timeoutMs}ms).`
            );

            timeoutError.code = 'TIMEOUT';

            throw timeoutError;
        }

        throw error;
    } finally {
        clearTimeout(timeout);
    }
}

type ApiGps = {
    latitude: number;
    longitude: number;
    velocidade?: number;
    satelites?: number;
    curso?: number;
    gpsValido?: boolean;
    data?: string;
    dataUTC?: string;
};

export type ApiMovement = {
    moving: boolean;
    alarmPending: boolean;
    routeId: string | null;
    lastMovementAt: string | null;
    lastAlarmAt: string | null;
};

/**
 * Status do aparelho (heartbeat / alarmes). Campos ausentes = ainda
 * não informados pelo rastreador.
 */
export type ApiDeviceStatus = {
    acc?: boolean;
    accChangedAt?: string;
    externalPower?: boolean;
    relayCut?: boolean;
    gpsTracking?: boolean;
    defense?: boolean;
    voltageLevel?: number;
    gsmLevel?: number;
    updatedAt?: string;
};

export type ApiTracker = {
    imei: string;
    online: boolean;
    lastSeen: string | null;
    gps: ApiGps | null;
    deviceStatus?: ApiDeviceStatus;
    heartbeat: {
        status: number;
        serial: string;
    } | null;
    movement?: ApiMovement | null;
    routes?: ApiRouteSummary[];
    stoppedLocations?: ApiStoppedLocation[];
};

/**
 * ========================================================
 * HISTÓRICO — LOCALIZAÇÕES PARADAS
 * ========================================================
 */
export type ApiStoppedLocation = ApiGps & {
    id: string;
    imei: string;
    stoppedAt: string;
};

/**
 * ========================================================
 * HISTÓRICO — ROTAS
 * ========================================================
 *
 * O resumo (retornado por /tracker/:imei/routes) não traz os
 * pontos, só `totalPoints`. Pra ter a linha completa da rota
 * é preciso buscar o detalhe via fetchRouteDetail.
 */
export type ApiRoutePoint = ApiGps & {
    timestamp: string;
};

export type ApiRouteSummary = {
    id: string;
    imei: string;
    startedAt: string;
    finishedAt: string | null;
    startSource: string;
    startLocation: ApiGps | null;
    endLocation: ApiGps | null;
    distanceKm: number;
    maxSpeed: number;
    durationSeconds?: number;
    totalPoints: number;
};

export type ApiRouteDetail = Omit<ApiRouteSummary, 'totalPoints'> & {
    points: ApiRoutePoint[];
};

export async function fetchAllTrackers(): Promise<ApiTracker[]> {
    return apiFetch('/trackers');
}

export async function fetchTrackerData(
    imei: string,
    timeoutMs?: number
): Promise<ApiTracker> {
    return apiFetch(
        `/tracker/${normalizeImei(imei)}`,
        timeoutMs
    );
}

export async function fetchTrackerLocationFromApi(
    imei: string
): Promise<TrackerLocation> {
    const data = await apiFetch(
        `/location/${normalizeImei(imei)}`
    );

    const payload = data?.location ?? data;

    if (
        typeof payload?.latitude !== 'number' ||
        typeof payload?.longitude !== 'number'
    ) {
        throw new Error(
            `Resposta inválida da API para localização do rastreador ${imei}.`
        );
    }

    return {
        latitude: payload.latitude,
        longitude: payload.longitude,

        speed:
            typeof payload.velocidade === 'number'
                ? payload.velocidade
                : payload.speed,

        satellites:
            typeof payload.satelites === 'number'
                ? payload.satelites
                : payload.satellites,

        lastUpdate:
            normalizeServerDate(payload.dataUTC) ??
            payload.lastSeen ??
            new Date().toISOString(),
    };
}

/**
 * Busca as últimas localizações "paradas" registradas pelo
 * servidor para o IMEI informado (até 10, mais recente primeiro).
 */
export async function fetchStoppedLocations(
    imei: string
): Promise<ApiStoppedLocation[]> {
    const data = await apiFetch(
        `/tracker/${normalizeImei(imei)}/stopped-locations`
    );

    return Array.isArray(data?.locations) ? data.locations : [];
}

/**
 * Busca o resumo das últimas rotas (até 10, mais recente primeiro).
 * Não traz os pontos — use fetchRouteDetail para isso.
 */
export async function fetchRoutes(
    imei: string
): Promise<ApiRouteSummary[]> {
    const data = await apiFetch(
        `/tracker/${normalizeImei(imei)}/routes`
    );

    return Array.isArray(data?.routes) ? data.routes : [];
}

/**
 * Busca uma rota específica, com todos os pontos.
 */
export async function fetchRouteDetail(
    imei: string,
    routeId: string
): Promise<ApiRouteDetail> {
    return apiFetch(
        `/tracker/${normalizeImei(imei)}/routes/${routeId}`
    );
}

export async function checkTrackerOnline(
    imei: string,
    timeoutMs = 6000
): Promise<boolean> {
    const normalizedImei = normalizeImei(imei);

    const controller = new AbortController();

    const timeout = setTimeout(
        () => controller.abort(),
        timeoutMs
    );

    try {
        const response = await fetch(
            `${API_URL}/api/tracker/${normalizedImei}`,
            {
                headers: {
                    'x-api-key': API_KEY ?? '',
                },
                signal: controller.signal,
            }
        );

        if (!response.ok) {
            return false;
        }

        const data: Partial<ApiTracker> =
            await response.json();

        if (data.online === true) {
            return true;
        }

        if (typeof data.online === 'string') {
            const value = (
                data.online as string
            ).toLowerCase();

            if (
                value === 'true' ||
                value === 'online'
            ) {
                return true;
            }

            if (
                value === 'false' ||
                value === 'offline'
            ) {
                return false;
            }
        }

        if (data.lastSeen) {
            return true;
        }

        if (data.gps) {
            return true;
        }

        if (data.heartbeat) {
            return true;
        }

        return false;
    } catch {
        return false;
    } finally {
        clearTimeout(timeout);
    }
}

export type RealtimeAvailability =
    | {
        status: 'no-connection';
    }
    | {
        status: 'no-location';
    }
    | {
        status: 'available';
        location: TrackerLocation;
    };

export async function checkRealtimeAvailability(
    imei: string,
    timeoutMs = 6000
): Promise<RealtimeAvailability> {
    const normalizedImei = normalizeImei(imei);

    const controller = new AbortController();

    const timeout = setTimeout(
        () => controller.abort(),
        timeoutMs
    );

    try {
        // Usa /location (só a posição atual) em vez de /tracker, que
        // traz também histórico — isso roda a cada 5 segundos.
        const response = await fetch(
            `${API_URL}/api/location/${normalizedImei}`,
            {
                headers: {
                    'x-api-key': API_KEY ?? '',
                },
                signal: controller.signal,
            }
        );

        // 404 = servidor respondeu, mas ainda não há posição válida
        // para esse IMEI.
        if (response.status === 404) {
            return {
                status: 'no-location',
            };
        }

        if (!response.ok) {
            return {
                status: 'no-connection',
            };
        }

        const data: Partial<ApiGps> & {
            lastSeen?: string | null;
        } = await response.json();

        const gps = data;

        if (
            !gps ||
            typeof gps.latitude !== 'number' ||
            typeof gps.longitude !== 'number' ||
            !Number.isFinite(gps.latitude) ||
            !Number.isFinite(gps.longitude)
        ) {
            return {
                status: 'no-location',
            };
        }

        return {
            status: 'available',

            location: {
                latitude: gps.latitude,
                longitude: gps.longitude,

                speed: gps.velocidade,

                satellites: gps.satelites,

                lastUpdate:
                    normalizeServerDate(gps.dataUTC) ??
                    data.lastSeen ??
                    new Date().toISOString(),
            },
        };
    } catch {
        return {
            status: 'no-connection',
        };
    } finally {
        clearTimeout(timeout);
    }
}
// ============================================================
// WEBSOCKET (Tempo Real / eventos)
// ============================================================

/**
 * URL do WebSocket do servidor, filtrado pelo IMEI. Mesmo host da API
 * (https -> wss, http -> ws), autenticado pela API key.
 */
export function buildRealtimeSocketUrl(imei: string): string {
    const wsBase = API_URL.replace(/^http/i, 'ws');

    return (
        `${wsBase}/ws` +
        `?apiKey=${encodeURIComponent(API_KEY ?? '')}` +
        `&imei=${encodeURIComponent(normalizeImei(imei))}`
    );
}

// ============================================================
// EVENTOS (alertas e alarmes)
// ============================================================

export type TrackerEventType =
    | 'SPEEDING'
    | 'IGNITION_FORBIDDEN'
    | 'OFFLINE'
    | 'ONLINE'
    | 'POWER_CUT'
    | 'GEOFENCE_ENTER'
    | 'GEOFENCE_EXIT'
    | 'ALARM';

export type ApiTrackerEvent = {
    id: string;
    imei: string;
    type: TrackerEventType | string;
    title: string;
    message: string;
    latitude: number | null;
    longitude: number | null;
    createdAt: string;
    data?: Record<string, unknown> | null;
};

/**
 * Eventos mais recentes primeiro. `since` (ISO): só os criados depois.
 */
export async function fetchTrackerEvents(
    imei: string,
    { limit = 50, since }: { limit?: number; since?: string } = {}
): Promise<ApiTrackerEvent[]> {
    const query =
        `?limit=${limit}` +
        (since ? `&since=${encodeURIComponent(since)}` : '');

    const data = await apiFetch(
        `/tracker/${normalizeImei(imei)}/events${query}`
    );

    return Array.isArray(data?.events) ? data.events : [];
}

// ============================================================
// CONFIGURAÇÕES DE ALERTA
// ============================================================

export type ApiAlertSettings = {
    speed: { enabled: boolean; limitKmh: number };
    ignition: { enabled: boolean; start: string; end: string };
    offline: { enabled: boolean; minutes: number };
    powerCut: { enabled: boolean };
};

export async function fetchAlertSettings(
    imei: string
): Promise<ApiAlertSettings> {
    return apiFetch(`/tracker/${normalizeImei(imei)}/settings`);
}

export async function saveAlertSettings(
    imei: string,
    settings: ApiAlertSettings
): Promise<ApiAlertSettings> {
    return apiFetch(
        `/tracker/${normalizeImei(imei)}/settings`,
        DEFAULT_TIMEOUT_MS,
        { method: 'PUT', body: settings }
    );
}

// ============================================================
// CERCAS VIRTUAIS
// ============================================================

export type ApiGeofence = {
    id: string;
    name: string;
    latitude: number;
    longitude: number;
    radiusMeters: number;
    notifyEnter: boolean;
    notifyExit: boolean;
    createdAt?: string;
};

export type GeofenceInput = Omit<ApiGeofence, 'id' | 'createdAt'>;

export async function fetchGeofences(
    imei: string
): Promise<ApiGeofence[]> {
    const data = await apiFetch(
        `/tracker/${normalizeImei(imei)}/geofences`
    );

    return Array.isArray(data?.geofences) ? data.geofences : [];
}

export async function createGeofence(
    imei: string,
    input: GeofenceInput
): Promise<ApiGeofence> {
    return apiFetch(
        `/tracker/${normalizeImei(imei)}/geofences`,
        DEFAULT_TIMEOUT_MS,
        { method: 'POST', body: input }
    );
}

export async function updateGeofence(
    imei: string,
    id: string,
    input: Partial<GeofenceInput>
): Promise<ApiGeofence> {
    return apiFetch(
        `/tracker/${normalizeImei(imei)}/geofences/${encodeURIComponent(id)}`,
        DEFAULT_TIMEOUT_MS,
        { method: 'PUT', body: input }
    );
}

export async function deleteGeofence(
    imei: string,
    id: string
): Promise<void> {
    await apiFetch(
        `/tracker/${normalizeImei(imei)}/geofences/${encodeURIComponent(id)}`,
        DEFAULT_TIMEOUT_MS,
        { method: 'DELETE' }
    );
}

// ============================================================
// RELATÓRIOS
// ============================================================

export type ApiReportDay = {
    date: string;
    distanceKm: number;
    movingSeconds: number;
    maxSpeed: number;
    routes: number;
};

export type ApiReport = {
    imei: string;
    from: string;
    to: string;
    totals: {
        distanceKm: number;
        movingSeconds: number;
        maxSpeed: number;
        routes: number;
        activeDays: number;
    };
    days: ApiReportDay[];
    routes: Array<{
        id: string;
        startedAt: string;
        finishedAt: string;
        durationSeconds: number;
        distanceKm: number;
        maxSpeed: number;
    }>;
};

/** Datas "AAAA-MM-DD" (horário de Brasília, inclusivas). */
export async function fetchReport(
    imei: string,
    from: string,
    to: string
): Promise<ApiReport> {
    return apiFetch(
        `/tracker/${normalizeImei(imei)}/report?from=${from}&to=${to}`,
        15000
    );
}
