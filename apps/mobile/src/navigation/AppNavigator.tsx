import React from 'react';
import { StatusBar } from 'react-native';
import SharedBasketScreen from '../screens/SharedBasketScreen';
import SavedBasketsScreen from '../screens/SavedBasketsScreen';
import { DarkColors } from '../theme/colors';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import PreferencesScreen from '../screens/PreferencesScreen';
import AccountScreen from '../screens/AccountScreen';
import InsightsScreen from '../screens/InsightsScreen';
import HomeScreen from '../screens/HomeScreen';
import CartScreen from '../screens/CartScreen';
import ComparisonScreen from '../screens/ComparisonScreen';
import { useColors } from '../theme/useTheme';
import { RootStackParamList } from './types';
const Stack = createNativeStackNavigator<RootStackParamList>();
export default function AppNavigator() {
  const Colors = useColors();

  return (
    <NavigationContainer
      linking={{ prefixes: ['grocerycompare://'], config: { screens: { SharedBasket: 'share/:id' } } }}
      theme={{
        ...DefaultTheme,
        dark: Colors === DarkColors,
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
      <StatusBar barStyle={Colors === DarkColors ? "light-content" : "dark-content"} backgroundColor={Colors.background} />
      <Stack.Navigator
        initialRouteName="Home"
        screenOptions={{
          headerShadowVisible: false,
          headerTintColor: Colors.primary,
          headerTitleStyle: { fontWeight: '700' },
          contentStyle: { backgroundColor: Colors.background },
        }}
      >
        <Stack.Screen name="SharedBasket" component={SharedBasketScreen} options={{title:"Shared basket"}} />
        <Stack.Screen name="SavedBaskets" component={SavedBasketsScreen} options={{title:"Saved baskets"}} />
        <Stack.Screen
          name="Preferences"
          component={PreferencesScreen}
          options={{ title: 'Preferences' }}
        />
        <Stack.Screen
          name="Account"
          component={AccountScreen}
          options={{ title: 'Account & alerts' }}
        />
        <Stack.Screen
          name="Insights"
          component={InsightsScreen}
          options={{ title: 'Product insights' }}
        />
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
