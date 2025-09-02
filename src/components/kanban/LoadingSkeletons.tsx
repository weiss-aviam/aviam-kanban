import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

export function BoardLoadingSkeleton() {
  return (
    <div className="h-screen flex flex-col">
      {/* Header Skeleton */}
      <header className="border-b bg-white px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <Skeleton className="h-8 w-64 mb-2" />
            <Skeleton className="h-4 w-32" />
          </div>
          <div className="flex items-center space-x-4">
            <div className="flex -space-x-2">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="w-8 h-8 rounded-full" />
              ))}
            </div>
          </div>
        </div>
      </header>

      {/* Filters Skeleton */}
      <div className="border-b bg-white px-6 py-3">
        <div className="flex items-center space-x-2">
          <Skeleton className="h-8 w-20" />
          <Skeleton className="h-6 w-16" />
          <Skeleton className="h-6 w-24" />
        </div>
      </div>

      {/* Board Content Skeleton */}
      <main className="flex-1 overflow-hidden">
        <div className="flex h-full gap-6 p-6">
          {[...Array(3)].map((_, i) => (
            <ColumnLoadingSkeleton key={i} />
          ))}
          <Skeleton className="h-12 w-32 flex-shrink-0" />
        </div>
      </main>
    </div>
  );
}

export function ColumnLoadingSkeleton() {
  return (
    <div className="flex flex-col w-80 flex-shrink-0">
      {/* Column Header */}
      <div className="flex items-center justify-between p-4 bg-gray-50 rounded-t-lg border border-b-0">
        <div className="flex items-center space-x-2">
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-5 w-6 rounded-full" />
        </div>
        <Skeleton className="h-6 w-6" />
      </div>

      {/* Cards Container */}
      <Card className="flex-1 min-h-[200px] p-4 rounded-t-none border-t-0">
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <CardLoadingSkeleton key={i} />
          ))}
          <Skeleton className="h-10 w-full border-dashed" />
        </div>
      </Card>
    </div>
  );
}

export function CardLoadingSkeleton() {
  return (
    <Card className="p-3">
      <CardContent className="p-0 space-y-3">
        {/* Title */}
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />

        {/* Labels */}
        <div className="flex flex-wrap gap-1">
          <Skeleton className="h-5 w-12 rounded-full" />
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Skeleton className="h-4 w-4" />
            <Skeleton className="h-3 w-4" />
          </div>
          <Skeleton className="h-6 w-6 rounded-full" />
        </div>
      </CardContent>
    </Card>
  );
}

export function DashboardLoadingSkeleton() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <Skeleton className="h-8 w-32 mb-2" />
              <Skeleton className="h-4 w-48" />
            </div>
            <Skeleton className="h-10 w-32" />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-6">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-4 w-16" />
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {[...Array(6)].map((_, i) => (
            <BoardCardLoadingSkeleton key={i} />
          ))}
        </div>
      </main>
    </div>
  );
}

export function BoardCardLoadingSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-5 w-full" />
        <div className="flex items-center space-x-4">
          <Skeleton className="h-3 w-12" />
          <Skeleton className="h-3 w-16" />
        </div>
      </CardHeader>
      <CardContent>
        <Skeleton className="h-5 w-16 rounded-full" />
      </CardContent>
    </Card>
  );
}

export function CardDetailsLoadingSkeleton() {
  return (
    <div className="space-y-6">
      {/* Description */}
      <div>
        <Skeleton className="h-5 w-24 mb-2" />
        <Skeleton className="h-4 w-full mb-1" />
        <Skeleton className="h-4 w-3/4 mb-1" />
        <Skeleton className="h-4 w-1/2" />
      </div>

      {/* Metadata */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Skeleton className="h-5 w-16 mb-2" />
          <div className="flex items-center space-x-2">
            <Skeleton className="w-6 h-6 rounded-full" />
            <Skeleton className="h-4 w-24" />
          </div>
        </div>
        <div>
          <Skeleton className="h-5 w-20 mb-2" />
          <Skeleton className="h-4 w-32" />
        </div>
      </div>

      {/* Labels */}
      <div>
        <Skeleton className="h-5 w-16 mb-2" />
        <div className="flex flex-wrap gap-2">
          <Skeleton className="h-6 w-16 rounded-full" />
          <Skeleton className="h-6 w-20 rounded-full" />
          <Skeleton className="h-6 w-12 rounded-full" />
        </div>
      </div>

      {/* Comments */}
      <div className="space-y-4">
        <Skeleton className="h-10 w-full" />
        {[...Array(2)].map((_, i) => (
          <div key={i} className="flex space-x-3">
            <Skeleton className="w-8 h-8 rounded-full flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="flex items-center space-x-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-3 w-16" />
              </div>
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-2/3" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
