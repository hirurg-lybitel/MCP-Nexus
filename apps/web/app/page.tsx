'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function Home() {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (pathname === '/') {
      router.push('/chat');
    }
  }, [pathname, router]);

  return (
    <div className="min-h-screen bg-gray-900">
      loading...
    </div>
  );
}

