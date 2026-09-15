import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import axios from 'axios';
import AppNavigator from './src/navigation/AppNavigator';
import ErrorBoundary from './src/components/common/ErrorBoundary';
const queryClient = new QueryClient({ defaultOptions: { queries: {
  retry: (failures, error) => failures < 2 && !(axios.isAxiosError(error) && error.response && error.response.status < 500),
  gcTime: 5 * 60_000,
} } });
export default function App() {
  return <SafeAreaProvider><ErrorBoundary><QueryClientProvider client={queryClient}>
    <AppNavigator />
  </QueryClientProvider></ErrorBoundary></SafeAreaProvider>;
}
