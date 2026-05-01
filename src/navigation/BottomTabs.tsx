import React from 'react'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { Text, View } from 'react-native'
import DashboardScreen from '../screens/DashboardScreen'
import TaskListScreen from '../screens/TaskListScreen'
import NotificationsScreen from '../screens/NotificationsScreen'
import ProfileScreen from '../screens/ProfileScreen'
import InventoryScreen from '../screens/InventoryScreen'
import { useAppSelector } from '../store/hooks'
import type { BottomTabParamList } from './types'

const Tab = createBottomTabNavigator<BottomTabParamList>()

const TAB_ICONS: Record<string, string> = {
  Dashboard: '🏠',
  Tasks: '📋',
  Inventory: '📦',
  Notifications: '🔔',
  Profile: '👤',
}

export default function BottomTabs() {
  const unreadCount = useAppSelector((s) => s.notifications.unreadCount)

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ focused }) => {
          const icon = <Text style={{ fontSize: 20 }}>{TAB_ICONS[route.name]}</Text>
          if (route.name === 'Notifications' && unreadCount > 0) {
            return (
              <View>
                {icon}
                <View
                  style={{
                    position: 'absolute',
                    top: -4,
                    right: -6,
                    backgroundColor: '#c62828',
                    borderRadius: 8,
                    minWidth: 16,
                    height: 16,
                    alignItems: 'center',
                    justifyContent: 'center',
                    paddingHorizontal: 3,
                  }}
                >
                  <Text style={{ color: '#fff', fontSize: 9, fontWeight: '800' }}>
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </Text>
                </View>
              </View>
            )
          }
          return icon
        },
        tabBarActiveTintColor: '#1a237e',
        tabBarInactiveTintColor: '#999',
        tabBarStyle: {
          backgroundColor: '#fff',
          borderTopWidth: 1,
          borderTopColor: '#eee',
          paddingBottom: 4,
          height: 58,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
      })}
    >
      <Tab.Screen name="Dashboard" component={DashboardScreen} />
      <Tab.Screen name="Tasks" component={TaskListScreen} options={{ title: 'Tasks' }} />
      <Tab.Screen name="Inventory" component={InventoryScreen} />
      <Tab.Screen name="Notifications" component={NotificationsScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  )
}
