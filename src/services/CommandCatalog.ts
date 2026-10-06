import { TrackerCommands } from './Trackercommands';
import type { Field } from '../components/ParamCommandModal';

export type StatusCommand = {
    id: string;
    label: string;
    build: () => string;
    confirm?: boolean;
    confirmMessage?: string;
    destructive?: boolean;
    // Pede a senha do app antes de executar.
    requiresPassword?: boolean;
};

export type ParamCommand = {
    id: string;
    label: string;
    fields: Field[];
    build: (values: Record<string, string>) => string;
};

export const STATUS_COMMANDS: StatusCommand[] = [
    { id: 'location', label: 'Localização', build: () => TrackerCommands.getLocationUrl() },
    { id: 'status', label: 'Status Geral', build: () => TrackerCommands.getStatus() },
    { id: 'params', label: 'Parâmetros (PARAM#)', build: () => TrackerCommands.getParams() },
    { id: 'relayStatus', label: 'Status do Relé', build: () => TrackerCommands.getRelayStatus() },
    { id: 'relayOn', label: 'Ligar Óleo/Energia (RELAY,0#)', build: () => TrackerCommands.restoreRelay() },
    {
        id: 'relayOff',
        label: 'Cortar Óleo/Energia (RELAY,1#)',
        build: () => TrackerCommands.cutRelay(),
        confirm: true,
        confirmMessage: 'Isso vai cortar óleo/energia do veículo. Continuar?',
        requiresPassword: true,
    },
    { id: 'apnGet', label: 'Consultar APN', build: () => TrackerCommands.getApn() },
    { id: 'serverGet', label: 'Consultar Servidor', build: () => TrackerCommands.getServer() },
    { id: 'gmtGet', label: 'Consultar Fuso Horário', build: () => TrackerCommands.getTimezone() },
    { id: 'hbtGet', label: 'Consultar Heartbeat', build: () => TrackerCommands.getHeartbeat() },
    { id: 'timerGet', label: 'Consultar Intervalo', build: () => TrackerCommands.getReportInterval() },
    { id: 'centerGet', label: 'Consultar Central', build: () => TrackerCommands.getCenterNumbers() },
    { id: 'sosGet', label: 'Consultar SOS', build: () => TrackerCommands.getSosNumbers() },
    { id: 'callFunGet', label: 'Consultar Função de Chamada', build: () => TrackerCommands.getCallFunction() },
    { id: 'sleepGet', label: 'Consultar Modo Sleep', build: () => TrackerCommands.getSleepMode() },
];

/**
 * ========================================================
 * COMANDOS PROTEGIDOS
 * ========================================================
 *
 * Antes ficavam soltos em STATUS_COMMANDS. Agora vivem
 * dentro da seção "Parâmetros", que exige senha antes de
 * ficar acessível — tanto pra abrir/ver os botões quanto
 * pra executar qualquer um deles.
 */
export const PROTECTED_STATUS_COMMANDS: StatusCommand[] = [
    { id: 'autoAnswerOn', label: 'Ativar Atendimento Automático', build: () => TrackerCommands.enableAutoAnswer() },
    { id: 'autoAnswerOff', label: 'Desativar Atendimento Automático', build: () => TrackerCommands.disableAutoAnswer() },
    {
        id: 'reset',
        label: 'Reiniciar Rastreador',
        build: () => TrackerCommands.restart(),
        confirm: true,
        confirmMessage: 'Isso vai reiniciar o rastreador. Deseja continuar?',
    },
];

/**
 * Extraído do array acima e exportado sozinho porque a tela SMS
 * renderiza ele separado, sempre como o último botão da seção
 * protegida, com destaque visual (vermelho/destrutivo).
 */
export const RESTORE_FACTORY_COMMAND: StatusCommand = {
    id: 'format',
    label: 'Restaurar Padrão de Fábrica',
    build: () => TrackerCommands.format(),
    confirm: true,
    confirmMessage: '⚠️ Isso apaga TODAS as configurações do rastreador. Tem certeza?',
    destructive: true,
};

export const PARAM_COMMANDS: ParamCommand[] = [
    {
        id: 'setApn',
        label: 'Configurar APN',
        fields: [
            { key: 'apn', label: 'APN', placeholder: 'ex: cmnet' },
            { key: 'user', label: 'Usuário', placeholder: '', optional: true },
            { key: 'pass', label: 'Senha', placeholder: '', optional: true },
        ],
        build: (v) => TrackerCommands.setApn(v.apn, v.user, v.pass),
    },
    {
        id: 'setServer',
        label: 'Configurar Servidor (IP)',
        fields: [
            { key: 'ip', label: 'IP', placeholder: 'ex: 191.101.2.5' },
            { key: 'port', label: 'Porta', placeholder: 'ex: 8011', keyboardType: 'numeric' },
        ],
        build: (v) => TrackerCommands.setServerIp(v.ip, v.port),
    },
    {
        id: 'setServerDomain',
        label: 'Configurar Servidor (Domínio)',
        fields: [
            { key: 'domain', label: 'Domínio', placeholder: 'ex: servidor.com' },
            { key: 'port', label: 'Porta', placeholder: 'ex: 8011', keyboardType: 'numeric' },
        ],
        build: (v) => TrackerCommands.setServerDomain(v.domain, v.port),
    },
    {
        id: 'setTimer',
        label: 'Configurar Intervalo (TIMER)',
        fields: [
            { key: 'accOn', label: 'Seg. com ACC ligado (5-60)', placeholder: 'ex: 30', keyboardType: 'numeric' },
            { key: 'accOff', label: 'Seg. com ACC desligado (5-1800)', placeholder: 'ex: 300', keyboardType: 'numeric' },
        ],
        build: (v) => TrackerCommands.setReportInterval(v.accOn, v.accOff),
    },
    {
        id: 'setHbt',
        label: 'Configurar Heartbeat',
        fields: [
            { key: 'accOn', label: 'Seg. com ACC ligado (60-300)', placeholder: 'ex: 180', keyboardType: 'numeric' },
            { key: 'accOff', label: 'Min. com ACC desligado (60-300)', placeholder: 'ex: 180', keyboardType: 'numeric' },
        ],
        build: (v) => TrackerCommands.setHeartbeat(v.accOn, v.accOff),
    },
    {
        id: 'setGmt',
        label: 'Configurar Fuso Horário',
        fields: [
            { key: 'direction', label: 'Direção (E ou W)', placeholder: 'E' },
            { key: 'hours', label: 'Horas (0-12)', placeholder: 'ex: 3', keyboardType: 'numeric' },
            { key: 'halfZone', label: 'Meio-fuso (0/15/30/45)', placeholder: '0', keyboardType: 'numeric', optional: true },
        ],
        build: (v) => TrackerCommands.setTimezone(v.direction.toUpperCase(), v.hours, v.halfZone || '0'),
    },
    {
        id: 'setCenter',
        label: 'Configurar Nº de Central',
        fields: [
            { key: 'number', label: 'Número (com código do país, ex: 5561999999999)', placeholder: '', keyboardType: 'phone-pad' },
        ],
        build: (v) => TrackerCommands.addCenterNumber(1, v.number),
    },
    {
        id: 'setSos',
        label: 'Configurar Nº de SOS',
        fields: [
            { key: 'number', label: 'Número (com código do país)', placeholder: '', keyboardType: 'phone-pad' },
        ],
        build: (v) => TrackerCommands.addSosNumbers(v.number),
    },
    {
        id: 'setCallFunction',
        label: 'Função da Chamada Recebida',
        fields: [
            { key: 'mode', label: '0 = monitorar voz | 1 = link Google', placeholder: '1', keyboardType: 'numeric' },
        ],
        build: (v) => TrackerCommands.setCallFunction(v.mode),
    },
];