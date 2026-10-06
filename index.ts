import { AppRegistry } from 'react-native';
import { registerRootComponent } from 'expo';

import App from './App';
import {
    VIGILANTE_TASK_KEY,
    vigilanteKeepAliveTask,
} from './src/services/VigilanteBackground';

// Tarefa iniciada pelo serviço em primeiro plano do Modo Vigilante
// (mantém os timers do JS rodando com o app em segundo plano).
AppRegistry.registerHeadlessTask(
    VIGILANTE_TASK_KEY,
    () => vigilanteKeepAliveTask
);

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
