import 'react-native-gesture-handler';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { DeviceProvider, useDevice } from './src/context/DeviceContext';
import { DashboardScreen } from './src/screens/DashboardScreen';
import { CablesScreen } from './src/screens/CablesScreen';
import { CableFormScreen } from './src/screens/CableFormScreen';
import { ProjectsScreen } from './src/screens/ProjectsScreen';
import { ProjectFormScreen } from './src/screens/ProjectFormScreen';
import { ProjectDetailScreen } from './src/screens/ProjectDetailScreen';
import { ResultsScreen } from './src/screens/ResultsScreen';
import { colors } from './src/theme';

export type RootStackParamList = {
  Dashboard: undefined;
  Cables: undefined;
  CableForm: { cableId?: string } | undefined;
  Projects: undefined;
  ProjectForm: { projectId?: string } | undefined;
  ProjectDetail: { projectId: string };
  Results: { projectId: string };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

function AppNavigator() {
  const { loading } = useDevice();

  if (loading) {
    return (
      <View style={styles.bootContainer}>
        <ActivityIndicator color={colors.cyan} />
        <Text style={styles.bootText}>Initializing mobile workspace...</Text>
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName="Dashboard"
        screenOptions={{
          headerStyle: { backgroundColor: '#09090b' },
          headerTintColor: '#f4f4f5',
          headerTitleStyle: { fontWeight: '700' },
          contentStyle: { backgroundColor: '#09090b' },
        }}
      >
        <Stack.Screen name="Dashboard" component={DashboardScreen} options={{ title: 'Thermal Tools' }} />
        <Stack.Screen name="Projects" component={ProjectsScreen} options={{ title: 'Projects' }} />
        <Stack.Screen name="ProjectForm" component={ProjectFormScreen} options={{ title: 'Project Inputs' }} />
        <Stack.Screen name="ProjectDetail" component={ProjectDetailScreen} options={{ title: 'Project Overview' }} />
        <Stack.Screen name="Results" component={ResultsScreen} options={{ title: 'Results' }} />
        <Stack.Screen name="Cables" component={CablesScreen} options={{ title: 'Cable Library' }} />
        <Stack.Screen name="CableForm" component={CableFormScreen} options={{ title: 'Custom Cable' }} />
      </Stack.Navigator>
      <StatusBar style="light" />
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <DeviceProvider>
      <AppNavigator />
    </DeviceProvider>
  );
}

const styles = StyleSheet.create({
  bootContainer: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
  },
  bootText: {
    color: colors.textSecondary,
  },
});
