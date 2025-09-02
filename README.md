# Aviam Kanban Board

A modern, full-stack Kanban board application built with Next.js 14, TypeScript, Supabase, and Drizzle ORM. Features real-time collaboration, drag-and-drop functionality, and comprehensive project management capabilities.

## 🚀 Features

### Core Functionality
- **Drag & Drop Interface**: Intuitive card movement between columns using @dnd-kit
- **Real-time Collaboration**: Live updates across multiple users with Supabase Realtime
- **Authentication**: Secure user authentication with Supabase Auth (email/password + magic links)
- **Row Level Security**: Database-level security ensuring users only access authorized data

### Board Management
- **Multiple Boards**: Create and manage multiple Kanban boards
- **Board Permissions**: Owner, Admin, Member, and Viewer roles with granular permissions
- **Board Sharing**: Invite team members with specific access levels

### Card Features
- **Rich Card Details**: Title, description, assignee, due dates, and labels
- **Card Comments**: Threaded discussions on cards
- **Label System**: Color-coded labels for categorization
- **Due Date Tracking**: Visual indicators for overdue and upcoming deadlines
- **Card Filtering**: Filter by assignee, labels, and due date status

### User Experience
- **Responsive Design**: Works seamlessly on desktop, tablet, and mobile
- **Dark/Light Mode**: Adaptive UI with system preference detection
- **Loading States**: Skeleton loaders for smooth user experience
- **Error Handling**: Comprehensive error handling with user-friendly messages
- **Empty States**: Helpful guidance when boards or columns are empty

## 🛠 Tech Stack

### Frontend
- **Next.js 14**: React framework with App Router
- **TypeScript**: Type-safe development
- **Tailwind CSS**: Utility-first CSS framework
- **shadcn/ui**: Modern UI component library
- **@dnd-kit**: Drag and drop functionality
- **date-fns**: Date manipulation and formatting

### Backend
- **Supabase**: Backend-as-a-Service platform
- **PostgreSQL**: Robust relational database
- **Drizzle ORM**: Type-safe database operations
- **Row Level Security**: Database-level access control
- **Realtime**: Live data synchronization

### Development Tools
- **ESLint**: Code linting
- **Prettier**: Code formatting
- **TypeScript**: Static type checking
- **Git**: Version control

## 📋 Prerequisites

Before running this application, make sure you have:

- **Node.js** (v18 or higher)
- **pnpm** (recommended) or npm
- **Supabase Account** (free tier available)
- **Git** for version control

## 🚀 Quick Start

### 1. Clone the Repository

```bash
git clone git@github.com:weiss-aviam/aviam-kanban.git
cd aviam-kanban/kanban-app
```

### 2. Install Dependencies

```bash
pnpm install
```

### 3. Set Up Supabase

1. Create a new project at [supabase.com](https://supabase.com)
2. Go to Settings > API to get your project URL and anon key
3. Go to Settings > Database to get your database URL

### 4. Environment Configuration

Create a `.env.local` file in the root directory:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# Database Configuration
DATABASE_URL=your_supabase_database_url

# Application Configuration (optional)
APP_URL=http://localhost:3000
```

### 5. Database Setup

```bash
# Generate and apply database migrations
pnpm run db:push

# Seed the database with demo data (optional)
pnpm run db:seed
```

### 6. Configure Row Level Security

Execute the SQL scripts in the Supabase SQL editor:

1. Run `src/db/rls/01_enable_rls.sql` to enable RLS
2. Run `src/db/rls/02_create_policies.sql` to create security policies
3. Run `src/db/rls/03_enable_realtime.sql` to enable real-time features

### 7. Start Development Server

```bash
pnpm run dev
```

Visit [http://localhost:3000](http://localhost:3000) to see the application.

## 📁 Project Structure

```
kanban-app/
├── src/
│   ├── app/                    # Next.js App Router pages
│   │   ├── auth/              # Authentication pages
│   │   ├── boards/            # Board-specific pages
│   │   ├── dashboard/         # Dashboard page
│   │   └── api/               # API routes
│   ├── components/            # React components
│   │   ├── ui/                # Base UI components
│   │   └── kanban/            # Kanban-specific components
│   ├── db/                    # Database configuration
│   │   ├── schema/            # Database schema definitions
│   │   ├── migrations/        # Database migrations
│   │   └── rls/               # Row Level Security scripts
│   ├── lib/                   # Utility functions
│   ├── hooks/                 # Custom React hooks
│   └── types/                 # TypeScript type definitions
├── public/                    # Static assets
└── docs/                      # Documentation
```

## 🔧 Available Scripts

```bash
# Development
pnpm run dev          # Start development server
pnpm run build        # Build for production
pnpm run start        # Start production server
pnpm run lint         # Run ESLint

# Database
pnpm run db:generate  # Generate new migrations
pnpm run db:push      # Apply migrations to database
pnpm run db:seed      # Seed database with demo data
pnpm run db:reset     # Reset database (development only)

# Type checking
pnpm run type-check   # Run TypeScript compiler
```

## 🔐 Authentication & Security

### Authentication Methods
- **Email/Password**: Traditional authentication
- **Magic Links**: Passwordless authentication via email
- **Social Providers**: Ready for Google, GitHub, etc. (configuration required)

### Security Features
- **Row Level Security**: Database-level access control
- **JWT Tokens**: Secure session management
- **CSRF Protection**: Built-in Next.js protection
- **Input Validation**: Server-side validation with Zod
- **Rate Limiting**: API endpoint protection

## 🎨 Customization

### Styling
- Modify `tailwind.config.js` for theme customization
- Update `src/components/ui/` for component styling
- Add custom CSS in `src/app/globals.css`

### Database Schema
- Modify schemas in `src/db/schema/`
- Generate migrations with `pnpm run db:generate`
- Apply changes with `pnpm run db:push`

### API Endpoints
- Add new routes in `src/app/api/`
- Follow existing patterns for consistency
- Include proper error handling and validation

## 🚀 Deployment

### Vercel (Recommended)

1. Push your code to GitHub
2. Connect your repository to Vercel
3. Add environment variables in Vercel dashboard
4. Deploy automatically on push

### Other Platforms

The application can be deployed on any platform supporting Next.js:
- Netlify
- Railway
- DigitalOcean App Platform
- AWS Amplify

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

- **Documentation**: Check the `/docs` folder for detailed guides
- **Issues**: Report bugs via GitHub Issues
- **Discussions**: Use GitHub Discussions for questions

## 🙏 Acknowledgments

- [Next.js](https://nextjs.org/) for the amazing React framework
- [Supabase](https://supabase.com/) for the backend infrastructure
- [shadcn/ui](https://ui.shadcn.com/) for the beautiful UI components
- [Drizzle ORM](https://orm.drizzle.team/) for type-safe database operations
- [@dnd-kit](https://dndkit.com/) for drag and drop functionality

---

Built with ❤️ by the Aviam team
