import React, {
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
} from 'react-native';

import {
    SafeAreaView,
} from 'react-native-safe-area-context';

import AsyncStorage from '@react-native-async-storage/async-storage';

import {
    MaterialIcons,
} from '@expo/vector-icons';

import * as LocalAuthentication from 'expo-local-authentication';

import { styles } from './styles';

import {
    useTheme,
} from '../../contexts/ThemeContext';

import { useNavigation } from '@react-navigation/native';

import {
    getCredentials,
    saveCredentials,
    clearCredentials,
    getBiometricEnabled,
    setBiometricEnabled,
    logout,
} from '../../services/storage/authStorage';

import { useRealTime } from '../../contexts/RealTimeContext';
import { useTrackerServiceProvider } from '../../contexts/TrackerServiceContext';

import Collapsible from '../../components/Collapsible';
import { APP_GREEN, APP_THEMES, APP_THEME_OPTIONS, type AppThemeName } from '../../theme/colors';

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

    const { stopRealTime, stopVigilante } = useRealTime();
    const { clearService } = useTrackerServiceProvider();

    const [
        username,
        setUsername,
    ] = useState('root');

    const [
        password,
        setPassword,
    ] = useState('root');

    /**
     * ========================================================
     * CONFIRMAÇÃO DE SENHA
     * ========================================================
     */
    const [
        confirmPassword,
        setConfirmPassword,
    ] = useState('');

    const [
        isLoading,
        setIsLoading,
    ] = useState(true);

    /**
     * ========================================================
     * SEGURANÇA (senha + biometria)
     * ========================================================
     */
    const [
        securityOpen,
        setSecurityOpen,
    ] = useState(false);

    const [
        biometricAvailable,
        setBiometricAvailable,
    ] = useState(false);

    const [
        biometricEnabled,
        setBiometricEnabledState,
    ] = useState(false);

    const [
        clearing,
        setClearing,
    ] = useState(false);

    const [storageOpen, setStorageOpen] = useState(false);

    const [
        themeMenuOpen,
        setThemeMenuOpen,
    ] = useState(false);

    /**
     * ========================================================
     * CREDENCIAIS
     * ========================================================
     */
    useEffect(() => {
        async function loadCredentials() {
            try {
                const credentials =
                    await getCredentials();

                setUsername(
                    credentials.username
                );

                setPassword(
                    credentials.password
                );
            } catch (error) {
                console.warn(
                    'Erro ao carregar credenciais:',
                    error
                );
            } finally {
                setIsLoading(false);
            }
        }

        loadCredentials();
    }, []);

    /**
     * ========================================================
     * BIOMETRIA — disponibilidade + estado atual
     * ========================================================
     */
    useEffect(() => {
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

        loadBiometricState();
    }, []);

    /**
     * Liga/desliga o login por biometria. Ao ATIVAR, pede uma
     * confirmação biométrica na hora — diferente do fluxo logo após
     * o login (onde isso seria repetitivo), aqui é uma ação
     * deliberada nas Configurações, então faz sentido confirmar.
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
     * SALVAR CREDENCIAIS
     * ========================================================
     */
    async function handleSaveCredentials() {
        if (password.trim() === '') {
            Alert.alert(
                'Aviso',
                'A senha não pode ficar em branco.'
            );

            return;
        }

        if (password !== confirmPassword) {
            Alert.alert(
                'Senhas não conferem',
                'A confirmação de senha precisa ser igual à nova senha digitada.'
            );

            return;
        }

        try {
            // Um único lugar de armazenamento (SecureStore) — vale
            // tanto pro login com senha quanto pela biometria.
            await saveCredentials(
                username,
                password
            );

            Alert.alert(
                'Sucesso',
                'Usuário e senha atualizados.'
            );

            setConfirmPassword('');
            setSecurityOpen(false);
        } catch (error) {
            Alert.alert(
                'Erro',
                'Não foi possível salvar as credenciais.'
            );
        }
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

                            // Volta ao login: as telas são montadas de
                            // novo, já sem os dados antigos em memória.
                            const root = navigation?.getParent?.() ?? nav.getParent?.();
                            root?.replace?.('Login');
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

    /**
     * ========================================================
     * ESTILOS DINÂMICOS
     * ========================================================
     */
    const containerStyle = [
        styles.container,
        { backgroundColor: colors.background },
        isDark &&
        styles.darkContainer,
    ];

    const rowStyle = [
        styles.row,
        { backgroundColor: colors.surface },
        isDark &&
        styles.darkRow,
    ];

    const formStyle = [
        styles.form,
        { backgroundColor: colors.surface },
        isDark &&
        styles.darkForm,
    ];

    const inputStyle = [
        styles.input,
        { backgroundColor: colors.input, borderColor: colors.border, color: colors.text },
        isDark &&
        styles.darkInput,
    ];

    const labelStyle = [
        styles.label,
        { color: colors.text },
        isDark &&
        styles.darkLabel,
    ];

    const titleStyle = [
        styles.title,
        { color: colors.text },
        isDark &&
        styles.darkText,
    ];

    const helpStyle = [
        styles.help,
        { color: colors.textMuted },
        isDark &&
        styles.darkHelp,
    ];

    /**
     * ========================================================
     * UI
     * ========================================================
     */
    return (
        <SafeAreaView
            style={containerStyle}
        >
            <View style={styles.topBar}>
                <TouchableOpacity
                    style={styles.menuButton}
                    onPress={() => navigation?.openDrawer?.() ?? nav.openDrawer()}
                    activeOpacity={0.8}
                >
                    <MaterialIcons
                        name="menu"
                        size={28}
                        color={isDark ? '#F3F4F6' : '#111827'}
                    />
                </TouchableOpacity>

                <Text style={titleStyle}>Configurações</Text>
            </View>

            {/* =================================================
                TEMAS
            ================================================= */}
            <View style={[rowStyle, { flexDirection: 'column', alignItems: 'stretch' }]}>
                <TouchableOpacity
                    style={styles.dropdownHeader}
                    onPress={() => setThemeMenuOpen(prev => !prev)}
                    activeOpacity={0.8}
                >
                    <View style={{ flex: 1 }}>
                        <Text style={labelStyle}>Temas</Text>
                        <Text style={helpStyle}>Ao escolher um tema customizado, o modo escuro é desativado automaticamente.</Text>
                    </View>

                    <MaterialIcons
                        name={themeMenuOpen ? 'expand-less' : 'expand-more'}
                        size={24}
                        color={isDark ? '#F3F4F6' : '#222'}
                    />
                </TouchableOpacity>

                <Collapsible open={themeMenuOpen}>
                    <View style={[styles.themeMenu, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                        {APP_THEME_OPTIONS.map((themeKey) => {
                            const option = APP_THEMES[themeKey];
                            const selected = activeTheme === themeKey;

                            return (
                                <TouchableOpacity
                                    key={themeKey}
                                    style={[
                                        styles.themeMenuItem,
                                        selected && { backgroundColor: colors.backgroundAlt, borderColor: colors.primary },
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

                                    <View style={styles.themeMenuItemTextWrap}>
                                        <Text style={[styles.themeButtonText, selected && { color: colors.primary }]}>{option.label}</Text>
                                        <Text style={[styles.themeButtonDescription, { color: colors.textMuted }]}>{option.description}</Text>
                                    </View>

                                    {selected && (
                                        <MaterialIcons name="check" size={18} color={colors.primary} />
                                    )}
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                </Collapsible>

                <View style={styles.darkToggleRow}>
                    <Text style={labelStyle}>Modo escuro</Text>
                    <Switch
                        value={isDark}
                        onValueChange={async (value) => {
                            await setTheme(value ? 'dark' : 'light');
                        }}
                        disabled={activeTheme !== 'light' && activeTheme !== 'dark'}
                        thumbColor={isDark ? '#F3F4F6' : '#FFFFFF'}
                        trackColor={{
                            false: '#D1D5DB',
                            true: APP_GREEN,
                        }}
                    />
                </View>
            </View>

            {/* =================================================
                SEGURANÇA (senha + biometria)
            ================================================= */}
            <View style={formStyle}>
                <TouchableOpacity
                    style={styles.dropdownHeader}
                    onPress={() => setSecurityOpen(prev => !prev)}
                    activeOpacity={0.8}
                >
                    <View style={{ flex: 1 }}>
                        <Text style={labelStyle}>Segurança</Text>
                        <Text style={helpStyle}>Senha de acesso e login por biometria.</Text>
                    </View>

                    <MaterialIcons
                        name={securityOpen ? 'expand-less' : 'expand-more'}
                        size={24}
                        color={isDark ? '#F3F4F6' : '#222'}
                    />
                </TouchableOpacity>

                <Collapsible open={securityOpen}>
                    <View style={styles.dropdownContent}>

                        {/* Biometria */}
                        <View style={styles.darkToggleRow}>
                            <View style={{ flex: 1, marginRight: 12 }}>
                                <Text style={labelStyle}>Login por biometria</Text>
                                <Text style={helpStyle}>
                                    {biometricAvailable
                                        ? 'Use impressão digital ou PIN para entrar mais rápido.'
                                        : 'Nenhuma biometria configurada neste dispositivo.'}
                                </Text>
                            </View>

                            <Switch
                                value={biometricEnabled}
                                onValueChange={handleToggleBiometric}
                                disabled={!biometricAvailable}
                                thumbColor={isDark ? '#F3F4F6' : '#FFFFFF'}
                                trackColor={{ false: '#D1D5DB', true: APP_GREEN }}
                            />
                        </View>

                        {/* Divisor */}
                        <View
                            style={{
                                height: 1,
                                backgroundColor: isDark ? '#334155' : '#EAEFE5',
                                marginVertical: 16,
                            }}
                        />

                        {/* Trocar usuário e senha */}
                        <Text style={[labelStyle, { marginBottom: 4 }]}>Trocar usuário e senha</Text>
                        <Text style={[helpStyle, { marginBottom: 12 }]}>Essas credenciais serão usadas no login do app.</Text>

                        <TextInput
                            style={inputStyle}
                            placeholder="Usuário"
                            placeholderTextColor={
                                isDark
                                    ? '#AFB9C7'
                                    : '#8E8E93'
                            }
                            value={username}
                            onChangeText={
                                setUsername
                            }
                            autoCapitalize="none"
                            editable={
                                !isLoading
                            }
                        />

                        <TextInput
                            style={inputStyle}
                            placeholder="Senha"
                            placeholderTextColor={
                                isDark
                                    ? '#AFB9C7'
                                    : '#8E8E93'
                            }
                            value={password}
                            onChangeText={
                                setPassword
                            }
                            secureTextEntry
                            editable={
                                !isLoading
                            }
                        />

                        <TextInput
                            style={inputStyle}
                            placeholder="Confirmar senha"
                            placeholderTextColor={
                                isDark
                                    ? '#AFB9C7'
                                    : '#8E8E93'
                            }
                            value={confirmPassword}
                            onChangeText={
                                setConfirmPassword
                            }
                            secureTextEntry
                            editable={
                                !isLoading
                            }
                        />

                        <TouchableOpacity
                            style={[
                                styles.button,
                                { backgroundColor: colors.primary },
                            ]}
                            onPress={
                                handleSaveCredentials
                            }
                        >
                            <Text
                                style={
                                    styles.buttonText
                                }
                            >
                                Salvar alterações
                            </Text>
                        </TouchableOpacity>
                    </View>
                </Collapsible>
            </View>

            {/* =================================================
                STORAGE (Factory Reset)
            ================================================= */}
            <View style={formStyle}>
                <TouchableOpacity
                    style={styles.dropdownHeader}
                    onPress={() => setStorageOpen(prev => !prev)}
                    activeOpacity={0.8}
                >
                    <View style={{ flex: 1 }}>
                        <Text style={labelStyle}>Restaurar padrões de fábrica</Text>
                        <Text style={helpStyle}>Remove todas as configurações, rastreadores e dados do app.</Text>
                    </View>

                    <MaterialIcons
                        name={storageOpen ? 'expand-less' : 'expand-more'}
                        size={24}
                        color={isDark ? '#F3F4F6' : '#222'}
                    />
                </TouchableOpacity>

                <Collapsible open={storageOpen}>
                    <View style={styles.dropdownContent}>
                        <TouchableOpacity
                            style={styles.dangerButton}
                            onPress={handleFactoryReset}
                            disabled={clearing}
                        >
                            <Text style={styles.dangerButtonText}>{clearing ? 'Processando...' : 'Restaurar padrões de fábrica'}</Text>
                        </TouchableOpacity>
                    </View>
                </Collapsible>
            </View>
        </SafeAreaView>
    );
}