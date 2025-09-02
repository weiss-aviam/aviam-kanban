'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { syncUserProfile, getUserProfile } from '@/lib/profile-sync';
import type { User } from '@supabase/supabase-js';
import type { User as DatabaseUser } from '@/types/database';

interface AuthState {
  user: User | null;
  profile: DatabaseUser | null;
  loading: boolean;
  error: string | null;
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    user: null,
    profile: null,
    loading: true,
    error: null,
  });

  const supabase = createClient();

  useEffect(() => {
    // Get initial session
    const getInitialSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          setState(prev => ({ ...prev, error: error.message, loading: false }));
          return;
        }

        if (session?.user) {
          await handleUserSession(session.user);
        } else {
          setState(prev => ({ ...prev, loading: false }));
        }
      } catch (err) {
        setState(prev => ({ 
          ...prev, 
          error: 'Failed to get session', 
          loading: false 
        }));
      }
    };

    getInitialSession();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_IN' && session?.user) {
          await handleUserSession(session.user);
        } else if (event === 'SIGNED_OUT') {
          setState({
            user: null,
            profile: null,
            loading: false,
            error: null,
          });
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const handleUserSession = async (user: User) => {
    try {
      setState(prev => ({ ...prev, user, loading: true, error: null }));

      // Sync user profile to database
      await syncUserProfile(user);

      // Get user profile from database
      const profile = await getUserProfile(user.id);

      setState(prev => ({
        ...prev,
        profile,
        loading: false,
      }));
    } catch (error) {
      console.error('Error handling user session:', error);
      setState(prev => ({
        ...prev,
        error: 'Failed to sync user profile',
        loading: false,
      }));
    }
  };

  const signOut = async () => {
    try {
      setState(prev => ({ ...prev, loading: true, error: null }));
      
      const { error } = await supabase.auth.signOut();
      
      if (error) {
        setState(prev => ({ ...prev, error: error.message, loading: false }));
      } else {
        setState({
          user: null,
          profile: null,
          loading: false,
          error: null,
        });
      }
    } catch (err) {
      setState(prev => ({
        ...prev,
        error: 'Failed to sign out',
        loading: false,
      }));
    }
  };

  const refreshProfile = async () => {
    if (!state.user) return;

    try {
      setState(prev => ({ ...prev, loading: true, error: null }));
      
      const profile = await getUserProfile(state.user.id);
      
      setState(prev => ({
        ...prev,
        profile,
        loading: false,
      }));
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: 'Failed to refresh profile',
        loading: false,
      }));
    }
  };

  return {
    ...state,
    signOut,
    refreshProfile,
    isAuthenticated: !!state.user,
  };
}
