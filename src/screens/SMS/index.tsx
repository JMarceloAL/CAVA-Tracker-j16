// src/screens/SMS/index.tsx
import React, { useState, useCallback } from 'react';
import {
    View,
    Text,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
    Alert,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import TrackerDropdown from '../../components/TrackerDropdown';
import ParamCommandModal from '../../components/ParamCommandModal';
import PasswordConfirmModal from '../../components/PasswordConfirmModal';
import CollapsibleSection from '../../components/CollapsibleSection';
import Collapsible from '../../components/Collapsible';
import { useTrackerServiceProvider } from '../../contexts/TrackerServiceContext';
import { useTheme } from '../../contexts/ThemeContext';
import { useTrackerSelection } from '../../contexts/TrackerSelectionContext';
import { requestSmsPermissions } from '../../services/Smsgateway';
import {
    STATUS_COMMANDS,
    PROTECTED_STATUS_COMMANDS,
    RESTORE_FACTORY_COMMAND,
    PARAM_COMMANDS,
} from '../../services/CommandCatalog';
import type { StatusCommand, ParamCommand } from '../../services/CommandCatalog';
import type { Tracker } from '../../types/Tracker';
import { styles } from './styles';

const STORAGE_KEY = '@cavalleta:trackers';

/**
 * Extraído como type alias porque `useState<(() => void) | null>`
 * direto na chamada confunde o parser do TypeScript em arquivos
 * .tsx (a sequência "<(" é ambígua com JSX).
 */
type PendingAction = (() => void) | null;

export default function SmsScreen() {
    const navigation = useNavigation<any>();
    const { getService } = useTrackerServiceProvider();
    const { isDark, colors } = useTheme();
    const { selectedTrackerId, setSelectedTrackerId, resolveSelectedTracker } = useTrackerSelection();

    const [trackers, setTrackers] = useState<Tracker[]>([]);
    const [selectedTracker, setSelectedTracker] = useState<Tracker | null>(null);
    const [loadingCommandId, setLoadingCommandId] = useState<string | null>(null);
    const [response, setResponse] = useState<{ command: string; text: string } | null>(null);
    const [activeParamCommand, setActiveParamCommand] = useState<ParamCommand | null>(null);

    /**
     * ========================================================
     * ACESSO RESTRITO — SEÇÃO PARÂMETROS
     * ========================================================
     *
     * Diferente do CollapsibleSection genérico (que guarda o
     * open/close internamente), aqui o open/close é controlado
     * por nós (parametrosOpen), justamente pra poder trancar de
     * novo toda vez que a seção for fechada — reabrir sempre
     * pede senha, mesmo sem sair da tela.
     */
    const [parametrosOpen, setParametrosOpen] = useState(false);
    const [parametrosUnlocked, setParametrosUnlocked] = useState(false);
    const [passwordModalVisible, setPasswordModalVisible] = useState(false);
    const [pendingAction, setPendingAction] = useState<PendingAction>(null);

    const loadTrackers = useCallback(async () => {
        try {
            const stored = await AsyncStorage.getItem(STORAGE_KEY);
            const list: Tracker[] = stored ? JSON.parse(stored) : [];
            setTrackers(list);

            const preferred = resolveSelectedTracker(list);
            setSelectedTracker(prev => {
                const stillExists = prev && list.find(t => t.id === prev.id);
                const next = stillExists ? prev : preferred;
                if (next) {
                    setSelectedTrackerId(next.id);
                }
                return next ?? null;
            });
        } catch (error) {
            console.warn('Erro ao carregar rastreadores', error);
        }
    }, [resolveSelectedTracker, setSelectedTrackerId]);

    useFocusEffect(
        useCallback(() => {
            loadTrackers();

            /**
             * Sair da tela e voltar também tranca e fecha a
             * seção, por segurança.
             */
            setParametrosOpen(false);
            setParametrosUnlocked(false);
        }, [loadTrackers])
    );

    function formatResponse(parsed: any): string {
        if (parsed.type === 'status') {
            return Object.entries(parsed)
                .filter(([key]) => key !== 'type' && key !== 'raw')
                .map(([key, value]) => `${key}: ${value}`)
                .join('\n');
        }

        if (parsed.type === 'location') {
            return `Lat: ${parsed.latitude}\nLng: ${parsed.longitude}\nURL: ${parsed.url}`;
        }

        return parsed.raw ?? JSON.stringify(parsed);
    }

    async function executeCommand(commandString: string, commandId: string) {
        if (!selectedTracker) {
            Alert.alert('Aviso', 'Selecione um rastreador primeiro.');
            return;
        }

        setLoadingCommandId(commandId);
        setResponse(null);

        try {
            await requestSmsPermissions();
            const service = getService(selectedTracker.phone);
            const parsed = await service.sendCommand(commandString);

            setResponse({
                command: commandString,
                text: formatResponse(parsed),
            });
        } catch (error: any) {
            Alert.alert(
                'Erro ao executar comando',
                error instanceof Error ? error.message : 'Erro desconhecido'
            );
        } finally {
            setLoadingCommandId(null);
        }
    }

    function handleStatusCommandPress(cmd: StatusCommand) {
        // Comandos críticos (ex: cortar óleo/energia) pedem a senha
        // do app antes, mesmo fora da seção protegida.
        if (cmd.requiresPassword) {
            requestUnlock(() => runStatusCommand(cmd));
            return;
        }

        runStatusCommand(cmd);
    }

    function runStatusCommand(cmd: StatusCommand) {
        if (cmd.id === 'location') {
            if (!selectedTracker) {
                Alert.alert('Aviso', 'Selecione um rastreador primeiro.');
                return;
            }

            navigation.navigate('MapScreen', {
                trackerId: selectedTracker.id,
                autoRequestLocation: true,
            });
            return;
        }

        if (cmd.confirm) {
            Alert.alert(
                cmd.destructive ? '⚠️ Atenção' : 'Confirmar',
                cmd.confirmMessage ?? `Deseja executar "${cmd.label}"?`,
                [
                    { text: 'Não', style: 'cancel' },
                    {
                        text: 'Sim',
                        style: cmd.destructive ? 'destructive' : 'default',
                        onPress: () => executeCommand(cmd.build(), cmd.id),
                    },
                ]
            );
            return;
        }

        executeCommand(cmd.build(), cmd.id);
    }

    function handleParamSubmit(values: Record<string, string>) {
        if (!activeParamCommand) return;

        const commandString = activeParamCommand.build(values);
        setActiveParamCommand(null);
        executeCommand(commandString, activeParamCommand.id);
    }

    /**
     * ========================================================
     * ACESSO RESTRITO — HANDLERS
     * ========================================================
     */

    function requestUnlock(action: () => void) {
        setPendingAction(() => action);
        setPasswordModalVisible(true);
    }

    function handlePasswordSuccess() {
        setParametrosUnlocked(true);
        setPasswordModalVisible(false);

        if (pendingAction) {
            pendingAction();
            setPendingAction(null);
        }
    }

    function handlePasswordCancel() {
        setPasswordModalVisible(false);
        setPendingAction(null);
    }

    /**
     * Toque no cabeçalho da seção Parâmetros.
     *
     * - Se estiver ABERTA: fecha e tranca de novo
     *   (parametrosUnlocked volta a false). Da próxima vez
     *   que tentar abrir, vai pedir senha de novo.
     * - Se estiver FECHADA: pede a senha antes de abrir.
     */
    function handleToggleParametros() {
        if (parametrosOpen) {
            setParametrosOpen(false);
            setParametrosUnlocked(false);
            return;
        }

        requestUnlock(() => {
            setParametrosOpen(true);
        });
    }

    function handleProtectedStatusCommandPress(cmd: StatusCommand) {
        // A esta altura a seção já está desbloqueada (só é
        // possível ver/tocar nesses botões com ela aberta).
        handleStatusCommandPress(cmd);
    }

    function handleParamCommandPress(cmd: ParamCommand) {
        setActiveParamCommand(cmd);
    }

    const containerStyle = [styles.container, isDark && styles.darkContainer];
    const responseBoxStyle = [styles.responseBox, isDark && styles.darkResponseBox];
    const responseCommandStyle = [styles.responseCommand, isDark && styles.darkResponseCommand];
    const responseTextStyle = [styles.responseText, isDark && styles.darkResponseText];
    const primaryActionStyle = { backgroundColor: colors.primary };
    const destructiveActionStyle = { backgroundColor: '#D95C5C' };

    return (
        <View style={containerStyle}>

            <TrackerDropdown
                trackers={trackers}
                selectedTracker={selectedTracker}
                onSelect={(tracker) => {
                    setSelectedTracker(tracker);
                    setSelectedTrackerId(tracker.id);
                }}
            />

            <ScrollView contentContainerStyle={styles.scrollContent}>
                {response && (
                    <View style={responseBoxStyle}>
                        <View style={styles.responseHeader}>
                            <MaterialIcons name="check-circle" size={16} color={colors.primary} />
                            <Text style={responseCommandStyle}>Comando: {response.command}</Text>
                        </View>
                        <Text style={responseTextStyle}>{response.text}</Text>
                    </View>
                )}

                <CollapsibleSection title="Status" defaultOpen>
                    <View style={styles.list}>
                        {STATUS_COMMANDS.map(cmd => (
                            <TouchableOpacity
                                key={cmd.id}
                                style={[
                                    styles.listButton,
                                    cmd.destructive ? destructiveActionStyle : primaryActionStyle,
                                ]}
                                onPress={() => handleStatusCommandPress(cmd)}
                                disabled={loadingCommandId !== null}
                                activeOpacity={0.85}
                            >
                                {loadingCommandId === cmd.id ? (
                                    <ActivityIndicator size="small" color="#fff" />
                                ) : (
                                    <Text style={styles.buttonText}>{cmd.label}</Text>
                                )}
                            </TouchableOpacity>
                        ))}
                    </View>
                </CollapsibleSection>

                {/* ==================================================
                    PARÂMETROS — SEÇÃO PROTEGIDA
                    (open/close controlado manualmente, tranca
                    de novo toda vez que é fechada)
                ================================================== */}
                <View
                    style={[
                        styles.protectedSectionContainer,
                        {
                            backgroundColor: colors.surfaceAlt,
                            borderColor: colors.border,
                        },
                    ]}
                >
                    <TouchableOpacity
                        style={styles.protectedSectionHeader}
                        onPress={handleToggleParametros}
                        activeOpacity={0.8}
                    >
                        <View style={styles.protectedSectionHeaderTitleGroup}>
                            <Text
                                style={[
                                    styles.protectedSectionHeaderText,
                                    { color: colors.text },
                                ]}
                            >
                                Parâmetros
                            </Text>

                            <MaterialIcons
                                name={parametrosOpen ? 'lock-open' : 'lock-outline'}
                                size={16}
                                color={colors.textMuted}
                                style={styles.protectedSectionLockIcon}
                            />
                        </View>

                        <Text
                            style={[
                                styles.protectedSectionChevron,
                                { color: colors.textMuted },
                            ]}
                        >
                            {parametrosOpen ? '▲' : '▼'}
                        </Text>
                    </TouchableOpacity>

                    <Collapsible open={parametrosOpen}>
                        <View style={styles.protectedSectionContent}>
                            <View style={styles.list}>
                                {/* Comandos protegidos (sem o format, que vai por último) */}
                                {PROTECTED_STATUS_COMMANDS.map(cmd => (
                                    <TouchableOpacity
                                        key={cmd.id}
                                        style={[styles.listButton, primaryActionStyle]}
                                        onPress={() =>
                                            handleProtectedStatusCommandPress(cmd)
                                        }
                                        disabled={loadingCommandId !== null}
                                        activeOpacity={0.85}
                                    >
                                        {loadingCommandId === cmd.id ? (
                                            <ActivityIndicator size="small" color="#fff" />
                                        ) : (
                                            <Text style={styles.buttonText}>{cmd.label}</Text>
                                        )}
                                    </TouchableOpacity>
                                ))}

                                {/* Comandos de configuração (com campos) */}
                                {PARAM_COMMANDS.map(cmd => (
                                    <TouchableOpacity
                                        key={cmd.id}
                                        style={[styles.listButton, primaryActionStyle]}
                                        onPress={() => handleParamCommandPress(cmd)}
                                        disabled={loadingCommandId !== null}
                                        activeOpacity={0.85}
                                    >
                                        <Text style={styles.buttonText}>{cmd.label}</Text>
                                    </TouchableOpacity>
                                ))}

                                {/* Restaurar Padrão de Fábrica — sempre por último */}
                                <TouchableOpacity
                                    key={RESTORE_FACTORY_COMMAND.id}
                                    style={[styles.listButton, destructiveActionStyle]}
                                    onPress={() =>
                                        handleProtectedStatusCommandPress(
                                            RESTORE_FACTORY_COMMAND
                                        )
                                    }
                                    disabled={loadingCommandId !== null}
                                    activeOpacity={0.85}
                                >
                                    {loadingCommandId === RESTORE_FACTORY_COMMAND.id ? (
                                        <ActivityIndicator size="small" color="#fff" />
                                    ) : (
                                        <Text style={styles.buttonText}>
                                            {RESTORE_FACTORY_COMMAND.label}
                                        </Text>
                                    )}
                                </TouchableOpacity>
                            </View>
                        </View>
                    </Collapsible>
                </View>
            </ScrollView>

            {activeParamCommand && (
                <ParamCommandModal
                    visible
                    title={activeParamCommand.label}
                    fields={activeParamCommand.fields}
                    onClose={() => setActiveParamCommand(null)}
                    onSubmit={handleParamSubmit}
                />
            )}

            <PasswordConfirmModal
                visible={passwordModalVisible}
                onClose={handlePasswordCancel}
                onSuccess={handlePasswordSuccess}
                title="Parâmetros protegidos"
                subtitle="Digite a senha do app para acessar os comandos de configuração."
            />
        </View>
    );
}