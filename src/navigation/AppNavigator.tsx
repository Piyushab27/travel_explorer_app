/**
 * Navigation setup: a bottom-tab navigator (Home, Wishlist) inside a stack
 * that also holds the Details screen, so Details opens full-screen with a back button.
 */
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme';
import HomeScreen from '../screens/HomeScreen';
import WishlistScreen from '../screens/WishlistScreen';
import DetailsScreen from '../screens/DetailsScreen';
import { useWishlist } from '../context/WishlistContext';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

/** Bottom tabs: Home + Wishlist (badge shows how many are saved). */
function Tabs() {
  const { ids } = useWishlist();
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarIcon: ({ color, size, focused }) => {
          const base = route.name === 'Home' ? 'compass' : 'heart';
          return <Ionicons name={(focused ? base : `${base}-outline`) as any} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen
        name="Wishlist"
        component={WishlistScreen}
        options={{ tabBarBadge: ids.length || undefined }}
      />
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Tabs" component={Tabs} />
        <Stack.Screen name="Details" component={DetailsScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
