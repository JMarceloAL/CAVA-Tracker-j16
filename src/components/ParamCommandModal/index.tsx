// src/components/ParamCommandModal/index.tsx
import React, { useEffect, useState } from 'react';
import { View, Text, Modal, TextInput, TouchableOpacity, Alert } from 'react-native';

import { styles } from './styles';
import { useTheme } from '../../contexts/ThemeContext';
import { PopIn } from '../Motion';


export type Field = {
    key: string;
    label: string;
    placeholder?: string;
    keyboardType?: 'default' | 'numeric' | 'phone-pad';
    optional?: boolean; // campos marcados como optional não bloqueiam o envio
};

type Props = {
    visible: boolean;
    title: string;
    fields: Field[];
    onClose: () => void;
    onSubmit: (values: Record<string, string>) => void;
};

export default function ParamCommandModal({ visible, title, fields, onClose, onSubmit }: Props) {
    const { isDark } = useTheme();
    const [values, setValues] = useState<Record<string, string>>({});

    useEffect(() => {
        if (visible) {
            setValues({});
        }
    }, [visible]);

    function handleChange(key: string, value: string) {
        setValues(prev => ({ ...prev, [key]: value }));
    }

    function handleSubmit() {
        const missing = fields.filter(field => !field.optional && !values[field.key]?.trim());

        if (missing.length > 0) {
            Alert.alert(
                'Campos obrigatórios',
                `Preencha: ${missing.map(f => f.label).join(', ')}`
            );
            return;
        }

        onSubmit(values);
    }

    const containerStyle = [styles.container, isDark && styles.darkContainer];
    const titleStyle = [styles.title, isDark && styles.darkTitle];
    const inputStyle = [styles.input, isDark && styles.darkInput];
    const cancelTextStyle = [styles.cancelButtonText, isDark && styles.darkCancelButtonText];

    return (
        <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
            <View style={styles.overlay}>
                <PopIn variant="sheet" style={containerStyle}>
                    <Text style={titleStyle}>{title}</Text>

                    {fields.map(field => (
                        <TextInput
                            key={field.key}
                            placeholder={field.label + (field.optional ? ' (opcional)' : '') + (field.placeholder ? ` — ${field.placeholder}` : '')}
                            placeholderTextColor={isDark ? '#AFB9C7' : '#8E8E93'}
                            keyboardType={field.keyboardType ?? 'default'}
                            value={values[field.key] ?? ''}
                            onChangeText={(text) => handleChange(field.key, text)}
                            style={inputStyle}
                        />
                    ))}

                    <TouchableOpacity style={styles.primaryButton} onPress={handleSubmit}>
                        <Text style={styles.primaryButtonText}>Enviar Comando</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
                        <Text style={cancelTextStyle}>Cancelar</Text>
                    </TouchableOpacity>
                </PopIn>
            </View>
        </Modal>
    );
}



