// src/components/Motion/index.tsx
//
// Transições de tela e de modais, com as mesmas curvas dos
// dropdowns (AnimatedDropdown):
// - ScreenFocusTransition: a tela entra com fade + leve subida toda
//   vez que ganha foco (usada no screenLayout do Drawer).
// - PopIn: o cartão/folha do modal surge com fade + escala (dialog)
//   ou subindo de baixo (sheet). O Modal em si usa animationType
//   "fade", então só o fundo escurece em vez da tela inteira deslizar.

import React, { useEffect, useRef } from 'react';
import { Animated, type StyleProp, type ViewStyle } from 'react-native';

import { EASE_OPEN } from '../AnimatedDropdown';

const SCREEN_ENTER_MS = 300;
const POP_IN_MS = 280;

type FocusNavigation = {
    isFocused: () => boolean;
    addListener: (event: 'focus', callback: () => void) => () => void;
};

export function ScreenFocusTransition({
    navigation,
    children,
}: {
    navigation: FocusNavigation;
    children: React.ReactNode;
}) {
    const progress = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        let lastRun = 0;

        function run() {
            // Montagem e evento "focus" podem chegar juntos.
            const now = Date.now();
            if (now - lastRun < 150) return;
            lastRun = now;

            progress.setValue(0);
            Animated.timing(progress, {
                toValue: 1,
                duration: SCREEN_ENTER_MS,
                easing: EASE_OPEN,
                useNativeDriver: true,
            }).start();
        }

        if (navigation.isFocused()) {
            run();
        }

        return navigation.addListener('focus', run);
    }, [navigation, progress]);

    return (
        <Animated.View
            style={{
                flex: 1,
                opacity: progress,
                transform: [
                    {
                        translateY: progress.interpolate({
                            inputRange: [0, 1],
                            outputRange: [14, 0],
                        }),
                    },
                ],
            }}
        >
            {children}
        </Animated.View>
    );
}

export function PopIn({
    variant = 'dialog',
    style,
    children,
}: {
    variant?: 'dialog' | 'sheet';
    style?: StyleProp<ViewStyle>;
    children: React.ReactNode;
}) {
    const progress = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.timing(progress, {
            toValue: 1,
            duration: POP_IN_MS,
            easing: EASE_OPEN,
            useNativeDriver: true,
        }).start();
    }, [progress]);

    const transform =
        variant === 'sheet'
            ? [
                {
                    translateY: progress.interpolate({
                        inputRange: [0, 1],
                        outputRange: [120, 0],
                    }),
                },
            ]
            : [
                {
                    scale: progress.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0.92, 1],
                    }),
                },
                {
                    translateY: progress.interpolate({
                        inputRange: [0, 1],
                        outputRange: [12, 0],
                    }),
                },
            ];

    return (
        <Animated.View style={[style, { opacity: progress, transform }]}>
            {children}
        </Animated.View>
    );
}
