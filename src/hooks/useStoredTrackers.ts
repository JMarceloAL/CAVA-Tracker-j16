// src/hooks/useStoredTrackers.ts
//
// Lista de rastreadores salvos no aparelho + rastreador selecionado
// (compartilhado entre as telas pelo TrackerSelectionContext).
// Recarrega sempre que a tela ganha foco.

import { useCallback, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';

import { useTrackerSelection } from '../contexts/TrackerSelectionContext';
import type { Tracker } from '../types/Tracker';

const STORAGE_KEY = '@cavalleta:trackers';

export function useStoredTrackers() {
    const { setSelectedTrackerId, resolveSelectedTracker } = useTrackerSelection();

    const [trackers, setTrackers] = useState<Tracker[]>([]);
    const [selectedTracker, setSelectedTracker] = useState<Tracker | null>(null);

    const load = useCallback(async () => {
        try {
            const stored = await AsyncStorage.getItem(STORAGE_KEY);
            const list: Tracker[] = stored ? JSON.parse(stored) : [];

            setTrackers(list);

            const next = resolveSelectedTracker(list);

            setSelectedTracker(previous =>
                previous && next && previous.id === next.id && previous.imei === next.imei
                    ? previous
                    : next
            );
        } catch (error) {
            console.warn('Erro ao carregar rastreadores', error);
        }
    }, [resolveSelectedTracker]);

    useFocusEffect(
        useCallback(() => {
            void load();
        }, [load])
    );

    const selectTracker = useCallback((tracker: Tracker) => {
        setSelectedTracker(tracker);
        setSelectedTrackerId(tracker.id);
    }, [setSelectedTrackerId]);

    return { trackers, selectedTracker, selectTracker };
}
