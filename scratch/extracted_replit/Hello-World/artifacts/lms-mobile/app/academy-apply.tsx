import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, ScrollView, Platform, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import Colors from '@/constants/colors';
import { useLanguage } from '@/contexts/LanguageContext';
import { useApi } from '@/hooks/useApi';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';

const C = Colors.light;

export default function AcademyApplyScreen() {
  const insets = useSafeAreaInsets();
  const { t, language } = useLanguage();
  const api = useApi();
  const { user } = useAuth();
  const isAr = language === 'ar';
  
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
    queryFn: () => api.apiFetch('/academy/programs')
  });

  const applyMutation = useMutation({
    mutationFn: (data: any) => api.apiFetch('/academy/apply', { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => {
      Alert.alert(
        isAr ? 'تم بنجاح' : 'Success',
        isAr ? 'تم تقديم طلبك بنجاح. سنعلمك بالنتيجة قريباً.' : 'Your application has been submitted successfully. We will notify you soon.',
        [{ text: isAr ? 'حسناً' : 'OK', onPress: () => router.replace('/(tabs)/academy') }]
      );
    },
    onError: (err: any) => {
      Alert.alert(isAr ? 'خطأ' : 'Error', err.message || (isAr ? 'حدث خطأ أثناء التقديم' : 'An error occurred'));
    }
  });

  if (!user) {
    router.replace('/auth/login');
    return null;
  }

  const handleNext = () => {
    if (step === 1 && (!formData.programId || !formData.gradeLevel)) {
      Alert.alert(isAr ? 'تنبيه' : 'Alert', isAr ? 'يرجى اختيار البرنامج والصف الدراسي' : 'Please select a program and grade level');
      return;
    }
    if (step === 2 && (!formData.parentName || !formData.parentPhone)) {
      Alert.alert(isAr ? 'تنبيه' : 'Alert', isAr ? 'يرجى إكمال الحقول المطلوبة' : 'Please complete required fields');
      return;
    }
    setStep(s => Math.min(s + 1, 4));
  };
  const handlePrev = () => setStep(s => Math.max(s - 1, 1));
  
  const handleSubmit = () => {
    applyMutation.mutate(formData);
  };

  const renderStepIndicator = () => (
    <View style={styles.stepContainer}>
      {[1, 2, 3, 4].map((num) => (
        <React.Fragment key={num}>
          <View style={[styles.stepCircle, step >= num ? styles.stepCircleActive : null]}>
            {step > num ? (
              <Feather name="check" size={16} color="#fff" />
            ) : (
              <Text style={[styles.stepText, step >= num ? styles.stepTextActive : null]}>{num}</Text>
            )}
          </View>
          {num < 4 && (
             <View style={[styles.stepLine, step > num ? styles.stepLineActive : null]} />
          )}
        </React.Fragment>
      ))}
    </View>
  );

  return (
    <View style={[styles.container, { paddingTop: Platform.OS === 'ios' ? insets.top : insets.top + 20 }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Feather name={isAr ? "chevron-right" : "chevron-left"} size={28} color={C.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{isAr ? 'طلب التحاق بالأكاديمية' : 'Academy Application'}</Text>
        <View style={{ width: 28 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {renderStepIndicator()}

        <View style={styles.formCard}>
          {step === 1 && (
            <View>
              <Text style={styles.stepTitle}>{isAr ? 'البرنامج الأكاديمي' : 'Academic Program'}</Text>
              
              <Text style={styles.label}>{isAr ? 'اختر البرنامج' : 'Select Program'} *</Text>
              {loadingPrograms ? (
                <ActivityIndicator color="#f59e0b" style={{ marginVertical: 20 }} />
              ) : (
                programs?.map((prog: any) => (
                  <TouchableOpacity
                    key={prog.id}
                    style={[styles.programCard, formData.programId === prog.id.toString() && styles.programCardActive]}
                    onPress={() => setFormData({ ...formData, programId: prog.id.toString() })}
                  >
                    <View style={{ flex: 1, alignItems: isAr ? 'flex-end' : 'flex-start' }}>
                      <Text style={[styles.programTitle, formData.programId === prog.id.toString() && { color: '#b45309' }]}>
                        {isAr ? prog.nameAr : prog.name}
                      </Text>
                      <Text style={styles.programGrade}>{prog.gradeLevel}</Text>
                    </View>
                    <View style={[styles.radioOuter, formData.programId === prog.id.toString() && styles.radioOuterActive]}>
                      {formData.programId === prog.id.toString() && <View style={styles.radioInner} />}
                    </View>
                  </TouchableOpacity>
                ))
              )}

              <Text style={[styles.label, { marginTop: 16 }]}>{isAr ? 'الصف الدراسي المستهدف' : 'Target Grade Level'} *</Text>
              <View style={styles.gridContainer}>
                {['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'].map(g => (
                  <TouchableOpacity
                    key={g}
                    style={[styles.gradeGridItem, formData.gradeLevel === g && styles.gradeGridItemActive]}
                    onPress={() => setFormData({ ...formData, gradeLevel: g })}
                  >
                    <Text style={[styles.gradeGridText, formData.gradeLevel === g && styles.gradeGridTextActive]}>{g}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {step === 2 && (
            <View>
              <Text style={styles.stepTitle}>{isAr ? 'معلومات ولي الأمر' : 'Parent Information'}</Text>
              
              <Text style={styles.label}>{isAr ? 'اسم ولي الأمر (بالعربية)' : 'Parent Name (Arabic)'} *</Text>
              <TextInput
                style={[styles.input, isAr && { textAlign: 'right' }]}
                value={formData.parentNameAr}
                onChangeText={v => setFormData({ ...formData, parentNameAr: v })}
                placeholder={isAr ? 'الاسم الثلاثي' : 'Full Name'}
              />

              <Text style={styles.label}>{isAr ? 'اسم ولي الأمر (بالإنجليزية)' : 'Parent Name (English)'} *</Text>
              <TextInput
                style={[styles.input, isAr && { textAlign: 'right' }]}
                value={formData.parentName}
                onChangeText={v => setFormData({ ...formData, parentName: v })}
              />

              <Text style={styles.label}>{isAr ? 'رقم الهاتف' : 'Phone Number'} *</Text>
              <TextInput
                style={[styles.input, { textAlign: 'left' }]}
                value={formData.parentPhone}
                onChangeText={v => setFormData({ ...formData, parentPhone: v })}
                keyboardType="phone-pad"
              />

              <Text style={styles.label}>{isAr ? 'البريد الإلكتروني' : 'Email Address'}</Text>
              <TextInput
                style={[styles.input, { textAlign: 'left' }]}
                value={formData.parentEmail}
                onChangeText={v => setFormData({ ...formData, parentEmail: v })}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>
          )}

          {step === 3 && (
            <View>
              <Text style={styles.stepTitle}>{isAr ? 'التاريخ الأكاديمي' : 'Academic History'}</Text>

              <Text style={styles.label}>{isAr ? 'المدرسة السابقة (بالعربية)' : 'Previous School (Arabic)'}</Text>
              <TextInput
                style={[styles.input, isAr && { textAlign: 'right' }]}
                value={formData.previousSchoolAr}
                onChangeText={v => setFormData({ ...formData, previousSchoolAr: v })}
              />

              <Text style={styles.label}>{isAr ? 'المدرسة السابقة (بالإنجليزية)' : 'Previous School (English)'}</Text>
              <TextInput
                style={[styles.input, isAr && { textAlign: 'right' }]}
                value={formData.previousSchool}
                onChangeText={v => setFormData({ ...formData, previousSchool: v })}
              />

              <Text style={styles.label}>{isAr ? 'ملاحظات إضافية' : 'Additional Notes'}</Text>
              <TextInput
                style={[styles.input, styles.textArea, isAr && { textAlign: 'right' }]}
                value={formData.notes}
                onChangeText={v => setFormData({ ...formData, notes: v })}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
            </View>
          )}

          {step === 4 && (
            <View>
              <Text style={styles.stepTitle}>{isAr ? 'مراجعة الطلب' : 'Review Application'}</Text>
              
              <View style={styles.summaryBox}>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>{isAr ? 'الطالب' : 'Student'}</Text>
                  <Text style={styles.summaryValue}>{user?.fullName}</Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>{isAr ? 'الصف' : 'Grade'}</Text>
                  <Text style={styles.summaryValue}>{formData.gradeLevel}</Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>{isAr ? 'ولي الأمر' : 'Parent'}</Text>
                  <Text style={styles.summaryValue}>{isAr ? formData.parentNameAr : formData.parentName}</Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>{isAr ? 'هاتف' : 'Phone'}</Text>
                  <Text style={styles.summaryValue}>{formData.parentPhone}</Text>
                </View>
              </View>

              <View style={styles.infoAlert}>
                <Feather name="info" size={20} color="#b45309" />
                <Text style={styles.infoAlertText}>
                  {isAr 
                    ? 'بتقديمك لهذا الطلب، أنت توافق على شروط وأحكام الأكاديمية. سيتم مراجعة طلبك وإعلامك بالنتيجة قريباً.'
                    : 'By submitting this application, you agree to the Academy terms and conditions. Your application will be reviewed and you will be notified shortly.'}
                </Text>
              </View>
            </View>
          )}
        </View>

        <View style={styles.footer}>
          {step > 1 ? (
             <TouchableOpacity style={styles.prevBtn} onPress={handlePrev}>
               <Text style={styles.prevBtnText}>{isAr ? 'السابق' : 'Previous'}</Text>
             </TouchableOpacity>
          ) : <View style={{ flex: 1 }} />}

          <TouchableOpacity 
            style={styles.nextBtn} 
            onPress={step === 4 ? handleSubmit : handleNext}
            disabled={applyMutation.isPending}
          >
            {applyMutation.isPending ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.nextBtnText}>
                {step === 4 ? (isAr ? 'تقديم الطلب' : 'Submit') : (isAr ? 'التالي' : 'Next')}
              </Text>
            )}
          </TouchableOpacity>
        </View>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: C.cardBorder,
  },
  backBtn: { padding: 4 },
  headerTitle: { fontFamily: 'Inter_700Bold', fontSize: 18, color: C.text },
  scrollContent: { padding: 20, paddingBottom: 100 },
  
  stepContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 32,
  },
  stepCircle: {
    width: 32, height: 32, borderRadius: 16, backgroundColor: C.backgroundSecondary, alignItems: 'center', justifyContent: 'center'
  },
  stepCircleActive: { backgroundColor: '#f59e0b' },
  stepText: { fontFamily: 'Inter_700Bold', fontSize: 13, color: C.textMuted },
  stepTextActive: { color: '#fff' },
  stepLine: { width: 40, height: 2, backgroundColor: C.backgroundSecondary },
  stepLineActive: { backgroundColor: '#f59e0b' },

  formCard: {
    backgroundColor: C.card,
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: C.cardBorder,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  stepTitle: { fontFamily: 'Inter_700Bold', fontSize: 20, color: C.text, marginBottom: 24 },
  
  label: { fontFamily: 'Inter_600SemiBold', fontSize: 14, color: C.text, marginBottom: 8 },
  input: {
    backgroundColor: C.background,
    borderWidth: 1,
    borderColor: C.inputBg,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontFamily: 'Inter_400Regular',
    fontSize: 15,
    color: C.text,
    marginBottom: 16,
  },
  textArea: { height: 100 },

  programCard: {
    flexDirection: 'row', alignItems: 'center', padding: 16, borderWidth: 1, borderColor: C.cardBorder, borderRadius: 12, marginBottom: 12
  },
  programCardActive: { borderColor: '#f59e0b', backgroundColor: '#fffbeb' },
  programTitle: { fontFamily: 'Inter_700Bold', fontSize: 15, color: C.text, marginBottom: 4 },
  programGrade: { fontFamily: 'Inter_500Medium', fontSize: 13, color: C.textMuted },
  radioOuter: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: C.textMuted, alignItems: 'center', justifyContent: 'center' },
  radioOuterActive: { borderColor: '#f59e0b' },
  radioInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#f59e0b' },

  gridContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  gradeGridItem: { width: '23%', paddingVertical: 12, alignItems: 'center', borderWidth: 1, borderColor: C.cardBorder, borderRadius: 10 },
  gradeGridItemActive: { backgroundColor: '#f59e0b', borderColor: '#f59e0b' },
  gradeGridText: { fontFamily: 'Inter_600SemiBold', fontSize: 15, color: C.text },
  gradeGridTextActive: { color: '#fff' },

  summaryBox: { backgroundColor: C.backgroundSecondary, borderRadius: 12, padding: 16, marginBottom: 20 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  summaryLabel: { fontFamily: 'Inter_500Medium', fontSize: 14, color: C.textSecondary },
  summaryValue: { fontFamily: 'Inter_700Bold', fontSize: 14, color: C.text },
  
  infoAlert: { backgroundColor: '#fef3c7', padding: 16, borderRadius: 12, flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  infoAlertText: { flex: 1, fontFamily: 'Inter_500Medium', fontSize: 13, color: '#92400e', lineHeight: 20 },

  footer: { flexDirection: 'row', gap: 12, marginTop: 32 },
  prevBtn: { flex: 1, paddingVertical: 16, borderRadius: 14, borderWidth: 1, borderColor: C.cardBorder, alignItems: 'center' },
  prevBtnText: { fontFamily: 'Inter_600SemiBold', fontSize: 15, color: C.text },
  nextBtn: { flex: 2, paddingVertical: 16, borderRadius: 14, backgroundColor: '#f59e0b', alignItems: 'center' },
  nextBtnText: { fontFamily: 'Inter_600SemiBold', fontSize: 15, color: '#fff' }
});
