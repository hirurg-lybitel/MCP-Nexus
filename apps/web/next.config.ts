import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  serverExternalPackages: [
    '@mcp-nexus/db-firebird',
    'node-firebird-driver-native',
    'node-firebird-native-api',
  ],
};

export default nextConfig;
