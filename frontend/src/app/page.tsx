'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../context/AuthContext';

export default function Home() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading) {
      if (user) {
        router.replace('/dashboard');
      } else {
        router.replace('/login');
      }
    }
  }, [user, isLoading, router]);

  return (
    <div className="flex h-screen items-center justify-center bg-dark-bg">
      <div className="flex items-center space-x-3 text-brand-500">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-current border-t-transparent" />
        <span className="text-sm font-medium text-gray-400">Loading ReachInbox...</span>
      </div>
    </div>
  );
}
