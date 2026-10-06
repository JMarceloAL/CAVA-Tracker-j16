import React, { useEffect, useState } from 'react';
import {
    View,
    Text,
    Modal,
    TextInput,
    TouchableOpacity,
    Alert,
} from 'react-native';

import { MaterialIcons } from '@expo/vector-icons';

import { styles } from './styles';
import { useTheme } from '../../contexts/ThemeContext';
import { getCredentials } from '../../services/storage/authStorage';

type Props = {
    visible: boolean;
    onClose: () => void;
    onSuccess: () => void;
    title?: string;
    subtitle?: string;
};

/**
 * Modal genérico de confirmação por senha.
 *
 * Compara o valor digitado contra a senha salva em
 * authStorage (a mesma usada no login do app). Só chama
 * onSuccess() se a senha bater.
 */
export default function PasswordConfirmModal({
    visible,
    onClose,
    onSuccess,
    title = 'Área protegida',
    subtitle = 'Digite a senha do app para continuar.',
}: Props) {
    const { isDark, colors } = useTheme();

    const [password, setPassword] = useState('');
    const [checking, setChecking] = useState(false);

    useEffect(() => {
        if (visible) {
            setPassword('');
        }
    }, [visible]);

    async function handleConfirm() {
        if (password.trim() === '') {
            Alert.alert('Aviso', 'Digite a senha.');
            return;
        }

        setChecking(true);

        try {
            const credentials = await getCredentials();

            // A senha é salva sem espaços nas pontas — compara igual.
            if (password.trim() !== credentials.password) {
                Alert.alert('Senha incorreta', 'A senha digitada não confere.');
                return;
            }

            setPassword('');
            onSuccess();
        } catch (error) {
            Alert.alert('Erro', 'Não foi possível verificar a senha.');
        } finally {
            setChecking(false);
        }
    }

    function handleClose() {
        setPassword('');
        onClose();
    }

    const containerStyle = [styles.container, isDark && styles.darkContainer];
    const iconCircleStyle = [styles.iconCircle, isDark && styles.darkIconCircle];
    const titleStyle = [styles.title, isDark && styles.darkTitle];
    const subtitleStyle = [styles.subtitle, isDark && styles.darkSubtitle];
    const inputStyle = [styles.input, isDark && styles.darkInput];
    const cancelTextStyle = [styles.cancelButtonText, isDark && styles.darkCancelButtonText];
    const primaryButtonStyle = [styles.primaryButton, { backgroundColor: colors.primary }];

    return (
        <Modal visible={visible} transparent animationType="fade">
            <View style={styles.overlay}>
                <View style={containerStyle}>
                    <View style={iconCircleStyle}>
                        <MaterialIcons
                            name="lock-outline"
                            size={26}
                            color={colors.primary}
                        />
                    </View>

                    <Text style={titleStyle}>{title}</Text>
                    <Text style={subtitleStyle}>{subtitle}</Text>

                    <TextInput
                        style={inputStyle}
                        placeholder="Senha"
                        placeholderTextColor={isDark ? '#AFB9C7' : '#8E8E93'}
                        value={password}
                        onChangeText={setPassword}
                        secureTextEntry
                        autoFocus
                        editable={!checking}
                        onSubmitEditing={handleConfirm}
                    />

                    <TouchableOpacity
                        style={primaryButtonStyle}
                        onPress={handleConfirm}
                        disabled={checking}
                    >
                        <Text style={styles.primaryButtonText}>
                            {checking ? 'Verificando...' : 'Confirmar'}
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.cancelButton}
                        onPress={handleClose}
                        disabled={checking}
                    >
                        <Text style={cancelTextStyle}>Cancelar</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );
}