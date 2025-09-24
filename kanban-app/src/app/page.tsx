'use client';

import { useEffect, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '../lib/supabase/client';
import { Loader2 } from 'lucide-react';

function RootPageContent() {
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    const handleRootAccess = async () => {
      // Check authentication status for normal access
      try {
        const { data: { user }, error } = await supabase.auth.getUser();

        if (error || !user) {
          // No user, redirect to login
          router.push('/auth/login');
        } else {
          // User is authenticated, redirect to dashboard
          router.push('/dashboard');
        }
      } catch (err) {
        console.error('Auth check error:', err);
        router.push('/auth/login');
      }
    };

    handleRootAccess();
  }, [router, supabase.auth]);
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center">
      <div className="text-center">
        <Loader2 className="h-12 w-12 text-blue-600 mx-auto mb-4 animate-spin" />
        <p className="text-gray-600">Redirecting...</p>
      </div>
    </div>
  );
}

export default function RootPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 text-blue-600 animate-spin" />
        </div>
      </div>
    }>
      <RootPageContent />
    </Suspense>
  );
}
