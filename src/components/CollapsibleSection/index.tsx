// src/components/CollapsibleSection/index.tsx
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';
import Collapsible from '../Collapsible';
import { RotatingChevron } from '../AnimatedDropdown';
import { styles } from './styles';
type Props = {
    title: string;
    children: React.ReactNode;
    defaultOpen?: boolean;
};

export default function CollapsibleSection({ title, children, defaultOpen = false }: Props) {
    const { colors } = useTheme();
    const [open, setOpen] = useState(defaultOpen);

    return (
        <View style={[styles.container, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
            <TouchableOpacity
                style={styles.header}
                onPress={() => setOpen(prev => !prev)}
                activeOpacity={0.8}
            >
                <Text style={[styles.headerText, { color: colors.text }]}>{title}</Text>
                <RotatingChevron open={open}>
                    <Text style={[styles.chevron, { color: colors.textMuted }]}>▼</Text>
                </RotatingChevron>
            </TouchableOpacity>

            <Collapsible open={open}>
                <View style={styles.content}>{children}</View>
            </Collapsible>
        </View>
    );
}
