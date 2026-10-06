// src/components/ScreenHeader/index.tsx
//
// Cabeçalho das telas do menu lateral (botão de menu + título).

import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

import { useTheme } from '../../contexts/ThemeContext';

export default function ScreenHeader({ title }: { title: string }) {
    const navigation = useNavigation<any>();
    const { colors } = useTheme();

    return (
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
            <TouchableOpacity
                style={{ marginRight: 12, padding: 4 }}
                onPress={() => navigation.openDrawer?.()}
                activeOpacity={0.8}
            >
                <MaterialIcons name="menu" size={28} color={colors.text} />
            </TouchableOpacity>

            <Text style={{ fontSize: 22, fontWeight: 'bold', color: colors.text }}>
                {title}
            </Text>
        </View>
    );
}
