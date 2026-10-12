// src/screens/Settings/index.tsx
//
// Configurações do app, em seções: aparência, segurança,
// notificações e monitoramento, servidor, dados do aparelho, sobre
// e zona de perigo (restaurar padrões de fábrica).

import React, {
    useCallback,
    useEffect,
    useState,
} from 'react';

import {
    View,
    Text,
    Switch,
    TextInput,
    TouchableOpacity,
    Alert,
    ScrollView,
    ActivityIndicator,
    AppState,
    Linking,
} from 'react-native';

import {
    SafeAreaView,
} from 'react-native-safe-area-context';

import AsyncStorage from '@react-native-async-storage/async-storage';

import {
    MaterialIcons,
} from '@expo/vector-icons';

import * as LocalAuthentication from 'expo-local-authentication';
import * as Notifications from 'expo-notifications';

import { useFocusEffect, useNavigation } from '@react-navigation/native';

import { styles } from './styles';

import {
    useTheme,
} from '../../contexts/ThemeContext';

import {
    getCredentials,
    saveCredentials,
    clearCredentials,
    getBiometricEnabled,
    setBiometricEnabled,
    logout,
} from '../../services/storage/authStorage';

import { clearTrackerLocationCache } from '../../services/storage/LastlocationStorage';
import { clearTrackerRoutes } from '../../services/storage/RouteHistoryStorage';
import { requestNotificationPermissions } from '../../services/NotificationService';
import { fetchAllTrackers, getServerInfo } from '../../services/TrackerApiService';

import { useRealTime } from '../../contexts/RealTimeContext';
import { useTrackerServiceProvider } from '../../contexts/TrackerServiceContext';
import { useStoredTrackers } from '../../hooks/useStoredTrackers';

import Collapsible from '../../components/Collapsible';
import { RotatingChevron } from '../../components/AnimatedDropdown';
import ScreenHeader from '../../components/ScreenHeader';
import { APP_THEMES, APP_THEME_OPTIONS, type AppThemeName } from '../../theme/colors';

import appConfig from '../../../app.json';

const DANGER = '#D32F2F';

type IconName = React.ComponentProps<typeof MaterialIcons>['name'];

type ServerTest =
    | { state: 'idle' }
    | { state: 'testing' }
    | { state: 'ok'; ms: number; trackers: number }
    | { state: 'error'; message: string };

// ============================================================
// PEÇAS DA INTERFACE (fora do componente para não remontar a cada render)
// ============================================================

function SectionTitle({ children }: { children: string }) {
    const { colors } = useTheme();

    return <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>{children}</Text>;
}

function SettingRow({
    icon,
    title,
    subtitle,
    onPress,
    right,
    iconColor,
    titleColor,
    disabled,
}: {
    icon: IconName;
    title: string;
    subtitle?: string;
    onPress?: () => void;
    right?: React.ReactNode;
    iconColor?: string;
    titleColor?: string;
    disabled?: boolean;
}) {
    const { colors } = useTheme();

    const content = (
        <>
            <View style={[styles.rowIcon, { backgroundColor: colors.backgroundAlt }]}>
                <MaterialIcons name={icon} size={20} color={iconColor ?? colors.primary} />
            </View>

            <View style={styles.rowText}>
                <Text style={[styles.rowTitle, { color: titleColor ?? colors.text }]}>{title}</Text>
                {subtitle ? (
                    <Text style={[styles.rowSubtitle, { color: colors.textMuted }]}>{subtitle}</Text>
                ) : null}
            </View>

            {right}
        </>
    );

    if (!onPress) {
        return <View style={styles.row}>{content}</View>;
    }

    return (
        <TouchableOpacity
            style={[styles.row, disabled && { opacity: 0.6 }]}
            onPress={onPress}
            disabled={disabled}
            activeOpacity={0.7}
        >
            {content}
        </TouchableOpacity>
    );
}

function Chevron({ open }: { open?: boolean }) {
    const { colors } = useTheme();

    if (open === undefined) {
        return <MaterialIcons name="chevron-right" size={24} color={colors.textMuted} />;
    }

    return (
        <RotatingChevron open={open}>
            <MaterialIcons name="expand-more" size={24} color={colors.textMuted} />
        </RotatingChevron>
    );
}

function ValueText({ children, color }: { children: string; color?: string }) {
    const { colors } = useTheme();

    return (
        <Text style={[styles.rowValue, { color: color ?? colors.textMuted }]} numberOfLines={1}>
            {children}
        </Text>
    );
}

function StopButton({ onPress }: { onPress: () => void }) {
    return (
        <TouchableOpacity
            style={[styles.smallButton, { borderColor: DANGER }]}
            onPress={onPress}
            activeOpacity={0.8}
        >
            <Text style={[styles.smallButtonText, { color: DANGER }]}>Desligar</Text>
        </TouchableOpacity>
    );
}

export default function SettingsScreen({
    navigation,
}: any) {
    const nav = useNavigation<any>();
    const {
        isDark,
        activeTheme,
        colors,
        setTheme,
    } = useTheme();

    const {
        stopRealTime,
        stopVigilante,
        realTimeEnabled,
        activeTrackerName,
        vigilanteEnabled,
        activeVigilanteTrackerName,
    } = useRealTime();
    const { clearService } = useTrackerServiceProvider();
    const { trackers } = useStoredTrackers();

    const server = getServerInfo();

    // Conta
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [credentialsOpen, setCredentialsOpen] = useState(false);

    // Biometria
    const [biometricAvailable, setBiometricAvailable] = useState(false);
    const [biometricEnabled, setBiometricEnabledState] = useState(false);

    // Aparência
    const [themeMenuOpen, setThemeMenuOpen] = useState(false);

    // Notificações
    const [notificationsGranted, setNotificationsGranted] = useState<boolean | null>(null);

    // Servidor
    const [serverTest, setServerTest] = useState<ServerTest>({ state: 'idle' });

    // Dados
    const [clearing, setClearing] = useState(false);
    const [clearingCache, setClearingCache] = useState(false);

    /**
     * ========================================================
     * CARREGAMENTO
     * ========================================================
     */
    useEffect(() => {
        async function loadCredentials() {
            try {
                const credentials = await getCredentials();

                setUsername(credentials.username);
            } catch (error) {
                console.warn('Erro ao carregar credenciais:', error);
            } finally {
                setIsLoading(false);
            }
        }

        async function loadBiometricState() {
            try {
                const hasHardware = await LocalAuthentication.hasHardwareAsync();
                const isEnrolled = await LocalAuthentication.isEnrolledAsync();
                const enabled = await getBiometricEnabled();

                setBiometricAvailable(!!hasHardware && !!isEnrolled);
                setBiometricEnabledState(!!enabled);
            } catch (error) {
                console.warn('Erro ao verificar biometria:', error);
            }
        }

        loadCredentials();
        loadBiometricState();
    }, []);

    const refreshNotificationStatus = useCallback(async () => {
        try {
            const { status } = await Notifications.getPermissionsAsync();
            setNotificationsGranted(status === 'granted');
        } catch (error) {
            console.warn('Erro ao verificar notificações:', error);
        }
    }, []);

    // Atualiza ao abrir a tela e ao voltar dos ajustes do sistema.
    useFocusEffect(
        useCallback(() => {
            void refreshNotificationStatus();
        }, [refreshNotificationStatus])
    );

    useEffect(() => {
        const subscription = AppState.addEventListener('change', (state) => {
            if (state === 'active') {
                void refreshNotificationStatus();
            }
        });

        return () => subscription.remove();
    }, [refreshNotificationStatus]);

    /**
     * ========================================================
     * BIOMETRIA
     * ========================================================
     *
     * Ao ATIVAR, pede uma confirmação biométrica na hora — aqui é
     * uma ação deliberada nas Configurações, então faz sentido
     * confirmar.
     */
    async function handleToggleBiometric(value: boolean) {
        if (!value) {
            await setBiometricEnabled(false);
            setBiometricEnabledState(false);
            return;
        }

        try {
            const hasHardware = await LocalAuthentication.hasHardwareAsync();
            const isEnrolled = await LocalAuthentication.isEnrolledAsync();

            if (!hasHardware || !isEnrolled) {
                Alert.alert(
                    'Biometria indisponível',
                    'Este dispositivo não tem biometria configurada. Configure a impressão digital ou reconhecimento facial nas configurações do sistema primeiro.'
                );
                return;
            }

            const auth = await LocalAuthentication.authenticateAsync({
                promptMessage: 'Confirme sua impressão digital ou PIN',
            });

            if (!auth.success) {
                Alert.alert('Autenticação', 'Não foi possível validar sua impressão digital/PIN.');
                return;
            }

            await setBiometricEnabled(true);
            setBiometricEnabledState(true);
        } catch (error) {
            console.warn('Erro ao ativar biometria:', error);
            Alert.alert('Erro', 'Não foi possível ativar a biometria.');
        }
    }

    /**
     * ========================================================
     * USUÁRIO E SENHA
     * ========================================================
     *
     * Senha em branco mantém a senha atual (permite trocar só o
     * usuário).
     */
    async function handleSaveCredentials() {
        const nextUsername = username.trim();

        if (nextUsername === '') {
            Alert.alert('Aviso', 'O usuário não pode ficar em branco.');
            return;
        }

        if (password !== '' && password !== confirmPassword) {
            Alert.alert(
                'Senhas não conferem',
                'A confirmação de senha precisa ser igual à nova senha digitada.'
            );
            return;
        }

        try {
            const nextPassword =
                password !== ''
                    ? password
                    : (await getCredentials()).password;

            // Um único lugar de armazenamento (SecureStore) — vale
            // tanto pro login com senha quanto pela biometria.
            await saveCredentials(nextUsername, nextPassword);

            Alert.alert(
                'Sucesso',
                password !== '' ? 'Usuário e senha atualizados.' : 'Usuário atualizado.'
            );

            setUsername(nextUsername);
            setPassword('');
            setConfirmPassword('');
            setShowPassword(false);
            setCredentialsOpen(false);
        } catch (error) {
            Alert.alert('Erro', 'Não foi possível salvar as credenciais.');
        }
    }

    /**
     * ========================================================
     * NOTIFICAÇÕES
     * ========================================================
     */
    async function handleNotificationsPress() {
        if (notificationsGranted) {
            Linking.openSettings().catch(() => undefined);
            return;
        }

        const granted = await requestNotificationPermissions();
        setNotificationsGranted(granted);

        if (!granted) {
            Alert.alert(
                'Notificações bloqueadas',
                'Permita as notificações do app nos ajustes do sistema para receber os alertas do Modo Vigilante.',
                [
                    { text: 'Agora não', style: 'cancel' },
                    { text: 'Abrir ajustes', onPress: () => Linking.openSettings().catch(() => undefined) },
                ]
            );
        }
    }

    /**
     * ========================================================
     * SERVIDOR
     * ========================================================
     */
    async function handleTestServer() {
        setServerTest({ state: 'testing' });

        const startedAt = Date.now();

        try {
            const list = await fetchAllTrackers();

            setServerTest({
                state: 'ok',
                ms: Date.now() - startedAt,
                trackers: Array.isArray(list) ? list.length : 0,
            });
        } catch (error: any) {
            setServerTest({
                state: 'error',
                message: error?.message ?? 'Não foi possível conectar ao servidor.',
            });
        }
    }

    /**
     * ========================================================
     * DADOS DO APARELHO
     * ========================================================
     */
    function handleClearCache() {
        if (vigilanteEnabled) {
            Alert.alert(
                'Modo Vigilante ativo',
                'Desligue o Modo Vigilante antes de limpar o cache — ele usa a última posição salva como referência.'
            );
            return;
        }

        Alert.alert(
            'Limpar cache de localização',
            'Apaga as últimas posições e rotas guardadas neste aparelho. Os rastreadores, alertas e o histórico no servidor não são afetados.',
            [
                { text: 'Cancelar', style: 'cancel' },
                {
                    text: 'Limpar',
                    style: 'destructive',
                    onPress: async () => {
                        setClearingCache(true);

                        try {
                            for (const tracker of trackers) {
                                await clearTrackerLocationCache(tracker.id);
                                await clearTrackerRoutes(tracker.id);
                            }

                            Alert.alert('Concluído', 'Cache de localização apagado.');
                        } finally {
                            setClearingCache(false);
                        }
                    },
                },
            ]
        );
    }

    /**
     * Volta à tela de login: as telas são montadas de novo, já sem
     * os dados antigos em memória.
     */
    function goToLogin() {
        const root = navigation?.getParent?.() ?? nav.getParent?.();
        root?.replace?.('Login');
    }

    function handleLogout() {
        Alert.alert('Sair', 'Deseja sair da sua conta?', [
            { text: 'Cancelar', style: 'cancel' },
            {
                text: 'Sair',
                style: 'destructive',
                onPress: async () => {
                    try {
                        // Ao sair, nada continua rodando (nem
                        // notificando) em nome do usuário.
                        stopRealTime();
                        stopVigilante();
                        clearService();

                        await logout();
                        goToLogin();
                    } catch (error) {
                        console.error(error);
                    }
                },
            },
        ]);
    }

    /**
     * Restaurar Padrões de Fábrica
     */
    function handleFactoryReset() {
        Alert.alert(
            'Restaurar padrões de fábrica',
            'Isso vai apagar todas as configurações, rastreadores e dados do app e restaurar o estado de fábrica. Deseja continuar?',
            [
                { text: 'Não', style: 'cancel' },
                {
                    text: 'Sim',
                    style: 'destructive',
                    onPress: async () => {
                        setClearing(true);

                        try {
                            // Para tudo que está rodando antes de
                            // apagar os dados.
                            stopRealTime();
                            stopVigilante();
                            clearService();

                            await AsyncStorage.clear();

                            // AsyncStorage.clear() não alcança o
                            // SecureStore — sem isso a senha antiga
                            // continuava valendo.
                            await clearCredentials();

                            await setTheme('light');
                            await logout();

                            Alert.alert(
                                'Concluído',
                                'O app foi restaurado para os padrões de fábrica. Entre com usuário e senha padrão (root / root).'
                            );

                            goToLogin();
                        } catch (error) {
                            Alert.alert(
                                'Erro',
                                'Não foi possível restaurar o app.'
                            );
                        } finally {
                            setClearing(false);
                        }
                    }
                }
            ]
        );
    }

    const cardStyle = [styles.card, { backgroundColor: colors.surface, borderColor: colors.border }];
    const dividerStyle = [styles.divider, { backgroundColor: colors.border }];
    const inputStyle = [styles.input, { backgroundColor: colors.input, borderColor: colors.border, color: colors.text }];
    const switchColors = { false: isDark ? '#475569' : '#D1D5DB', true: colors.primary };

    const isCustomTheme = activeTheme !== 'light' && activeTheme !== 'dark';
    const placeholderColor = colors.textMuted;

    /**
     * ========================================================
     * UI
     * ========================================================
     */
    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
            <View style={styles.header}>
                <ScreenHeader title="Configurações" />
            </View>

            <ScrollView
                contentContainerStyle={styles.scrollContent}
                keyboardShouldPersistTaps="handled"
            >
                {/* =================================================
                    VERSÃO
                ================================================= */}
                <Text style={[styles.versionText, { color: colors.textMuted }]}>
                    Cavalleta Connect · versão {appConfig.expo.version}
                </Text>

                {/* =================================================
                    APARÊNCIA
                ================================================= */}
                <SectionTitle>Aparência</SectionTitle>
                <View style={cardStyle}>
                    <SettingRow
                        icon="palette"
                        title="Tema"
                        subtitle={APP_THEMES[activeTheme].label}
                        onPress={() => setThemeMenuOpen(prev => !prev)}
                        right={<Chevron open={themeMenuOpen} />}
                    />

                    <Collapsible open={themeMenuOpen}>
                        <View style={styles.themeMenu}>
                            {APP_THEME_OPTIONS.map((themeKey) => {
                                const option = APP_THEMES[themeKey];
                                const selected = activeTheme === themeKey;

                                return (
                                    <TouchableOpacity
                                        key={themeKey}
                                        style={[
                                            styles.themeMenuItem,
                                            { borderColor: selected ? colors.primary : colors.border },
                                            selected && { backgroundColor: colors.backgroundAlt },
                                        ]}
                                        activeOpacity={0.9}
                                        onPress={async () => {
                                            await setTheme(themeKey as AppThemeName);
                                            setThemeMenuOpen(false);
                                        }}
                                    >
                                        <View style={styles.themePreviewRow}>
                                            {option.preview.map((color, index) => (
                                                <View
                                                    key={`${themeKey}-${index}`}
                                                    style={[styles.themePreviewSwatch, { backgroundColor: color }]}
                                                />
                                            ))}
                                        </View>

                                        <View style={styles.rowText}>
                                            <Text style={[styles.themeName, { color: selected ? colors.primary : colors.text }]}>
                                                {option.label}
                                            </Text>
                                            <Text style={[styles.rowSubtitle, { color: colors.textMuted }]}>
                                                {option.description}
                                            </Text>
                                        </View>

                                        {selected && (
                                            <MaterialIcons name="check" size={20} color={colors.primary} />
                                        )}
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                    </Collapsible>

                    <View style={dividerStyle} />

                    <SettingRow
                        icon="dark-mode"
                        title="Modo escuro"
                        subtitle={
                            isCustomTheme
                                ? 'Indisponível com tema personalizado.'
                                : 'Alterna entre os temas Padrão e Escuro.'
                        }
                        right={
                            <Switch
                                value={isDark}
                                onValueChange={async (value) => {
                                    await setTheme(value ? 'dark' : 'light');
                                }}
                                disabled={isCustomTheme}
                                thumbColor="#FFFFFF"
                                trackColor={switchColors}
                            />
                        }
                    />
                </View>

                {/* =================================================
                    SEGURANÇA
                ================================================= */}
                <SectionTitle>Segurança</SectionTitle>
                <View style={cardStyle}>
                    <SettingRow
                        icon="fingerprint"
                        title="Login por biometria"
                        subtitle={
                            biometricAvailable
                                ? 'Impressão digital ou PIN para entrar mais rápido.'
                                : 'Nenhuma biometria configurada neste aparelho.'
                        }
                        right={
                            <Switch
                                value={biometricEnabled}
                                onValueChange={handleToggleBiometric}
                                disabled={!biometricAvailable}
                                thumbColor="#FFFFFF"
                                trackColor={switchColors}
                            />
                        }
                    />

                    <View style={dividerStyle} />

                    <SettingRow
                        icon="lock"
                        title="Alterar usuário e senha"
                        subtitle="Credenciais usadas no login do app."
                        onPress={() => setCredentialsOpen(prev => !prev)}
                        right={<Chevron open={credentialsOpen} />}
                    />

                    <Collapsible open={credentialsOpen}>
                        <View style={styles.form}>
                            <Text style={[styles.inputLabel, { color: colors.textMuted }]}>Usuário</Text>
                            <TextInput
                                style={inputStyle}
                                placeholder="Usuário"
                                placeholderTextColor={placeholderColor}
                                value={username}
                                onChangeText={setUsername}
                                autoCapitalize="none"
                                editable={!isLoading}
                            />

                            <Text style={[styles.inputLabel, { color: colors.textMuted }]}>Nova senha</Text>
                            <View style={[inputStyle, styles.passwordWrap]}>
                                <TextInput
                                    style={[styles.passwordInput, { color: colors.text }]}
                                    placeholder="Deixe em branco para manter a atual"
                                    placeholderTextColor={placeholderColor}
                                    value={password}
                                    onChangeText={setPassword}
                                    secureTextEntry={!showPassword}
                                    autoCapitalize="none"
                                    editable={!isLoading}
                                />
                                <TouchableOpacity onPress={() => setShowPassword(prev => !prev)} hitSlop={8}>
                                    <MaterialIcons
                                        name={showPassword ? 'visibility-off' : 'visibility'}
                                        size={22}
                                        color={colors.textMuted}
                                    />
                                </TouchableOpacity>
                            </View>

                            <Text style={[styles.inputLabel, { color: colors.textMuted }]}>Confirmar nova senha</Text>
                            <TextInput
                                style={inputStyle}
                                placeholder="Repita a nova senha"
                                placeholderTextColor={placeholderColor}
                                value={confirmPassword}
                                onChangeText={setConfirmPassword}
                                secureTextEntry={!showPassword}
                                autoCapitalize="none"
                                editable={!isLoading && password !== ''}
                            />

                            <TouchableOpacity
                                style={[styles.primaryButton, { backgroundColor: colors.primary }]}
                                onPress={handleSaveCredentials}
                                activeOpacity={0.85}
                            >
                                <Text style={[styles.primaryButtonText, { color: colors.buttonText }]}>
                                    Salvar alterações
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </Collapsible>
                </View>

                {/* =================================================
                    NOTIFICAÇÕES E MONITORAMENTO
                ================================================= */}
                <SectionTitle>Notificações e monitoramento</SectionTitle>
                <View style={cardStyle}>
                    <SettingRow
                        icon={notificationsGranted === false ? 'notifications-off' : 'notifications'}
                        iconColor={notificationsGranted === false ? DANGER : colors.primary}
                        title="Notificações"
                        subtitle={
                            notificationsGranted === null
                                ? 'Verificando permissão...'
                                : notificationsGranted
                                    ? 'Permitidas. Toque para abrir os ajustes do sistema.'
                                    : 'Bloqueadas. Toque para permitir os alertas.'
                        }
                        onPress={handleNotificationsPress}
                        right={<Chevron />}
                    />

                    <View style={dividerStyle} />

                    <SettingRow
                        icon="security"
                        title="Modo Vigilante"
                        subtitle={
                            vigilanteEnabled
                                ? `Ativo em ${activeVigilanteTrackerName ?? 'rastreador'}.`
                                : 'Desligado. Ative pela tela do mapa.'
                        }
                        right={vigilanteEnabled ? <StopButton onPress={stopVigilante} /> : null}
                    />

                    <View style={dividerStyle} />

                    <SettingRow
                        icon="my-location"
                        title="Tempo real"
                        subtitle={
                            realTimeEnabled
                                ? `Acompanhando ${activeTrackerName ?? 'rastreador'}.`
                                : 'Desligado. Ative pela tela do mapa.'
                        }
                        right={realTimeEnabled ? <StopButton onPress={stopRealTime} /> : null}
                    />
                </View>

                {/* =================================================
                    SERVIDOR
                ================================================= */}
                <SectionTitle>Servidor</SectionTitle>
                <View style={cardStyle}>
                    <SettingRow
                        icon="dns"
                        title="Endereço"
                        subtitle={server.url}
                    />

                    <View style={dividerStyle} />

                    <SettingRow
                        icon="vpn-key"
                        iconColor={server.hasApiKey ? colors.primary : DANGER}
                        title="Chave de API"
                        right={
                            <ValueText color={server.hasApiKey ? colors.primary : DANGER}>
                                {server.hasApiKey ? 'Configurada' : 'Não configurada'}
                            </ValueText>
                        }
                    />

                    <View style={dividerStyle} />

                    <SettingRow
                        icon="network-check"
                        title="Testar conexão"
                        subtitle={
                            serverTest.state === 'ok'
                                ? `Conectado em ${serverTest.ms} ms · ${serverTest.trackers} rastreador(es) no servidor.`
                                : serverTest.state === 'error'
                                    ? serverTest.message
                                    : 'Verifica se o app alcança o servidor.'
                        }
                        onPress={handleTestServer}
                        disabled={serverTest.state === 'testing'}
                        right={
                            serverTest.state === 'testing' ? (
                                <ActivityIndicator color={colors.primary} />
                            ) : serverTest.state === 'ok' ? (
                                <MaterialIcons name="check-circle" size={22} color={colors.primary} />
                            ) : serverTest.state === 'error' ? (
                                <MaterialIcons name="error" size={22} color={DANGER} />
                            ) : (
                                <Chevron />
                            )
                        }
                    />
                </View>

                {/* =================================================
                    DADOS DO APARELHO
                ================================================= */}
                <SectionTitle>Dados do aparelho</SectionTitle>
                <View style={cardStyle}>
                    <SettingRow
                        icon="gps-fixed"
                        title="Rastreadores cadastrados"
                        right={<ValueText>{String(trackers.length)}</ValueText>}
                    />

                    <View style={dividerStyle} />

                    <SettingRow
                        icon="cleaning-services"
                        title="Limpar cache de localização"
                        subtitle="Últimas posições e rotas guardadas no aparelho."
                        onPress={handleClearCache}
                        disabled={clearingCache}
                        right={clearingCache ? <ActivityIndicator color={colors.primary} /> : <Chevron />}
                    />
                </View>

                {/* =================================================
                    SOBRE
                ================================================= */}
                <SectionTitle>Sobre</SectionTitle>
                <View style={cardStyle}>
                    <SettingRow
                        icon="info-outline"
                        title="Sobre o app"
                        subtitle="Recursos e código-fonte."
                        onPress={() => (navigation ?? nav).navigate('Info')}
                        right={<Chevron />}
                    />
                </View>

                {/* =================================================
                    ZONA DE PERIGO
                ================================================= */}
                <SectionTitle>Zona de perigo</SectionTitle>
                <View style={[cardStyle, { borderColor: DANGER }]}>
                    <SettingRow
                        icon="restore"
                        iconColor={DANGER}
                        titleColor={DANGER}
                        title="Restaurar padrões de fábrica"
                        subtitle="Apaga configurações, rastreadores e dados do app."
                        onPress={handleFactoryReset}
                        disabled={clearing}
                        right={clearing ? <ActivityIndicator color={DANGER} /> : <Chevron />}
                    />
                </View>

                {/* =================================================
                    SAIR
                ================================================= */}
                <TouchableOpacity
                    style={[styles.logoutButton, { borderColor: DANGER }]}
                    onPress={handleLogout}
                    activeOpacity={0.8}
                >
                    <MaterialIcons name="exit-to-app" size={20} color={DANGER} />
                    <Text style={[styles.logoutText, { color: DANGER }]}>Sair da conta</Text>
                </TouchableOpacity>
            </ScrollView>
        </SafeAreaView>
    );
}
