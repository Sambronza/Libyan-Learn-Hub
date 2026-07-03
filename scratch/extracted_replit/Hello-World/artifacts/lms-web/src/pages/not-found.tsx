import React from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { BookOpen, Home, Search, Compass } from 'lucide-react';
import { motion } from 'framer-motion';

export default function NotFound() {
  const { language } = useLanguage();
  const isAr = language === 'ar';

  return (
    <div className="min-h-screen bg-background relative overflow-hidden flex items-center justify-center p-4">
      {/* Background Decor */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-primary/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-violet-600/10 blur-[120px] pointer-events-none" />

      <div className="max-w-2xl w-full text-center relative z-10">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="mb-8 relative"
        >
          <h1 className="text-[120px] md:text-[180px] font-display font-black leading-none bg-gradient-to-br from-primary via-violet-500 to-primary/50 text-transparent bg-clip-text select-none">
            404
          </h1>
          <motion.div 
            initial={{ rotate: -20, opacity: 0 }}
            animate={{ rotate: 0, opacity: 1 }}
            transition={{ delay: 0.3, duration: 0.5 }}
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-background/80 backdrop-blur-md px-6 py-2 rounded-full border border-border shadow-xl"
          >
            <span className="font-bold text-xl tracking-wider uppercase text-foreground">
              {isAr ? 'الصفحة غير موجودة' : 'Page Not Found'}
            </span>
          </motion.div>
        </motion.div>

        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.4, duration: 0.5 }}
        >
          <p className="text-xl text-muted-foreground mb-10 max-w-lg mx-auto leading-relaxed">
            {isAr 
              ? 'عذراً، يبدو أن الصفحة التي تبحث عنها غير موجودة أو تم نقلها. دعنا نعيدك إلى المسار الصحيح.' 
              : "Oops! It looks like the page you're looking for doesn't exist or has been moved. Let's get you back on track."}
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/">
              <Button size="lg" className="h-14 px-8 text-base rounded-2xl w-full sm:w-auto bg-gradient-to-r from-primary to-violet-600 hover:from-primary/90 hover:to-violet-600/90 shadow-lg shadow-primary/20 gap-2">
                <Home className="w-5 h-5" />
                {isAr ? 'العودة للرئيسية' : 'Return Home'}
              </Button>
            </Link>
            <Link href="/courses">
              <Button size="lg" variant="outline" className="h-14 px-8 text-base rounded-2xl w-full sm:w-auto border-border/50 hover:bg-muted gap-2">
                <BookOpen className="w-5 h-5 text-primary" />
                {isAr ? 'تصفح الدورات' : 'Browse Courses'}
              </Button>
            </Link>
          </div>

          <div className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-4 text-center max-w-xl mx-auto opacity-70 hover:opacity-100 transition-opacity">
            {[
              { icon: Compass, label: isAr ? 'استكشف' : 'Explore' },
              { icon: Search, label: isAr ? 'ابحث' : 'Search' },
              { icon: BookOpen, label: isAr ? 'تعلم' : 'Learn' },
              { icon: Home, label: isAr ? 'الرئيسية' : 'Home' }
            ].map((item, i) => (
              <div key={i} className="flex flex-col items-center gap-2">
                <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
                  <item.icon className="w-4 h-4" />
                </div>
                <span className="text-xs font-medium text-muted-foreground">{item.label}</span>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
