import type { NextConfig } from 'next';
import { MCP_PORT } from './constants';

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: '/api/mcp/:path*', 
        destination: `http://localhost:${MCP_PORT}/mcp/:path*`,
      },
    ];
  },
};

export default nextConfig;
