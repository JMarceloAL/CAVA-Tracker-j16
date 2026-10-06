package expo.modules.vigilanteservice

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.ServiceCompat
import com.facebook.react.HeadlessJsTaskService
import com.facebook.react.bridge.Arguments
import com.facebook.react.jstasks.HeadlessJsTaskConfig

/**
 * Serviço em primeiro plano do Modo Vigilante.
 *
 * Duas coisas mantêm o Vigilante funcionando com o app minimizado ou
 * com a tela bloqueada:
 *
 * 1. Ser um serviço em primeiro plano (notificação fixa) — o Android
 *    não mata o processo do app nem o trata como "em segundo plano".
 * 2. Rodar uma tarefa headless do React Native que só termina quando
 *    o Vigilante é desligado. Enquanto existe uma tarefa headless
 *    ativa, o React Native NÃO pausa os timers do JavaScript — então
 *    o polling do Vigilante (setInterval no RealTimeContext) continua
 *    rodando normalmente. A classe base também segura um wake lock
 *    parcial, que mantém a CPU acordada com a tela desligada.
 */
class VigilanteForegroundService : HeadlessJsTaskService() {
    private var taskStarted = false

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent?.action == ACTION_STOP) {
            // Botão "Desligar" da notificação: avisa o JS (que desliga
            // o Vigilante e encerra a tarefa) e para o serviço.
            onStopRequested?.invoke()
            ServiceCompat.stopForeground(this, ServiceCompat.STOP_FOREGROUND_REMOVE)
            stopSelf()
            return START_NOT_STICKY
        }

        val title = intent?.getStringExtra(EXTRA_TITLE) ?: DEFAULT_TITLE
        val body = intent?.getStringExtra(EXTRA_BODY) ?: DEFAULT_BODY

        startInForeground(title, body)
        isRunning = true

        // Um novo start com o serviço já rodando só atualiza o texto
        // da notificação — não abre uma segunda tarefa.
        if (!taskStarted) {
            taskStarted = true
            super.onStartCommand(intent, flags, startId)
        }

        // Se o Android matar o processo, não recria o serviço sozinho:
        // sem o app aberto não há polling do Vigilante pra manter vivo.
        return START_NOT_STICKY
    }

    override fun getTaskConfig(intent: Intent?): HeadlessJsTaskConfig =
        HeadlessJsTaskConfig(
            TASK_KEY,
            Arguments.createMap(),
            0, // sem timeout: dura até o Vigilante ser desligado
            true // pode rodar com o app aberto na tela
        )

    override fun onDestroy() {
        isRunning = false
        taskStarted = false
        super.onDestroy()
    }

    private fun startInForeground(title: String, body: String) {
        val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            manager.createNotificationChannel(
                NotificationChannel(
                    CHANNEL_ID,
                    "Vigilante em execução",
                    // Baixa: notificação fixa e silenciosa. Os alertas de
                    // movimento/alarme usam o canal "vigilante" (máxima).
                    NotificationManager.IMPORTANCE_LOW
                ).apply {
                    description = "Mantém o Modo Vigilante ativo com o app em segundo plano."
                    setShowBadge(false)
                }
            )
        }

        val openAppIntent = packageManager.getLaunchIntentForPackage(packageName)?.let {
            PendingIntent.getActivity(
                this,
                0,
                it,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
        }

        val stopIntent = PendingIntent.getService(
            this,
            1,
            Intent(this, VigilanteForegroundService::class.java).setAction(ACTION_STOP),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val notification = NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle(title)
            .setContentText(body)
            .setSmallIcon(android.R.drawable.ic_menu_mylocation)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .setForegroundServiceBehavior(NotificationCompat.FOREGROUND_SERVICE_IMMEDIATE)
            .setContentIntent(openAppIntent)
            .addAction(0, "Desligar", stopIntent)
            .build()

        val type =
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
                ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE
            } else {
                0
            }

        ServiceCompat.startForeground(this, NOTIFICATION_ID, notification, type)
    }

    companion object {
        const val TASK_KEY = "CavalletaVigilante"
        const val ACTION_STOP = "expo.modules.vigilanteservice.STOP"
        const val EXTRA_TITLE = "title"
        const val EXTRA_BODY = "body"

        private const val CHANNEL_ID = "vigilante_service"
        private const val NOTIFICATION_ID = 7316
        private const val DEFAULT_TITLE = "Modo Vigilante ativo"
        private const val DEFAULT_BODY = "Monitorando o rastreador."

        @Volatile
        var isRunning = false
            private set

        /** Chamado quando o usuário desliga pelo botão da notificação. */
        @Volatile
        var onStopRequested: (() -> Unit)? = null
    }
}
