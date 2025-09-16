import { db } from './index';
import { boardMembers, type BoardMemberRole } from './schema';
import { eq, and } from 'drizzle-orm';

/**
 * Validate that all required environment variables are present
 */
export function validateDatabaseConfig() {
  const requiredEnvVars = [
    'DATABASE_URL',
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
  ];

  const missingVars = requiredEnvVars.filter(
    (varName) => !process.env[varName]
  );

  if (missingVars.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missingVars.join(', ')}\n` +
      'Please check your .env.local file and ensure all variables are set.'
    );
  }
}

/**
 * Check if a user has access to a board with the specified role
 */
export async function checkBoardAccess(
  userId: string,
  boardId: number,
  requiredRole?: BoardMemberRole
): Promise<boolean> {
  try {
    const membership = await db
      .select()
      .from(boardMembers)
      .where(
        and(
          eq(boardMembers.userId, userId),
          eq(boardMembers.boardId, boardId)
        )
      )
      .limit(1);

    if (membership.length === 0) {
      return false;
    }

    if (!requiredRole) {
      return true;
    }

    const userRole = membership[0]?.role;
    
    // Role hierarchy: owner > admin > member > viewer
    const roleHierarchy: Record<BoardMemberRole, number> = {
      owner: 4,
      admin: 3,
      member: 2,
      viewer: 1,
    };

    return roleHierarchy[userRole] >= roleHierarchy[requiredRole];
  } catch (error) {
    console.error('Error checking board access:', error);
    return false;
  }
}

/**
 * Get the next position for a new item in a list
 */
export async function getNextPosition(
  table: any,
  whereCondition: any
): Promise<number> {
  try {
    const result = await db
      .select({ maxPosition: table.position })
      .from(table)
      .where(whereCondition)
      .orderBy(table.position)
      .limit(1);

    return (result[0]?.maxPosition || 0) + 1;
  } catch (error) {
    console.error('Error getting next position:', error);
    return 1;
  }
}

/**
 * Test database connection
 */
export async function testDatabaseConnection(): Promise<boolean> {
  try {
    await db.execute('SELECT 1');
    return true;
  } catch (error) {
    console.error('Database connection test failed:', error);
    return false;
  }
}
