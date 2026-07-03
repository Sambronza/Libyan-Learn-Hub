import React from 'react';
import { motion } from 'framer-motion';

interface BlobProps {
  className?: string;
  color?: string;
  size?: string;
  delay?: number;
  duration?: number;
}

export function Blob({ 
  className = "", 
  color = "bg-primary/20", 
  size = "w-72 h-72",
  delay = 0,
  duration = 20
}: BlobProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ 
        opacity: [0.3, 0.6, 0.3],
        scale: [1, 1.15, 1],
        x: [0, 40, -30, 0],
        y: [0, -50, 30, 0],
      }}
      transition={{ 
        duration: duration, 
        repeat: Infinity, 
        ease: "easeInOut",
        delay: delay
      }}
      className={`absolute rounded-full blur-[80px] -z-10 pointer-events-none mix-blend-screen dark:mix-blend-lighten ${color} ${size} ${className}`}
    />
  );
}
