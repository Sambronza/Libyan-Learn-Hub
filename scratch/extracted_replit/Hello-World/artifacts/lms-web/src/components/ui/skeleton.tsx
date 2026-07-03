import React from 'react';
import { cn } from '@/lib/utils';

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {}

export function Skeleton({ className, ...props }: SkeletonProps) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-muted/60", className)}
      {...props}
    />
  );
}

export function CourseCardSkeleton() {
  return (
    <div className="bg-card rounded-2xl border border-border overflow-hidden shadow-sm flex flex-col h-full">
      <Skeleton className="aspect-video w-full" />
      <div className="p-5 flex-1 flex flex-col">
        <div className="flex items-center gap-2 mb-3">
          <Skeleton className="h-5 w-20 rounded-full" />
          <Skeleton className="h-5 w-14 rounded-full ml-auto" />
        </div>
        <Skeleton className="h-6 w-full mb-2" />
        <Skeleton className="h-6 w-3/4 mb-4" />
        <div className="mt-auto pt-4 border-t border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Skeleton className="h-8 w-8 rounded-full" />
            <Skeleton className="h-4 w-24" />
          </div>
          <Skeleton className="h-4 w-16" />
        </div>
      </div>
    </div>
  );
}

export function StatCardSkeleton() {
  return (
    <div className="bg-card rounded-2xl border border-border p-4 flex items-center gap-3 shadow-sm">
      <Skeleton className="w-10 h-10 rounded-xl" />
      <div className="space-y-2">
        <Skeleton className="h-6 w-12" />
        <Skeleton className="h-3 w-20" />
      </div>
    </div>
  );
}
