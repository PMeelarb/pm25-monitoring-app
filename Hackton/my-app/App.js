import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';

// 🌟 นำเข้า Global State (ถ้าคุณวาง AppContext.js ไว้ในโฟลเดอร์ context)
import { AppProvider } from './context/AppContext'; 

// 🌟 นำเข้าหน้าจอต่างๆ (ใช้โฟลเดอร์ screen ตามที่คุณตั้งชื่อไว้)
import HomeScreen from './screen/HomeScreen';
import MapScreen from './screen/MapScreen';
import AgricultureScreen from './screen/AgricultureScreen';
import NotificationScreen from './screen/NotificationScreen';
import ProfileScreen from './screen/ProfileScreen';
import PremiumRegistrationScreen from './screen/PremiumRegistrationScreen'; 

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

// ── สร้างแถบเมนูด้านล่าง (Tab) แบบเดิมของคุณ ──
function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;
          if (route.name === 'หน้าหลัก') { iconName = focused ? 'home' : 'home-outline'; } 
          else if (route.name === 'แผนที่') { iconName = focused ? 'map' : 'map-outline'; } 
          else if (route.name === 'เกษตร') { iconName = focused ? 'leaf' : 'leaf-outline'; } 
          else if (route.name === 'แจ้งเตือน') { iconName = focused ? 'notifications' : 'notifications-outline'; } 
          else if (route.name === 'ฉัน') { iconName = focused ? 'person' : 'person-outline'; }
          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#2C5282',
        tabBarInactiveTintColor: 'gray',
        headerShown: false,
      })}
    >
      <Tab.Screen name="หน้าหลัก" component={HomeScreen} />
      <Tab.Screen name="แผนที่" component={MapScreen} />
      <Tab.Screen name="เกษตร" component={AgricultureScreen} />
      <Tab.Screen name="แจ้งเตือน" component={NotificationScreen} />
      <Tab.Screen name="ฉัน" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

// ── นำทุกอย่างมารวมกันตรงนี้ ──
export default function App() {
  return (
    <AppProvider>
      <NavigationContainer>
        <Stack.Navigator>
          <Stack.Screen 
            name="MainTabs" 
            component={MainTabs} 
            options={{ headerShown: false }} 
          />
          <Stack.Screen 
            name="PremiumRegistration" 
            component={PremiumRegistrationScreen} 
            options={{ title: 'สมัครสมาชิกพรีเมี่ยม' }} // แสดงชื่อบนแถบบาร์ตอนเปลี่ยนหน้า
          />
        </Stack.Navigator>
      </NavigationContainer>
    </AppProvider>
  );
}