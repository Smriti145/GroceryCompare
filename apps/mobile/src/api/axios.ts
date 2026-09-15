import axios from 'axios';
import { Platform } from 'react-native';
import config from '../config/runtime.json';
import type { ApiFailure } from '../../../../packages/contracts';
const api = axios.create({
  baseURL:
    config.apiBaseUrl ||
    (Platform.OS === 'android'
      ? 'http://10.0.2.2:5001/api'
      : 'http://localhost:5001/api'),
  timeout: 10000,
});
api.interceptors.request.use(request => {
  if (!__DEV__ && !config.apiBaseUrl.startsWith('https://')) {
    throw new Error(
      'A secure API endpoint must be configured for this release',
    );
  }
  request.headers.set(
    'X-Request-ID',
    `mobile-${Date.now().toString(36)}-${Math.random()
      .toString(36)
      .slice(2, 10)}`,
  );
  return request;
});
export function errorMessage(error: unknown): string {
  if (axios.isAxiosError<ApiFailure>(error)) {
    if (error.code === 'ECONNABORTED')
      return 'The request timed out. Please try again.';
    if (!error.response)
      return 'Unable to connect. Check your connection and try again.';
    const message = error.response.data?.error?.message;
    return typeof message === 'string'
      ? message
      : 'The service is temporarily unavailable. Please try again.';
  }
  return 'Something went wrong. Please try again.';
}
export default api;
