import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.nexride.app',
  appName: 'NEXRIDE',
  webDir: 'www',
  server: {
    url: 'https://nexride-2.vercel.app',
    cleartext: false,
    errorPath: 'offline.html'
  }
};

export default config;
