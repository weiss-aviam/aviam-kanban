# Admin User Management System

## Overview

The admin user management system has been moved from a modal-based interface to a dedicated full-page admin panel. This provides much more space and better functionality for managing board users and invitations.

## Access

### URL

- **Admin Panel**: `/admin/users?boardId={boardId}`
- **From Board**: Click "Manage Users" button in board header (only visible to admins/owners)

### Permissions

- Only board **owners** and **admins** can access the admin panel
- Route protection is enforced at middleware level
- Automatic redirection if user lacks permissions

## Features

### 1. User Management Tab

- **View all board users** with pagination, search, and filtering
- **Edit user roles** (admin/member/viewer)
- **Remove users** from the board
- **Reset user passwords** (admin action)
- **Sort and filter** by role, name, email, join date

### 2. Invite Users Tab

- **Single user invitation** with role selection
- **Bulk user invitations** (up to 50 at once)
- **Pending invitations list** with status tracking
- **Resend invitations** for expired/failed invites
- **Cancel pending invitations**

### 3. Memberships Tab

- **Overview of all board members** and their roles
- **Role distribution summary**
- **Membership activity tracking**
- **Bulk role updates**

### 4. Audit Log Tab

- **Complete audit trail** of all admin actions
- **Filter by action type**, user, date range
- **Export audit logs** for compliance
- **Real-time activity monitoring**

## Database Schema

### User Invitations Table

```sql
CREATE TABLE user_invitations (
  id UUID PRIMARY KEY,
  board_id UUID REFERENCES boards(id),
  email VARCHAR(255) NOT NULL,
  role VARCHAR(20) CHECK (role IN ('admin', 'member', 'viewer')),
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired', 'cancelled')),
  token VARCHAR(255) UNIQUE NOT NULL,
  invited_by UUID REFERENCES users(id),
  invited_at TIMESTAMP DEFAULT NOW(),
  accepted_at TIMESTAMP,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### User Login Activity Table

```sql
CREATE TABLE user_login_activity (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  login_at TIMESTAMP DEFAULT NOW(),
  ip_address INET,
  user_agent TEXT,
  login_method VARCHAR(50)
);
```

## API Endpoints

### Invitations Management

- `GET /api/admin/invitations?boardId={id}` - List all invitations
- `DELETE /api/admin/invitations?id={id}&boardId={id}` - Cancel invitation
- `PATCH /api/admin/invitations` - Resend invitation

### User Management (existing)

- `GET /api/admin/users?boardId={id}` - List board users
- `POST /api/admin/users` - Invite new user
- `PATCH /api/admin/users/{id}` - Update user
- `DELETE /api/admin/users/{id}` - Remove user

### Memberships (existing)

- `GET /api/admin/memberships?boardId={id}` - List memberships
- `PATCH /api/admin/memberships` - Update roles

### Audit Logs (existing)

- `GET /api/admin/audit-logs?boardId={id}` - List audit entries

## Security Features

### Row Level Security (RLS)

- All tables have RLS policies enabled
- Users can only access data for boards they're members of
- Admin actions require proper role verification

### Input Validation

- Comprehensive Zod schemas for all inputs
- Email validation and sanitization
- Role validation and permission checks
- Rate limiting on invitation endpoints

### Audit Trail

- All admin actions are logged with:
  - Action type and timestamp
  - Performing user and target user
  - IP address and user agent
  - Detailed action context

## User Experience Improvements

### From Modal to Full Page

- **Much wider interface** (95% viewport width vs cramped modal)
- **Better organization** with clear tab structure
- **More breathing room** with improved spacing
- **Better mobile experience** with responsive design
- **No more "Invalid pagination parameters"** errors

### Enhanced Invitation Tracking

- **Real-time status updates** (pending/accepted/expired)
- **Login activity tracking** to see if invited users are active
- **Invitation management** with resend/cancel options
- **Expiry date tracking** with automatic status updates

### Improved Navigation

- **Direct access** via `/admin/users` URL
- **Breadcrumb navigation** back to board
- **Clear role indicators** in header
- **Contextual actions** based on user permissions

## Migration Notes

### Removed Components

- `UserManagementModal.tsx` - Replaced with full page
- Modal-based user management hooks
- Cramped modal interface

### Updated Components

- `BoardDetailPage.tsx` - Now redirects to admin page instead of opening modal
- Navigation updated to use router.push() instead of modal state

### Database Changes

- Added `user_invitations` table for proper invitation tracking
- Added `user_login_activity` table for login status monitoring
- Enhanced audit logging with more detailed context

## Future Enhancements

### Planned Features

- **Email templates** for invitation customization
- **Bulk user import** from CSV files
- **Advanced user analytics** and activity reports
- **Integration with external user directories**
- **Automated user provisioning** workflows

### Performance Optimizations

- **Pagination improvements** for large user lists
- **Search indexing** for faster user lookups
- **Caching strategies** for frequently accessed data
- **Background job processing** for bulk operations

## Troubleshooting

### Common Issues

1. **"Invalid pagination parameters"** - Fixed with proper role enum validation
2. **Modal too small** - Resolved by moving to full-page interface
3. **Authentication errors** - Check user permissions and board membership
4. **Missing invitations** - Verify database schema is properly migrated

### Debug Steps

1. Check browser console for API errors
2. Verify user has admin/owner role on board
3. Confirm database tables exist and have proper RLS policies
4. Check middleware logs for route protection issues
