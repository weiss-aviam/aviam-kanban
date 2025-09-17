import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient, requireAdminAccess, logAdminAction, getClientIP, getUserAgent } from '@/lib/supabase/admin';

/**
 * GET /api/admin/invitations - Get all invitations for a board
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const boardId = searchParams.get('boardId');

    if (!boardId) {
      return NextResponse.json({ error: 'Board ID is required' }, { status: 400 });
    }

    // Check admin permissions
    const adminContext = await requireAdminAccess(user.id, boardId);

    const adminClient = createAdminClient();

    // Get all invitations for the board
    const { data: invitations, error: invitationsError } = await adminClient
      .from('user_invitations')
      .select(`
        id,
        email,
        role,
        status,
        invited_at,
        accepted_at,
        expires_at,
        invited_by,
        token,
        users!invited_by(name, email)
      `)
      .eq('board_id', boardId)
      .order('invited_at', { ascending: false });

    if (invitationsError) {
      console.error('Error fetching invitations:', invitationsError);
      return NextResponse.json({ error: 'Failed to fetch invitations' }, { status: 500 });
    }

    // Transform the data
    const transformedInvitations = invitations?.map(invitation => ({
      id: invitation.id,
      board_id: boardId, // Use the boardId from the request
      email: invitation.email,
      role: invitation.role,
      status: invitation.status,
      invited_at: invitation.invited_at,
      accepted_at: invitation.accepted_at,
      expires_at: invitation.expires_at,
      invited_by: 'Unknown', // Simplified for now to avoid type issues
    })) || [];

    return NextResponse.json({
      invitations: transformedInvitations,
      summary: {
        total: transformedInvitations.length,
        pending: transformedInvitations.filter(i => i.status === 'pending').length,
        accepted: transformedInvitations.filter(i => i.status === 'accepted').length,
        expired: transformedInvitations.filter(i => i.status === 'expired').length,
      }
    });

  } catch (error) {
    console.error('Error in GET /api/admin/invitations:', error);
    
    if (error instanceof Error && error.message === 'Admin access required') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }
    
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/invitations - Cancel/delete an invitation
 */
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const invitationId = searchParams.get('id');
    const boardId = searchParams.get('boardId');

    if (!invitationId || !boardId) {
      return NextResponse.json({ error: 'Invitation ID and Board ID are required' }, { status: 400 });
    }

    // Check admin permissions
    const adminContext = await requireAdminAccess(user.id, boardId);

    const adminClient = createAdminClient();

    // Get invitation details for logging
    const { data: invitation, error: getError } = await adminClient
      .from('user_invitations')
      .select('email, role, status')
      .eq('id', invitationId)
      .eq('board_id', boardId)
      .single();

    if (getError || !invitation) {
      return NextResponse.json({ error: 'Invitation not found' }, { status: 404 });
    }

    // Delete the invitation
    const { error: deleteError } = await adminClient
      .from('user_invitations')
      .delete()
      .eq('id', invitationId)
      .eq('board_id', boardId);

    if (deleteError) {
      console.error('Error deleting invitation:', deleteError);
      return NextResponse.json({ error: 'Failed to delete invitation' }, { status: 500 });
    }

    // Log the action
    await logAdminAction({
      action: 'invitation_cancelled',
      adminUserId: user.id,
      boardId,
      ipAddress: getClientIP(request) || 'unknown',
      userAgent: getUserAgent(request) || 'unknown',
      details: {
        invitationId,
        email: invitation.email,
        role: invitation.role,
        previousStatus: invitation.status,
      },
    });

    return NextResponse.json({ 
      success: true,
      message: 'Invitation cancelled successfully'
    });

  } catch (error) {
    console.error('Error in DELETE /api/admin/invitations:', error);
    
    if (error instanceof Error && error.message === 'Admin access required') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }
    
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * PATCH /api/admin/invitations - Resend an invitation
 */
export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { invitationId, boardId } = body;

    if (!invitationId || !boardId) {
      return NextResponse.json({ error: 'Invitation ID and Board ID are required' }, { status: 400 });
    }

    // Check admin permissions
    const adminContext = await requireAdminAccess(user.id, boardId);

    const adminClient = createAdminClient();

    // Get invitation details
    const { data: invitation, error: getError } = await adminClient
      .from('user_invitations')
      .select('email, role, status')
      .eq('id', invitationId)
      .eq('board_id', boardId)
      .single();

    if (getError || !invitation) {
      return NextResponse.json({ error: 'Invitation not found' }, { status: 404 });
    }

    if (invitation.status === 'accepted') {
      return NextResponse.json({ error: 'Cannot resend accepted invitation' }, { status: 400 });
    }

    // Update invitation with new expiry date
    const newExpiryDate = new Date();
    newExpiryDate.setDate(newExpiryDate.getDate() + 7); // 7 days from now

    const { error: updateError } = await adminClient
      .from('user_invitations')
      .update({
        status: 'pending',
        expires_at: newExpiryDate.toISOString(),
        invited_at: new Date().toISOString(), // Update invited_at to show it was resent
      })
      .eq('id', invitationId)
      .eq('board_id', boardId);

    if (updateError) {
      console.error('Error updating invitation:', updateError);
      return NextResponse.json({ error: 'Failed to resend invitation' }, { status: 500 });
    }

    // Log the action
    await logAdminAction({
      action: 'invitation_resent',
      adminUserId: user.id,
      boardId,
      ipAddress: getClientIP(request) || 'unknown',
      userAgent: getUserAgent(request) || 'unknown',
      details: {
        invitationId,
        email: invitation.email,
        role: invitation.role,
        newExpiryDate: newExpiryDate.toISOString(),
      },
    });

    return NextResponse.json({ 
      success: true,
      message: 'Invitation resent successfully',
      expiresAt: newExpiryDate.toISOString()
    });

  } catch (error) {
    console.error('Error in PATCH /api/admin/invitations:', error);
    
    if (error instanceof Error && error.message === 'Admin access required') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }
    
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
