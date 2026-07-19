import { PageContainer } from '@/components/layout/PageContainer';
import { useLanguage } from '@/contexts/LanguageContext';
import { FileText } from 'lucide-react';

/**
 * Terms of Service. Content is a bilingual starting template — the wording
 * should be reviewed by legal counsel before launch.
 */
export default function Terms() {
  const { language, dir } = useLanguage();
  const ar = language === 'ar';

  const sections = ar
    ? [
        { h: 'قبول الشروط', b: 'باستخدامك منصة إديوليبيا للتعلّم، فإنك توافق على الالتزام بهذه الشروط والأحكام. إذا كنت لا توافق على أي جزء منها، يُرجى التوقف عن استخدام المنصة.' },
        { h: 'حسابات المستخدمين', b: 'أنت مسؤول عن الحفاظ على سرية بيانات حسابك وكلمة المرور، وعن جميع الأنشطة التي تتم من خلال حسابك. يجب أن تكون المعلومات التي تقدمها عند التسجيل دقيقة وكاملة.' },
        { h: 'المحتوى التعليمي', b: 'يحتفظ المعلمون بملكية المحتوى الذي ينشرونه، ويمنحون المنصة ترخيصاً لعرضه وتوزيعه على الطلاب. يلتزم المعلمون بأن يكون المحتوى من إعدادهم وألا ينتهك حقوق الغير.' },
        { h: 'المدفوعات والاشتراكات', b: 'تُدفع رسوم الدورات والاشتراكات وفقاً للأسعار المعلنة. تخضع عمليات الاسترداد لسياسة الاسترداد المعمول بها على المنصة.' },
        { h: 'السلوك المحظور', b: 'يُمنع استخدام المنصة لأي غرض غير قانوني، أو نشر محتوى مسيء أو منتهك لحقوق النشر، أو محاولة الإخلال بأمن المنصة أو الوصول غير المصرّح به إليها.' },
        { h: 'إنهاء الخدمة', b: 'يحق للمنصة تعليق أو إنهاء أي حساب يخالف هذه الشروط دون إشعار مسبق.' },
        { h: 'التعديلات', b: 'قد نقوم بتحديث هذه الشروط من وقت لآخر. استمرارك في استخدام المنصة بعد التحديث يعني موافقتك على الشروط المُعدّلة.' },
      ]
    : [
        { h: 'Acceptance of Terms', b: 'By using the EduLibya learning platform, you agree to be bound by these Terms of Service. If you do not agree with any part of them, please discontinue use of the platform.' },
        { h: 'User Accounts', b: 'You are responsible for safeguarding your account credentials and password, and for all activity that occurs under your account. Information provided at registration must be accurate and complete.' },
        { h: 'Educational Content', b: 'Teachers retain ownership of the content they publish and grant the platform a licence to display and distribute it to students. Teachers warrant that their content is original and does not infringe the rights of others.' },
        { h: 'Payments & Subscriptions', b: 'Course fees and subscriptions are payable at the advertised prices. Refunds are handled according to the platform’s prevailing refund policy.' },
        { h: 'Prohibited Conduct', b: 'You may not use the platform for any unlawful purpose, post abusive or copyright-infringing content, or attempt to breach the platform’s security or gain unauthorised access.' },
        { h: 'Termination', b: 'The platform may suspend or terminate any account that violates these Terms without prior notice.' },
        { h: 'Changes', b: 'We may update these Terms from time to time. Continued use of the platform after an update constitutes acceptance of the revised Terms.' },
      ];

  return (
    <PageContainer>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10 lg:py-16" dir={dir}>
        <div className="flex items-center gap-3 mb-2">
          <FileText className="w-7 h-7 text-primary shrink-0" />
          <h1 className="text-2xl sm:text-3xl font-display font-bold text-foreground">
            {ar ? 'شروط الخدمة' : 'Terms of Service'}
          </h1>
        </div>
        <p className="text-sm text-muted-foreground mb-8">
          {ar ? 'آخر تحديث: ' : 'Last updated: '}
          {new Date().toLocaleDateString(ar ? 'ar-LY' : 'en-GB', { year: 'numeric', month: 'long', day: 'numeric' })}
        </p>

        <div className="space-y-8">
          {sections.map((s, i) => (
            <section key={i}>
              <h2 className="text-lg font-semibold text-foreground mb-2">{`${i + 1}. ${s.h}`}</h2>
              <p className="text-muted-foreground leading-relaxed">{s.b}</p>
            </section>
          ))}
        </div>
      </div>
    </PageContainer>
  );
}
