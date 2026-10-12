// src/components/AnimatedDropdown/index.tsx
//
// Animações compartilhadas dos dropdowns do app:
// - DropdownPanel: a lista aparece deslizando de cima com fade e
//   leve escala, e continua montada durante a animação de fechar.
// - RotatingChevron: gira a seta (▼ / expand-more) 180° ao abrir.
//
// Tudo com useNativeDriver (opacidade/transform), então roda na
// thread nativa sem travar mesmo com a tela ocupada.

import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, type StyleProp, type ViewStyle } from 'react-native';

export const DROPDOWN_OPEN_MS = 240;
export const DROPDOWN_CLOSE_MS = 180;

// Curvas no estilo Material: desacelera ao abrir, acelera ao fechar.
export const EASE_OPEN = Easing.bezier(0.2, 0, 0, 1);
export const EASE_CLOSE = Easing.bezier(0.4, 0, 1, 1);

function useOpenProgress(open: boolean) {
    const progress = useRef(new Animated.Value(open ? 1 : 0)).current;

    useEffect(() => {
        const animation = Animated.timing(progress, {
            toValue: open ? 1 : 0,
            duration: open ? DROPDOWN_OPEN_MS : DROPDOWN_CLOSE_MS,
            easing: open ? EASE_OPEN : EASE_CLOSE,
            useNativeDriver: true,
        });

        animation.start();

        return () => animation.stop();
    }, [open, progress]);

    return progress;
}

type PanelProps = {
    open: boolean;
    style?: StyleProp<ViewStyle>;
    children: React.ReactNode;
};

export function DropdownPanel({ open, style, children }: PanelProps) {
    const progress = useOpenProgress(open);
    const [mounted, setMounted] = useState(open);

    useEffect(() => {
        if (open) {
            setMounted(true);
            return;
        }

        // Desmonta só depois que a animação de fechar terminar.
        const timer = setTimeout(() => setMounted(false), DROPDOWN_CLOSE_MS);

        return () => clearTimeout(timer);
    }, [open]);

    // `open` já renderiza no mesmo frame em que abre (sem esperar o
    // efeito), para a animação começar do primeiro quadro.
    if (!open && !mounted) {
        return null;
    }

    return (
        <Animated.View
            pointerEvents={open ? 'auto' : 'none'}
            style={[
                style,
                {
                    opacity: progress,
                    transformOrigin: 'top',
                    transform: [
                        {
                            translateY: progress.interpolate({
                                inputRange: [0, 1],
                                outputRange: [-8, 0],
                            }),
                        },
                        {
                            scaleY: progress.interpolate({
                                inputRange: [0, 1],
                                outputRange: [0.94, 1],
                            }),
                        },
                    ],
                },
            ]}
        >
            {children}
        </Animated.View>
    );
}

type ChevronProps = {
    open: boolean;
    style?: StyleProp<ViewStyle>;
    /** Ícone no estado FECHADO (apontando para baixo). */
    children: React.ReactNode;
};

export function RotatingChevron({ open, style, children }: ChevronProps) {
    const progress = useOpenProgress(open);

    return (
        <Animated.View
            style={[
                style,
                {
                    transform: [
                        {
                            rotate: progress.interpolate({
                                inputRange: [0, 1],
                                outputRange: ['0deg', '180deg'],
                            }),
                        },
                    ],
                },
            ]}
        >
            {children}
        </Animated.View>
    );
}
