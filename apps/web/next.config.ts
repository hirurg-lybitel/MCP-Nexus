import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  env: {
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    OPENAI_PROJECT_KEY: process.env.OPENAI_PROJECT_KEY,
  },
  serverExternalPackages: [
    '@mcp-nexus/db-firebird',
    'node-firebird-driver',
    'node-firebird-driver-native',
    'node-firebird-native-api',
  ],
};

export default nextConfig;
