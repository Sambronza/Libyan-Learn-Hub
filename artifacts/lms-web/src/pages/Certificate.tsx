import React, { useEffect, useState } from 'react';
import { useRoute } from 'wouter';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Award, Printer, CheckCircle2, XCircle } from 'lucide-react';

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, '') + '/api';

/**
 * Public certificate view + verification page (/certificate/:code).
 * Shareable and printable (print → save as PDF).
 */
export default function Certificate() {
  const [, params] = useRoute('/certificate/:code');
  const { language } = useLanguage();
  const isAr = language === 'ar';
  const [data, setData] = useState<any>(null);
  const [notFound, setNotFound] = useState(false);
  const [loading, setLoading] = useState(true);

  const code = params?.code || '';

  useEffect(() => {
    if (!code) return;
    fetch(`${API_BASE}/certificates/verify/${encodeURIComponent(code)}`)
      .then((res) => res.json())
      .then((json) => {
        if (json.valid) setData(json.certificate);
        else setNotFound(true);
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [code]);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">…</div>;
  }

  if (notFound || !data) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-4">
        <XCircle className="w-16 h-16 text-destructive" />
        <h1 className="text-2xl font-display font-bold">{isAr ? 'شهادة غير صالحة' : 'Invalid Certificate'}</h1>
        <p className="text-muted-foreground text-center max-w-md">
          {isAr
            ? `لا توجد شهادة مسجلة بالرمز "${code}". تأكد من الرمز وحاول مرة أخرى.`
            : `No certificate is registered with code "${code}". Check the code and try again.`}
        </p>
      </div>
    );
  }

  const issued = new Date(data.issuedAt);

  return (
    <div className="min-h-screen bg-muted/30 py-10 px-4 print:bg-white print:py-0">
      <div className="max-w-3xl mx-auto">
        {/* Actions (hidden in print) */}
        <div className="flex justify-between items-center mb-6 print:hidden">
          <div className="flex items-center gap-2 text-success text-sm font-bold">
            <CheckCircle2 className="w-5 h-5" />
            {isAr ? 'شهادة موثّقة من المنصة' : 'Verified by Libyan Learn Hub'}
          </div>
          <Button onClick={() => window.print()} className="gap-2">
            <Printer className="w-4 h-4" /> {isAr ? 'طباعة / حفظ PDF' : 'Print / Save PDF'}
          </Button>
        </div>

        {/* Certificate body */}
        <div className="bg-white text-slate-900 rounded-2xl border-8 border-double border-amber-600/60 shadow-2xl p-10 sm:p-14 text-center relative overflow-hidden print:shadow-none print:rounded-none">
          <div className="absolute top-0 left-0 w-40 h-40 bg-warning/10 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2 opacity-60" />
          <div className="absolute bottom-0 right-0 w-40 h-40 bg-warning/10 rounded-full blur-3xl translate-x-1/2 translate-y-1/2 opacity-60" />

          {/* Platform logo */}
          <img
            src="/images/logo.png"
            alt="EduLibya"
            className="h-16 mx-auto mb-3 object-contain select-none"
            draggable={false}
          />
          <Award className="w-10 h-10 text-warning mx-auto mb-3" />
          <div className="text-xs tracking-[0.3em] uppercase text-slate-500 mb-1">Libyan Learn Hub — EduLibya</div>
          <h1 className="font-display text-3xl sm:text-4xl font-extrabold text-slate-900 mb-1">
            {isAr ? 'شهادة إتمام دورة' : 'Certificate of Completion'}
          </h1>
          <div className="text-sm text-slate-500 mb-8">{isAr ? 'Certificate of Completion' : 'شهادة إتمام دورة'}</div>

          <p className="text-slate-500 text-sm mb-2">{isAr ? 'تُمنح هذه الشهادة إلى' : 'This certificate is awarded to'}</p>
          <div className="text-3xl sm:text-4xl font-extrabold text-warning mb-1" style={{ fontFamily: 'serif' }}>
            {isAr ? (data.studentNameAr || data.studentName) : data.studentName}
          </div>
          {data.studentNameAr && !isAr && <div className="text-lg text-slate-500 mb-6">{data.studentNameAr}</div>}

          <p className="text-slate-500 text-sm mt-6 mb-2">{isAr ? 'لإتمامه بنجاح دورة' : 'for successfully completing the course'}</p>
          <div className="text-xl sm:text-2xl font-bold text-slate-900 mb-1">
            {isAr ? (data.courseTitleAr || data.courseTitle) : data.courseTitle}
          </div>
          {data.mode === 'quiz' && data.quizScore && (
            <div className="text-sm text-slate-600 mt-2">
              {isAr ? `اجتاز الاختبار النهائي بنتيجة ${data.quizScore}%` : `Passed the final exam with a score of ${data.quizScore}%`}
            </div>
          )}

          <div className="flex justify-between items-end mt-12 pt-8 border-t border-slate-200 text-sm">
            <div className="text-start">
              <div className="font-bold text-slate-800">{data.teacherName}</div>
              <div className="text-slate-500 text-xs">{isAr ? 'المعلّم' : 'Instructor'}</div>
            </div>
            <div className="text-center">
              <div className="font-mono text-xs text-slate-400">{data.code}</div>
              <div className="text-slate-500 text-[10px]">
                {isAr ? 'تحقق من الشهادة على' : 'Verify at'} eduonline.net.ly/certificate/{data.code}
              </div>
            </div>
            <div className="text-end">
              <div className="font-bold text-slate-800">
                {issued.toLocaleDateString(isAr ? 'ar-LY' : 'en-GB', { year: 'numeric', month: 'long', day: 'numeric' })}
              </div>
              <div className="text-slate-500 text-xs">{isAr ? 'تاريخ الإصدار' : 'Date issued'}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
