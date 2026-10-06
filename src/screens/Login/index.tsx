// Importa os Hooks do React.
import React, { useState, useEffect } from 'react';
import { useRef } from 'react';

// Componentes visuais do React Native.
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    Alert,
    ActivityIndicator,
} from 'react-native';

import { MaterialIcons } from '@expo/vector-icons';

// Importa os estilos.
import { styles } from './styles';
import { useTheme } from '../../contexts/ThemeContext';
// Use import estático: o development build inclui o módulo nativo.
import * as LocalAuthentication from 'expo-local-authentication';

// Serviço responsável pela autenticação.
import { login } from '../../services/Auth';
import {
    saveCredentialsSecure,
    getBiometricEnabled,
    setBiometricEnabled,
    getCredentials,
    hasPromptedBiometric,
    setBiometricPrompted,
    isUsingDefaultCredentials,
} from '../../services/storage/authStorage';

// Permissões pedidas logo após o login.
import { requestSmsPermissions } from '../../services/Smsgateway';
import { requestNotificationPermissions } from '../../services/NotificationService';

export default function Login({ navigation }: any) {
    const { isDark, colors } = useTheme();

    /*
        Armazena o usuário digitado.
    */
    const [username, setUsername] = useState('');

    /*
        Armazena a senha digitada.
    */
    const [password, setPassword] = useState('');

    /*
        Controla o estado de carregamento durante login + permissões.
    */
    const [loading, setLoading] = useState(false);
    const [biometricAvailable, setBiometricAvailable] = useState(false);
    const [biometricEnabled, setBiometricEnabledState] = useState(false);
    const attemptedBiometricRef = useRef(false);

    /*
        Pede as permissões de SMS e notificação, uma de cada vez.
        Não bloqueia o acesso ao app se o usuário negar — só avisa.
    */
    async function requestAppPermissions() {
        try {
            await requestSmsPermissions();
        } catch (error) {
            console.log('⚠️ Permissão de SMS não concedida:', error);
        }

        try {
            const granted = await requestNotificationPermissions();
            if (!granted) {
                console.log('⚠️ Permissão de notificação não concedida.');
            }
        } catch (error) {
            console.log('⚠️ Erro ao pedir permissão de notificação:', error);
        }
    }

    /*
        Realiza o login.
    */
    async function handleLogin() {
        setLoading(true);

        try {
            const success = await login(username, password);

            if (!success) {
                Alert.alert('Erro', 'Usuário ou senha inválidos.');
                return;
            }

            await requestAppPermissions();

            // Ainda com o usuário/senha de fábrica: avisa pra trocar.
            if (await isUsingDefaultCredentials()) {
                Alert.alert(
                    'Senha padrão',
                    'Você está usando o usuário e a senha padrão (root / root). Troque em Configurações > Segurança para proteger o app.'
                );
            }

            // Após login bem-sucedido, oferecer ativar biometria se disponível —
            // mas só se ainda NÃO estiver ativada e o usuário ainda NÃO tiver
            // sido perguntado antes (independente da resposta anterior).
            try {
                if (LocalAuthentication && LocalAuthentication.hasHardwareAsync) {
                    const hasHardware = await LocalAuthentication.hasHardwareAsync();
                    const isEnrolled = await LocalAuthentication.isEnrolledAsync();
                    const alreadyPrompted = await hasPromptedBiometric();

                    if (hasHardware && isEnrolled && !biometricEnabled && !alreadyPrompted) {
                        // Marca ANTES de exibir o Alert: mesmo que o app feche
                        // no meio do diálogo, a pergunta não repete depois.
                        await setBiometricPrompted();

                        Alert.alert('Ativar autenticação', 'Deseja ativar login por impressão digital / PIN para entrar mais rápido?', [
                            { text: 'Não', onPress: () => { } },
                            {
                                text: 'Sim',
                                onPress: async () => {
                                    // Sem chamar authenticateAsync aqui — o usuário já provou
                                    // quem é fazendo login com usuário/senha agora mesmo. A
                                    // biometria só é pedida de verdade na PRÓXIMA vez que
                                    // abrir a tela de login (via handleBiometricLogin no useEffect).
                                    try {
                                        await saveCredentialsSecure(username, password);
                                        await setBiometricEnabled(true);
                                        setBiometricEnabledState(true);
                                    } catch (e) {
                                        console.warn('Erro ao salvar credenciais seguras:', e);
                                    }
                                }
                            }
                        ]);
                    }
                }
            } catch (e) {
                console.warn('Erro ao verificar biometria:', e);
            }

            navigation.replace('Home');
        } finally {
            setLoading(false);
        }
    }

    async function handleBiometricLogin() {
        setLoading(true);

        try {
            if (!LocalAuthentication || !LocalAuthentication.authenticateAsync) {
                Alert.alert('Autenticação', 'Autenticação biométrica não disponível neste dispositivo.');
                return;
            }

            const auth = await LocalAuthentication.authenticateAsync({ promptMessage: 'Use impressão digital ou PIN para entrar' });
            if (!auth.success) {
                Alert.alert('Autenticação', 'Falha na autenticação biométrica.');
                return;
            }

            const creds = await getCredentials();
            const success = await login(creds.username, creds.password);
            if (!success) {
                Alert.alert('Erro', 'Credenciais salvas não são válidas.');
                return;
            }

            await requestAppPermissions();
            navigation.replace('Home');
        } catch (e) {
            console.warn('Erro durante login biométrico:', e);
            Alert.alert('Erro', 'Erro durante login biométrico.');
        } finally {
            setLoading(false);
        }
    }


    const containerStyle = [styles.container, { backgroundColor: colors.background }, isDark && styles.darkContainer];
    const titleStyle = [styles.title, { color: colors.text }, isDark && styles.darkTitle];
    const subtitleStyle = [styles.subtitle, isDark && styles.darkSubtitle];
    const inputStyle = [styles.input, { backgroundColor: colors.surface, borderColor: colors.border }, isDark && styles.darkInput];
    const inputContainerStyle = [styles.inputContainer, { backgroundColor: colors.surface, borderColor: colors.border }, isDark && styles.darkInputContainer];
    const inputWithIconStyle = [styles.inputWithIcon, { color: colors.text }, isDark && styles.darkInputText];
    const buttonStyle = [styles.button, { backgroundColor: colors.primary }];

    useEffect(() => {
        (async () => {
            try {
                const hasHardware = await LocalAuthentication.hasHardwareAsync();
                const isEnrolled = await LocalAuthentication.isEnrolledAsync();
                const enabled = await getBiometricEnabled();

                setBiometricAvailable(!!hasHardware && !!isEnrolled);
                setBiometricEnabledState(!!enabled);
                // Auto-disparar login biométrico apenas uma vez quando já habilitado
                if (!!hasHardware && !!isEnrolled && !!enabled && !attemptedBiometricRef.current) {
                    attemptedBiometricRef.current = true;
                    // pequeno delay para deixar a tela renderizar antes do prompt
                    setTimeout(() => {
                        handleBiometricLogin();
                    }, 300);
                }
            } catch (e) {
                console.warn('Erro ao verificar biometria:', e);
            }
        })();
    }, []);

    return (

        <View style={containerStyle}>

            <Text style={titleStyle}>
                <Text style={{ color: colors.primary }}>CAVA</Text>
                {' '}
                <Text style={titleStyle}>Tracker</Text>
            </Text>

            <Text style={subtitleStyle}>

                Sistema de Rastreamento J16

            </Text>

            {biometricAvailable && biometricEnabled && (
                <TouchableOpacity
                    style={[styles.biometricButton, { borderColor: colors.primary }]}
                    onPress={handleBiometricLogin}
                    disabled={loading}
                >
                    <MaterialIcons name="fingerprint" size={28} color={colors.primary} />
                </TouchableOpacity>
            )}

            {/* Biometric activation is automatic after first successful username/password login. Manual button removed. */}

            <TextInput

                style={inputStyle}

                placeholder="Usuário"

                autoCapitalize="none"

                value={username}
                placeholderTextColor={isDark ? '#AFB9C7' : '#8E8E93'}

                onChangeText={setUsername}

                editable={!loading}

            />

            <View style={inputContainerStyle}>
                <MaterialIcons
                    name="lock-outline"
                    size={22}
                    color={isDark ? '#AFB9C7' : '#8E8E93'}
                    style={styles.inputIcon}
                />

                <TextInput
                    style={inputWithIconStyle}
                    placeholder="Senha"
                    placeholderTextColor={isDark ? '#AFB9C7' : '#8E8E93'}
                    secureTextEntry
                    value={password}
                    onChangeText={setPassword}
                    editable={!loading}
                />
            </View>

            <TouchableOpacity

                style={buttonStyle}

                onPress={handleLogin}

                disabled={loading}

            >

                {loading ? (
                    <ActivityIndicator size="small" color="#fff" />
                ) : (
                    <Text style={styles.buttonText}>

                        Entrar

                    </Text>
                )}

            </TouchableOpacity>

        </View>

    );

}