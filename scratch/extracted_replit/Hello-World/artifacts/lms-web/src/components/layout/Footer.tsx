import React from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { BookOpen, Mail, Phone, MapPin } from 'lucide-react';
import { Link } from 'wouter';
import { Logo } from '@/components/ui/Logo';

export function Footer() {
  const { t, dir } = useLanguage();

  return (
    <footer className="bg-card border-t border-border mt-12 lg:mt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 lg:py-16">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-12">
          
          <div className="space-y-4">
            <Logo size={56} />
            <p className={`text-muted-foreground text-sm leading-relaxed max-w-xs ${dir === 'rtl' ? 'text-start' : 'text-start'}`}>
              {t('footer.description')}
            </p>
          </div>

          <div>
            <h3 className="font-display font-semibold text-foreground mb-4">{t('footer.explore')}</h3>
            <ul className="space-y-3">
              <li><a href="/courses" className="text-sm text-muted-foreground hover:text-primary transition-colors">{t('nav.courses')}</a></li>
              <li><a href="/live-sessions" className="text-sm text-muted-foreground hover:text-primary transition-colors">{t('nav.live')}</a></li>
              <li><a href="/teachers" className="text-sm text-muted-foreground hover:text-primary transition-colors">{t('nav.teachers')}</a></li>
            </ul>
          </div>

          <div>
            <h3 className="font-display font-semibold text-foreground mb-4">{t('footer.legal')}</h3>
            <ul className="space-y-3">
              <li><a href="#" className="text-sm text-muted-foreground hover:text-primary transition-colors">{t('footer.terms')}</a></li>
              <li><a href="#" className="text-sm text-muted-foreground hover:text-primary transition-colors">{t('footer.privacy')}</a></li>
              <li><Link href="/dmca" className="text-sm text-muted-foreground hover:text-primary transition-colors">{t('footer.dmca')}</Link></li>
            </ul>
          </div>

          <div>
            <h3 className="font-display font-semibold text-foreground mb-4">{t('footer.contact')}</h3>
            <ul className="space-y-3">
              <li className="flex items-start gap-3 text-sm text-muted-foreground">
                <MapPin className="w-4 h-4 mt-0.5 shrink-0 text-secondary" />
                <span>Tripoli, Libya</span>
              </li>
              <li className="flex items-center gap-3 text-sm text-muted-foreground">
                <Phone className="w-4 h-4 shrink-0 text-secondary" />
                <span dir="ltr">+218 91 123 4567</span>
              </li>
              <li className="flex items-center gap-3 text-sm text-muted-foreground">
                <Mail className="w-4 h-4 shrink-0 text-secondary" />
                <span>support@edulibya.ly</span>
              </li>
            </ul>
          </div>

        </div>
        
        <div className="mt-12 pt-8 border-t border-border flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground text-start">
            &copy; {new Date().getFullYear()} {t('footer.allRightsReserved')}
          </p>
          <div className="flex gap-4">
            <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-muted-foreground hover:bg-primary hover:text-white transition-all cursor-pointer">
              <span className="sr-only">Facebook</span>
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878v-6.987h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.988C18.343 21.128 22 16.991 22 12z"/></svg>
            </div>
            <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-muted-foreground hover:bg-primary hover:text-white transition-all cursor-pointer">
              <span className="sr-only">Twitter</span>
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z"/></svg>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
