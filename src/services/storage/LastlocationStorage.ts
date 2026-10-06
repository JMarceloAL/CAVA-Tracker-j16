// src/services/storage/LastlocationStorage.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { TrackerLocation } from '../../types/Tracker';

// Última posição conhecida do rastreador (um único objeto) — usada
// pelo mapa e pelo botão "Última localização".
const PREFIX = '@cavalleta:lastLocation:';

// Histórico de localizações PARADAS vindo do servidor (lista) —
// usado pela tela de Histórico. Fica numa chave separada da última
// posição pra uma não sobrescrever a outra.
const HISTORY_PREFIX = '@cavalleta:stoppedHistory:';

const MAX_HISTORY = 10;
const STOPPED_PREFIX = '@cavalleta:stoppedLocation:';

/**
 * Salva a última posição conhecida do rastreador, substituindo a
 * anterior. Ignora a gravação se for a mesma leitura já salva.
 */
export async function saveLastLocation(trackerId: string, location: TrackerLocation) {
    try {
        const previous = await getLastLocation(trackerId);

        if (
            previous &&
            previous.latitude === location.latitude &&
            previous.longitude === location.longitude &&
            previous.lastUpdate === location.lastUpdate
        ) {
            return;
        }

        await AsyncStorage.setItem(`${PREFIX}${trackerId}`, JSON.stringify(location));
    } catch (error) {
        console.warn('Erro ao salvar última localização', error);
    }
}

/** Retorna a última posição conhecida do rastreador */
export async function getLastLocation(trackerId: string): Promise<TrackerLocation | null> {
    try {
        const stored = await AsyncStorage.getItem(`${PREFIX}${trackerId}`);
        if (!stored) return null;

        const parsed = JSON.parse(stored);

        // Compatibilidade: versões antigas guardavam uma lista
        // nessa chave (mais recente primeiro).
        if (Array.isArray(parsed)) return parsed[0] ?? null;
        return parsed;
    } catch (error) {
        console.warn('Erro ao carregar última localização', error);
        return null;
    }
}

/** Retorna o histórico de localizações paradas (até MAX_HISTORY), mais recente primeiro */
export async function getLocationHistory(trackerId: string): Promise<TrackerLocation[]> {
    try {
        const stored = await AsyncStorage.getItem(`${HISTORY_PREFIX}${trackerId}`);
        if (!stored) return [];

        const parsed = JSON.parse(stored);
        return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
        console.warn('Erro ao carregar histórico de localizações', error);
        return [];
    }
}

/**
 * Sobrescreve todo o histórico de localizações paradas do rastreador
 * com os dados vindos da API (sincronização servidor -> cache local),
 * garantindo que o app fique consistente mesmo se o cache local
 * estiver desatualizado ou tiver sido perdido (reinstalação etc.).
 */
export async function replaceLocationHistory(
    trackerId: string,
    locations: TrackerLocation[]
): Promise<void> {
    try {
        const limited = locations.slice(0, MAX_HISTORY);

        await AsyncStorage.setItem(
            `${HISTORY_PREFIX}${trackerId}`,
            JSON.stringify(limited)
        );
    } catch (error) {
        console.warn('Erro ao sincronizar histórico de localizações', error);
    }
}

/**
 * Apaga todo o cache de localização de um rastreador (última
 * posição, histórico de paradas e referência do Vigilante). Usado
 * ao excluir o rastreador.
 */
export async function clearTrackerLocationCache(trackerId: string): Promise<void> {
    try {
        await AsyncStorage.multiRemove([
            `${PREFIX}${trackerId}`,
            `${HISTORY_PREFIX}${trackerId}`,
            `${STOPPED_PREFIX}${trackerId}`,
        ]);
    } catch (error) {
        console.warn('Erro ao limpar cache de localização', error);
    }
}

/**
 * Salva a última posição em que o rastreador foi visto "parado"
 * (speed baixo). Serve de referência para o Modo Vigilante detectar
 * quando ele voltar a se mover.
 */
export async function saveStoppedLocation(trackerId: string, location: TrackerLocation) {
    try {
        await AsyncStorage.setItem(`${STOPPED_PREFIX}${trackerId}`, JSON.stringify(location));
    } catch (error) {
        console.warn('Erro ao salvar última localização parada', error);
    }
}

/** Retorna a última posição "parada" conhecida, usada como referência pelo Modo Vigilante */
export async function getStoppedLocation(trackerId: string): Promise<TrackerLocation | null> {
    try {
        const stored = await AsyncStorage.getItem(`${STOPPED_PREFIX}${trackerId}`);
        return stored ? JSON.parse(stored) : null;
    } catch (error) {
        console.warn('Erro ao carregar última localização parada', error);
        return null;
    }
}