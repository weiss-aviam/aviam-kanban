import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient, requireAdminAccess } from '@/lib/supabase/admin';
import { auditLogFiltersSchema } from '@/lib/validations/admin';

/**
 * GET /api/admin/audit-logs - Get audit logs for admin actions
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

    // Validate filter parameters
    const filtersResult = auditLogFiltersSchema.safeParse({
      page: searchParams.get('page'),
      limit: searchParams.get('limit'),
      action: searchParams.get('action'),
      targetUserId: searchParams.get('targetUserId'),
      startDate: searchParams.get('startDate'),
      endDate: searchParams.get('endDate'),
    });

    if (!filtersResult.success) {
      return NextResponse.json(
        { error: 'Invalid filter parameters', details: filtersResult.error.issues },
        { status: 400 }
      );
    }

    const { page, limit, action, targetUserId, startDate, endDate } = filtersResult.data;

    // Check admin permissions
    const adminContext = await requireAdminAccess(user.id, boardId);

    const adminClient = createAdminClient();

    // Build query for audit logs
    let query = adminClient
      .from('admin_audit_log')
      .select(`
        id,
        action,
        details,
        ip_address,
        user_agent,
        created_at,
        admin_users:admin_user_id (
          id,
          email,
          name
        ),
        target_users:target_user_id (
          id,
          email,
          name
        )
      `)
      .eq('board_id', boardId);

    // Apply filters
    if (action) {
      query = query.eq('action', action);
    }

    if (targetUserId) {
      query = query.eq('target_user_id', targetUserId);
    }

    if (startDate) {
      query = query.gte('created_at', startDate);
    }

    if (endDate) {
      query = query.lte('created_at', endDate);
    }

    // Apply sorting (most recent first)
    query = query.order('created_at', { ascending: false });

    // Apply pagination
    const offset = (page - 1) * limit;
    query = query.range(offset, offset + limit - 1);

    const { data: auditLogs, error: logsError } = await query;

    if (logsError) {
      console.error('Error fetching audit logs:', logsError);
      return NextResponse.json({ error: 'Failed to fetch audit logs' }, { status: 500 });
    }

    // Get total count for pagination
    let countQuery = adminClient
      .from('admin_audit_log')
      .select('*', { count: 'exact', head: true })
      .eq('board_id', boardId);

    // Apply same filters to count query
    if (action) {
      countQuery = countQuery.eq('action', action);
    }
    if (targetUserId) {
      countQuery = countQuery.eq('target_user_id', targetUserId);
    }
    if (startDate) {
      countQuery = countQuery.gte('created_at', startDate);
    }
    if (endDate) {
      countQuery = countQuery.lte('created_at', endDate);
    }

    const { count, error: countError } = await countQuery;

    if (countError) {
      console.error('Error counting audit logs:', countError);
      return NextResponse.json({ error: 'Failed to count audit logs' }, { status: 500 });
    }

    // Transform the response
    const logs = auditLogs.map((log: any) => ({
      id: log.id,
      action: log.action,
      details: log.details ? JSON.parse(log.details) : null,
      ipAddress: log.ip_address,
      userAgent: log.user_agent,
      createdAt: log.created_at,
      adminUser: log.admin_users ? {
        id: log.admin_users.id,
        email: log.admin_users.email,
        name: log.admin_users.name,
      } : null,
      targetUser: log.target_users ? {
        id: log.target_users.id,
        email: log.target_users.email,
        name: log.target_users.name,
      } : null,
    }));

    const totalPages = Math.ceil((count || 0) / limit);

    // Get action summary for the current filters
    const { data: actionSummary } = await adminClient
      .from('admin_audit_log')
      .select('action')
      .eq('board_id', boardId);

    const actionCounts = actionSummary?.reduce((acc: any, log: any) => {
      acc[log.action] = (acc[log.action] || 0) + 1;
      return acc;
    }, {}) || {};

    return NextResponse.json({
      auditLogs: logs,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
      summary: {
        totalActions: count || 0,
        actionCounts,
        dateRange: {
          startDate,
          endDate,
        },
      },
    });

  } catch (error) {
    console.error('Error in GET /api/admin/audit-logs:', error);
    
    if (error instanceof Error && error.message === 'Admin access required') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }
    
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
