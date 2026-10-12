// src/components/TrackerDropdown/index.tsx
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, FlatList } from 'react-native';
import type { Tracker } from '../../types/Tracker';
import { useTheme } from '../../contexts/ThemeContext';
import { DropdownPanel, RotatingChevron } from '../AnimatedDropdown';
import { styles } from './styles';


type Props = {
    trackers: Tracker[];
    selectedTracker: Tracker | null;
    onSelect: (tracker: Tracker) => void;
};

export default function TrackerDropdown({ trackers, selectedTracker, onSelect }: Props) {
    const [open, setOpen] = useState(false);
    const { isDark } = useTheme();

    const headerStyle = [styles.header, isDark && styles.darkHeader];
    const headerTextStyle = [styles.headerText, isDark && styles.darkHeaderText];
    const chevronStyle = [styles.chevron, isDark && styles.darkChevron];
    const listStyle = [styles.list, isDark && styles.darkList];
    const itemStyle = [styles.item, isDark && styles.darkItem];
    const itemTextStyle = [styles.itemText, isDark && styles.darkItemText];
    const itemSubtextStyle = [styles.itemSubtext, isDark && styles.darkItemSubtext];
    const emptyTextStyle = [styles.emptyText, isDark && styles.darkEmptyText];

    return (
        <View style={styles.container}>
            <TouchableOpacity style={headerStyle} onPress={() => setOpen(prev => !prev)}>
                <Text style={headerTextStyle} numberOfLines={1}>
                    {selectedTracker ? selectedTracker.name : 'Selecione um rastreador'}
                </Text>
                <RotatingChevron open={open}>
                    <Text style={chevronStyle}>▼</Text>
                </RotatingChevron>
            </TouchableOpacity>

            <DropdownPanel open={open} style={listStyle}>
                <FlatList
                    data={trackers}
                    keyExtractor={item => item.id}
                    style={{ maxHeight: 220 }}
                    ListEmptyComponent={
                        <Text style={emptyTextStyle}>Nenhum rastreador cadastrado.</Text>
                    }
                    renderItem={({ item }) => (
                        <TouchableOpacity
                            style={itemStyle}
                            onPress={() => {
                                onSelect(item);
                                setOpen(false);
                            }}
                        >
                            <Text style={itemTextStyle}>{item.name}</Text>
                            <Text style={itemSubtextStyle}>{item.phone}</Text>
                        </TouchableOpacity>
                    )}
                />
            </DropdownPanel>
        </View>
    );
}

