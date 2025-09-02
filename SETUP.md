# Aviam Kanban Setup Guide

This guide will help you set up the Aviam Kanban application from scratch.

## 🚀 Quick Setup

### 1. Prerequisites

- Node.js 18+ installed
- pnpm installed (`npm install -g pnpm`)
- A Supabase account (free tier available)

### 2. Clone and Install

```bash
# Navigate to the kanban app directory
cd kanban-app

# Install dependencies
pnpm install
```

### 3. Set Up Supabase Project

1. **Create a new Supabase project:**
   - Go to [supabase.com](https://supabase.com)
   - Click "New Project"
   - Choose your organization
   - Enter project name: "aviam-kanban"
   - Enter a secure database password
   - Select a region close to your users
   - Click "Create new project"

2. **Get your project credentials:**
   - Go to Settings > API
   - Copy the Project URL
   - Copy the `anon` `public` key
   - Copy the `service_role` `secret` key (keep this secure!)

3. **Get your database URL:**
   - Go to Settings > Database
   - Copy the Connection string (URI format)
   - Replace `[YOUR-PASSWORD]` with your database password

### 4. Configure Environment Variables

Create a `.env.local` file in the `kanban-app` directory:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here

# Database Configuration
DATABASE_URL=postgresql://postgres:[YOUR-PASSWORD]@db.your-project-id.supabase.co:5432/postgres

# Application Configuration (optional)
APP_URL=http://localhost:3000
```

### 5. Set Up Database Schema

Run the database migrations to create all necessary tables:

```bash
# Push the schema to your Supabase database
pnpm run db:push
```

### 6. Configure Row Level Security (RLS)

In your Supabase dashboard, go to the SQL Editor and run these scripts in order:

1. **Enable RLS on all tables:**
   ```sql
   -- Copy and paste the contents of src/db/rls/01_enable_rls.sql
   ```

2. **Create security policies:**
   ```sql
   -- Copy and paste the contents of src/db/rls/02_create_policies.sql
   ```

3. **Enable Realtime:**
   ```sql
   -- Copy and paste the contents of src/db/rls/03_enable_realtime.sql
   ```

### 7. Configure Authentication

In your Supabase dashboard:

1. Go to Authentication > Settings
2. Set **Site URL** to: `http://localhost:3000` (for development)
3. Add **Redirect URLs**:
   - `http://localhost:3000/auth/callback`
   - `http://localhost:3000/dashboard`
4. Configure **Email Templates** if desired
5. Enable **Email confirmations** (recommended)

### 8. Seed Demo Data (Optional)

Add some demo data to test the application:

```bash
pnpm run db:seed
```

### 9. Start Development Server

```bash
pnpm run dev
```

Visit [http://localhost:3000](http://localhost:3000) to see your Kanban board!

## 🔧 Troubleshooting

### Database Connection Issues

If you see `ENOTFOUND` errors:

1. **Check your DATABASE_URL:**
   - Ensure the URL is correct
   - Verify your password is properly encoded
   - Make sure there are no extra spaces

2. **Verify Supabase project status:**
   - Check if your project is active in the Supabase dashboard
   - Ensure you're using the correct region

3. **Test connection:**
   ```bash
   # Test if you can connect to the database
   psql "postgresql://postgres:[YOUR-PASSWORD]@db.your-project-id.supabase.co:5432/postgres"
   ```

### Authentication Issues

If authentication isn't working:

1. **Check environment variables:**
   - Verify `NEXT_PUBLIC_SUPABASE_URL` is correct
   - Verify `NEXT_PUBLIC_SUPABASE_ANON_KEY` is correct
   - Restart your development server after changing env vars

2. **Check Supabase Auth settings:**
   - Verify Site URL is set correctly
   - Check redirect URLs are configured
   - Ensure email confirmations are working

### RLS Policy Issues

If you can't access data after authentication:

1. **Verify RLS is enabled:**
   ```sql
   SELECT schemaname, tablename, rowsecurity 
   FROM pg_tables 
   WHERE schemaname = 'public' AND rowsecurity = true;
   ```

2. **Check policies exist:**
   ```sql
   SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
   FROM pg_policies 
   WHERE schemaname = 'public';
   ```

3. **Test policies manually:**
   - Try creating a board through the UI
   - Check the browser console for errors
   - Verify the user is properly authenticated

## 🚀 Production Deployment

### Vercel Deployment

1. **Push to GitHub:**
   ```bash
   git add .
   git commit -m "Initial commit"
   git push origin main
   ```

2. **Deploy to Vercel:**
   - Connect your GitHub repository to Vercel
   - Set the root directory to `kanban-app`
   - Add all environment variables
   - Deploy

3. **Update Supabase settings:**
   - Add your production URL to Site URL
   - Add production redirect URLs
   - Update CORS settings if needed

### Environment Variables for Production

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
DATABASE_URL=your-database-url
APP_URL=https://your-domain.vercel.app
```

## 📚 Additional Resources

- [Supabase Documentation](https://supabase.com/docs)
- [Next.js Documentation](https://nextjs.org/docs)
- [Drizzle ORM Documentation](https://orm.drizzle.team)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)

## 🆘 Getting Help

If you encounter issues:

1. Check the browser console for errors
2. Check the Supabase logs in your dashboard
3. Verify all environment variables are set correctly
4. Ensure your Supabase project is active and properly configured

## 🎉 Success!

Once everything is set up, you should be able to:

- ✅ Visit the landing page at `/`
- ✅ Sign up for a new account at `/auth/signup`
- ✅ Sign in at `/auth/login`
- ✅ Access the dashboard at `/dashboard`
- ✅ Create and manage Kanban boards
- ✅ Add cards, move them around, and collaborate in real-time

Enjoy your new Kanban board application! 🎊
