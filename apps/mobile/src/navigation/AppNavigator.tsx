import React from 'react';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import HomeScreen from '../screens/HomeScreen';
import CartScreen from '../screens/CartScreen';
import ComparisonScreen from '../screens/ComparisonScreen';
import { Colors } from '../theme/colors';
import { RootStackParamList } from './types';
const Stack = createNativeStackNavigator<RootStackParamList>();
export default function AppNavigator() {
  return (
    <NavigationContainer
      theme={{
        ...DefaultTheme,
        colors: {
          ...DefaultTheme.colors,
          background: Colors.background,
          card: Colors.background,
          text: Colors.textPrimary,
          primary: Colors.primary,
          border: Colors.border,
        },
      }}
    >
      <Stack.Navigator
        screenOptions={{
          headerShadowVisible: false,
          headerTintColor: Colors.primary,
          headerTitleStyle: { fontWeight: '700' },
          contentStyle: { backgroundColor: Colors.background },
        }}
      >
        <Stack.Screen
          name="Home"
          component={HomeScreen}
          options={{ title: 'GroceryCompare' }}
        />
        <Stack.Screen
          name="Cart"
          component={CartScreen}
          options={{ title: 'Your compare cart' }}
        />
        <Stack.Screen
          name="Comparison"
          component={ComparisonScreen}
          options={{ title: 'Compare prices' }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
