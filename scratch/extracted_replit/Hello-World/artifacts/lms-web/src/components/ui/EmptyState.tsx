import React from 'react';
import { LucideIcon, Ghost } from 'lucide-react';
import { Button } from './button';
import { Link } from 'wouter';
import { motion } from 'framer-motion';

interface EmptyStateProps {
  title: string;
  description: string;
  icon?: LucideIcon;
  actionLabel?: string;
  actionHref?: string;
  onAction?: () => void;
}

export function EmptyState({ 
  title, 
  description, 
  icon: Icon = Ghost, 
  actionLabel, 
  actionHref,
  onAction
}: EmptyStateProps) {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="flex flex-col items-center justify-center py-24 px-4 text-center bg-card/30 rounded-3xl border border-border/40 backdrop-blur-sm"
    >
      <div className="relative mb-6">
        <motion.div 
          animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0.8, 0.5] }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          className="absolute inset-0 bg-primary/20 blur-3xl rounded-full" 
        />
        <div className="relative w-24 h-24 rounded-[2rem] bg-gradient-to-br from-card to-muted border border-border/50 flex items-center justify-center text-primary shadow-2xl shadow-primary/10">
          <Icon size={40} strokeWidth={1.5} className="drop-shadow-md" />
        </div>
      </div>
      
      <h3 className="text-2xl font-display font-bold text-foreground mb-3">
        {title}
      </h3>
      <p className="text-muted-foreground max-w-sm mb-8 text-base leading-relaxed">
        {description}
      </p>
      
      {actionLabel && (
        actionHref ? (
          <Link href={actionHref}>
            <Button size="lg" className="rounded-2xl px-8 shadow-xl shadow-primary/20 hover:scale-105 transition-transform duration-300">
              {actionLabel}
            </Button>
          </Link>
        ) : (
          <Button size="lg" onClick={onAction} className="rounded-2xl px-8 shadow-xl shadow-primary/20 hover:scale-105 transition-transform duration-300">
            {actionLabel}
          </Button>
        )
      )}
    </motion.div>
  );
}
