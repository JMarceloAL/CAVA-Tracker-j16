package expo.modules.vigilanteservice

import android.annotation.SuppressLint
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.PowerManager
import android.provider.Settings
import androidx.core.content.ContextCompat
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class ExpoVigilanteServiceModule : Module() {
    private val context: Context
        get() = appContext.reactContext?.applicationContext
            ?: throw CodedException("ERR_NO_CONTEXT", "Contexto do app indisponível.", null)

    override fun definition() = ModuleDefinition {
        Name("ExpoVigilanteService")

        Events("onStopRequested")

        OnCreate {
            VigilanteForegroundService.onStopRequested = {
                sendEvent("onStopRequested", emptyMap<String, Any>())
            }
        }

        OnDestroy {
            VigilanteForegroundService.onStopRequested = null
        }

        /** Inicia o serviço (ou só atualiza o texto da notificação, se já estiver rodando). */
        Function("start") { title: String, body: String ->
            val intent = Intent(context, VigilanteForegroundService::class.java)
                .putExtra(VigilanteForegroundService.EXTRA_TITLE, title)
                .putExtra(VigilanteForegroundService.EXTRA_BODY, body)

            try {
                ContextCompat.startForegroundService(context, intent)
            } catch (e: Exception) {
                // Ex: Android 12+ recusa iniciar serviço em primeiro plano
                // com o app em segundo plano.
                throw CodedException(
                    "ERR_START_SERVICE",
                    "Não foi possível iniciar o serviço do Vigilante: ${e.message}",
                    e
                )
            }
        }

        Function("stop") {
            context.stopService(Intent(context, VigilanteForegroundService::class.java))
        }

        Function("isRunning") {
            VigilanteForegroundService.isRunning
        }

        Function("isIgnoringBatteryOptimizations") {
            val powerManager = context.getSystemService(Context.POWER_SERVICE) as PowerManager
            powerManager.isIgnoringBatteryOptimizations(context.packageName)
        }

        /**
         * Abre o diálogo do sistema pedindo para o app ficar fora da
         * otimização de bateria (sem isso, alguns fabricantes ainda
         * pausam o app mesmo com o serviço em primeiro plano).
         */
        @SuppressLint("BatteryLife")
        Function("requestIgnoreBatteryOptimizations") {
            val intent = Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS)
                .setData(Uri.parse("package:${context.packageName}"))
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)

            context.startActivity(intent)
        }
    }
}
