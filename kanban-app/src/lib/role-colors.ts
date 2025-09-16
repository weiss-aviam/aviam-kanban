/**
 * Standardized role color scheme for consistent styling across the application
 */

export interface RoleColorScheme {
  background: string;
  text: string;
  border: string;
}

export const ROLE_COLORS: Record<string, RoleColorScheme> = {
  owner: {
    background: 'bg-purple-100',
    text: 'text-purple-800',
    border: 'border-purple-200',
  },
  admin: {
    background: 'bg-blue-100',
    text: 'text-blue-800',
    border: 'border-blue-200',
  },
  member: {
    background: 'bg-green-100',
    text: 'text-green-800',
    border: 'border-green-200',
  },
  viewer: {
    background: 'bg-gray-100',
    text: 'text-gray-800',
    border: 'border-gray-200',
  },
} as const;

/**
 * Get standardized role badge classes
 */
export function getRoleBadgeClasses(role: string): string {
  const colors = ROLE_COLORS[role] || ROLE_COLORS.viewer;
  return `${colors.background} ${colors.text} ${colors.border}`;
}

/**
 * Get capitalized role label
 */
export function getRoleLabel(role: string): string {
  return role.charAt(0).toUpperCase() + role.slice(1);
}

/**
 * Get user avatar background color based on role
 */
export function getUserAvatarColor(role?: string): string {
  switch (role) {
    case 'owner':
      return 'bg-purple-500';
    case 'admin':
      return 'bg-blue-500';
    case 'member':
      return 'bg-green-500';
    case 'viewer':
      return 'bg-gray-500';
    default:
      return 'bg-blue-500'; // Default for users without specific roles
  }
}

/**
 * Get consistent user initials from name or email
 */
export function getUserInitials(name?: string, email?: string): string {
  if (name && name.trim()) {
    const nameParts = name.trim().split(' ');
    if (nameParts.length >= 2) {
      return (nameParts[0].charAt(0) + nameParts[1].charAt(0)).toUpperCase();
    }
    return nameParts[0].charAt(0).toUpperCase();
  }
  
  if (email) {
    return email.charAt(0).toUpperCase();
  }
  
  return '?';
}
