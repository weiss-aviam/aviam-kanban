'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { auth, isValidEmail } from '@/lib/auth';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const [usePassword, setUsePassword] = useState(false);

  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get('redirectTo') || '/dashboard';

  const handleMagicLinkSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    if (!isValidEmail(email)) {
      setError('Please enter a valid email address');
      setIsLoading(false);
      return;
    }

    try {
      const { error } = await auth.signInWithEmail(email, `${window.location.origin}${redirectTo}`);
      
      if (error) {
        setError(error.message);
      } else {
        setMagicLinkSent(true);
      }
    } catch (err) {
      setError('An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePasswordSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    if (!isValidEmail(email)) {
      setError('Please enter a valid email address');
      setIsLoading(false);
      return;
    }

    if (!password) {
      setError('Please enter your password');
      setIsLoading(false);
      return;
    }

    try {
      const { error } = await auth.signInWithPassword(email, password);
      
      if (error) {
        setError(error.message);
      } else {
        router.push(redirectTo);
      }
    } catch (err) {
      setError('An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  if (magicLinkSent) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle>Check your email</CardTitle>
            <CardDescription>
              We've sent a magic link to {email}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-gray-600 text-center">
              Click the link in your email to sign in to your account.
            </p>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => setMagicLinkSent(false)}
            >
              Back to login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle>Welcome back</CardTitle>
          <CardDescription>
            Sign in to your Kanban account
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={usePassword ? handlePasswordSignIn : handleMagicLinkSignIn} className="space-y-4">
            <div>
              <Input
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={isLoading}
              />
            </div>
            
            {usePassword && (
              <div>
                <Input
                  type="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={isLoading}
                />
              </div>
            )}

            {error && (
              <div className="text-sm text-red-600 text-center">
                {error}
              </div>
            )}

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? 'Signing in...' : usePassword ? 'Sign in' : 'Send magic link'}
            </Button>
          </form>

          <div className="text-center">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setUsePassword(!usePassword)}
              disabled={isLoading}
            >
              {usePassword ? 'Use magic link instead' : 'Use password instead'}
            </Button>
          </div>

          <div className="text-center text-sm text-gray-600">
            Don't have an account?{' '}
            <Link href="/auth/signup" className="text-blue-600 hover:underline">
              Sign up
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
