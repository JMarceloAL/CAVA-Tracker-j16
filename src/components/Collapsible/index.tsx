// src/components/Collapsible/index.tsx
import React, { useState, useRef, useEffect } from 'react';
import { Animated, View, LayoutChangeEvent } from 'react-native';

import { DROPDOWN_CLOSE_MS, DROPDOWN_OPEN_MS, EASE_CLOSE, EASE_OPEN } from '../AnimatedDropdown';
import { styles } from './styles';

type Props = {
    open: boolean;
    children: React.ReactNode;
};

export default function Collapsible({ open, children }: Props) {
    const [measuredHeight, setMeasuredHeight] = useState<number | null>(null);
    const heightAnim = useRef(new Animated.Value(0)).current;
    const opacityAnim = useRef(new Animated.Value(open ? 1 : 0)).current;

    function handleContentLayout(e: LayoutChangeEvent) {
        const h = e.nativeEvent.layout.height;
        if (h > 0 && h !== measuredHeight) {
            setMeasuredHeight(h);
        }
    }

    useEffect(() => {
        if (measuredHeight === null) return;

        // Altura um pouco mais longa que o dropdown (move mais
        // conteúdo); a opacidade acompanha.
        const duration = open ? DROPDOWN_OPEN_MS + 60 : DROPDOWN_CLOSE_MS + 40;
        const easing = open ? EASE_OPEN : EASE_CLOSE;

        Animated.parallel([
            Animated.timing(heightAnim, {
                toValue: open ? measuredHeight : 0,
                duration,
                easing,
                useNativeDriver: false,
            }),
            Animated.timing(opacityAnim, {
                toValue: open ? 1 : 0,
                duration: open ? duration : duration * 0.6,
                easing,
                useNativeDriver: false,
            }),
        ]).start();
    }, [open, measuredHeight, heightAnim, opacityAnim]);

    return (
        <View>
            <View style={styles.measure} pointerEvents="none">
                <View onLayout={handleContentLayout}>{children}</View>
            </View>

            <Animated.View
                style={{
                    height: heightAnim,
                    opacity: opacityAnim,
                    overflow: 'hidden',
                }}
            >
                {children}
            </Animated.View>
        </View>
    );
}
