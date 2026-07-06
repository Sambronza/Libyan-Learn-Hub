import React from 'react';
import { Link } from 'wouter';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useLanguage } from '@/contexts/LanguageContext';
import { useApi } from '@/hooks/useApi';
import { Newspaper, Users } from 'lucide-react';
import { PostCard, type TeacherPost } from './TeacherPosts';

/** "My Feed" — posts from teachers the student follows. */
export function FeedSection() {
  const { language } = useLanguage();
  const api = useApi();
  const queryClient = useQueryClient();
  const ar = language === 'ar';

  const { data: posts, isLoading } = useQuery<TeacherPost[]>({
    queryKey: ['my-feed'],
    queryFn: () => api.get('/community/feed'),
  });

  if (isLoading) return null;

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-display font-bold flex items-center gap-2">
          <Newspaper className="w-5 h-5 text-primary" />
          {ar ? 'آخر منشورات معلميك' : 'My Feed'}
        </h2>
      </div>

      {!posts?.length ? (
        <div className="bg-card border border-border rounded-2xl p-8 text-center">
          <Users className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">
            {ar
              ? 'تابع معلميك المفضلين لتصلك منشوراتهم وإعلاناتهم هنا.'
              : 'Follow your favorite teachers to see their posts and announcements here.'}
          </p>
          <Link href="/teachers" className="inline-block mt-3 text-sm font-medium text-primary hover:underline">
            {ar ? 'تصفح المعلمين ←' : 'Browse teachers →'}
          </Link>
        </div>
      ) : (
        <div className="space-y-4 max-w-2xl">
          {posts.slice(0, 10).map((p) => (
            <PostCard
              key={p.id}
              post={p}
              showAuthor
              onDeleted={() => queryClient.invalidateQueries({ queryKey: ['my-feed'] })}
            />
          ))}
        </div>
      )}
    </section>
  );
}
