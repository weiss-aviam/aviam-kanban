import { createClient } from '@/lib/supabase/client';
import { createClient as createServerClient } from '@/lib/supabase/server';
import type { User } from '@supabase/supabase-js';

export interface AuthUser extends User {
  // Add any additional user properties here
}

/**
 * Client-side authentication utilities
 */
export const auth = {
  /**
   * Sign in with email and magic link
   */
  async signInWithEmail(email: string, redirectTo?: string) {
    const supabase = createClient();
    
    const { data, error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: redirectTo || `${window.location.origin}/auth/callback`,
      },
    });

    return { data, error };
  },

  /**
   * Sign in with email and password
   */
  async signInWithPassword(email: string, password: string) {
    const supabase = createClient();
    
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    return { data, error };
  },

  /**
   * Sign up with email and password
   */
  async signUp(email: string, password: string, options?: { name?: string }) {
    const supabase = createClient();
    
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
        data: {
          name: options?.name,
        },
      },
    });

    return { data, error };
  },

  /**
   * Sign out
   */
  async signOut() {
    const supabase = createClient();
    
    const { error } = await supabase.auth.signOut();
    
    if (!error) {
      // Redirect to home page after sign out
      window.location.href = '/';
    }

    return { error };
  },

  /**
   * Get current user (client-side)
   */
  async getUser(): Promise<{ user: AuthUser | null; error: any }> {
    const supabase = createClient();
    
    const { data, error } = await supabase.auth.getUser();
    
    return { user: data.user as AuthUser | null, error };
  },

  /**
   * Get current session (client-side)
   */
  async getSession() {
    const supabase = createClient();
    
    const { data, error } = await supabase.auth.getSession();
    
    return { session: data.session, error };
  },

  /**
   * Listen to auth state changes
   */
  onAuthStateChange(callback: (event: string, session: any) => void) {
    const supabase = createClient();
    
    return supabase.auth.onAuthStateChange(callback);
  },
};

/**
 * Server-side authentication utilities
 */
export const serverAuth = {
  /**
   * Get current user (server-side)
   */
  async getUser(): Promise<{ user: AuthUser | null; error: any }> {
    const supabase = createServerClient();
    
    const { data, error } = await supabase.auth.getUser();
    
    return { user: data.user as AuthUser | null, error };
  },

  /**
   * Get current session (server-side)
   */
  async getSession() {
    const supabase = createServerClient();
    
    const { data, error } = await supabase.auth.getSession();
    
    return { session: data.session, error };
  },
};

/**
 * Check if user is authenticated (server-side)
 */
export async function requireAuth(): Promise<AuthUser> {
  const { user, error } = await serverAuth.getUser();
  
  if (error || !user) {
    throw new Error('Authentication required');
  }
  
  return user;
}

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate password strength
 */
export function validatePassword(password: string): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  
  if (password.length < 8) {
    errors.push('Password must be at least 8 characters long');
  }
  
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }
  
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }
  
  if (!/\d/.test(password)) {
    errors.push('Password must contain at least one number');
  }
  
  return {
    isValid: errors.length === 0,
    errors,
  };
}
