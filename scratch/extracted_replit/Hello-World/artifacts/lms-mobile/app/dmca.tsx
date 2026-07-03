import React, { useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TextInput,
  Pressable, ActivityIndicator, Alert, KeyboardAvoidingView, Platform
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Feather } from "@expo/vector-icons";
import Colors from "@/constants/colors";
import { useLanguage } from "@/contexts/LanguageContext";
import { useApi } from "@/hooks/useApi";
import { useAuth } from "@/contexts/AuthContext";

const C = Colors.light;

export default function DMCAComplaintScreen() {
  const insets = useSafeAreaInsets();
  const { t, language } = useLanguage();
  const { apiFetch } = useApi();
  const { user } = useAuth();
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const [form, setForm] = useState({
    reporterName: user?.fullName || "",
    reporterEmail: user?.email || "",
    reportedTeacherId: "",
    reportedLessonId: "",
    description: "",
    proofUrl: "",
    agreement1: false,
    agreement2: false,
    agreement3: false,
  });

  const allAgreed = form.agreement1 && form.agreement2 && form.agreement3;
  const isFormValid = form.reporterName && form.reporterEmail && form.reportedTeacherId && form.description.length >= 20;

  const handleSubmit = async () => {
    if (!isFormValid || !allAgreed) {
      Alert.alert(t("مطلوب", "Required"), t("يرجى ملء جميع الحقول المطلوبة والموافقة على جميع الإقرارات.", "Please fill all required fields and agree to all declarations."));
      return;
    }

    try {
      setIsSubmitting(true);
      await apiFetch("/copyright-complaints", {
        method: "POST",
        body: JSON.stringify({
          reporterName: form.reporterName,
          reporterEmail: form.reporterEmail,
          reportedTeacherId: parseInt(form.reportedTeacherId),
          reportedLessonId: form.reportedLessonId ? parseInt(form.reportedLessonId) : undefined,
          description: form.description,
          proofUrl: form.proofUrl,
          reporterUserId: user?.id,
        })
      });
      setIsSubmitted(true);
    } catch (err: any) {
      Alert.alert(t("خطأ", "Error"), err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSubmitted) {
    return (
      <View style={[styles.container, { paddingTop: topPad + 40, alignItems: "center", paddingHorizontal: 20 }]}>
        <View style={styles.successIconBox}>
          <Feather name="check" size={32} color="#059669" />
        </View>
        <Text style={styles.successTitle}>{t("تم استلام البلاغ", "Complaint Received")}</Text>
        <Text style={styles.successDesc}>
          {t("لقد استلمنا بلاغك بشأن انتهاك حقوق الملكية وسيقوم فريقنا بمراجعته قريباً.", "Your copyright infringement report has been received and will be reviewed shortly.")}
        </Text>
        <Pressable style={styles.primaryBtn} onPress={() => router.replace("/")}>
          <Text style={styles.primaryBtnText}>{t("العودة للرئيسية", "Return to Home")}</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 10 }]}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Feather name={language === 'ar' ? "arrow-right" : "arrow-left"} size={22} color={C.text} />
        </Pressable>
        <Text style={styles.headerTitle}>{t("بلاغ حقوق ملكية (DMCA)", "Copyright Report (DMCA)")}</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView 
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 40 }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.warningBox}>
          <Feather name="alert-circle" size={20} color="#B45309" />
          <View style={{ flex: 1, paddingRight: language === 'ar' ? 0 : 8, paddingLeft: language === 'ar' ? 8 : 0 }}>
            <Text style={styles.warningTitle}>{t("ملاحظة قانونية", "Legal Notice")}</Text>
            <Text style={styles.warningText}>
              {t("تقديم بلاغ كاذب قد يعرضك للمساءلة القانونية ويؤدي لحظر الحساب.", "Submitting a false report may expose you to legal liability and account ban.")}
            </Text>
          </View>
        </View>

        {/* Section 1: Contact Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>1. {t("معلومات التواصل", "Contact Information")}</Text>
          <Text style={styles.inputLabel}>{t("الاسم الكامل *", "Full Name *")}</Text>
          <TextInput 
            style={styles.input} 
            value={form.reporterName} 
            onChangeText={v => setForm({ ...form, reporterName: v })} 
            textAlign={language === 'ar' ? "right" : "left"} 
          />
          <Text style={styles.inputLabel}>{t("البريد الإلكتروني للتواصل *", "Contact Email *")}</Text>
          <TextInput 
            style={styles.input} 
            value={form.reporterEmail} 
            onChangeText={v => setForm({ ...form, reporterEmail: v })} 
            keyboardType="email-address"
            autoCapitalize="none"
            textAlign={language === 'ar' ? "right" : "left"} 
          />
        </View>

        {/* Section 2: Infringing Content */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>2. {t("تفاصيل المحتوى المخالف", "Infringing Content Details")}</Text>
          <Text style={styles.inputLabel}>{t("المعرف الرقمي للمعلم المخالف *", "Infringing Teacher ID *")}</Text>
          <TextInput 
            style={styles.input} 
            value={form.reportedTeacherId} 
            onChangeText={v => setForm({ ...form, reportedTeacherId: v })} 
            keyboardType="numeric"
            placeholder={t("أدخل المعرف الرقمي", "Enter Teacher ID")}
            textAlign={language === 'ar' ? "right" : "left"} 
          />
          <Text style={styles.inputLabel}>{t("المعرف الخاص بالدرس (اختياري)", "Lesson ID (Optional)")}</Text>
          <TextInput 
            style={styles.input} 
            value={form.reportedLessonId} 
            onChangeText={v => setForm({ ...form, reportedLessonId: v })} 
            keyboardType="numeric"
            textAlign={language === 'ar' ? "right" : "left"} 
          />
          <Text style={styles.inputLabel}>{t("الوصف التفصيلي للمخالفة *", "Detailed Description *")}</Text>
          <TextInput 
            style={[styles.input, { height: 100, textAlignVertical: "top" }]} 
            multiline 
            value={form.description} 
            onChangeText={v => setForm({ ...form, description: v })} 
            placeholder={t("وصف كيف تم انتهاك حقوقك...", "Describe how your rights were infringed...")}
            textAlign={language === 'ar' ? "right" : "left"} 
          />
          <Text style={styles.inputLabel}>{t("رابط إثبات الملكية (اختياري)", "Proof of Ownership Link (Optional)")}</Text>
          <TextInput 
            style={styles.input} 
            value={form.proofUrl} 
            onChangeText={v => setForm({ ...form, proofUrl: v })} 
            placeholder="https://..."
            keyboardType="url"
            autoCapitalize="none"
            textAlign={language === 'ar' ? "right" : "left"} 
          />
        </View>

        {/* Section 3: Legal Declarations */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>3. {t("الإقرارات القانونية", "Legal Declarations")}</Text>
          
          <Pressable style={styles.checkboxRow} onPress={() => setForm({ ...form, agreement1: !form.agreement1 })}>
            <View style={[styles.checkbox, form.agreement1 && styles.checkboxActive]}>
              {form.agreement1 && <Feather name="check" size={14} color="#fff" />}
            </View>
            <Text style={styles.checkboxLabel}>
              {t("لدي اعتقاد حسن النية بأن استخدام هذا المحتوى غير مصرح به.", "I have a good faith belief that this use is not authorized.")}
            </Text>
          </Pressable>

          <Pressable style={styles.checkboxRow} onPress={() => setForm({ ...form, agreement2: !form.agreement2 })}>
            <View style={[styles.checkbox, form.agreement2 && styles.checkboxActive]}>
              {form.agreement2 && <Feather name="check" size={14} color="#fff" />}
            </View>
            <Text style={styles.checkboxLabel}>
              {t("المعلومات الواردة بالبلاغ دقيقة وحقيقية.", "The information in this notification is accurate and truthful.")}
            </Text>
          </Pressable>

          <Pressable style={styles.checkboxRow} onPress={() => setForm({ ...form, agreement3: !form.agreement3 })}>
            <View style={[styles.checkbox, form.agreement3 && styles.checkboxActive]}>
              {form.agreement3 && <Feather name="check" size={14} color="#fff" />}
            </View>
            <Text style={styles.checkboxLabel}>
              {t("أنا المالك أو مخول بالتصرف نيابة عن مالك الحقوق.", "I am the owner or authorized to act on behalf of the owner.")}
            </Text>
          </Pressable>
        </View>

        <Pressable 
          style={[styles.primaryBtn, (!isFormValid || !allAgreed || isSubmitting) && styles.primaryBtnDisabled]} 
          onPress={handleSubmit}
          disabled={!isFormValid || !allAgreed || isSubmitting}
        >
          {isSubmitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.primaryBtnText}>{t("إرسال البلاغ", "Submit Report")}</Text>
          )}
        </Pressable>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: C.cardBorder,
    backgroundColor: C.card,
  },
  backBtn: { padding: 4 },
  headerTitle: { fontFamily: "Inter_700Bold", fontSize: 18, color: C.text },
  scrollContent: { padding: 20 },
  warningBox: {
    flexDirection: "row-reverse",
    backgroundColor: "#FFFBEB",
    borderWidth: 1,
    borderColor: "#FCD34D",
    padding: 14,
    borderRadius: 12,
    marginBottom: 20,
    alignItems: "flex-start",
    gap: 12,
  },
  warningTitle: { fontFamily: "Inter_700Bold", fontSize: 14, color: "#92400E", textAlign: "right", marginBottom: 2 },
  warningText: { fontFamily: "Inter_400Regular", fontSize: 12, color: "#92400E", textAlign: "right", lineHeight: 18 },
  section: {
    backgroundColor: C.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: C.cardBorder,
  },
  sectionTitle: { fontFamily: "Inter_700Bold", fontSize: 16, color: C.text, textAlign: "right", marginBottom: 16 },
  inputLabel: { fontFamily: "Inter_600SemiBold", fontSize: 13, color: C.textSecondary, textAlign: "right", marginBottom: 6 },
  input: {
    backgroundColor: C.pill,
    borderRadius: 12,
    padding: 14,
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: C.text,
    borderWidth: 1,
    borderColor: C.cardBorder,
    marginBottom: 16,
  },
  checkboxRow: {
    flexDirection: "row-reverse",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 16,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: C.textMuted,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  checkboxActive: {
    backgroundColor: C.tint,
    borderColor: C.tint,
  },
  checkboxLabel: {
    flex: 1,
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: C.text,
    textAlign: "right",
    lineHeight: 20,
  },
  primaryBtn: {
    backgroundColor: C.tint,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 10,
    flexDirection: "row",
    gap: 8,
  },
  primaryBtnDisabled: {
    backgroundColor: C.textMuted,
  },
  primaryBtnText: { fontFamily: "Inter_700Bold", fontSize: 16, color: "#fff" },
  successIconBox: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#D1FAE5",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  successTitle: { fontFamily: "Inter_700Bold", fontSize: 22, color: C.text, textAlign: "center", marginBottom: 12 },
  successDesc: { fontFamily: "Inter_400Regular", fontSize: 14, color: C.textSecondary, textAlign: "center", lineHeight: 22, marginBottom: 30 },
});
