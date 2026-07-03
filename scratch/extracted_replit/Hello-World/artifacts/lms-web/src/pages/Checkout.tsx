import React, { useState } from 'react';
import { useRoute, useLocation } from 'wouter';
import { useQuery, useMutation } from '@tanstack/react-query';
import { PageContainer } from '@/components/layout/PageContainer';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { motion } from 'framer-motion';
import { CheckCircle, Copy, Banknote, Smartphone, CreditCard, ArrowLeft, AlertCircle } from 'lucide-react';

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, '') + '/api';

import { Wallet } from 'lucide-react';

const PAYMENT_METHODS = [
  { id: 'gateway', label: 'بوابة الدفع الإلكتروني', labelEn: 'Secure Payment Gateway', icon: CreditCard },
  { id: 'wallet', label: 'المحفظة الإلكترونية', labelEn: 'My Wallet', icon: Wallet },
];

function copyToClipboard(text: string) {
  navigator.clipboard?.writeText(text).catch(() => {});
}

export default function Checkout() {
  const [, params] = useRoute('/checkout/:type/:id');
  const [, navigate] = useLocation();
  const { language } = useLanguage();
  const { user } = useAuth();
  const isAr = language === 'ar';

  const type = params?.type as 'course' | 'session';
  const id = parseInt(params?.id || '0');

  const [method, setMethod] = useState('gateway');
  const [step, setStep] = useState<'select' | 'done'>('select');

  const { data: item } = useQuery({
    queryKey: [type, id],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/${type === 'course' ? 'courses' : 'live-sessions'}/${id}`);
      return res.json();
    },
    enabled: !!id,
  });

  // Fetch live wallet balance so the display is never stale after a purchase
  const { data: walletData } = useQuery({
    queryKey: ['wallet-balance'],
    queryFn: async () => {
      const token = localStorage.getItem('lms_token');
      const res = await fetch(`${API_BASE}/wallet/balance`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return { balance: '0' };
      return res.json();
    },
    enabled: !!user,
  });

  const initiateMutation = useMutation({
    mutationFn: async () => {
      const token = localStorage.getItem('lms_token');
      const res = await fetch(`${API_BASE}/payments/create-session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ type, itemId: id, method }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Payment request failed');
      return data;
    },
    onSuccess: (data) => {
      if (data.url) {
        if (data.url.includes('success=true')) {
            setStep('done');
        } else {
            // Redirect to the payment gateway
            window.location.href = data.url;
        }
      }
    },
    onError: (err: any) => {
      // Error is now shown via the isPending/isError state in the button
      console.error('Payment initiation failed:', err.message);
    },
  });

// Replaced confirmMutation and handleCopy
  const price = item?.price ?? 0;
  const title = isAr ? item?.titleAr : item?.title;
  const isFree = price === 0;
  // Use live balance fetched from server (not stale auth context)
  const liveBalance = parseFloat(walletData?.balance || user?.balance || "0");

  if (!item) {
    return <PageContainer><div className="py-40 text-center text-muted-foreground">جاري التحميل...</div></PageContainer>;
  }

  return (
    <PageContainer>
      <div className="max-w-2xl mx-auto px-4 py-16">
        {step === 'done' ? (
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="text-center py-20">
            <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-6">
              <CheckCircle className="w-10 h-10 text-green-500" />
            </div>
            <h2 className="text-3xl font-display font-bold text-foreground mb-3">
              {isFree ? 'تم التسجيل بنجاح!' : 'تم استلام طلب الدفع!'}
            </h2>
            <p className="text-muted-foreground mb-8 text-lg">
              {isFree
                ? 'يمكنك الآن الوصول إلى محتوى الدورة'
                : 'لقد تم الدفع والتسجيل بنجاح. نتمنى لك تعلماً ممتعاً!'}
            </p>
            <div className="flex gap-3 justify-center">
              <Button onClick={() => navigate(type === 'course' ? `/courses/${id}` : '/live-sessions')} className="rounded-2xl h-12 px-8">
                {type === 'course' ? 'انتقل إلى الدورة' : 'عرض الجلسات'}
              </Button>
              <Button variant="outline" onClick={() => navigate('/dashboard')} className="rounded-2xl h-12 px-8">
                لوحة التحكم
              </Button>
            </div>
          </motion.div>
        ) : (
          <>
            {/* Header */}
            <button onClick={() => navigate(-1 as any)} className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-8 transition-colors">
              <ArrowLeft className="w-4 h-4" />
              <span>رجوع</span>
            </button>

            <div className="bg-card rounded-2xl border border-border p-6 mb-6">
              <div className="flex items-start gap-4">
                {item.thumbnailUrl && (
                  <img src={item.thumbnailUrl} alt={title} className="w-20 h-14 object-cover rounded-xl flex-shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-muted-foreground mb-1">{type === 'course' ? 'دورة' : 'جلسة مباشرة'}</p>
                  <h3 className="font-display font-bold text-lg text-foreground mb-1 line-clamp-2">{title}</h3>
                  <p className="text-sm text-muted-foreground">{item.teacherName}</p>
                </div>
                <div className="text-start flex-shrink-0">
                  <div className="text-2xl font-extrabold text-primary">
                    {isFree ? 'مجاني' : `${price} LYD`}
                  </div>
                </div>
              </div>
            </div>

            {step === 'select' && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                <h2 className="text-xl font-display font-bold text-foreground mb-4">اختر طريقة الدفع</h2>
                {isFree ? (
                  <div className="bg-green-50 border border-green-200 rounded-2xl p-6 mb-6 flex items-center gap-4">
                    <CheckCircle className="w-8 h-8 text-green-500 flex-shrink-0" />
                    <div>
                      <p className="font-bold text-green-800">هذه الدورة مجانية!</p>
                      <p className="text-sm text-green-600">يمكنك التسجيل مباشرة بدون أي رسوم.</p>
                    </div>
                  </div>
                ) : (
                  <div className="grid gap-3 mb-6">
                    {PAYMENT_METHODS.map(pm => {
                      const Icon = pm.icon;
                      const isWallet = pm.id === 'wallet';
                      const balance = liveBalance;
                      const insufficient = isWallet && balance < price;

                      return (
                        <button
                          key={pm.id}
                          onClick={() => !insufficient && setMethod(pm.id)}
                          disabled={insufficient}
                          className={`flex items-center gap-4 p-4 rounded-2xl border-2 transition-all text-start 
                            ${method === pm.id ? 'border-primary bg-primary/5' : 'border-border bg-card hover:border-primary/30'}
                            ${insufficient ? 'opacity-50 cursor-not-allowed grayscale' : ''}
                          `}
                        >
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${method === pm.id ? 'bg-primary text-white' : 'bg-muted'}`}>
                            <Icon className="w-5 h-5" />
                          </div>
                          <div className="flex-1">
                            <div className="font-bold text-foreground">{pm.label}</div>
                            <div className="text-sm text-muted-foreground">{pm.labelEn}</div>
                            {isWallet && (
                              <div className={`text-xs mt-1 font-bold ${insufficient ? 'text-destructive' : 'text-primary'}`}>
                                Balance: {balance.toFixed(2)} LYD {insufficient && '(Insufficient)'}
                              </div>
                            )}
                          </div>
                          <div className={`ms-auto w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${method === pm.id ? 'border-primary bg-primary' : 'border-muted-foreground/30'}`}>
                            {method === pm.id && <div className="w-2 h-2 rounded-full bg-white" />}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}

                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-6 flex gap-3">
                  <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-amber-700">
                    {isFree
                      ? 'الدورة مجانية تماماً — ستحصل على وصول فوري بعد الضغط على "سجّل الآن".'
                      : 'سيتم توجيهك إلى بوابة الدفع الآمنة لإتمام الدفع ببطاقتك أو محفظتك الإلكترونية.'}
                  </p>
                </div>

                <Button
                  size="lg"
                  className="w-full h-14 text-lg rounded-2xl bg-gradient-to-r from-primary to-teal-500"
                  onClick={() => initiateMutation.mutate()}
                  disabled={initiateMutation.isPending}
                >
                  {initiateMutation.isPending ? 'جاري المعالجة...' : isFree ? 'سجّل الآن مجاناً' : 'متابعة الدفع'}
                </Button>
                {initiateMutation.isError && (
                  <p className="text-sm text-destructive text-center mt-2">
                    {(initiateMutation.error as any)?.message || 'حدث خطأ. يرجى المحاولة مرة أخرى.'}
                  </p>
                )}
              </motion.div>
            )}

// Removed manual instructions section
          </>
        )}
      </div>
    </PageContainer>
  );
}
