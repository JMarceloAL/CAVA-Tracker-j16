import {
    sendSmsToTracker,
    listenForIncomingSms,
} from './Smsgateway';

import { TrackerCommands } from './Trackercommands';

import { parseTrackerReply } from './Trackerparse';

type ParsedTrackerReply = ReturnType<typeof parseTrackerReply>;

type ReplyMatcher = (parsed: ParsedTrackerReply) => boolean;

type PendingResolver = {
    resolve: (parsed: ParsedTrackerReply) => void;
    reject: (error: Error) => void;
    timer: ReturnType<typeof setTimeout>;
    accepts: ReplyMatcher;
};

const acceptAnyReply: ReplyMatcher = () => true;

type TrackerServiceOptions = {
    timeoutMs?: number;
};

/**
 * Orquestra o ciclo:
 *
 * enviar comando -> aguardar resposta do rastreador.
 *
 * O SMS não possui correlação nativa entre request/response.
 * Por isso a resposta é associada ao número de origem do rastreador.
 */
export class TrackerService {
    private trackerPhoneNumber: string;

    private timeoutMs: number;

    private pendingResolvers: PendingResolver[] = [];

    private unsubscribe: (() => void) | null = null;

    private destroyed = false;

    constructor(
        trackerPhoneNumber: string,
        { timeoutMs = 20000 }: TrackerServiceOptions = {}
    ) {
        const normalizedPhone = trackerPhoneNumber.replace(/\D/g, '');

        if (!normalizedPhone) {
            throw new Error(
                'Número de telefone do rastreador não informado.'
            );
        }

        this.trackerPhoneNumber = normalizedPhone;
        this.timeoutMs = timeoutMs;

        this.unsubscribe = listenForIncomingSms(
            this.handleIncoming.bind(this)
        );
    }

    private handleIncoming({
        originatingAddress,
        body,
    }: {
        originatingAddress?: string | null;
        body?: string | null;
    }): void {
        if (this.destroyed) {
            return;
        }

        const from = (originatingAddress ?? '')
            .replace(/\D/g, '')
            .slice(-9);

        const expected = this.trackerPhoneNumber
            .replace(/\D/g, '')
            .slice(-9);

        console.log(
            '📩 SMS recebido — de:',
            originatingAddress,
            '| esperado:',
            this.trackerPhoneNumber
        );

        console.log(
            '📩 Corpo bruto:',
            JSON.stringify(body)
        );

        if (!from || from !== expected) {
            console.log(
                '⏭️ SMS ignorado — número não confere'
            );

            return;
        }

        if (!body) {
            console.log(
                '⏭️ SMS ignorado — corpo vazio'
            );

            return;
        }

        const parsed = parseTrackerReply(body);

        console.log(
            '🔍 Classificado como:',
            parsed.type,
            parsed
        );

        // Relatórios de entrega não são respostas do rastreador.
        if (parsed.type === 'deliveryReport') {
            console.log(
                '⏭️ Ignorado — é relatório de entrega'
            );

            return;
        }

        // Entrega para a solicitação mais antiga que aceita esse tipo
        // de resposta. Um SMS espontâneo do rastreador (ex: alarme)
        // não é "consumido" por um comando que espera outra coisa.
        const pendingIndex = this.pendingResolvers.findIndex(
            item => item.accepts(parsed)
        );

        if (pendingIndex === -1) {
            console.log(
                '⏭️ Nenhuma solicitação aguardando esse tipo de resposta.'
            );

            return;
        }

        const [pending] = this.pendingResolvers.splice(
            pendingIndex,
            1
        );

        clearTimeout(pending.timer);

        pending.resolve(parsed);
    }

    /**
     * `accepts` filtra quais respostas valem para esse comando
     * (padrão: qualquer uma).
     */
    sendCommand(
        commandString: string,
        accepts: ReplyMatcher = acceptAnyReply
    ): Promise<ParsedTrackerReply> {
        if (this.destroyed) {
            return Promise.reject(
                new Error(
                    'TrackerService já foi destruído.'
                )
            );
        }

        return new Promise(
            (resolve, reject) => {
                const timer = setTimeout(() => {
                    this.pendingResolvers =
                        this.pendingResolvers.filter(
                            item =>
                                item.resolve !== resolve
                        );

                    reject(
                        new Error(
                            `Timeout aguardando resposta do rastreador para: ${commandString}`
                        )
                    );
                }, this.timeoutMs);

                this.pendingResolvers.push({
                    resolve,
                    reject,
                    timer,
                    accepts,
                });

                sendSmsToTracker(
                    this.trackerPhoneNumber,
                    commandString
                ).catch(error => {
                    clearTimeout(timer);

                    this.pendingResolvers =
                        this.pendingResolvers.filter(
                            item =>
                                item.resolve !== resolve
                        );

                    reject(
                        error instanceof Error
                            ? error
                            : new Error(
                                String(error)
                            )
                    );
                });
            }
        );
    }

    /**
     * Solicita os parâmetros do rastreador.
     * A resposta deve conter o IMEI.
     */
    async getParams() {
        const reply = await this.sendCommand(
            TrackerCommands.getParams(),
            parsed => 'imei' in parsed && !!parsed.imei
        );

        if (!reply.imei) {
            throw new Error(
                `Resposta não contém IMEI: ${JSON.stringify(
                    reply
                )}`
            );
        }

        return reply;
    }

    /**
     * Solicita a localização atual.
     */
    async getLocation() {
        const reply = await this.sendCommand(
            TrackerCommands.getLocationUrl(),
            parsed =>
                parsed.type === 'location' ||
                parsed.type === 'noSignal'
        );

        if (reply.type === 'noSignal') {
            const error = new Error(
                'Rastreador sem sinal de GPS. Verifique se o dispositivo está em local aberto.'
            );

            (
                error as Error & {
                    code?: string;
                }
            ).code = 'NO_SIGNAL';

            throw error;
        }

        if (reply.type !== 'location') {
            throw new Error(
                `Resposta inesperada ao pedir localização: ${JSON.stringify(
                    reply
                )}`
            );
        }

        return reply;
    }

    /**
     * Solicita o status atual do rastreador.
     */
    async getStatus() {
        const reply = await this.sendCommand(
            TrackerCommands.getStatus(),
            parsed => parsed.type === 'status'
        );

        if (reply.type !== 'status') {
            throw new Error(
                `Resposta inesperada ao pedir status: ${JSON.stringify(
                    reply
                )}`
            );
        }

        return reply;
    }

    /**
     * Encerra a escuta de SMS e cancela
     * todas as solicitações pendentes.
     */
    destroy(): void {
        if (this.destroyed) {
            return;
        }

        this.destroyed = true;

        this.unsubscribe?.();
        this.unsubscribe = null;

        for (const pending of this.pendingResolvers) {
            clearTimeout(pending.timer);

            pending.reject(
                new Error(
                    'TrackerService foi encerrado.'
                )
            );
        }

        this.pendingResolvers = [];
    }
}