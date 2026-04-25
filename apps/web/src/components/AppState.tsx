import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

interface PageStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  isActionLoading?: boolean;
  tone?: 'neutral' | 'danger' | 'success';
  className?: string;
}

const toneClasses = {
  neutral: 'bg-primary/10 text-primary dark:bg-primary/20 dark:text-primary-foreground',
  danger: 'bg-red-50 text-red-500 dark:bg-red-950/40 dark:text-red-300',
  success: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-300',
};

export function PageState({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
  isActionLoading = false,
  tone = 'neutral',
  className,
}: PageStateProps) {
  return (
    <div className={cn('flex min-h-[60vh] items-center justify-center p-6 text-center', className)}>
      <div className="mx-auto flex max-w-sm flex-col items-center">
        <div
          className={cn(
            'mb-4 flex h-20 w-20 items-center justify-center rounded-full',
            toneClasses[tone],
          )}
        >
          <Icon className="h-9 w-9" aria-hidden="true" />
        </div>
        <h2 className="mb-2 text-xl font-bold text-gray-900 dark:text-gray-50">{title}</h2>
        <p className="mb-6 text-sm leading-6 text-gray-600 dark:text-gray-300">{description}</p>
        {actionLabel && onAction ? (
          <Button
            onClick={onAction}
            disabled={isActionLoading}
            className="min-w-32 bg-primary text-white"
          >
            {isActionLoading ? 'Working...' : actionLabel}
          </Button>
        ) : null}
      </div>
    </div>
  );
}

export function DiscoverySkeleton() {
  return (
    <div className="min-h-screen bg-gray-50 pb-[calc(var(--bottom-nav-offset)+0.5rem)] dark:bg-gray-900">
      <header className="flex items-center justify-between bg-white p-4 shadow-sm dark:bg-gray-800">
        <div className="space-y-2">
          <Skeleton className="h-6 w-44" />
          <Skeleton className="h-4 w-32" />
        </div>
        <div className="flex gap-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-10 w-10 rounded-full" />
          ))}
        </div>
      </header>
      <div className="relative p-4 md:p-6 lg:p-8">
        <Card className="overflow-hidden rounded-2xl bg-white shadow-xl dark:bg-gray-800">
          <CardContent className="p-0">
            <Skeleton className="h-48 w-full rounded-none" />
            <div className="space-y-4 p-4">
              <div className="flex items-center justify-between gap-4">
                <Skeleton className="h-6 flex-1" />
                <Skeleton className="h-6 w-24 rounded-full" />
              </div>
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-12 w-full" />
              <div className="flex items-center gap-3 border-t pt-4 dark:border-gray-700">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-36" />
                  <Skeleton className="h-3 w-24" />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
        <div className="fixed inset-x-0 bottom-[calc(var(--bottom-nav-offset)+0.75rem)] flex justify-center gap-6 px-4">
          <Skeleton className="h-16 w-16 rounded-full" />
          <Skeleton className="h-12 w-12 rounded-full" />
          <Skeleton className="h-16 w-16 rounded-full" />
        </div>
      </div>
    </div>
  );
}

export function ListSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="space-y-4 p-4" aria-label="Loading list">
      {Array.from({ length: count }).map((_, index) => (
        <Card key={index} className="bg-white dark:bg-gray-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Skeleton className="h-16 w-16 rounded-xl" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-5 w-24 rounded-full" />
              </div>
              <Skeleton className="h-10 w-10 rounded-full" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function ChatSkeleton({ header }: { header?: ReactNode }) {
  return (
    <div className="flex h-screen flex-col bg-white dark:bg-gray-950">
      {header}
      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className={cn('flex', index % 2 ? 'justify-end' : 'justify-start')}>
            <div className="w-64 max-w-[78%] space-y-2 rounded-2xl bg-gray-100 p-4 dark:bg-gray-800">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-2/3" />
            </div>
          </div>
        ))}
      </div>
      <div className="border-t border-gray-200 p-4 dark:border-gray-800">
        <div className="flex items-center gap-2">
          <Skeleton className="h-10 flex-1 rounded-full" />
          <Skeleton className="h-10 w-10 rounded-full" />
        </div>
      </div>
    </div>
  );
}
