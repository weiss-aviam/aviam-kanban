import Link from 'next/link';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import {
  Kanban,
  Users,
  Zap,
  Shield,
  Smartphone,
  GitBranch,
  ArrowRight,
  Star
} from 'lucide-react';

export default function LandingPage() {
  const features = [
    {
      icon: Kanban,
      title: 'Drag & Drop Interface',
      description: 'Intuitive card movement between columns with smooth animations'
    },
    {
      icon: Users,
      title: 'Real-time Collaboration',
      description: 'Work together with live updates across all team members'
    },
    {
      icon: Zap,
      title: 'Lightning Fast',
      description: 'Built with Next.js 14 and optimized for performance'
    },
    {
      icon: Shield,
      title: 'Secure by Design',
      description: 'Row Level Security ensures data protection and privacy'
    },
    {
      icon: Smartphone,
      title: 'Mobile Responsive',
      description: 'Perfect experience on desktop, tablet, and mobile devices'
    },
    {
      icon: GitBranch,
      title: 'Advanced Features',
      description: 'Comments, labels, due dates, filtering, and much more'
    }
  ];

  const techStack = [
    'Next.js 14', 'TypeScript', 'Supabase', 'Tailwind CSS',
    'Drizzle ORM', 'shadcn/ui', '@dnd-kit', 'Vitest'
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Kanban className="h-8 w-8 text-blue-600" />
            <span className="text-2xl font-bold text-gray-900">Aviam Kanban</span>
          </div>
          <div className="flex items-center space-x-4">
            <Link href="/auth/login">
              <Button variant="ghost">Sign In</Button>
            </Link>
            <Link href="/auth/signup">
              <Button>Get Started</Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-20 text-center">
        <div className="max-w-4xl mx-auto">
          <Badge variant="secondary" className="mb-4">
            <Star className="w-4 h-4 mr-1" />
            Production Ready
          </Badge>
          <h1 className="text-5xl md:text-6xl font-bold text-gray-900 mb-6">
            Modern Kanban Board for
            <span className="text-blue-600"> Agile Teams</span>
          </h1>
          <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
            Streamline your workflow with our powerful, real-time Kanban board.
            Built for modern teams who value collaboration, security, and performance.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/dashboard">
              <Button size="lg" className="text-lg px-8">
                Try Demo
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
            <Link href="https://github.com/weiss-aviam/aviam-kanban">
              <Button variant="outline" size="lg" className="text-lg px-8">
                View on GitHub
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="container mx-auto px-4 py-20">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            Everything you need to manage projects
          </h2>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Powerful features designed to help teams collaborate effectively and deliver results faster.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <Card key={index} className="border-0 shadow-lg hover:shadow-xl transition-shadow">
              <CardHeader>
                <feature.icon className="h-12 w-12 text-blue-600 mb-4" />
                <CardTitle className="text-xl">{feature.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-base">
                  {feature.description}
                </CardDescription>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Tech Stack */}
      <section className="container mx-auto px-4 py-20">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            Built with Modern Technology
          </h2>
          <p className="text-lg text-gray-600">
            Leveraging the best tools and frameworks for optimal performance and developer experience.
          </p>
        </div>

        <div className="flex flex-wrap justify-center gap-4">
          {techStack.map((tech, index) => (
            <Badge key={index} variant="secondary" className="text-sm py-2 px-4">
              {tech}
            </Badge>
          ))}
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-blue-600 text-white">
        <div className="container mx-auto px-4 py-20 text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Ready to transform your workflow?
          </h2>
          <p className="text-xl mb-8 opacity-90 max-w-2xl mx-auto">
            Join teams who have already improved their productivity with our Kanban solution.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/auth/signup">
              <Button size="lg" variant="secondary" className="text-lg px-8">
                Start Free Trial
              </Button>
            </Link>
            <Link href="/dashboard">
              <Button size="lg" variant="outline" className="text-lg px-8 border-white text-white hover:bg-white hover:text-blue-600">
                View Demo
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white">
        <div className="container mx-auto px-4 py-12">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="flex items-center space-x-2 mb-4 md:mb-0">
              <Kanban className="h-6 w-6" />
              <span className="text-lg font-semibold">Aviam Kanban</span>
            </div>
            <div className="flex items-center space-x-6 text-sm text-gray-400">
              <span>Built with ❤️ by the Aviam team</span>
              <Link href="https://github.com/weiss-aviam/aviam-kanban" className="hover:text-white">
                GitHub
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
