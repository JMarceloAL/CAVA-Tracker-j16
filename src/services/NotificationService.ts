import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// ============================================================
// CONFIGURAÇÃO DAS NOTIFICAÇÕES
// ============================================================

Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
    }),
});

const VIGILANTE_CHANNEL_ID = 'vigilante';

const VIGILANTE_TRIGGER: Notifications.NotificationTriggerInput =
    Platform.OS === 'android'
        ? { channelId: VIGILANTE_CHANNEL_ID }
        : null;

// ============================================================
// PERMISSÕES
// ============================================================

export async function requestNotificationPermissions(): Promise<boolean> {
    const { status: existingStatus } =
        await Notifications.getPermissionsAsync();

    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
        const { status } =
            await Notifications.requestPermissionsAsync();

        finalStatus = status;
    }

    if (finalStatus !== 'granted') {
        return false;
    }

    // Android
    if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync(
            VIGILANTE_CHANNEL_ID,
            {
                name: 'Vigilante',
                importance: Notifications.AndroidImportance.MAX,
                vibrationPattern: [0, 250, 250, 250],
                lockscreenVisibility:
                    Notifications.AndroidNotificationVisibility.PUBLIC,
            }
        );
    }

    return true;
}

// ============================================================
// DATA/HORA
// ============================================================

function formatarDataHoraAgora(): string {
    return new Date().toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
    });
}

// ============================================================
// MOVIMENTO
// ============================================================

export async function sendMovementNotification(
    trackerName: string
): Promise<void> {
    const dataHora = formatarDataHoraAgora();

    await Notifications.scheduleNotificationAsync({
        content: {
            title: '🚨 Movimento detectado',
            body:
                `${trackerName} começou a se mover.\n` +
                `Data e hora: ${dataHora}`,
            data: {
                tipo: 'MOVIMENTO',
                trackerName,
                dataHora,
            },
        },

        // Envia imediatamente, pelo canal "vigilante" (prioridade
        // máxima no Android — aparece como pop-up e vibra).
        trigger: VIGILANTE_TRIGGER,
    });
}

// ============================================================
// ALARME
// ============================================================

export async function sendAlarmNotification(
    trackerName: string,
    descricao: string,
    dataHora?: string
): Promise<void> {
    const data = dataHora || formatarDataHoraAgora();

    await Notifications.scheduleNotificationAsync({
        content: {
            title: '🚨 ALARME ATIVADO',
            body:
                `${trackerName}\n` +
                `Alarme: ${descricao}\n` +
                `Data e hora: ${data}`,
            data: {
                tipo: 'ALARME',
                trackerName,
                descricao,
                dataHora: data,
            },
        },

        // Envia imediatamente, pelo canal "vigilante" (prioridade
        // máxima no Android — aparece como pop-up e vibra).
        trigger: VIGILANTE_TRIGGER,
    });
}
// ============================================================
// EVENTO DO SERVIDOR (alertas configuráveis, cercas, alarmes)
// ============================================================

export async function sendTrackerEventNotification(
    trackerName: string,
    event: {
        id: string;
        type: string;
        title: string;
        message: string;
        createdAt: string;
    }
): Promise<void> {
    const dataHora = new Date(event.createdAt).toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
    });

    await Notifications.scheduleNotificationAsync({
        content: {
            title: `🚨 ${event.title}`,
            body:
                `${trackerName}\n` +
                `${event.message}\n` +
                `Data e hora: ${dataHora}`,
            data: {
                tipo: 'EVENTO',
                eventId: event.id,
                eventType: event.type,
                trackerName,
            },
        },

        trigger: VIGILANTE_TRIGGER,
    });
}
