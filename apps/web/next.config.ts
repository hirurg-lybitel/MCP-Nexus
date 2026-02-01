import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: '/api/mcp/:path*', 
        destination: 'http://localhost:6005/mcp/:path*',
      },
    ];
  },
};

export default nextConfig;
