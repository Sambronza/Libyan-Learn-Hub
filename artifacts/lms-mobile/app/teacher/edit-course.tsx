import { Feather } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Colors from "@/constants/colors";
import { useApi } from "@/hooks/useApi";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";

const C = Colors.light;

const LEVELS = [
  { value: "beginner", ar: "مبتدئ", en: "Beginner" },
  { value: "intermediate", ar: "متوسط", en: "Intermediate" },
  { value: "advanced", ar: "متقدم", en: "Advanced" },
];
const LANGS = [
  { value: "ar", ar: "عربي", en: "Arabic" },
  { value: "en", ar: "إنجليزي", en: "English" },
];
const CERT_MODES = [
  { value: "none", ar: "بدون شهادة", en: "None" },
  { value: "completion", ar: "عند الإتمام", en: "On completion" },
  { value: "quiz", ar: "إتمام + اختبار", en: "Completion + quiz" },
];

function InputField({ label, value, onChangeText, placeholder, multiline, keyboardType }: any) {
  return (
    <View style={styles.fieldGroup}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={[styles.input, multiline && styles.inputMulti]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={C.textMuted}
        multiline={multiline}
        textAlign="right"
        keyboardType={keyboardType}
      />
    </View>
  );
}

function SegmentControl({ options, value, onChange }: { options: { value: string; ar: string; en: string }[]; value: string; onChange: (v: string) => void }) {
  return (
    <View style={styles.segment}>
      {options.map((opt) => (
        <Pressable
          key={opt.value}
          style={[styles.segmentBtn, value === opt.value && styles.segmentBtnActive]}
          onPress={() => onChange(opt.value)}
        >
          <Text style={[styles.segmentText, value === opt.value && styles.segmentTextActive]}>
            {opt.ar}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

export default function EditCourseScreen() {
  const insets = useSafeAreaInsets();
  const { apiFetch } = useApi();
  const { t } = useLanguage();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { id } = useLocalSearchParams<{ id: string }>();
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const [form, setForm] = useState({
    title: "",
    titleAr: "",
    description: "",
    descriptionAr: "",
    price: "0",
    priceMonth3: "",
    priceMonth6: "",
    priceMonth12: "",
    certificateMode: "none",
    level: "beginner",
    language: "ar",
    categoryId: "",
  });

  const { data: categories = [] } = useQuery<any[]>({
    queryKey: ["categories"],
    queryFn: () => apiFetch("/categories"),
  });

  const { data: course, isLoading } = useQuery({
    queryKey: ["course-edit", id],
    queryFn: () => apiFetch(`/courses/${id}`),
    enabled: !!id,
  });

  useEffect(() => {
    if (course) {
      setForm({
        title: course.title || "",
        titleAr: course.titleAr || "",
        description: course.description || "",
        descriptionAr: course.descriptionAr || "",
        price: String(course.priceMonth1 ?? course.price ?? "0"),
        priceMonth3: course.priceMonth3 != null ? String(course.priceMonth3) : "",
        priceMonth6: course.priceMonth6 != null ? String(course.priceMonth6) : "",
        priceMonth12: course.priceMonth12 != null ? String(course.priceMonth12) : "",
        certificateMode: course.certificateMode || "none",
        level: course.level || "beginner",
        language: course.language || "ar",
        categoryId: String(course.categoryId ?? ""),
      });
    }
  }, [course]);

  const updateMutation = useMutation({
    mutationFn: () => {
      const p1 = parseFloat(form.price) || 0;
      const p3 = parseFloat(form.priceMonth3) || 0;
      const p6 = parseFloat(form.priceMonth6) || 0;
      const p12 = parseFloat(form.priceMonth12) || 0;
      if (p1 > 0 && (p3 <= 0 || p6 <= 0 || p12 <= 0)) {
        return Promise.reject(new Error(t(
          "يجب تحديد أسعار جميع مدد الاشتراك الأربع (شهر، 3، 6، 12) للدورة المدفوعة",
          "A paid course must set prices for all four durations (1, 3, 6, 12 months)"
        )));
      }
      return apiFetch(`/courses/${id}`, {
        method: "PUT",
        body: JSON.stringify({
          ...form,
          price: p1,
          priceMonth1: p1 > 0 ? p1 : null,
          priceMonth3: p1 > 0 ? p3 : null,
          priceMonth6: p1 > 0 ? p6 : null,
          priceMonth12: p1 > 0 ? p12 : null,
          categoryId: form.categoryId ? parseInt(form.categoryId) : undefined,
        }),
      });
    },
    onSuccess: () => {
      Alert.alert(t("تم!", "Done!"), t("تم تحديث الدورة بنجاح", "Course updated successfully."));
      queryClient.invalidateQueries({ queryKey: ["teacher-courses"] });
      queryClient.invalidateQueries({ queryKey: ["course", id] });
      router.back();
    },
    onError: (e: any) => Alert.alert(t("خطأ", "Error"), e.message),
  });

  if (isLoading) {
    return (
      <View style={[styles.container, { paddingTop: topPad, alignItems: "center", justifyContent: "center" }]}>
        <ActivityIndicator color={C.tint} size="large" />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-right" size={22} color={C.text} />
        </Pressable>
        <Text style={styles.headerTitle}>{t("تعديل الدورة", "Edit Course")}</Text>
        <Pressable
          style={[styles.saveBtn, updateMutation.isPending && { opacity: 0.6 }]}
          onPress={() => updateMutation.mutate()}
          disabled={updateMutation.isPending}
        >
          {updateMutation.isPending ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.saveBtnText}>{t("حفظ", "Save")}</Text>
          )}
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 20, gap: 20, paddingBottom: Platform.OS === "web" ? 34 : insets.bottom + 24 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Basic Info */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>{t("المعلومات الأساسية", "Basic Information")}</Text>
          <InputField label={t("العنوان (عربي) *", "Title (Arabic) *")} value={form.titleAr} onChangeText={(v: string) => setForm(f => ({ ...f, titleAr: v }))} placeholder={t("عنوان الدورة", "Course title")} />
          <InputField label={t("العنوان (إنجليزي)", "Title (English)")} value={form.title} onChangeText={(v: string) => setForm(f => ({ ...f, title: v }))} placeholder="Course title" />
          <InputField label={t("الوصف (عربي)", "Description (Arabic)")} value={form.descriptionAr} onChangeText={(v: string) => setForm(f => ({ ...f, descriptionAr: v }))} placeholder={t("وصف الدورة", "Course description")} multiline />
          <InputField label={t("الوصف (إنجليزي)", "Description (English)")} value={form.description} onChangeText={(v: string) => setForm(f => ({ ...f, description: v }))} placeholder="Course description" multiline />
        </View>

        {/* Pricing & Settings */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>{t("السعر والإعدادات", "Pricing & Settings")}</Text>
          <InputField label={t("سعر شهر واحد (0 = مجاني)", "1-Month Price (0 = Free)")} value={form.price} onChangeText={(v: string) => setForm(f => ({ ...f, price: v }))} placeholder="0" keyboardType="decimal-pad" />
          {(parseFloat(form.price) || 0) > 0 && (
            <>
              <InputField label={t("سعر 3 أشهر *", "3-Month Price *")} value={form.priceMonth3} onChangeText={(v: string) => setForm(f => ({ ...f, priceMonth3: v }))} placeholder="0" keyboardType="decimal-pad" />
              <InputField label={t("سعر 6 أشهر *", "6-Month Price *")} value={form.priceMonth6} onChangeText={(v: string) => setForm(f => ({ ...f, priceMonth6: v }))} placeholder="0" keyboardType="decimal-pad" />
              <InputField label={t("سعر 12 شهرًا *", "12-Month Price *")} value={form.priceMonth12} onChangeText={(v: string) => setForm(f => ({ ...f, priceMonth12: v }))} placeholder="0" keyboardType="decimal-pad" />
            </>
          )}

          <Text style={styles.fieldLabel}>{t("شهادة الإتمام", "Completion Certificate")}</Text>
          {(user as any)?.certificatesApproved ? (
            <>
              <SegmentControl options={CERT_MODES} value={form.certificateMode} onChange={(v) => setForm(f => ({ ...f, certificateMode: v }))} />
              {form.certificateMode !== "none" && (
                <Text style={{ fontFamily: "Inter_400Regular", fontSize: 11, color: C.textMuted, textAlign: "right", marginBottom: 8 }}>
                  {t("سيُمنع التخطي والتسريع في دروس هذه الدورة", "Skipping and fast-forward will be disabled in this course's lessons")}
                </Text>
              )}
            </>
          ) : (
            <Text style={{ fontFamily: "Inter_400Regular", fontSize: 11, color: C.textMuted, textAlign: "right", marginBottom: 8 }}>
              {t("🎓 الشهادات متاحة للمعلمين المعتمدين فقط — تواصل مع الإدارة", "🎓 Certificates are for approved teachers only — contact administration")}
            </Text>
          )}

          <Text style={styles.fieldLabel}>{t("المستوى", "Level")}</Text>
          <SegmentControl options={LEVELS} value={form.level} onChange={(v) => setForm(f => ({ ...f, level: v }))} />

          <Text style={styles.fieldLabel}>{t("لغة الدورة", "Course Language")}</Text>
          <SegmentControl options={LANGS} value={form.language} onChange={(v) => setForm(f => ({ ...f, language: v }))} />
        </View>

        {/* Category */}
        {categories.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>{t("التصنيف", "Category")}</Text>
            <View style={styles.categoryGrid}>
              {(categories as any[]).map((cat: any) => (
                <Pressable
                  key={cat.id}
                  style={[styles.catBtn, form.categoryId === String(cat.id) && styles.catBtnActive]}
                  onPress={() => setForm(f => ({ ...f, categoryId: String(cat.id) }))}
                >
                  <Text style={[styles.catText, form.categoryId === String(cat.id) && styles.catTextActive]}>
                    {cat.nameAr || cat.name}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}

        {/* Manage Lessons */}
        <Pressable
          style={styles.manageLessonsBtn}
          onPress={() => router.push({ pathname: "/manage-course", params: { id: id! } } as any)}
        >
          <Feather name="list" size={18} color={C.tint} />
          <Text style={styles.manageLessonsBtnText}>{t("إدارة الدروس والمحتوى", "Manage Lessons & Content")}</Text>
          <Feather name="chevron-left" size={16} color={C.tint} />
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
  header: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: C.cardBorder,
  },
  backBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontFamily: "Inter_700Bold", fontSize: 20, color: C.text },
  saveBtn: { backgroundColor: C.tint, borderRadius: 12, paddingHorizontal: 18, paddingVertical: 8 },
  saveBtnText: { fontFamily: "Inter_700Bold", fontSize: 14, color: "#fff" },
  card: { backgroundColor: C.card, borderRadius: 20, padding: 20, borderWidth: 1, borderColor: C.cardBorder, gap: 14 },
  sectionTitle: { fontFamily: "Inter_700Bold", fontSize: 16, color: C.text, textAlign: "right" },
  fieldGroup: { gap: 6 },
  fieldLabel: { fontFamily: "Inter_600SemiBold", fontSize: 13, color: C.textSecondary, textAlign: "right" },
  input: {
    backgroundColor: C.inputBg,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: C.text,
    borderWidth: 1,
    borderColor: C.inputBorder,
  },
  inputMulti: { height: 90, textAlignVertical: "top" },
  segment: { flexDirection: "row", borderRadius: 12, overflow: "hidden", borderWidth: 1, borderColor: C.cardBorder },
  segmentBtn: { flex: 1, paddingVertical: 10, alignItems: "center", backgroundColor: C.inputBg },
  segmentBtnActive: { backgroundColor: C.tint },
  segmentText: { fontFamily: "Inter_500Medium", fontSize: 13, color: C.textSecondary },
  segmentTextActive: { color: "#fff", fontFamily: "Inter_700Bold" },
  categoryGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  catBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: C.inputBg,
    borderWidth: 1,
    borderColor: C.cardBorder,
  },
  catBtnActive: { backgroundColor: C.tint, borderColor: C.tint },
  catText: { fontFamily: "Inter_500Medium", fontSize: 13, color: C.textSecondary },
  catTextActive: { color: "#fff" },
  manageLessonsBtn: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 12,
    backgroundColor: `${C.tint}10`,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: `${C.tint}30`,
  },
  manageLessonsBtnText: { flex: 1, fontFamily: "Inter_600SemiBold", fontSize: 15, color: C.tint, textAlign: "right" },
});
