// src/utils/dayTrack.ts
//
// "Trajeto do dia" (aba Dia do Histórico): datas no horário de Brasília,
// resumo das posições de um dia e conversão para os pontos do mapa.
//
// As posições vêm de GET /api/tracker/:imei/positions?date=AAAA-MM-DD —
// TODAS as posições válidas do dia, inclusive as que chegaram atrasadas
// (buffer do rastreador ao voltar o sinal).

import type { ApiDayPosition } from '../services/TrackerApiService';
import type { TrackerLocation } from '../types/Tracker';

// Brasília: UTC-3, sem horário de verão (igual ao servidor).
const BRASILIA_OFFSET_MS = -3 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

// Distância entre dois pontos seguidos acima disso = salto do GPS (mesmo
// filtro do servidor ao somar as rotas).
const MAX_STEP_KM = 5;

// O mapa desenha no máximo isso de pontos (um dia rodando pode passar de
// 5 mil). Mantém o primeiro e o último.
const MAX_MAP_POINTS = 2000;

/** Hoje, "AAAA-MM-DD", no horário de Brasília. */
export function todayKey(): string {
    return new Date(Date.now() + BRASILIA_OFFSET_MS).toISOString().slice(0, 10);
}

/** Soma `days` dias a uma data "AAAA-MM-DD". */
export function shiftDay(dateKey: string, days: number): string {
    return new Date(Date.parse(`${dateKey}T12:00:00Z`) + days * DAY_MS)
        .toISOString()
        .slice(0, 10);
}

/** "Hoje", "Ontem" ou "seg., 05/10". */
export function formatDayLabel(dateKey: string): string {
    if (dateKey === todayKey()) {
        return 'Hoje';
    }

    if (dateKey === shiftDay(todayKey(), -1)) {
        return 'Ontem';
    }

    return new Date(`${dateKey}T12:00:00Z`).toLocaleDateString('pt-BR', {
        weekday: 'short',
        day: '2-digit',
        month: '2-digit',
        timeZone: 'UTC',
    });
}

function toRadians(value: number) {
    return (value * Math.PI) / 180;
}

function distanceKm(a: ApiDayPosition, b: ApiDayPosition): number {
    const dLat = toRadians(b.latitude - a.latitude);
    const dLon = toRadians(b.longitude - a.longitude);

    const h =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRadians(a.latitude)) *
        Math.cos(toRadians(b.latitude)) *
        Math.sin(dLon / 2) ** 2;

    return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

export type DaySummary = {
    total: number;
    late: number;
    distanceKm: number;
    maxSpeed: number;
    firstAt: string | null;
    lastAt: string | null;
};

export function summarizeDay(points: ApiDayPosition[]): DaySummary {
    let distance = 0;
    let maxSpeed = 0;
    let late = 0;

    points.forEach((point, index) => {
        if (point.atrasado) {
            late += 1;
        }

        maxSpeed = Math.max(maxSpeed, Number(point.velocidade) || 0);

        if (index > 0) {
            const step = distanceKm(points[index - 1], point);

            if (step < MAX_STEP_KM) {
                distance += step;
            }
        }
    });

    return {
        total: points.length,
        late,
        distanceKm: distance,
        maxSpeed,
        firstAt: points[0]?.timestamp ?? null,
        lastAt: points[points.length - 1]?.timestamp ?? null,
    };
}

/** Pontos no formato do mapa (TrackerMap), reduzidos se forem muitos. */
export function toMapPoints(points: ApiDayPosition[]): TrackerLocation[] {
    const step = Math.max(1, Math.ceil(points.length / MAX_MAP_POINTS));

    const selected = points.filter(
        (_, index) => index % step === 0 || index === points.length - 1
    );

    return selected.map(point => ({
        latitude: point.latitude,
        longitude: point.longitude,
        speed: point.velocidade,
        satellites: point.satelites,
        // `timestamp` já vem em ISO (UTC) do servidor.
        lastUpdate: point.timestamp,
    }));
}
