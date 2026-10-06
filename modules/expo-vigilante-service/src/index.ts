import { NativeModule, requireOptionalNativeModule } from 'expo';

declare class ExpoVigilanteServiceModule extends NativeModule<{
    onStopRequested: () => void;
}> {
    start(title: string, body: string): void;
    stop(): void;
    isRunning(): boolean;
    isIgnoringBatteryOptimizations(): boolean;
    requestIgnoreBatteryOptimizations(): void;
}

// Só existe no Android. Em outras plataformas tudo vira no-op.
const nativeModule =
    requireOptionalNativeModule<ExpoVigilanteServiceModule>('ExpoVigilanteService');

/** Nome da tarefa headless iniciada pelo serviço (igual ao TASK_KEY nativo). */
export const VIGILANTE_TASK_KEY = 'CavalletaVigilante';

export const isSupported = nativeModule != null;

export function startService(title: string, body: string): void {
    nativeModule?.start(title, body);
}

export function stopService(): void {
    nativeModule?.stop();
}

export function isServiceRunning(): boolean {
    return nativeModule?.isRunning() ?? false;
}

export function isIgnoringBatteryOptimizations(): boolean {
    return nativeModule?.isIgnoringBatteryOptimizations() ?? true;
}

export function requestIgnoreBatteryOptimizations(): void {
    nativeModule?.requestIgnoreBatteryOptimizations();
}

/** Usuário tocou em "Desligar" na notificação do serviço. */
export function addStopRequestedListener(listener: () => void) {
    return nativeModule?.addListener('onStopRequested', listener) ?? {
        remove: () => undefined,
    };
}
