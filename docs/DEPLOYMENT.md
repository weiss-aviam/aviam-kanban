# Deployment Guide

This guide covers deploying the Aviam Kanban application to various platforms.

## Prerequisites

Before deploying, ensure you have:

1. **Supabase Project**: Set up and configured with RLS policies
2. **Environment Variables**: All required variables configured
3. **Database**: Migrations applied and seeded (if desired)
4. **Build Success**: Application builds without errors locally

## Vercel Deployment (Recommended)

Vercel provides the best experience for Next.js applications.

### 1. Prepare Repository

```bash
# Ensure your code is pushed to GitHub
git add .
git commit -m "feat: complete kanban application"
git push origin main
```

### 2. Connect to Vercel

1. Visit [vercel.com](https://vercel.com) and sign in
2. Click "New Project"
3. Import your GitHub repository
4. Select the `kanban-app` folder as the root directory

### 3. Configure Environment Variables

In the Vercel dashboard, add these environment variables:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
DATABASE_URL=your_supabase_database_url
APP_URL=https://your-vercel-domain.vercel.app
```

### 4. Deploy

1. Click "Deploy"
2. Wait for the build to complete
3. Visit your deployed application

### 5. Custom Domain (Optional)

1. Go to Project Settings > Domains
2. Add your custom domain
3. Configure DNS records as instructed

## Netlify Deployment

### 1. Build Configuration

Create `netlify.toml` in the project root:

```toml
[build]
  command = "cd kanban-app && npm run build"
  publish = "kanban-app/.next"

[build.environment]
  NODE_VERSION = "18"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

### 2. Deploy

1. Connect your GitHub repository to Netlify
2. Set build command: `cd kanban-app && npm run build`
3. Set publish directory: `kanban-app/.next`
4. Add environment variables in Netlify dashboard
5. Deploy

## Railway Deployment

### 1. Railway Configuration

Create `railway.toml`:

```toml
[build]
  builder = "nixpacks"
  buildCommand = "cd kanban-app && npm run build"

[deploy]
  startCommand = "cd kanban-app && npm start"
```

### 2. Deploy

1. Connect repository to Railway
2. Add environment variables
3. Deploy automatically

## Docker Deployment

### 1. Create Dockerfile

```dockerfile
FROM node:18-alpine AS base

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Install dependencies based on the preferred package manager
COPY kanban-app/package.json kanban-app/pnpm-lock.yaml* ./
RUN npm install -g pnpm && pnpm install --frozen-lockfile

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY kanban-app/ .

# Environment variables must be present at build time
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NEXT_PUBLIC_SUPABASE_URL=${NEXT_PUBLIC_SUPABASE_URL}
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=${NEXT_PUBLIC_SUPABASE_ANON_KEY}

RUN npm install -g pnpm && pnpm run build

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

ENV NODE_ENV production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public

# Set the correct permission for prerender cache
RUN mkdir .next
RUN chown nextjs:nodejs .next

# Automatically leverage output traces to reduce image size
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

ENV PORT 3000
ENV HOSTNAME "0.0.0.0"

CMD ["node", "server.js"]
```

### 2. Build and Run

```bash
# Build image
docker build -t aviam-kanban .

# Run container
docker run -p 3000:3000 \
  -e NEXT_PUBLIC_SUPABASE_URL=your_url \
  -e NEXT_PUBLIC_SUPABASE_ANON_KEY=your_key \
  -e SUPABASE_SERVICE_ROLE_KEY=your_service_key \
  -e DATABASE_URL=your_db_url \
  aviam-kanban
```

## Environment Variables

### Required Variables

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Database
DATABASE_URL=postgresql://postgres:password@db.your-project.supabase.co:5432/postgres
```

### Optional Variables

```env
# Application URL (for redirects)
APP_URL=https://your-domain.com

# Analytics (if using)
NEXT_PUBLIC_GA_ID=your_google_analytics_id

# Error Tracking (if using Sentry)
SENTRY_DSN=your_sentry_dsn
```

## Post-Deployment Checklist

### 1. Database Setup

Ensure your Supabase database is properly configured:

```sql
-- Check if RLS is enabled
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' AND rowsecurity = true;

-- Check if Realtime is enabled
SELECT * FROM pg_publication_tables WHERE pubname = 'supabase_realtime';
```

### 2. Authentication Configuration

In Supabase Dashboard > Authentication > Settings:

1. **Site URL**: Set to your deployed domain
2. **Redirect URLs**: Add your domain to allowed redirects
3. **Email Templates**: Customize if needed

### 3. Security Headers

Add security headers in your deployment platform:

```
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=()
```

### 4. Performance Optimization

1. **Enable Compression**: Gzip/Brotli compression
2. **CDN**: Use Vercel's Edge Network or Cloudflare
3. **Caching**: Configure appropriate cache headers
4. **Image Optimization**: Ensure Next.js image optimization works

### 5. Monitoring

Set up monitoring for:

1. **Uptime**: Use services like UptimeRobot
2. **Performance**: Web Vitals monitoring
3. **Errors**: Error tracking with Sentry
4. **Analytics**: User behavior tracking

## Troubleshooting

### Common Issues

1. **Build Failures**
   - Check Node.js version compatibility
   - Verify all dependencies are installed
   - Check for TypeScript errors

2. **Environment Variables**
   - Ensure all required variables are set
   - Check for typos in variable names
   - Verify Supabase URLs and keys

3. **Database Connection**
   - Test database connectivity
   - Check RLS policies
   - Verify user permissions

4. **Authentication Issues**
   - Check redirect URLs in Supabase
   - Verify JWT configuration
   - Test auth flow manually

### Performance Issues

1. **Slow Loading**
   - Enable compression
   - Optimize images
   - Use CDN for static assets

2. **Database Performance**
   - Add database indexes
   - Optimize queries
   - Use connection pooling

### Security Considerations

1. **Environment Variables**: Never commit secrets to version control
2. **HTTPS**: Always use HTTPS in production
3. **CORS**: Configure appropriate CORS policies
4. **Rate Limiting**: Implement API rate limiting
5. **Input Validation**: Validate all user inputs

## Scaling Considerations

### Database Scaling

1. **Connection Pooling**: Use Supabase connection pooling
2. **Read Replicas**: Consider read replicas for high traffic
3. **Indexing**: Add indexes for frequently queried columns

### Application Scaling

1. **Serverless**: Leverage serverless functions for API routes
2. **Edge Computing**: Use edge functions for global performance
3. **Caching**: Implement Redis caching for frequently accessed data

### Monitoring and Alerts

Set up alerts for:
- High error rates
- Slow response times
- Database connection issues
- High memory/CPU usage

## Backup and Recovery

1. **Database Backups**: Supabase provides automatic backups
2. **Code Backups**: Use Git for version control
3. **Environment Backups**: Document all configurations
4. **Recovery Testing**: Regularly test backup restoration
