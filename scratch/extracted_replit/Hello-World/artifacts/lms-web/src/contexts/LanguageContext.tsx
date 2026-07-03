import React, { createContext, useContext, useEffect, useState } from 'react';

type Language = 'ar' | 'en';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string, fallbackOrVariables?: string | Record<string, string>) => string;
  dir: 'rtl' | 'ltr';
}

const translations: Record<Language, Record<string, string>> = {
  en: {
    'nav.courses': 'Courses',
    'nav.live': 'Live Sessions',
    'nav.teachers': 'Teachers',
    'nav.dashboard': 'Dashboard',
    'nav.login': 'Log In',
    'nav.register': 'Sign Up',
    'home.hero.title': 'Unlock Your Potential with Top Experts',
    'home.hero.subtitle': 'Join thousands of Libyan students learning from the best teachers in the country. Master new skills, prepare for exams, and shape your future.',
    'home.hero.cta': 'Explore Courses',
    'home.featured': 'Featured Courses',
    'course.enroll': 'Enroll Now',
    'course.enrolled': 'Go to Course',
    'course.price': '{price} LYD',
    'course.free': 'Free',
    'auth.email': 'Email Address',
    'auth.password': 'Password',
    'auth.login.title': 'Welcome Back',
    'auth.login.submit': 'Log In',
    'auth.register.title': 'Create an Account',
    'auth.register.submit': 'Sign Up',
    'common.loading': 'Loading...',
    'common.error': 'An error occurred. Please try again.',
    'courses.explore': 'Explore Courses',
    'courses.search': 'Search courses, topics, or teachers...',
    'courses.searchBtn': 'Search',
    'courses.filters': 'Filters',
    'courses.category': 'Category',
    'courses.allCategories': 'All Categories',
    'courses.level': 'Level',
    'courses.beginner': 'Beginner',
    'courses.intermediate': 'Intermediate',
    'courses.advanced': 'Advanced',
    'courses.noCourses': 'No courses found',
    'courses.adjustFilters': 'Try adjusting your filters or search term.',
    'courses.clearFilters': 'Clear Filters',
    'courses.showingResults': 'Showing {count} of {total} results',
    'courses.lessons': 'Lessons',
    'footer.description': 'Empowering Libyan students and teachers through modern, accessible, and high-quality online education.',
    'footer.explore': 'Explore',
    'footer.legal': 'Legal',
    'footer.contact': 'Contact',
    'footer.terms': 'Terms of Service',
    'footer.privacy': 'Privacy Policy',
    'footer.dmca': 'Copyright / DMCA',
    'footer.allRightsReserved': 'EduLibya. All rights reserved.',
    'teacher_dashboard.portal': 'Teacher Portal',
    'teacher_dashboard.schedule_session': 'Schedule Session',
    'teacher_dashboard.new_course': 'New Course',
    'teacher_dashboard.total_courses': 'Total Courses',
    'teacher_dashboard.published': 'Published',
    'teacher_dashboard.total_students': 'Total Students',
    'teacher_dashboard.revenue': 'Revenue (LYD)',
    'teacher_dashboard.my_courses': 'My Courses',
    'teacher_dashboard.live_sessions': 'Live Sessions',
    'teacher_dashboard.students': 'Students',
    'teacher_dashboard.promote': 'Promote & Analytics',
    'student_dashboard.welcome': 'Welcome back, {name}!',
    'student_dashboard.enrolled': 'Enrolled',
    'student_dashboard.in_progress': 'In Progress',
    'student_dashboard.completed': 'Completed',
    'student_dashboard.continue_watching': 'Continue Watching',
    'academy.program': 'Academy Program',
    'academy.pending': 'Application Pending',
    'academy.enrollment_open': 'Enrollment Open',
    'profile.settings': 'Settings',
    'profile.personal_info': 'Personal Information',
    'profile.name': 'Full Name',
    'profile.bio': 'Bio',
    'profile.language': 'Language',
    'profile.security': 'Security',
    'profile.email': 'Email Address',
    'profile.password': 'Password',
    'profile.save': 'Save Changes',
    'profile.update_success': 'Profile updated successfully',
    'inactivity.warning.title': 'Session Expiry Warning',
    'inactivity.teacher.message': 'Dear Teacher, you have been inactive for 15 minutes. To protect exam materials, grades, and student privacy, your session will expire soon.',
    'inactivity.student.message': 'Dear Student, you have been inactive for 15 minutes. To ensure your lesson and course progress are recorded safely, please confirm you are still here.',
    'inactivity.countdown': 'Signing out in {seconds} seconds...',
    'inactivity.btn.stay': 'Keep Me Signed In',
    'inactivity.btn.logout': 'Sign Out Now',
  },
  ar: {
    'nav.courses': 'الدورات',
    'nav.live': 'البث المباشر',
    'nav.teachers': 'المعلمون',
    'nav.dashboard': 'لوحة التحكم',
    'nav.login': 'تسجيل الدخول',
    'nav.register': 'حساب جديد',
    'home.hero.title': 'أطلق العنان لإمكانياتك مع نخبة الخبراء',
    'home.hero.subtitle': 'انضم إلى آلاف الطلاب الليبيين الذين يتعلمون من أفضل المعلمين في البلاد. اكتسب مهارات جديدة، استعد للامتحانات، وارسم مستقبلك.',
    'home.hero.cta': 'استكشف الدورات',
    'home.featured': 'الدورات المميزة',
    'course.enroll': 'اشترك الآن',
    'course.enrolled': 'اذهب للدورة',
    'course.price': '{price} د.ل',
    'course.free': 'مجاناً',
    'auth.email': 'البريد الإلكتروني',
    'auth.password': 'كلمة المرور',
    'auth.login.title': 'مرحباً بعودتك',
    'auth.login.submit': 'تسجيل الدخول',
    'auth.register.title': 'إنشاء حساب جديد',
    'auth.register.submit': 'تسجيل',
    'common.loading': 'جاري التحميل...',
    'common.error': 'حدث خطأ. يرجى المحاولة مرة أخرى.',
    'courses.explore': 'استكشف الدورات',
    'courses.search': 'ابحث عن دورات، مواضيع، أو معلمين...',
    'courses.searchBtn': 'بحث',
    'courses.filters': 'التصنيفات',
    'courses.category': 'الفئة',
    'courses.allCategories': 'جميع الفئات',
    'courses.level': 'المستوى',
    'courses.beginner': 'مبتدئ',
    'courses.intermediate': 'متوسط',
    'courses.advanced': 'متقدم',
    'courses.noCourses': 'لا توجد دورات',
    'courses.adjustFilters': 'حاول تعديل الفلاتر أو مصطلح البحث.',
    'courses.clearFilters': 'مسح الفلاتر',
    'courses.showingResults': 'عرض {count} من {total} نتيجة',
    'courses.lessons': 'دروس',
    'footer.description': 'تمكين الطلاب والمعلمين في ليبيا من خلال تعليم عبر الإنترنت حديث ومتاح وعالي الجودة.',
    'footer.explore': 'استكشف',
    'footer.legal': 'قانوني',
    'footer.contact': 'تواصل معنا',
    'footer.terms': 'شروط الخدمة',
    'footer.privacy': 'سياسة الخصوصية',
    'footer.dmca': 'حقوق الطبع والنشر',
    'footer.allRightsReserved': 'إديوليبيا. جميع الحقوق محفوظة.',
    'teacher_dashboard.portal': 'بوابة المعلم',
    'teacher_dashboard.schedule_session': 'جدولة حصة',
    'teacher_dashboard.new_course': 'دورة جديدة',
    'teacher_dashboard.total_courses': 'إجمالي الدورات',
    'teacher_dashboard.published': 'منشورة',
    'teacher_dashboard.total_students': 'إجمالي الطلاب',
    'teacher_dashboard.revenue': 'الإيرادات (د.ل)',
    'teacher_dashboard.my_courses': 'دوراتي',
    'teacher_dashboard.live_sessions': 'حصص مباشرة',
    'teacher_dashboard.students': 'الطلاب',
    'teacher_dashboard.promote': 'الترويج والتحليل',
    'student_dashboard.welcome': 'أهلاً بك مجدداً، {name}!',
    'student_dashboard.enrolled': 'مسجل',
    'student_dashboard.in_progress': 'قيد الدراسة',
    'student_dashboard.completed': 'مكتملة',
    'student_dashboard.continue_watching': 'متابعة المشاهدة',
    'academy.program': 'برنامج الأكاديمية',
    'academy.pending': 'الطلب قيد المراجعة',
    'academy.enrollment_open': 'التسجيل مفتوح',
    'profile.settings': 'الإعدادات',
    'profile.personal_info': 'المعلومات الشخصية',
    'profile.name': 'الاسم الكامل',
    'profile.bio': 'السيرة الذاتية',
    'profile.language': 'اللغة',
    'profile.security': 'الأمان',
    'profile.email': 'البريد الإلكتروني',
    'profile.password': 'كلمة المرور',
    'profile.save': 'حفظ التغييرات',
    'profile.update_success': 'تم تحديث الملف الشخصي بنجاح',
    'inactivity.warning.title': 'تنبيه انتهاء الجلسة',
    'inactivity.teacher.message': 'عزيزي المعلم، لقد كنت غير نشط لمدة 15 دقيقة. لحماية مواد الامتحانات والدرجات وخصوصية الطلاب، ستنتهي جلستك قريباً.',
    'inactivity.student.message': 'عزيزي الطالب، لقد كنت غير نشط لمدة 15 دقيقة. لضمان تسجيل تقدمك في الدروس والدورات بأمان، يرجى تأكيد تواجدك.',
    'inactivity.countdown': 'سيتم تسجيل الخروج خلال {seconds} ثانية...',
    'inactivity.btn.stay': 'إبقاء تسجيل دخولي نشطاً',
    'inactivity.btn.logout': 'تسجيل الخروج الآن',
  }
};

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>('ar'); // Default Arabic

  useEffect(() => {
    const saved = localStorage.getItem('lms_language') as Language;
    if (saved && (saved === 'ar' || saved === 'en')) {
      setLanguageState(saved);
    }
  }, []);

  useEffect(() => {
    document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = language;
  }, [language]);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem('lms_language', lang);
  };

  const t = (key: string, fallbackOrVariables?: string | Record<string, string>) => {
    // Support inline bilingual pattern: t('Arabic text', 'English text')
    if (typeof fallbackOrVariables === 'string') {
      return language === 'ar' ? key : fallbackOrVariables;
    }
    const variables = fallbackOrVariables;
    let text = translations[language][key] || translations['en'][key] || key;
    if (variables) {
      Object.keys(variables).forEach(vKey => {
        text = text.replace(`{${vKey}}`, variables[vKey]);
      });
    }
    return text;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t, dir: language === 'ar' ? 'rtl' : 'ltr' }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) throw new Error('useLanguage must be used within a LanguageProvider');
  return context;
}
