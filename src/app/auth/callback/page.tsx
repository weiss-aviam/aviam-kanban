import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { syncUserProfile } from '@/lib/profile-sync';

export default async function AuthCallbackPage({
  searchParams,
}: {
  searchParams: { code?: string; error?: string; error_description?: string };
}) {
  const { code, error, error_description } = searchParams;

  if (error) {
    console.error('Auth callback error:', error, error_description);
    redirect(`/auth/login?error=${encodeURIComponent(error_description || error)}`);
  }

  if (code) {
    const supabase = createClient();

    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

    if (exchangeError) {
      console.error('Code exchange error:', exchangeError);
      redirect(`/auth/login?error=${encodeURIComponent(exchangeError.message)}`);
    }

    // Get the user after successful authentication
    const { data: { user } } = await supabase.auth.getUser();

    if (user) {
      try {
        // Sync user profile to database
        await syncUserProfile(user);
      } catch (syncError) {
        console.error('Profile sync error:', syncError);
        // Don't fail the auth flow, just log the error
      }
    }
  }

  // Successful authentication - redirect to dashboard
  redirect('/dashboard');
}
