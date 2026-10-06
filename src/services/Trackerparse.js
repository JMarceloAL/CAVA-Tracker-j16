/**
 * Interpreta as respostas SMS enviadas pelo rastreador J16 e transforma
 * em objetos JS fáceis de usar na UI.
 */

const LOCATION_REGEX = /(?:<(\d{2}-\d{2}\s\d{2}:\d{2})>\s*)?(https?:\/\/maps\.google\.com\/maps\?q=([+-]?[\d.]+),([+-]?[\d.]+))/;

const DELIVERY_REPORT_REGEX = /\b(?:torpedo entregue|sms entregue|sms delivered|sms sent|delivered|entregue|enviado)\b/i;
const NO_SIGNAL_REGEX = /\b(?:sem sinal|no signal|gprs:offline|gps:off|sem serviço|sem rede|offline|sem linha)\b/i;

// Um único regex genérico de IMEI, reutilizado em qualquer tipo de resposta
const IMEI_REGEX = /IMEI:(\d+)/;

const STATUS_REGEX = {
    // Formato do manual (pode não bater com todos os firmwares)
    battery: /Battery:([\d.]+)V/,
    gprs: /GPRS:(\w+)/,
    gsmSignal: /GSMSignal Level:(\d+)/,
    acc: /ACC:(\w+)/,
    gps: /GPS:(\w+)/,
    defense: /Defense:(\w+)/,
    imei: IMEI_REGEX,
    timer: /TIMER:([\d,]+)/,
    hbt: /HBT:(\w+)/,
    sneds: /SNEDS:(\d+)/,

    // Formato real observado no seu firmware
    charging: /Charging:([\d.]+)V/,
    gprsLink: /GPRS:([\w\s]+?)(?:;|$)/,
    signalLevel: /NW Signal Level:(\w+)/,
    pppState: /PPP_STATE:(\d+)/,
    gpsBd: /GPS\+BD:(\w+)/,
    pwrmd: /PWRMD:(\d+)/,
};

export function parseTrackerReply(rawMessage) {
    const message = rawMessage.trim();

    if (DELIVERY_REPORT_REGEX.test(message)) {
        return { type: 'deliveryReport', raw: message };
    }

    // Localização e status são verificados ANTES do "sem sinal": uma
    // resposta de STATUS# traz campos como "GPRS:offline" / "GPS:OFF",
    // que casariam com NO_SIGNAL_REGEX e seriam classificados errado.
    const locationMatch = message.match(LOCATION_REGEX);
    if (locationMatch) {
        return {
            type: 'location',
            // O horário do rastreador vem como "MM-DD HH:mm" (sem ano
            // nem fuso) — guardado à parte. `timestamp` é o momento em
            // que a resposta chegou, em ISO.
            timestamp: new Date().toISOString(),
            trackerTime: locationMatch[1] ?? null,
            url: locationMatch[2],
            latitude: parseFloat(locationMatch[3]),
            longitude: parseFloat(locationMatch[4]),
            raw: message,
        };
    }

    // Reconhece STATUS# tanto no formato do manual (Battery/IMEI)
    // quanto no formato real observado (Charging/PWRMD)
    const looksLikeStatus =
        (message.includes('Battery:') && message.includes('IMEI:')) ||
        message.includes('Charging:') ||
        message.includes('PWRMD');

    if (looksLikeStatus) {
        const status = { type: 'status', raw: message };
        for (const [key, regex] of Object.entries(STATUS_REGEX)) {
            const match = message.match(regex);
            if (match) status[key] = match[1].trim();
        }
        return status;
    }

    if (NO_SIGNAL_REGEX.test(message)) {
        return { type: 'noSignal', raw: message };
    }

    if (message.startsWith('RELAY:')) {
        return { type: 'relay', value: message.split(':')[1]?.trim(), raw: message };
    }

    if (message.startsWith('APN:')) {
        return { type: 'apn', raw: message };
    }

    if (message.startsWith('SERVER:')) {
        return { type: 'server', raw: message };
    }

    if (message.startsWith('HBT')) {
        return { type: 'heartbeat', raw: message };
    }

    if (message.startsWith('TIMER')) {
        return { type: 'reportInterval', raw: message };
    }

    if (message === 'RESET OK') {
        return { type: 'reset', raw: message };
    }

    // PARAM# provavelmente retorna algo com IMEI: mas sem bater em nenhum
    // formato acima — captura como 'params' se tiver IMEI, senão 'unknown'
    const imeiMatch = message.match(IMEI_REGEX);
    if (imeiMatch) {
        return { type: 'params', imei: imeiMatch[1], raw: message };
    }

    return { type: 'unknown', raw: message };
}