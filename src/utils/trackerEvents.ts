// src/utils/trackerEvents.ts
//
// Aparência (ícone, cor, rótulo) dos eventos de alerta/alarme e dos
// itens do painel de status, compartilhada entre as telas.

import type {
    ApiDeviceStatus,
    ApiTrackerEvent,
} from '../services/TrackerApiService';

export type EventAppearance = {
    icon: string; // nome do MaterialIcons
    color: string;
    label: string;
};

const EVENT_APPEARANCE: Record<string, EventAppearance> = {
    SPEEDING: { icon: 'speed', color: '#E67E22', label: 'Velocidade' },
    IGNITION_FORBIDDEN: { icon: 'key', color: '#D95C5C', label: 'Ignição' },
    OFFLINE: { icon: 'cloud-off', color: '#7F8C8D', label: 'Sem comunicação' },
    ONLINE: { icon: 'cloud-done', color: '#27AE60', label: 'Comunicação' },
    POWER_CUT: { icon: 'power-off', color: '#C0392B', label: 'Alimentação' },
    GEOFENCE_ENTER: { icon: 'login', color: '#2980B9', label: 'Cerca' },
    GEOFENCE_EXIT: { icon: 'logout', color: '#8E44AD', label: 'Cerca' },
    ALARM: { icon: 'notifications-active', color: '#D35400', label: 'Alarme' },
};

const DEFAULT_APPEARANCE: EventAppearance = {
    icon: 'notifications',
    color: '#7F8C8D',
    label: 'Evento',
};

export function eventAppearance(
    event: Pick<ApiTrackerEvent, 'type'>
): EventAppearance {
    return EVENT_APPEARANCE[event.type] ?? DEFAULT_APPEARANCE;
}

/** "há 3 min", "há 2 h", "há 5 dias" */
export function formatTimeAgo(value?: string | null): string {
    if (!value) {
        return 'nunca';
    }

    const diffMs = Date.now() - new Date(value).getTime();

    if (!Number.isFinite(diffMs)) {
        return '—';
    }

    const minutes = Math.floor(diffMs / 60000);

    if (minutes < 1) return 'agora';
    if (minutes < 60) return `há ${minutes} min`;

    const hours = Math.floor(minutes / 60);

    if (hours < 24) return `há ${hours} h`;

    const days = Math.floor(hours / 24);

    return `há ${days} ${days === 1 ? 'dia' : 'dias'}`;
}

// Nível de tensão do GT06: 0 (desligando) a 6 (muito alta).
const VOLTAGE_LABELS = [
    'Sem energia',
    'Crítica',
    'Muito baixa',
    'Baixa',
    'Média',
    'Boa',
    'Cheia',
];

export function voltageLabel(level?: number): string | null {
    if (typeof level !== 'number' || level < 0 || level > 6) {
        return null;
    }

    return VOLTAGE_LABELS[level];
}

// Sinal GSM do GT06: 0 (sem sinal) a 4 (forte).
export function gsmLabel(level?: number): string | null {
    if (typeof level !== 'number' || level < 0 || level > 4) {
        return null;
    }

    return ['Sem sinal', 'Fraco', 'Regular', 'Bom', 'Forte'][level];
}

export type StatusChip = {
    key: string;
    icon: string;
    label: string;
    tone: 'ok' | 'warn' | 'danger' | 'neutral';
};

/**
 * Itens do painel de status de um rastreador (cards da Home).
 */
export function buildStatusChips(
    online: boolean | undefined,
    lastSeen: string | null | undefined,
    status: ApiDeviceStatus | undefined,
    satellites?: number
): StatusChip[] {
    const chips: StatusChip[] = [
        {
            key: 'online',
            icon: online ? 'wifi' : 'wifi-off',
            label: online ? 'Online' : `Offline · ${formatTimeAgo(lastSeen)}`,
            tone: online ? 'ok' : 'danger',
        },
    ];

    if (!status) {
        return chips;
    }

    if (typeof status.acc === 'boolean') {
        chips.push({
            key: 'acc',
            icon: 'key',
            label: status.acc ? 'Ignição ligada' : 'Ignição desligada',
            tone: status.acc ? 'warn' : 'neutral',
        });
    }

    if (typeof status.externalPower === 'boolean') {
        chips.push({
            key: 'power',
            icon: status.externalPower ? 'power' : 'power-off',
            label: status.externalPower ? 'Alimentação OK' : 'Sem alimentação',
            tone: status.externalPower ? 'ok' : 'danger',
        });
    }

    if (status.relayCut === true) {
        chips.push({
            key: 'relay',
            icon: 'block',
            label: 'Óleo/energia cortado',
            tone: 'danger',
        });
    }

    const battery = voltageLabel(status.voltageLevel);

    if (battery) {
        chips.push({
            key: 'battery',
            icon: 'battery-std',
            label: `Bateria: ${battery}`,
            tone:
                (status.voltageLevel ?? 6) <= 2
                    ? 'danger'
                    : (status.voltageLevel ?? 6) <= 3
                        ? 'warn'
                        : 'ok',
        });
    }

    const gsm = gsmLabel(status.gsmLevel);

    if (gsm) {
        chips.push({
            key: 'gsm',
            icon: 'signal-cellular-alt',
            label: `GSM: ${gsm}`,
            tone: (status.gsmLevel ?? 4) <= 1 ? 'warn' : 'ok',
        });
    }

    if (typeof satellites === 'number') {
        chips.push({
            key: 'sat',
            icon: 'satellite-alt',
            label: `${satellites} satélites`,
            tone: satellites >= 4 ? 'ok' : 'warn',
        });
    }

    return chips;
}
