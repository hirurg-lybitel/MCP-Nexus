import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  serverExternalPackages: [
    'node-firebird-driver-native',
    'node-firebird-native-api',
  ],
};

export default nextConfig;
