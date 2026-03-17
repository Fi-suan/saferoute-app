/**
 * RootNavigator — SafeRoute / Sapa Jol
 *
 * Stack Navigator поверх Tab Navigator.
 * IncidentDetailScreen открывается без tab bar (modal-like slide).
 *
 * Структура:
 * RootStack
 *   ├─ Main (TabNavigator)
 *   └─ IncidentDetail (Stack screen, без tab bar)
 */
import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import TabNavigator from './TabNavigator';
import IncidentDetailScreen from '../screens/IncidentDetailScreen';
import { Colors } from '../constants/colors';
import { Incident } from '../constants/incidents';

export type RootStackParamList = {
    Main: undefined;
    IncidentDetail: { incident: Incident };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootNavigator() {
    return (
        <Stack.Navigator
            screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: Colors.bg.primary },
                animation: 'slide_from_right',
            }}
        >
            <Stack.Screen name="Main" component={TabNavigator} />
            <Stack.Screen
                name="IncidentDetail"
                component={IncidentDetailScreen}
                options={{
                    animation: 'slide_from_bottom',
                    presentation: 'modal',
                }}
            />
        </Stack.Navigator>
    );
}
