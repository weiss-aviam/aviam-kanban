'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '../../../lib/supabase/client';
import { Loader2, CheckCircle, XCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import Link from 'next/link';

export default function AuthCallbackPage() {
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        // Get the code from URL parameters
        const code = searchParams.get('code');
        const error = searchParams.get('error');
        const errorDescription = searchParams.get('error_description');

        if (error) {
          setStatus('error');
          setMessage(errorDescription || 'Authentication failed');
          return;
        }

        if (code) {
          // Exchange the code for a session
          const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

          if (exchangeError) {
            setStatus('error');
            setMessage(exchangeError.message);
            return;
          }

          if (data.user) {
            setStatus('success');
            setMessage('Successfully authenticated! Redirecting to dashboard...');
            
            // Redirect to dashboard after a short delay
            setTimeout(() => {
              router.push('/dashboard');
            }, 2000);
          }
        } else {
          // Check if user is already authenticated
          const { data: { user }, error: userError } = await supabase.auth.getUser();

          if (userError) {
            setStatus('error');
            setMessage(userError.message);
            return;
          }

          if (user) {
            setStatus('success');
            setMessage('Already authenticated! Redirecting to dashboard...');
            
            setTimeout(() => {
              router.push('/dashboard');
            }, 1000);
          } else {
            setStatus('error');
            setMessage('No authentication code found');
          }
        }
      } catch (err) {
        setStatus('error');
        setMessage('An unexpected error occurred during authentication');
        console.error('Auth callback error:', err);
      }
    };

    handleAuthCallback();
  }, [searchParams, router, supabase.auth]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Card>
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              {status === 'loading' && (
                <Loader2 className="h-12 w-12 text-blue-600 animate-spin" />
              )}
              {status === 'success' && (
                <CheckCircle className="h-12 w-12 text-green-600" />
              )}
              {status === 'error' && (
                <XCircle className="h-12 w-12 text-red-600" />
              )}
            </div>
            <CardTitle>
              {status === 'loading' && 'Authenticating...'}
              {status === 'success' && 'Authentication Successful!'}
              {status === 'error' && 'Authentication Failed'}
            </CardTitle>
            <CardDescription>
              {message}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {status === 'loading' && (
              <div className="text-center">
                <p className="text-sm text-gray-600">
                  Please wait while we complete your authentication...
                </p>
              </div>
            )}

            {status === 'success' && (
              <div className="text-center space-y-4">
                <p className="text-sm text-gray-600">
                  You will be redirected automatically, or you can click below to continue.
                </p>
                <Button asChild className="w-full">
                  <Link href="/dashboard">
                    Go to Dashboard
                  </Link>
                </Button>
              </div>
            )}

            {status === 'error' && (
              <div className="text-center space-y-4">
                <p className="text-sm text-gray-600">
                  Something went wrong during authentication. Please try again.
                </p>
                <div className="flex flex-col space-y-2">
                  <Button asChild variant="default">
                    <Link href="/auth/login">
                      Try Again
                    </Link>
                  </Button>
                  <Button asChild variant="outline">
                    <Link href="/">
                      Back to Home
                    </Link>
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
