// Importa o AsyncStorage.
//authStorage.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
// SecureStore é opcional: carregamos dinamicamente para evitar crash quando
// o pacote não estiver instalado no ambiente do desenvolvedor.
let SecureStore: typeof import('expo-secure-store') | null = null;
try {
    // require em vez de import estático para não falhar na inicialização
    // quando o pacote não estiver presente.
    // eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-unsafe-assignment
    SecureStore = require('expo-secure-store');
} catch (e) {
    SecureStore = null;
}

/*
    Chave utilizada para armazenar
    a sessão do usuário.
*/
const SESSION_KEY = '@cavalleta:session';
const CREDENTIALS_KEY = '@cavalleta:credentials';
// SecureStore keys must only contain alphanumeric, '.', '-', '_'
const SECURE_CREDENTIALS_KEY = 'cavalleta_secure_credentials';
const BIOMETRIC_KEY = 'cavalleta_biometric_enabled';

/*
    Se o app já perguntou ao usuário (uma única vez) se ele queria
    ativar a biometria. Independente da resposta (sim ou não), uma
    vez perguntado, nunca mais deve perguntar de novo.
*/
const BIOMETRIC_PROMPTED_KEY = 'cavalleta_biometric_prompted';

export type StoredCredentials = {
    username: string;
    password: string;
};

/*
    Salva a sessão do usuário.

    Será chamado após um login válido.
*/
export async function saveSession(): Promise<void> {
    await AsyncStorage.setItem(SESSION_KEY, 'true');
}

/*
    Verifica se existe uma sessão salva.

    Retorna:

    true  -> usuário logado.

    false -> usuário não logado.
*/
export async function getSession(): Promise<boolean> {
    const session = await AsyncStorage.getItem(SESSION_KEY);
    return session === 'true';
}

/*
    Salva usuário e senha. Existe um ÚNICO lugar de verdade: o
    SecureStore (criptografado). O AsyncStorage (texto puro) só é
    usado se o SecureStore não estiver disponível — e, quando o
    SecureStore funciona, a cópia antiga em texto puro é apagada.

    Antes havia duas cópias (SecureStore só quando a biometria era
    ativada + AsyncStorage sempre), e trocar a senha com a biometria
    desligada deixava a senha ANTIGA no SecureStore, que tinha
    prioridade na leitura — a senha nova era recusada no login.
*/
export async function saveCredentials(username: string, password: string): Promise<void> {
    const payload: StoredCredentials = {
        username: username.trim(),
        password: password.trim(),
    };

    try {
        if (SecureStore && SecureStore.setItemAsync) {
            await SecureStore.setItemAsync(SECURE_CREDENTIALS_KEY, JSON.stringify(payload));
            await AsyncStorage.removeItem(CREDENTIALS_KEY);
            return;
        }
    } catch (error) {
        console.warn('Não foi possível salvar credenciais no SecureStore:', error);
    }

    await AsyncStorage.setItem(CREDENTIALS_KEY, JSON.stringify(payload));
}

/*
    Mantido por compatibilidade com quem já chama esse nome —
    hoje é igual a saveCredentials.
*/
export async function saveCredentialsSecure(username: string, password: string): Promise<void> {
    await saveCredentials(username, password);
}

/*
    Apaga as credenciais salvas (usado no "restaurar padrões de
    fábrica"). O AsyncStorage.clear() não alcança o SecureStore.
*/
export async function clearCredentials(): Promise<void> {
    try {
        if (SecureStore && SecureStore.deleteItemAsync) {
            await SecureStore.deleteItemAsync(SECURE_CREDENTIALS_KEY);
        }
    } catch (error) {
        console.warn('Não foi possível apagar credenciais do SecureStore:', error);
    }

    await AsyncStorage.removeItem(CREDENTIALS_KEY);
}

/*
    Retorna true se ainda estiver usando o usuário/senha padrão
    (root/root) — o app avisa pra trocar.
*/
export async function isUsingDefaultCredentials(): Promise<boolean> {
    const creds = await getCredentials();
    return creds.username === 'root' && creds.password === 'root';
}

export async function setBiometricEnabled(enabled: boolean): Promise<void> {
    await AsyncStorage.setItem(BIOMETRIC_KEY, enabled ? 'true' : 'false');
}

export async function getBiometricEnabled(): Promise<boolean> {
    const v = await AsyncStorage.getItem(BIOMETRIC_KEY);
    return v === 'true';
}

/*
    Marca que o app já perguntou ao usuário se ele queria ativar
    a biometria. Chamado logo antes de mostrar o Alert, para que
    mesmo se o app fechar no meio do diálogo, a pergunta não seja
    repetida na próxima abertura.
*/
export async function setBiometricPrompted(): Promise<void> {
    await AsyncStorage.setItem(BIOMETRIC_PROMPTED_KEY, 'true');
}

export async function hasPromptedBiometric(): Promise<boolean> {
    const v = await AsyncStorage.getItem(BIOMETRIC_PROMPTED_KEY);
    return v === 'true';
}

export async function getCredentials(): Promise<StoredCredentials> {
    // Prefer secure credentials when available
    try {
        if (SecureStore && SecureStore.getItemAsync) {
            const secureRaw = await SecureStore.getItemAsync(SECURE_CREDENTIALS_KEY);
            if (secureRaw) {
                const parsed = JSON.parse(secureRaw) as Partial<StoredCredentials>;
                return {
                    username: parsed.username?.trim() || 'root',
                    password: parsed.password?.trim() || 'root',
                };
            }
        }
    } catch (error) {
        console.warn('Erro ao ler credenciais seguras:', error);
    }

    // Fallback to AsyncStorage
    const raw = await AsyncStorage.getItem(CREDENTIALS_KEY);

    if (!raw) {
        return { username: 'root', password: 'root' };
    }

    try {
        const parsed = JSON.parse(raw) as Partial<StoredCredentials>;

        const credentials = {
            username: parsed.username?.trim() || 'root',
            password: parsed.password?.trim() || 'root',
        };

        // Migra a cópia antiga em texto puro pro SecureStore.
        if (SecureStore) {
            await saveCredentials(credentials.username, credentials.password);
        }

        return credentials;
    } catch (error) {
        console.warn('Erro ao ler credenciais salvas:', error);
        return { username: 'root', password: 'root' };
    }
}

/*
    Remove a sessão do usuário.

    Será chamado quando o usuário
    realizar o logout.
*/
export async function logout(): Promise<void> {
    await AsyncStorage.removeItem(SESSION_KEY);
}