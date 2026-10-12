// src/routes/AppRoutes.tsx

import React from 'react';

import { View, StyleSheet, ActivityIndicator } from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';

// Responsável pela navegação.
import { NavigationContainer } from '@react-navigation/native';

// Navegação em pilha.
import { createNativeStackNavigator } from '@react-navigation/native-stack';

// Telas.
import Login from '../../screens/Login';

import DrawerNavigator from '../DrawerNavigator/DrawerNavigator';

// Cria o Stack Navigator.
const Stack = createNativeStackNavigator();

export default function AppRoutes() {

    const { isReady } = useTheme();

    if (!isReady) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#56AC00" />
            </View>
        );
    }

    return (

        <NavigationContainer>

            <Stack.Navigator
                initialRouteName="Login"
                screenOptions={{
                    headerShown: false,
                    gestureEnabled: true,
                    fullScreenGestureEnabled: true,
                    // Login <-> app é troca de contexto: fade suave em
                    // vez de deslizar a tela inteira.
                    animation: 'fade',
                    animationTypeForReplace: 'push',
                }}
            >

                <Stack.Screen
                    name="Login"
                    component={Login}
                />

                <Stack.Screen
                    name="Home"
                    component={DrawerNavigator}
                />

            </Stack.Navigator>

        </NavigationContainer>

    );

}

const styles = StyleSheet.create({
    loadingContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#FFFFFF',
    },
});