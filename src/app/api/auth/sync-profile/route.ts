import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { syncUserProfile } from '@/lib/profile-sync';

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient();
    
    // Get the current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Sync the user profile
    await syncUserProfile(user);

    return NextResponse.json(
      { message: 'Profile synced successfully' },
      { status: 200 }
    );
  } catch (error) {
    console.error('Profile sync error:', error);
    return NextResponse.json(
      { error: 'Failed to sync profile' },
      { status: 500 }
    );
  }
}
