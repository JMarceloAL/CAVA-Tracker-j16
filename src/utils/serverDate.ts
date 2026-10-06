// src/utils/serverDate.ts

/**
 * O servidor manda o horário do GPS (`dataUTC`, e o `timestamp` dos
 * pontos de rota) como "AAAA-MM-DD HH:mm:ss" em UTC, sem o "Z". O
 * `new Date()` interpreta esse formato como hora LOCAL (ou nem
 * consegue ler, no Hermes), mostrando o horário 3h adiantado.
 *
 * Converte esse formato para ISO 8601 em UTC. Qualquer outro valor
 * (já em ISO, por exemplo) volta sem alteração.
 */
export function normalizeServerDate(value: string): string;
export function normalizeServerDate(
    value: string | null | undefined
): string | undefined;
export function normalizeServerDate(
    value: string | null | undefined
): string | undefined {
    if (!value) {
        return undefined;
    }

    if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value)) {
        return `${value.replace(' ', 'T')}Z`;
    }

    return value;
}
