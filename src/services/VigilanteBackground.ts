// src/services/VigilanteBackground.ts
//
// Mantém o Modo Vigilante rodando com o app minimizado ou com a tela
// bloqueada (Android), via o serviço em primeiro plano do módulo
// nativo expo-vigilante-service.
//
// O serviço inicia a tarefa headless VIGILANTE_TASK_KEY. Essa tarefa
// não faz nada além de ficar "pendente" até o Vigilante ser desligado:
// enquanto ela existe, o React Native não pausa os timers do JS, e o
// polling normal do Vigilante (RealTimeContext) continua rodando.

import {
    VIGILANTE_TASK_KEY,
    addStopRequestedListener,
    isIgnoringBatteryOptimizations,
    isSupported,
    requestIgnoreBatteryOptimizations,
    startService,
    stopService,
} from '../../modules/expo-vigilante-service/src';

export {
    VIGILANTE_TASK_KEY,
    addStopRequestedListener,
    isIgnoringBatteryOptimizations,
    requestIgnoreBatteryOptimizations,
};

let releaseKeepAliveTask: (() => void) | null = null;

/**
 * Tarefa headless registrada no index.ts. Só termina quando
 * stopVigilanteBackground() é chamado — ao terminar, o serviço nativo
 * se encerra sozinho.
 */
export function vigilanteKeepAliveTask(): Promise<void> {
    // Se sobrou uma tarefa anterior, encerra antes de abrir outra.
    releaseKeepAliveTask?.();

    return new Promise(resolve => {
        releaseKeepAliveTask = resolve;
    });
}

/**
 * Liga o serviço em primeiro plano (ou só atualiza o texto da
 * notificação, se já estiver ligado). Retorna false se não foi
 * possível — o Vigilante continua funcionando com o app aberto.
 */
export function startVigilanteBackground(trackerName: string): boolean {
    if (!isSupported) {
        return false;
    }

    try {
        startService(
            'Modo Vigilante ativo',
            `Monitorando ${trackerName}. Você será avisado se ele se mover ou disparar um alarme.`
        );

        return true;
    } catch (error) {
        console.warn('Não foi possível iniciar o serviço do Vigilante:', error);
        return false;
    }
}

export function stopVigilanteBackground(): void {
    releaseKeepAliveTask?.();
    releaseKeepAliveTask = null;

    if (!isSupported) {
        return;
    }

    try {
        stopService();
    } catch (error) {
        console.warn('Erro ao parar o serviço do Vigilante:', error);
    }
}
