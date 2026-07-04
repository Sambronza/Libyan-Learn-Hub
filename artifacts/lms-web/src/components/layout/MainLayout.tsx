import React from 'react';
import { Navbar } from './Navbar';
import { Footer } from './Footer';
import { AppBanner } from './AppBanner';

export function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      <AppBanner />
      <Navbar />
      <div className="flex-1 flex flex-col relative">
        {children}
      </div>
      <Footer />
    </div>
  );
}
