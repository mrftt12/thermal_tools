import 'react-native-gesture-handler';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { DeviceProvider, useDevice } from './src/context/DeviceContext';
import { ThemeProvider, useThemeContext } from './src/context/ThemeContext';
import { DashboardScreen } from './src/screens/DashboardScreen';
import { CablesScreen } from './src/screens/CablesScreen';
import { CableFormScreen } from './src/screens/CableFormScreen';
import { ProjectsScreen } from './src/screens/ProjectsScreen';
import { ProjectFormScreen } from './src/screens/ProjectFormScreen';
import { ProjectDetailScreen } from './src/screens/ProjectDetailScreen';
import { ResultsScreen } from './src/screens/ResultsScreen';
import { AIScreen } from './src/screens/AIScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';

export type MainTabParamList = {
  Dashboard: undefined;
  Projects: undefined;
  Cables: undefined;
  AI: undefined;
  Settings: undefined;
};

export type RootStackParamList = {
  MainTabs: undefined;
  ProjectForm: { projectId?: string } | undefined;
  ProjectDetail: { projectId: string };
  Results: { projectId: string };
  CableForm: { cableId?: string } | undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tabs = createBottomTabNavigator<MainTabParamList>();

function MainTabs() {
  const { colors } = useThemeContext();

  return (
    <Tabs.Navigator
      initialRouteName="Dashboard"
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          height: 62,
          paddingBottom: 8,
          paddingTop: 6,
        },
        tabBarActiveTintColor: colors.cyan,
        tabBarInactiveTintColor: colors.textSecondary,
      }}
    >
      <Tabs.Screen name="Dashboard" component={DashboardScreen} options={{ title: 'Dashboard' }} />
      <Tabs.Screen name="Projects" component={ProjectsScreen} options={{ title: 'Projects' }} />
      <Tabs.Screen name="Cables" component={CablesScreen} options={{ title: 'Cable Library' }} />
      <Tabs.Screen name="AI" component={AIScreen} options={{ title: 'AI' }} />
      <Tabs.Screen name="Settings" component={SettingsScreen} options={{ title: 'Settings' }} />
    </Tabs.Navigator>
  );
}

function AppNavigator() {
  const { loading } = useDevice();
  const { colors, mode } = useThemeContext();

  if (loading) {
    return (
      <View style={[styles.bootContainer, { backgroundColor: colors.background }]}> 
        <ActivityIndicator color={colors.cyan} />
        <Text style={[styles.bootText, { color: colors.textSecondary }]}>Initializing mobile workspace...</Text>
      </View>
    );
  }

  return (
    <NavigationContainer
      theme={{
        ...DefaultTheme,
        colors: {
          ...DefaultTheme.colors,
          background: colors.background,
          card: colors.surface,
          text: colors.textPrimary,
          border: colors.border,
          primary: colors.cyan,
        },
      }}
    >
      <Stack.Navigator
        initialRouteName="MainTabs"
        screenOptions={{
          headerStyle: { backgroundColor: colors.surface },
          headerTintColor: colors.textPrimary,
          headerTitleStyle: { fontWeight: '700' },
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Screen name="MainTabs" component={MainTabs} options={{ headerShown: false }} />
        <Stack.Screen name="ProjectForm" component={ProjectFormScreen} options={{ title: 'Project Inputs' }} />
        <Stack.Screen name="ProjectDetail" component={ProjectDetailScreen} options={{ title: 'Project Overview' }} />
        <Stack.Screen name="Results" component={ResultsScreen} options={{ title: 'Results' }} />
        <Stack.Screen name="CableForm" component={CableFormScreen} options={{ title: 'Custom Cable' }} />
      </Stack.Navigator>
      <StatusBar style={mode === 'dark' ? 'light' : 'dark'} />
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <DeviceProvider>
        <AppNavigator />
      </DeviceProvider>
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  bootContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
  },
  bootText: {
    fontSize: 14,
  },
});
