import { isMcpClientAuthRequired } from '@/lib/mcp/auth';
import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({ authRequired: isMcpClientAuthRequired() });
}
