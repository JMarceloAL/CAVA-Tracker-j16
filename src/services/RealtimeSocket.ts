// src/services/RealtimeSocket.ts
//
// Conexão WebSocket com o servidor (/ws), filtrada por IMEI. O
// servidor empurra as mensagens na hora em que o rastreador manda:
//
//   LOCATION  posição nova (já filtrada: sem pacote atrasado)
//   EVENT     alerta/alarme (velocidade, cerca, ignição...)
//   MOVEMENT, ROUTE_*, STATUS, ALARM ...
//
// Reconecta sozinho com espera crescente (1s, 2s, 4s... até 30s)
// enquanto não for fechada com close().

import { buildRealtimeSocketUrl } from './TrackerApiService';

export type RealtimeMessage = {
    tipo: string;
    imei?: string;
    [key: string]: unknown;
};

type Options = {
    onMessage: (message: RealtimeMessage) => void;
    onStatusChange?: (connected: boolean) => void;
};

const MIN_RECONNECT_MS = 1000;
const MAX_RECONNECT_MS = 30000;

export class RealtimeSocket {
    private socket: WebSocket | null = null;

    private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    private reconnectDelay = MIN_RECONNECT_MS;

    private closed = false;

    private connected = false;

    private lastMessageAt = 0;

    constructor(
        private readonly imei: string,
        private readonly options: Options
    ) {
        this.connect();
    }

    /** Conectado e recebendo mensagens? */
    get isConnected(): boolean {
        return this.connected;
    }

    /** Momento (ms) da última mensagem recebida. */
    get lastMessageTime(): number {
        return this.lastMessageAt;
    }

    close(): void {
        this.closed = true;

        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }

        this.socket?.close();
        this.socket = null;

        this.setConnected(false);
    }

    private setConnected(value: boolean) {
        if (this.connected === value) {
            return;
        }

        this.connected = value;
        this.options.onStatusChange?.(value);
    }

    private connect() {
        if (this.closed) {
            return;
        }

        let socket: WebSocket;

        try {
            socket = new WebSocket(
                buildRealtimeSocketUrl(this.imei)
            );
        } catch (error) {
            console.warn('[RealtimeSocket] Erro ao abrir:', error);
            this.scheduleReconnect();
            return;
        }

        this.socket = socket;

        socket.onopen = () => {
            this.reconnectDelay = MIN_RECONNECT_MS;
            this.lastMessageAt = Date.now();
            this.setConnected(true);
        };

        socket.onmessage = (event) => {
            this.lastMessageAt = Date.now();

            try {
                const message = JSON.parse(
                    String(event.data)
                ) as RealtimeMessage;

                // O servidor também manda as linhas do terminal do
                // monitor pra todo mundo — o app não usa.
                if (message?.tipo && message.tipo !== 'TERMINAL') {
                    this.options.onMessage(message);
                }
            } catch {
                // mensagem inválida: ignora
            }
        };

        socket.onerror = () => {
            // O onclose vem em seguida e cuida da reconexão.
        };

        socket.onclose = () => {
            if (this.socket === socket) {
                this.socket = null;
            }

            this.setConnected(false);
            this.scheduleReconnect();
        };
    }

    private scheduleReconnect() {
        if (this.closed || this.reconnectTimer) {
            return;
        }

        const delay = this.reconnectDelay;

        this.reconnectDelay = Math.min(
            this.reconnectDelay * 2,
            MAX_RECONNECT_MS
        );

        this.reconnectTimer = setTimeout(() => {
            this.reconnectTimer = null;
            this.connect();
        }, delay);
    }
}
