import React, { useEffect, useState } from 'react';

import {
    View,
    Text,
    Modal,
    TextInput,
    TouchableOpacity,
    Alert,
    ActivityIndicator,
} from 'react-native';

import { styles } from './styles';
import { normalizeToE164 } from '../../../utils/phone';
import { useTheme } from '../../../contexts/ThemeContext';
import { APP_GREEN } from '../../../theme/colors';
import { PopIn } from '../../Motion';

interface Props {

    visible: boolean;

    onClose(): void;

    onAdd(name: string, phone: string): Promise<void> | void;

    initialName?: string;

    initialPhone?: string;

    title?: string;

    submitLabel?: string;

    allowPhoneEdit?: boolean;

}

export default function AddTrackerModal({

    visible,

    onClose,

    onAdd,

    initialName = '',

    initialPhone = '',

    title = 'Novo Rastreador',

    submitLabel = 'Adicionar',

    allowPhoneEdit = true,

}: Props) {

    const { isDark, colors } = useTheme();
    const [name, setName] = useState(initialName);
    const [phone, setPhone] = useState(initialPhone);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        setName(initialName);
        setPhone(initialPhone);
    }, [initialName, initialPhone, visible]);

    async function handleAdd() {
        if (loading) return;

        if (name.trim() === '') {
            Alert.alert('Aviso', 'Preencha o nome do rastreador.');
            return;
        }

        const valueToSave = allowPhoneEdit ? phone : initialPhone;

        if (allowPhoneEdit && (phone.trim() === '' || phone.length < 10)) {
            Alert.alert('Aviso', 'Número inválido. Digite o DDD + número (ex: 61999999999).');
            return;
        }

        try {
            setLoading(true);
            await onAdd(name, allowPhoneEdit ? normalizeToE164(phone) : normalizeToE164(valueToSave));
        } catch (error: any) {
            Alert.alert(
                'Erro ao adicionar rastreador',
                error instanceof Error ? error.message : 'Erro desconhecido'
            );
        } finally {
            // Não limpa os campos aqui: se o cadastro falhar, o modal
            // continua aberto com o que foi digitado. Ao reabrir, o
            // useEffect acima reinicia os campos.
            setLoading(false);
        }
    }

    function handleClose() {
        setName('');
        setPhone('');
        onClose();
    }

    function handleNameChange(value: string) {
        if (value.length <= 25) {
            setName(value);
        }
    }

    function handlePhoneChange(value: string) {
        const onlyNumbers = value.replace(/\D/g, '');

        if (onlyNumbers.length <= 11) {
            setPhone(onlyNumbers);
        }
    }

    const containerStyle = [styles.container, isDark && styles.darkContainer];
    const titleStyle = [styles.title, isDark && styles.darkTitle];
    const inputStyle = [styles.input, styles.inputSpacing, isDark && styles.darkInput];
    const cancelTextStyle = [styles.cancelButtonText, isDark && styles.darkCancelButtonText];

    return (

        <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>

            <View style={styles.overlay}>

                <PopIn variant="dialog" style={containerStyle}>
                    {loading ? (
                        <View style={styles.loadingContainer}>
                            <ActivityIndicator size="large" color={isDark ? '#F3F4F6' : colors.primary} />
                            <Text style={[styles.loadingText, isDark && styles.darkLoadingText]}>
                                Conectando ao rastreador...
                            </Text>
                        </View>
                    ) : (
                        <>
                            <Text style={titleStyle}>{title}</Text>

                            <TextInput
                                placeholder="Nome"
                                placeholderTextColor={isDark ? '#AFB9C7' : '#8E8E93'}
                                value={name}
                                onChangeText={handleNameChange}
                                style={inputStyle}
                                editable={!loading}
                            />

                            {allowPhoneEdit && (
                                <TextInput
                                    placeholder="Ex: 11912345678"
                                    placeholderTextColor={isDark ? '#AFB9C7' : '#8E8E93'}
                                    keyboardType="phone-pad"
                                    value={phone}
                                    onChangeText={handlePhoneChange}
                                    maxLength={11}
                                    style={[inputStyle, styles.inputSpacing]}
                                    editable={!loading}
                                />
                            )}

                            {!allowPhoneEdit && (
                                <View style={[inputStyle, styles.inputSpacing, { opacity: 0.9 }]}>
                                    <Text style={{
                                        color: isDark ? '#AFB9C7' : '#6B7280',
                                        fontSize: 15,
                                    }}>
                                        {initialPhone || 'Número do chip não disponível'}
                                    </Text>
                                </View>
                            )}

                            <TouchableOpacity style={[styles.primaryButton, { backgroundColor: colors.primary }]} onPress={handleAdd} disabled={loading}>
                                <Text style={styles.primaryButtonText}>{submitLabel}</Text>
                            </TouchableOpacity>

                            <TouchableOpacity style={styles.cancelButton} onPress={handleClose} disabled={loading}>
                                <Text style={cancelTextStyle}>Cancelar</Text>
                            </TouchableOpacity>
                        </>
                    )}
                </PopIn>

            </View>

        </Modal>

    );

}