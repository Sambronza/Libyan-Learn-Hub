import React from 'react';
import { PageContainer } from '@/components/layout/PageContainer';
import { Button } from '@/components/ui/button';
import { Link, useLocation } from 'wouter';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { useApi } from '@/hooks/useApi';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { 
  GraduationCap, BookOpen, Shield, Users, Clock, Award, 
  ChevronRight, ChevronLeft, CheckCircle2, MapPin, Monitor, FileText,
  Sparkles
} from 'lucide-react';

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 32 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.6, ease: 'easeOut' as const, delay },
});

export default function Academy() {
  const { language } = useLanguage();
  const { isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();
  const api = useApi();
  const isRtl = language === 'ar';
  const Arrow = isRtl ? ChevronLeft : ChevronRight;

  const { data: programs, isLoading } = useQuery({
    queryKey: ['academy-programs'],
    queryFn: () => api.get('/academy/programs')
  });

  const handleApplyClick = () => {
    if (isAuthenticated) {
      setLocation('/academy/apply');
    } else {
      setLocation('/login?redirect=/academy/apply');
    }
  };

  const features = [
    {
      icon: BookOpen,
      title: isRtl ? 'المنهج الليبي المعتمد' : 'Official Libyan Curriculum',
      desc: isRtl ? 'جميع المواد تتبع منهج وزارة التربية والتعليم الليبية' : 'All subjects follow the Libyan Ministry of Education curriculum',
      color: 'from-blue-500 to-cyan-500',
    },
    {
      icon: Monitor,
      title: isRtl ? 'تعلم من المنزل' : 'Learn From Home',
      desc: isRtl ? 'محاضرات فيديو عالية الجودة ودروس تفاعلية متاحة ٢٤/٧' : 'HD video lectures and interactive lessons available 24/7',
      color: 'from-violet-500 to-purple-500',
    },
    {
      icon: Shield,
      title: isRtl ? 'اختبارات معتمدة' : 'Certified Exams',
      desc: isRtl ? 'اختبارات مراقبة في مراكز معتمدة للحصول على شهادة رسمية' : 'Proctored exams at certified centers for official certification',
      color: 'from-emerald-500 to-green-500',
    },
    {
      icon: Users,
      title: isRtl ? 'كادر تدريسي متميز' : 'Expert Faculty',
      desc: isRtl ? 'معلمون معتمدون ذوو خبرة طويلة في التعليم الليبي' : 'Certified teachers with extensive experience in Libyan education',
      color: 'from-amber-500 to-orange-500',
    },
    {
      icon: FileText,
      title: isRtl ? 'شهادة معترف بها' : 'Recognized Diploma',
      desc: isRtl ? 'شهادة ثانوية معترف بها تؤهلك لدخول الجامعة' : 'Recognized secondary certificate qualifying for university admission',
      color: 'from-rose-500 to-pink-500',
    },
    {
      icon: Clock,
      title: isRtl ? 'تعلم بالوتيرة المناسبة' : 'Flexible Schedule',
      desc: isRtl ? 'نظام مرن يتيح لك التعلم وفق جدولك الخاص مع مواعيد محددة للاختبارات' : 'Flexible system allowing you to learn at your pace with set exam schedules',
      color: 'from-indigo-500 to-blue-500',
    },
  ];

  const steps = [
    { step: 1, title: isRtl ? 'قدّم طلبك' : 'Apply', desc: isRtl ? 'أكمل نموذج التسجيل وأرفق المستندات المطلوبة' : 'Complete the registration form and attach required documents' },
    { step: 2, title: isRtl ? 'القبول' : 'Get Accepted', desc: isRtl ? 'يتم مراجعة طلبك وإعلامك بالقبول' : 'Your application is reviewed and you\'re notified of acceptance' },
    { step: 3, title: isRtl ? 'سجّل في الفصل' : 'Enroll', desc: isRtl ? 'ادفع الرسوم واحصل على جدولك الدراسي' : 'Pay tuition and receive your class schedule' },
    { step: 4, title: isRtl ? 'تعلّم' : 'Learn', desc: isRtl ? 'شاهد المحاضرات وأكمل الواجبات واحضر الحصص المباشرة' : 'Watch lectures, complete assignments, attend live classes' },
    { step: 5, title: isRtl ? 'اختبر' : 'Take Exams', desc: isRtl ? 'قدّم اختباراتك في مراكز معتمدة' : 'Take your exams at certified testing centers' },
    { step: 6, title: isRtl ? 'تخرّج' : 'Graduate', desc: isRtl ? 'احصل على شهادتك واستعد للجامعة' : 'Receive your diploma and prepare for university' },
  ];

  const grades = [
    { range: isRtl ? 'الصفوف ١-٦' : 'Grades 1-6', label: isRtl ? 'التعليم الأساسي' : 'Primary Education', icon: '📚' },
    { range: isRtl ? 'الصفوف ٧-٩' : 'Grades 7-9', label: isRtl ? 'المرحلة الإعدادية' : 'Preparatory', icon: '📖' },
    { range: isRtl ? 'الصف ١٠' : 'Grade 10', label: isRtl ? 'السنة الأولى ثانوي' : '1st Year Secondary', icon: '🔬' },
    { range: isRtl ? 'الصفوف ١١-١٢' : 'Grades 11-12', label: isRtl ? 'علمي / أدبي' : 'Scientific / Literary', icon: '🎓' },
  ];

  const faqs = [
    {
      q: isRtl ? 'هل الشهادة معترف بها؟' : 'Is the diploma recognized?',
      a: isRtl ? 'نعمل على الشراكة مع وزارة التربية والتعليم الليبية لضمان الاعتراف الرسمي بالشهادة.' : 'We are working on partnering with the Libyan Ministry of Education to ensure official recognition of the diploma.',
    },
    {
      q: isRtl ? 'كيف تتم الاختبارات؟' : 'How are exams conducted?',
      a: isRtl ? 'الاختبارات الصغيرة تتم إلكترونياً، أما الاختبارات النهائية فتتم في مراكز معتمدة تحت إشراف مباشر.' : 'Quizzes are conducted online. Final exams take place at certified centers under direct supervision.',
    },
    {
      q: isRtl ? 'ما هي تكلفة الدراسة؟' : 'What is the cost?',
      a: isRtl ? 'سيتم الإعلان عن الرسوم الدراسية قريباً. ستكون أقل بكثير من المدارس الدولية.' : 'Tuition fees will be announced soon. They will be significantly lower than international schools.',
    },
    {
      q: isRtl ? 'هل يمكن للأولياء متابعة تقدم أبنائهم؟' : 'Can parents track their children\'s progress?',
      a: isRtl ? 'نعم! سيتوفر لوحة تحكم خاصة بالأولياء لمتابعة تقدم الطالب يومياً.' : 'Yes! A dedicated parent dashboard will be available to track student progress daily.',
    },
  ];

  return (
    <PageContainer>
      {/* Hero */}
      <section className="relative min-h-[70vh] flex items-center overflow-hidden">
        <div className="absolute inset-0 -z-10">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-20%,rgba(245,158,11,0.12),transparent)]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_80%_80%,rgba(124,58,237,0.08),transparent)]" />
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-20 lg:py-24 text-center">
          <motion.div {...fadeUp(0)} className="inline-flex items-center gap-2 mb-6 px-4 py-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-sm font-bold">
            <Sparkles className="w-4 h-4" />
            {isRtl ? 'التسجيل مفتوح الآن' : 'Enrollment Now Open'}
          </motion.div>

          <motion.h1 {...fadeUp(0.1)} className="text-3xl sm:text-5xl lg:text-7xl font-display font-extrabold leading-[1.1] text-foreground mb-6">
            {isRtl ? (
              <>أكاديمية <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500">EduLibya</span></>
            ) : (
              <>EduLibya <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500">Academy</span></>
            )}
          </motion.h1>

          <motion.p {...fadeUp(0.2)} className="text-xl text-muted-foreground leading-relaxed mb-10 max-w-2xl mx-auto">
            {isRtl
              ? 'أول أكاديمية إلكترونية ليبية تقدم التعليم الأساسي والثانوي بالمنهج الليبي المعتمد. تعلّم من المنزل واحصل على شهادتك.'
              : 'The first Libyan online academy offering primary and secondary education following the official Libyan curriculum. Learn from home and earn your diploma.'
            }
          </motion.p>

          <motion.div {...fadeUp(0.3)} className="flex flex-wrap gap-4 justify-center">
            <Button 
              size="lg" 
              onClick={handleApplyClick}
              className="h-14 px-8 text-base font-bold rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 shadow-2xl shadow-amber-500/30 gap-2 text-white"
            >
              <GraduationCap className="w-5 h-5" />
              {isRtl ? 'قدم طلب الالتحاق الآن' : 'Apply for Admission Now'}
            </Button>
            <Button 
               size="lg" 
               variant="outline" 
               className="h-14 px-8 text-base font-medium rounded-2xl border-2 gap-2"
               onClick={() => {
                 document.getElementById('programs')?.scrollIntoView({ behavior: 'smooth' });
               }}
            >
              {isRtl ? 'عرض البرامج الدراسية' : 'View Academic Programs'}
            </Button>
          </motion.div>

          <motion.div {...fadeUp(0.4)} className="mt-12 flex flex-wrap justify-center gap-8 text-sm text-muted-foreground">
            {[
              { icon: BookOpen, text: isRtl ? 'الصفوف ١-١٢' : 'Grades 1-12' },
              { icon: Shield, text: isRtl ? 'منهج ليبي معتمد' : 'Libyan Curriculum' },
              { icon: Award, text: isRtl ? 'شهادة معترف بها' : 'Certified Diploma' },
              { icon: MapPin, text: isRtl ? 'اختبارات في مراكز معتمدة' : 'Exams at Certified Centers' },
            ].map(({ icon: Icon, text }) => (
              <span key={text} className="flex items-center gap-2 font-medium">
                <Icon className="w-4 h-4 text-amber-500" />
                {text}
              </span>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Grade Levels */}
      <section className="py-20 bg-muted/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div {...fadeUp()} className={`mb-12 ${isRtl ? 'text-right' : ''}`}>
            <p className="text-amber-600 font-semibold mb-2 text-sm uppercase tracking-widest">{isRtl ? 'المراحل الدراسية' : 'Grade Levels'}</p>
            <h2 className="text-4xl font-display font-bold text-foreground">{isRtl ? 'من الصف الأول حتى الثانوية العامة' : 'From 1st Grade to High School'}</h2>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {grades.map((g, i) => (
              <motion.div key={g.range} {...fadeUp(i * 0.1)} className="bg-card border border-border rounded-3xl p-8 text-center hover:border-amber-500/40 hover:shadow-xl transition-all">
                <div className="text-5xl mb-4">{g.icon}</div>
                <h3 className="font-display font-bold text-lg text-foreground mb-1">{g.range}</h3>
                <p className="text-sm text-muted-foreground">{g.label}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Live Programs Listing */}
      <section id="programs" className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div {...fadeUp()} className={`mb-12 ${isRtl ? 'text-right' : ''}`}>
             <h2 className="text-4xl font-display font-bold text-foreground">
               {isRtl ? 'البرامج الدراسية المتاحة' : 'Available Academic Programs'}
             </h2>
             <p className="mt-4 text-lg text-muted-foreground">
               {isRtl 
                 ? 'اختر البرنامج المناسب وابدأ رحلتك الأكاديمية نحو النجاح.'
                 : 'Choose the right program and begin your academic journey towards success.'}
             </p>
          </motion.div>

          {isLoading ? (
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
               {[1,2,3].map(i => (
                 <div key={i} className="h-64 rounded-3xl bg-muted/50 animate-pulse border border-border"></div>
               ))}
             </div>
          ) : programs?.length > 0 ? (
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
               {programs.map((prog: any, i: number) => (
                 <motion.div 
                   key={prog.id} 
                   {...fadeUp(i * 0.1)} 
                   className="bg-card border border-border rounded-3xl p-8 hover:border-amber-500/40 hover:shadow-xl transition-all flex flex-col"
                 >
                   <div className="w-14 h-14 rounded-2xl bg-amber-100 flex items-center justify-center mb-5">
                      <GraduationCap className="w-7 h-7 text-amber-600" />
                   </div>
                   <h3 className={`font-display font-bold text-2xl text-foreground mb-2 ${isRtl ? 'text-right' : ''}`}>
                     {isRtl ? prog.nameAr : prog.name}
                   </h3>
                   <p className={`text-sm text-muted-foreground leading-relaxed flex-1 ${isRtl ? 'text-right' : ''}`}>
                     {isRtl ? prog.descriptionAr : prog.description}
                   </p>
                   
                   <div className={`mt-6 pt-6 border-t border-border flex ${isRtl ? 'flex-row-reverse' : ''} justify-between text-sm`}>
                     <div className={`flex flex-col ${isRtl ? 'items-end' : 'items-start'}`}>
                       <span className="text-muted-foreground">{isRtl ? 'المرحلة' : 'Grade'}</span>
                       <span className="font-semibold text-foreground">{prog.gradeLevel}</span>
                     </div>
                     <div className={`flex flex-col ${isRtl ? 'items-end' : 'items-start'}`}>
                       <span className="text-muted-foreground">{isRtl ? 'المدة' : 'Duration'}</span>
                       <span className="font-semibold text-foreground">
                         {prog.durationYears} {isRtl ? 'سنوات' : 'Years'}
                       </span>
                     </div>
                   </div>

                   <Button 
                     className="w-full mt-6 bg-amber-500 hover:bg-amber-600 text-white rounded-xl h-12"
                     onClick={handleApplyClick}
                   >
                     {isRtl ? 'تقديم طلب' : 'Apply Now'}
                   </Button>
                 </motion.div>
               ))}
             </div>
          ) : (
             <div className="text-center py-20 bg-card rounded-3xl border border-dashed border-border">
               <GraduationCap className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
               <h3 className="text-xl font-bold">{isRtl ? 'لا توجد برامج حالياً' : 'No programs available presently'}</h3>
               <p className="text-muted-foreground mt-2">{isRtl ? 'يرجى العودة لاحقاً.' : 'Please check back later.'}</p>
             </div>
          )}
        </div>
      </section>

      {/* Features */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div {...fadeUp()} className={`mb-12 text-center`}>
            <p className="text-amber-600 font-semibold mb-2 text-sm uppercase tracking-widest">{isRtl ? 'لماذا أكاديمية EduLibya؟' : 'Why EduLibya Academy?'}</p>
            <h2 className="text-4xl font-display font-bold text-foreground">{isRtl ? 'تعليم عالي الجودة من المنزل' : 'Quality Education From Home'}</h2>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((f, i) => (
              <motion.div key={f.title} {...fadeUp(i * 0.08)} className="group bg-card border border-border rounded-3xl p-8 hover:border-amber-500/30 hover:shadow-xl transition-all">
                <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${f.color} flex items-center justify-center mb-5 shadow-lg group-hover:scale-110 transition-transform`}>
                  <f.icon className="w-7 h-7 text-white" />
                </div>
                <h3 className={`font-display font-bold text-lg text-foreground mb-2 ${isRtl ? 'text-right' : ''}`}>{f.title}</h3>
                <p className={`text-sm text-muted-foreground leading-relaxed ${isRtl ? 'text-right' : ''}`}>{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 bg-muted/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div {...fadeUp()} className="mb-12 text-center">
            <p className="text-amber-600 font-semibold mb-2 text-sm uppercase tracking-widest">{isRtl ? 'كيف يعمل' : 'How It Works'}</p>
            <h2 className="text-4xl font-display font-bold text-foreground">{isRtl ? 'رحلتك الأكاديمية' : 'Your Academic Journey'}</h2>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {steps.map((s, i) => (
              <motion.div key={s.step} {...fadeUp(i * 0.08)} className="relative bg-card border border-border rounded-3xl p-8 hover:shadow-lg transition-all">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center text-white font-display font-bold text-lg shadow-lg">
                    {s.step}
                  </div>
                  <h3 className={`font-display font-bold text-lg text-foreground`}>{s.title}</h3>
                </div>
                <p className={`text-sm text-muted-foreground leading-relaxed ${isRtl ? 'text-right' : ''}`}>{s.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-20">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div {...fadeUp()} className="mb-12 text-center">
            <p className="text-amber-600 font-semibold mb-2 text-sm uppercase tracking-widest">{isRtl ? 'أسئلة شائعة' : 'FAQ'}</p>
            <h2 className="text-4xl font-display font-bold text-foreground">{isRtl ? 'الأسئلة الشائعة' : 'Frequently Asked Questions'}</h2>
          </motion.div>

          <div className="space-y-4">
            {faqs.map((faq, i) => (
              <motion.div key={i} {...fadeUp(i * 0.08)} className="bg-card border border-border rounded-2xl p-6">
                <h3 className={`font-bold text-foreground mb-2 flex items-start gap-2 ${isRtl ? 'flex-row-reverse text-right' : ''}`}>
                  <CheckCircle2 className="w-5 h-5 text-amber-500 mt-0.5 shrink-0" />
                  {faq.q}
                </h3>
                <p className={`text-sm text-muted-foreground leading-relaxed ${isRtl ? 'text-right pe-7' : 'ps-7'}`}>{faq.a}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            {...fadeUp()}
            className="relative overflow-hidden rounded-[3rem] bg-gradient-to-br from-amber-500 via-orange-500 to-rose-500 p-12 text-center text-white"
          >
            <div className="absolute top-0 start-0 w-72 h-72 bg-white/10 rounded-full -translate-x-1/2 -translate-y-1/2 blur-3xl" />
            <div className="absolute bottom-0 end-0 w-72 h-72 bg-rose-400/20 rounded-full translate-x-1/2 translate-y-1/2 blur-3xl" />

            <div className="relative">
              <GraduationCap className="w-16 h-16 mx-auto mb-6 opacity-80" />
              <h2 className="text-4xl lg:text-5xl font-display font-extrabold mb-4">
                {isRtl ? 'كن أول من ينضم!' : 'Be the First to Join!'}
              </h2>
              <p className="text-white/80 text-lg mb-8 max-w-xl mx-auto">
                {isRtl 
                  ? 'سجل طلب الالتحاق الآن وانضم إلى أول أكاديمية ذكية في ليبيا. مستقبلك الأكاديمي يبدأ من هنا.'
                  : 'Apply for admission now and join the first smart academy in Libya. Your academic future starts here.'
                }
              </p>
              <Button 
                size="lg" 
                onClick={handleApplyClick}
                className="h-14 px-10 text-base font-bold rounded-2xl bg-white text-amber-600 hover:bg-white/90 shadow-2xl gap-2"
              >
                {isRtl ? 'التحق الآن' : 'Enroll Now'}
                <Arrow className="w-5 h-5" />
              </Button>
            </div>
          </motion.div>
        </div>
      </section>
    </PageContainer>
  );
}
