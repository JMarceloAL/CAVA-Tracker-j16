// src/routes/DrawerNavigator.tsx
import React from 'react';
import { createDrawerNavigator } from '@react-navigation/drawer';
import { MaterialIcons } from '@expo/vector-icons';
import TabNavigator from '../TabNavigator/TabNavigator'; import SettingsScreen from '../../screens/Settings';
import InfoScreen from '../../screens/Info'; import { logout } from '../../services/storage/authStorage';
import AlertsScreen from '../../screens/Alerts';
import ReportsScreen from '../../screens/Reports';
import { useTheme } from '../../contexts/ThemeContext';
import { useRealTime } from '../../contexts/RealTimeContext';
import { useTrackerServiceProvider } from '../../contexts/TrackerServiceContext';
import { APP_GREEN } from '../../theme/colors';

const Drawer = createDrawerNavigator();

// SOLUÇÃO: Declaramos o componente fixo aqui fora para o React não recriá-lo na renderização
function EmptyScreen() {
    return null;
}

export default function DrawerNavigator() {
    const { isDark, colors } = useTheme();
    const { stopRealTime, stopVigilante } = useRealTime();
    const { clearService } = useTrackerServiceProvider();

    return (
        <Drawer.Navigator
            initialRouteName="Início"
            screenOptions={{
                headerShown: false,
                drawerActiveTintColor: colors.primary,
                drawerInactiveTintColor: isDark ? '#AFB9C7' : '#555',
                drawerLabelStyle: {
                    fontSize: 16,
                },
                drawerStyle: {
                    backgroundColor: colors.background,
                },
            }}
        >
            {/* ITEM: INÍCIO */}
            <Drawer.Screen
                name="Início"
                component={TabNavigator}
                listeners={({ navigation }) => ({
                    drawerItemPress: (e) => {
                        e.preventDefault();
                        navigation.closeDrawer();
                        navigation.navigate('Início', { screen: 'HomeScreen' });
                    },
                })}
                options={{
                    drawerIcon: ({ color, size }) => (
                        <MaterialIcons name="home" color={color} size={size} />
                    ),
                }}
            />

            {/* ITEM: ALERTAS E CERCAS */}
            <Drawer.Screen
                name="Alertas e cercas"
                component={AlertsScreen}
                options={{
                    drawerIcon: ({ color, size }) => (
                        <MaterialIcons name="notifications-active" color={color} size={size} />
                    ),
                }}
            />

            {/* ITEM: RELATÓRIOS */}
            <Drawer.Screen
                name="Relatórios"
                component={ReportsScreen}
                options={{
                    drawerIcon: ({ color, size }) => (
                        <MaterialIcons name="bar-chart" color={color} size={size} />
                    ),
                }}
            />

            {/* ITEM: CONFIGURAÇÕES */}
            <Drawer.Screen
                name="Configurações"
                component={SettingsScreen}
                options={{
                    drawerIcon: ({ color, size }) => (
                        <MaterialIcons name="settings" color={color} size={size} />
                    ),
                }}
            />

            {/* ITEM: INFO */}
            <Drawer.Screen
                name="Info"
                component={InfoScreen}
                options={{
                    drawerIcon: ({ color, size }) => (
                        <MaterialIcons name="info-outline" color={color} size={size} />
                    ),
                }}
            />

            {/* ITEM: SAIR */}
            <Drawer.Screen
                name="Sair"
                component={EmptyScreen} // <--- Passamos a referência estática limpa aqui
                listeners={({ navigation }) => ({
                    drawerItemPress: (e) => {
                        e.preventDefault();
                        navigation.closeDrawer();

                        const runLogout = async () => {
                            try {
                                // Ao sair, nada continua rodando (nem
                                // notificando) em nome do usuário.
                                stopRealTime();
                                stopVigilante();
                                clearService();

                                await logout();
                                const parent = navigation.getParent();
                                const root = parent?.getParent() ?? parent;

                                if (root && 'replace' in root) {
                                    (root as any).replace('Login');
                                    return;
                                }
                                navigation.navigate('Login');
                            } catch (error) {
                                console.error(error);
                            }
                        };
                        runLogout();
                    },
                })}
                options={{
                    drawerIcon: () => (
                        <MaterialIcons name="exit-to-app" color="#ff5252" size={22} />
                    ),
                    drawerLabelStyle: {
                        color: '#ff5252',
                        fontSize: 16,
                    }
                }}
            />
        </Drawer.Navigator>
    );
}