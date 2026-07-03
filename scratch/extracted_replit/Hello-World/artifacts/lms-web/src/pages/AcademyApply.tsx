import React, { useState, useEffect } from 'react';
import { PageContainer } from '@/components/layout/PageContainer';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { useApi } from '@/hooks/useApi';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { GraduationCap, ArrowRight, ArrowLeft, CheckCircle2, User, Phone, Mail, FileText, School, Loader2 } from 'lucide-react';
import { toast } from 'react-hot-toast';

export default function AcademyApply() {
  const { language } = useLanguage();
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const api = useApi();
  const isRtl = language === 'ar';
  
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    programId: '',
    gradeLevel: '',
    previousSchool: '',
    previousSchoolAr: '',
    parentName: '',
    parentNameAr: '',
    parentPhone: '',
    parentEmail: '',
    notes: '',
  });

  const { data: programs, isLoading: loadingPrograms } = useQuery({
    queryKey: ['academy-programs'],
    queryFn: () => api.get('/academy/programs')
  });

  const { data: existingApp, isLoading: loadingApp } = useQuery({
    queryKey: ['academy-application'],
    queryFn: () => api.get('/academy/my-application'),
    // Only fetch if user is authenticated; avoids 401 errors for guests
    enabled: !!user,
  });

  // Redirect unauthenticated visitors to login with redirect param
  useEffect(() => {
    if (user === null) {
      setLocation('/login?redirect=/academy/apply');
    }
  }, [user, setLocation]);

  const applyMutation = useMutation({
    mutationFn: (data: any) => api.post('/academy/apply', data),
    onSuccess: () => {
      toast.success(isRtl ? 'تم تقديم الطلب بنجاح' : 'Application submitted successfully');
      setLocation('/academy/dashboard');
    },
    onError: (err: any) => {
      toast.error(err.message || (isRtl ? 'حدث خطأ ما' : 'An error occurred'));
    }
  });

  // If they already have a pending app, redirect them to dashboard
  useEffect(() => {
    if (existingApp && existingApp.length > 0) {
      const hasPending = existingApp.some((a: any) => a.status === 'pending');
      if (hasPending) {
        setLocation('/academy/dashboard');
      }
    }
  }, [existingApp, setLocation]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleNext = () => setStep(s => Math.min(s + 1, 4));
  const handlePrev = () => setStep(s => Math.max(s - 1, 1));
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.programId || !formData.gradeLevel || !formData.parentName || !formData.parentPhone) {
      toast.error(isRtl ? 'يرجى إكمال جميع الحقول المطلوبة' : 'Please complete all required fields');
      return;
    }
    applyMutation.mutate(formData);
  };

  if (loadingPrograms || loadingApp) {
    return <PageContainer><div className="flex justify-center py-40"><Loader2 className="w-8 h-8 animate-spin text-amber-500" /></div></PageContainer>;
  }

  const ArrowNext = isRtl ? ArrowLeft : ArrowRight;
  const ArrowPrev = isRtl ? ArrowRight : ArrowLeft;

  const renderStepIndicator = () => (
    <div className="flex items-center justify-center mb-12">
      {[1, 2, 3, 4].map((num) => (
        <React.Fragment key={num}>
          <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm transition-colors ${
            step >= num ? 'bg-amber-500 text-white shadow-lg' : 'bg-muted text-muted-foreground'
          }`}>
            {step > num ? <CheckCircle2 className="w-5 h-5" /> : num}
          </div>
          {num < 4 && (
            <div className={`w-16 h-1 transition-colors ${step > num ? 'bg-amber-500' : 'bg-muted'}`} />
          )}
        </React.Fragment>
      ))}
    </div>
  );

  return (
    <PageContainer>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center mb-12">
          <div className="w-16 h-16 rounded-2xl bg-amber-100 flex items-center justify-center mx-auto mb-6">
            <GraduationCap className="w-8 h-8 text-amber-600" />
          </div>
          <h1 className="text-3xl font-display font-bold text-foreground mb-4">
            {isRtl ? 'طلب الالتحاق بالأكاديمية' : 'Academy Admission Application'}
          </h1>
          <p className="text-muted-foreground">
            {isRtl ? 'يرجى إكمال المعلومات التالية لتقديم طلبك' : 'Please complete the following information to submit your application'}
          </p>
        </div>

        {renderStepIndicator()}

        <div className="bg-card border border-border rounded-3xl p-8 shadow-sm">
          <form onSubmit={handleSubmit}>
            {/* Step 1: Program Selection */}
            {step === 1 && (
              <div className="space-y-6 animate-in slide-in-from-bottom-4">
                <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                  <School className="w-5 h-5 text-amber-500" />
                  {isRtl ? 'اختيار البرنامج' : 'Select Program'}
                </h2>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">{isRtl ? 'البرنامج الدراسي' : 'Academic Program'} *</label>
                    <div className="grid grid-cols-1 gap-4">
                      {programs?.map((prog: any) => (
                        <label 
                          key={prog.id} 
                          className={`flex items-center p-4 border rounded-xl cursor-pointer transition-colors ${formData.programId === prog.id.toString() ? 'border-amber-500 bg-amber-50/50 dark:bg-amber-500/10' : 'border-border hover:border-amber-500/50'}`}
                        >
                          <input 
                            type="radio" 
                            name="programId" 
                            value={prog.id} 
                            checked={formData.programId === prog.id.toString()}
                            onChange={handleChange}
                            className="hidden" 
                          />
                          <div className={`flex-1 ${isRtl ? 'text-right' : ''}`}>
                            <div className="font-bold text-lg">{isRtl ? prog.nameAr : prog.name}</div>
                            <div className="text-sm text-muted-foreground">{prog.gradeLevel}</div>
                          </div>
                          <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${formData.programId === prog.id.toString() ? 'border-amber-500' : 'border-muted-foreground'}`}>
                            {formData.programId === prog.id.toString() && <div className="w-3 h-3 rounded-full bg-amber-500" />}
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">{isRtl ? 'الصف الدراسي الحالي' : 'Current Grade Level'} *</label>
                    <select
                      name="gradeLevel"
                      value={formData.gradeLevel}
                      onChange={handleChange}
                      className="w-full bg-background border border-input rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-amber-500 text-foreground"
                      required
                    >
                      <option value="">{isRtl ? 'اختر الصف' : 'Select Grade'}</option>
                      {['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'].map(g => (
                        <option key={g} value={g}>{isRtl ? `الصف ${g}` : `Grade ${g}`}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* Step 2: Parent Information */}
            {step === 2 && (
              <div className="space-y-6 animate-in slide-in-from-bottom-4">
                <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                  <User className="w-5 h-5 text-amber-500" />
                  {isRtl ? 'معلومات ولي الأمر' : 'Parent Information'}
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium mb-2">{isRtl ? 'اسم ولي الأمر (بالعربية)' : 'Parent Name (Arabic)'} *</label>
                    <input
                      type="text"
                      name="parentNameAr"
                      value={formData.parentNameAr}
                      onChange={handleChange}
                      className="w-full bg-background border border-input rounded-xl px-4 py-3 text-foreground"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">{isRtl ? 'اسم ولي الأمر (بالإنجليزية)' : 'Parent Name (English)'} *</label>
                    <input
                      type="text"
                      name="parentName"
                      value={formData.parentName}
                      onChange={handleChange}
                      className="w-full bg-background border border-input rounded-xl px-4 py-3 text-foreground"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2 flex items-center gap-2">
                       <Phone className="w-4 h-4" /> {isRtl ? 'رقم الهاتف' : 'Phone Number'} *
                    </label>
                    <input
                      type="tel"
                      name="parentPhone"
                      value={formData.parentPhone}
                      onChange={handleChange}
                      className="w-full bg-background border border-input rounded-xl px-4 py-3 text-foreground"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2 flex items-center gap-2">
                       <Mail className="w-4 h-4" /> {isRtl ? 'البريد الإلكتروني' : 'Email Address'}
                    </label>
                    <input
                      type="email"
                      name="parentEmail"
                      value={formData.parentEmail}
                      onChange={handleChange}
                      className="w-full bg-background border border-input rounded-xl px-4 py-3 text-foreground"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Step 3: Academic History */}
            {step === 3 && (
              <div className="space-y-6 animate-in slide-in-from-bottom-4">
                <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                  <FileText className="w-5 h-5 text-amber-500" />
                  {isRtl ? 'التاريخ الأكاديمي' : 'Academic History'}
                </h2>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">{isRtl ? 'المدرسة السابقة (بالعربية)' : 'Previous School (Arabic)'}</label>
                    <input
                      type="text"
                      name="previousSchoolAr"
                      value={formData.previousSchoolAr}
                      onChange={handleChange}
                      className="w-full bg-background border border-input rounded-xl px-4 py-3 text-foreground"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">{isRtl ? 'المدرسة السابقة (بالإنجليزية)' : 'Previous School (English)'}</label>
                    <input
                      type="text"
                      name="previousSchool"
                      value={formData.previousSchool}
                      onChange={handleChange}
                      className="w-full bg-background border border-input rounded-xl px-4 py-3 text-foreground"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">{isRtl ? 'ملاحظات إضافية' : 'Additional Notes'}</label>
                    <textarea
                      name="notes"
                      value={formData.notes}
                      onChange={handleChange}
                      rows={4}
                      className="w-full bg-background border border-input rounded-xl px-4 py-3 text-foreground resize-none"
                    ></textarea>
                  </div>
                </div>
              </div>
            )}

            {/* Step 4: Review */}
            {step === 4 && (
              <div className="space-y-6 animate-in slide-in-from-bottom-4">
                <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-amber-500" />
                  {isRtl ? 'مراجعة الطلب' : 'Review Application'}
                </h2>
                <div className="bg-muted/50 rounded-xl p-6 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <span className="text-sm text-muted-foreground block mb-1">{isRtl ? 'الطالب' : 'Student'}</span>
                      <span className="font-medium">{user?.fullName}</span>
                    </div>
                    <div>
                      <span className="text-sm text-muted-foreground block mb-1">{isRtl ? 'الصف الدراسي' : 'Grade'}</span>
                      <span className="font-medium">{formData.gradeLevel}</span>
                    </div>
                    <div className="col-span-2">
                      <span className="text-sm text-muted-foreground block mb-1">{isRtl ? 'ولي الأمر' : 'Parent/Guardian'}</span>
                      <span className="font-medium">{isRtl ? formData.parentNameAr : formData.parentName} ({formData.parentPhone})</span>
                    </div>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground flex items-start gap-2 bg-amber-500/10 text-amber-700 p-4 rounded-xl">
                  <span className="text-lg">ℹ️</span>
                  <span>
                    {isRtl 
                      ? 'بتقديمك لهذا الطلب، أنت توافق على شروط وأحكام الأكاديمية. سيتم مراجعة طلبك وإعلامك بالنتيجة قريباً.'
                      : 'By submitting this application, you agree to the Academy terms and conditions. Your application will be reviewed and you will be notified shortly.'}
                  </span>
                </p>
              </div>
            )}

            {/* Navigation Buttons */}
            <div className={`mt-10 pt-6 border-t border-border flex ${step === 1 ? 'justify-end' : 'justify-between'}`}>
              {step > 1 && (
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={handlePrev}
                  className="rounded-xl px-6 gap-2"
                >
                  <ArrowPrev className="w-4 h-4" />
                  {isRtl ? 'السابق' : 'Previous'}
                </Button>
              )}
              
              {step < 4 ? (
                <Button 
                  type="button" 
                  onClick={handleNext}
                  className="rounded-xl px-8 bg-amber-500 hover:bg-amber-600 text-white gap-2"
                  disabled={step === 1 && (!formData.programId || !formData.gradeLevel)}
                >
                  {isRtl ? 'التالي' : 'Next'}
                  <ArrowNext className="w-4 h-4" />
                </Button>
              ) : (
                <Button 
                  type="submit" 
                  disabled={applyMutation.isPending}
                  className="rounded-xl px-10 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white gap-2 font-bold shadow-lg shadow-amber-500/20"
                >
                  {applyMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                  {isRtl ? 'تقديم الطلب' : 'Submit Application'}
                  <CheckCircle2 className="w-4 h-4" />
                </Button>
              )}
            </div>
          </form>
        </div>
      </div>
    </PageContainer>
  );
}
