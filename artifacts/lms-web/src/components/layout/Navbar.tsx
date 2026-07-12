import React, { useState, useRef, useEffect } from 'react';
import { Link, useLocation } from 'wouter';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { BookOpen, MonitorPlay, Users, Menu, X, Globe, User as UserIcon, LogOut, GraduationCap, LayoutDashboard, ChevronDown, MessageCircle, Library } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { NotificationDropdown } from './NotificationDropdown';
import { Logo } from '@/components/ui/Logo';
import { ThemeToggle } from './ThemeToggle';

export function Navbar() {
  const { t, language, setLanguage } = useLanguage();
  const { user, logout, isAuthenticated } = useAuth();
  const [location, setLocation] = useLocation();
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const toggleLanguage = () => {
    setLanguage(language === 'ar' ? 'en' : 'ar');
  };

  // Close user menu on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setIsUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const navLinks = [
    { href: '/courses', label: t('nav.courses'), icon: BookOpen },
    { href: '/academy', label: language === 'ar' ? 'الأكاديمية' : 'Academy', icon: GraduationCap, badge: true },
    { href: '/library', label: language === 'ar' ? 'المكتبة' : 'Library', icon: Library, badge: true },
    { href: '/live-sessions', label: t('nav.live'), icon: MonitorPlay },
    { href: '/tutoring', label: language === 'ar' ? 'دروس خصوصية' : '1-to-1 Tutoring', icon: MessageCircle, badge: true },
    { href: '/teachers', label: t('nav.teachers'), icon: Users },
  ];

  return (
    <header className={`sticky top-0 z-50 w-full transition-all duration-300 ${
      isScrolled 
        ? 'bg-background/70 backdrop-blur-2xl border-b border-border/60 shadow-sm shadow-black/5' 
        : 'bg-background/0 backdrop-blur-none border-b border-transparent'
    }`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-20">
          
          {/* Logo */}
          <Logo size={75} />

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => {
              const isActive = location === link.href || location.startsWith(link.href + '/');
              const Icon = link.icon;
              return (
                <Link 
                  key={link.href} 
                  href={link.href}
                  className={`relative flex items-center gap-2 text-sm font-medium transition-colors px-3 py-2 rounded-xl ${
                    isActive 
                      ? 'text-primary bg-primary/8' 
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {link.label}
                  {link.badge && (
                    <span className="absolute -top-1 -end-1 px-1.5 py-0.5 text-[9px] font-bold rounded-full bg-gradient-to-r from-amber-500 to-orange-500 text-white leading-none shadow-sm">
                      {language === 'ar' ? 'جديد' : 'NEW'}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>

          {/* Actions */}
          <div className="hidden md:flex items-center gap-3">
            <button 
              onClick={toggleLanguage}
              className="p-2 rounded-full hover:bg-secondary/20 text-muted-foreground hover:text-secondary transition-colors flex items-center gap-2 text-sm font-medium"
            >
              <Globe className="w-4 h-4" />
              <span className="uppercase">{language}</span>
            </button>
            <ThemeToggle />

            {isAuthenticated ? (
              <>
                <NotificationDropdown />
                <div className="relative" ref={userMenuRef}>
                  <button
                    onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-muted transition-colors"
                  >
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-violet-600 flex items-center justify-center text-white text-sm font-bold shadow-md">
                      {user?.fullName?.charAt(0) || 'U'}
                    </div>
                    <span className="text-sm font-medium text-foreground max-w-[100px] truncate hidden lg:block">
                      {user?.fullName}
                    </span>
                    <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${isUserMenuOpen ? 'rotate-180' : ''}`} />
                  </button>

                  <AnimatePresence>
                    {isUserMenuOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: 8, scale: 0.96 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 8, scale: 0.96 }}
                      transition={{ duration: 0.15 }}
                      className="absolute end-0 top-full mt-2 w-56 max-w-[calc(100vw-2rem)] bg-card border border-border rounded-2xl shadow-xl overflow-hidden z-50"
                    >
                      {/* User info */}
                      <div className="px-4 py-3 border-b border-border bg-muted/30">
                        <div className="font-bold text-sm text-foreground truncate">{user?.fullName}</div>
                        <div className="text-xs text-muted-foreground truncate">{user?.email}</div>
                        <div className="mt-1 inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-primary/10 text-primary capitalize">
                          {user?.role}
                        </div>
                      </div>

                      <div className="py-1">
                        <Link 
                          href={user?.role === 'teacher' ? '/teacher/dashboard' : '/dashboard'}
                          onClick={() => setIsUserMenuOpen(false)}
                        >
                          <button className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-foreground hover:bg-muted transition-colors text-start">
                            <LayoutDashboard className="w-4 h-4 text-muted-foreground" />
                            {t('nav.dashboard')}
                          </button>
                        </Link>
                        
                        {user?.role === 'student' && (
                          <Link href="/academy/dashboard" onClick={() => setIsUserMenuOpen(false)}>
                            <button className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-warning hover:bg-warning/10 transition-colors text-start font-medium">
                              <GraduationCap className="w-4 h-4 text-amber-500" />
                              {language === 'ar' ? 'بوابة الأكاديمية' : 'Academy Portal'}
                            </button>
                          </Link>
                        )}
                        <Link href="/profile" onClick={() => setIsUserMenuOpen(false)}>
                          <button className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-foreground hover:bg-muted transition-colors text-start">
                            <UserIcon className="w-4 h-4 text-muted-foreground" />
                            {language === 'ar' ? 'الملف الشخصي' : 'Profile Settings'}
                          </button>
                        </Link>

                        {user?.role === 'admin' && (
                          <Link href="/admin/dashboard" onClick={() => setIsUserMenuOpen(false)}>
                            <button className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-foreground hover:bg-muted transition-colors text-start">
                              <LayoutDashboard className="w-4 h-4 text-muted-foreground" />
                              {language === 'ar' ? 'لوحة الإدارة' : 'Admin Panel'}
                            </button>
                          </Link>
                        )}
                      </div>

                      <div className="border-t border-border py-1">
                        <button 
                          onClick={() => { 
                            setIsUserMenuOpen(false); 
                            setTimeout(() => {
                              logout();
                              setLocation('/login');
                            }, 150);
                          }}
                          className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-destructive hover:bg-destructive/10 transition-colors text-start"
                        >
                          <LogOut className="w-4 h-4" />
                          {language === 'ar' ? 'تسجيل الخروج' : 'Sign Out'}
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
              </>
            ) : (
              <div className="flex items-center gap-3">
                <Link href={`/login?returnTo=${encodeURIComponent(location + window.location.search)}`}>
                  <Button variant="ghost">{t('nav.login')}</Button>
                </Link>
                <Link href={`/register?returnTo=${encodeURIComponent(location + window.location.search)}`}>
                  <Button className="bg-gradient-to-r from-primary to-violet-600 hover:from-primary/90 hover:to-violet-600/90 shadow-lg shadow-primary/25 rounded-xl">
                    {t('nav.register')}
                  </Button>
                </Link>
              </div>
            )}
          </div>

          {/* Mobile Menu Toggle */}
          <button 
            className="md:hidden p-2 text-foreground rounded-lg hover:bg-muted transition-colors"
            onClick={() => setIsMobileOpen(!isMobileOpen)}
            aria-label={isMobileOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={isMobileOpen}
          >
            {isMobileOpen ? <X /> : <Menu />}
          </button>
        </div>
      </div>

      {/* Mobile Nav */}
      <AnimatePresence>
        {isMobileOpen && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="md:hidden overflow-hidden bg-background border-t border-border"
          >
            <div className="px-4 py-6 flex flex-col gap-3">
              {navLinks.map((link) => (
                <Link 
                  key={link.href} 
                  href={link.href}
                  className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted font-medium relative"
                  onClick={() => setIsMobileOpen(false)}
                >
                  <link.icon className="w-5 h-5 text-primary" />
                  {link.label}
                  {link.badge && (
                    <span className="ml-2 px-1.5 py-0.5 text-[9px] font-bold rounded-full bg-gradient-to-r from-amber-500 to-orange-500 text-white leading-none">
                      {language === 'ar' ? 'جديد' : 'NEW'}
                    </span>
                  )}
                </Link>
              ))}
              
              <div className="h-px w-full bg-border my-2" />
              
              {/* ThemeToggle + Notification on mobile */}
              <div className="flex items-center gap-2 p-1">
                <ThemeToggle />
                {isAuthenticated && <NotificationDropdown />}
              </div>

              <button 
                onClick={toggleLanguage}
                className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted font-medium text-start"
              >
                <Globe className="w-5 h-5 text-secondary" />
                Switch to {language === 'ar' ? 'English' : 'العربية'}
              </button>

              {isAuthenticated ? (
                <>
                  <Link href={user?.role === 'teacher' ? '/teacher/dashboard' : '/dashboard'} onClick={() => setIsMobileOpen(false)}>
                    <Button className="w-full justify-start gap-2" variant="outline">
                      <LayoutDashboard className="w-4 h-4" /> {t('nav.dashboard')}
                    </Button>
                  </Link>
                  <Link href="/profile" onClick={() => setIsMobileOpen(false)}>
                    <Button className="w-full justify-start gap-2" variant="outline">
                      <UserIcon className="w-4 h-4" /> {language === 'ar' ? 'الملف الشخصي' : 'Profile Settings'}
                    </Button>
                  </Link>
                  <Button variant="ghost" onClick={() => { 
                    setIsMobileOpen(false); 
                    setTimeout(() => {
                      logout();
                      setLocation('/login');
                    }, 300); // Wait for mobile menu animation
                  }} className="w-full justify-start text-destructive">
                    <LogOut className="w-4 h-4 me-2" /> {language === 'ar' ? 'تسجيل الخروج' : 'Sign Out'}
                  </Button>
                </>
              ) : (
                <div className="grid grid-cols-2 gap-3 mt-4">
                  <Link href={`/login?returnTo=${encodeURIComponent(location + window.location.search)}`} onClick={() => setIsMobileOpen(false)}>
                    <Button variant="outline" className="w-full">{t('nav.login')}</Button>
                  </Link>
                  <Link href={`/register?returnTo=${encodeURIComponent(location + window.location.search)}`} onClick={() => setIsMobileOpen(false)}>
                    <Button className="w-full bg-gradient-to-r from-primary to-violet-600">{t('nav.register')}</Button>
                  </Link>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
