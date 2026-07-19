import { PageContainer } from '@/components/layout/PageContainer';
import { useLanguage } from '@/contexts/LanguageContext';
import { ShieldCheck } from 'lucide-react';

/**
 * Privacy Policy. Content is a bilingual starting template — the wording
 * should be reviewed by legal counsel before launch.
 */
export default function Privacy() {
  const { language, dir } = useLanguage();
  const ar = language === 'ar';

  const sections = ar
    ? [
        { h: 'المعلومات التي نجمعها', b: 'نجمع المعلومات التي تقدّمها عند إنشاء حساب (مثل الاسم والبريد الإلكتروني ورقم الهاتف)، بالإضافة إلى بيانات الاستخدام مثل الدورات التي تتابعها وتقدّمك فيها.' },
        { h: 'كيفية استخدام المعلومات', b: 'نستخدم معلوماتك لتقديم الخدمة التعليمية وتحسينها، ومعالجة المدفوعات، وإرسال الإشعارات المتعلقة بحسابك، وضمان أمن المنصة.' },
        { h: 'مشاركة المعلومات', b: 'لا نبيع بياناتك الشخصية. قد نشارك معلومات محدودة مع مزوّدي الخدمات (مثل معالجة المدفوعات واستضافة الوسائط) بالقدر اللازم لتشغيل المنصة فقط.' },
        { h: 'ملفات تعريف الارتباط', b: 'نستخدم ملفات تعريف الارتباط والتقنيات المشابهة للحفاظ على تسجيل دخولك وتذكّر تفضيلاتك وتحليل أداء المنصة.' },
        { h: 'أمن البيانات', b: 'نطبّق إجراءات أمنية معقولة لحماية بياناتك، بما في ذلك تشفير كلمات المرور. ومع ذلك لا يمكن ضمان أمان أي نظام عبر الإنترنت بشكل مطلق.' },
        { h: 'حقوقك', b: 'يحق لك الوصول إلى بياناتك الشخصية أو تصحيحها أو طلب حذفها عبر التواصل معنا على البريد الإلكتروني للدعم.' },
        { h: 'التواصل معنا', b: 'لأي استفسار يتعلق بالخصوصية، يُرجى مراسلتنا على support@edulibya.ly.' },
      ]
    : [
        { h: 'Information We Collect', b: 'We collect the information you provide when creating an account (such as name, email, and phone number), along with usage data such as the courses you follow and your progress in them.' },
        { h: 'How We Use Information', b: 'We use your information to provide and improve the learning service, process payments, send account-related notifications, and keep the platform secure.' },
        { h: 'Information Sharing', b: 'We do not sell your personal data. We may share limited information with service providers (such as payment processing and media hosting) only as needed to operate the platform.' },
        { h: 'Cookies', b: 'We use cookies and similar technologies to keep you signed in, remember your preferences, and analyse platform performance.' },
        { h: 'Data Security', b: 'We apply reasonable security measures to protect your data, including password hashing. However, no online system can be guaranteed to be perfectly secure.' },
        { h: 'Your Rights', b: 'You may access, correct, or request deletion of your personal data by contacting us at our support email.' },
        { h: 'Contact Us', b: 'For any privacy-related enquiry, please email us at support@edulibya.ly.' },
      ];

  return (
    <PageContainer>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10 lg:py-16" dir={dir}>
        <div className="flex items-center gap-3 mb-2">
          <ShieldCheck className="w-7 h-7 text-primary shrink-0" />
          <h1 className="text-2xl sm:text-3xl font-display font-bold text-foreground">
            {ar ? 'سياسة الخصوصية' : 'Privacy Policy'}
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
