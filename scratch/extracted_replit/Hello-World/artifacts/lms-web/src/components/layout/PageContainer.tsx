import React from 'react';
import { motion } from 'framer-motion';

export function PageContainer({ children, hideFooter = false }: { children: React.ReactNode, hideFooter?: boolean }) {
  return (
    <>
      <motion.main 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="flex-1 flex flex-col min-h-[calc(100vh-140px)]"
      >
        {children}
      </motion.main>
    </>
  );
}
