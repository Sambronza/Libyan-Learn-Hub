import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Colors from "@/constants/colors";
import { useAuth } from "@/contexts/AuthContext";
import { useApi } from "@/hooks/useApi";
import { useLanguage } from "@/contexts/LanguageContext";

const C = Colors.light;

interface Enrollment {
  id: number;
  courseId: number;
  progress: number;
  enrolledAt: string;
  course: {
    id: number;
    title: string;
    titleAr: string;
    teacherName: string;
    lessonCount: number;
    totalDuration: number;
    thumbnailUrl?: string | null;
  };
}

function ProgressBar({ value }: { value: number }) {
  return (
    <View style={styles.progressBar}>
      <View style={[styles.progressFill, { width: `${Math.min(value, 100)}%` as any }]} />
    </View>
  );
}

function EnrollmentCard({ item }: { item: Enrollment }) {
  const { t } = useLanguage();
  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }]}
      onPress={() => router.push({ pathname: "/course/[id]", params: { id: item.courseId.toString() } })}
    >
      <View style={styles.cardThumb}>
        <Feather name="book-open" size={28} color={C.tint} />
      </View>
      <View style={styles.cardInfo}>
        <Text style={styles.cardTitle} numberOfLines={2}>{t(item.course.titleAr || item.course.title, item.course.title)}</Text>
        <Text style={styles.cardTeacher}>{item.course.teacherName}</Text>
        <View style={styles.progressRow}>
          <ProgressBar value={item.progress} />
          <Text style={styles.progressPct}>{Math.round(item.progress)}%</Text>
        </View>
        <Text style={styles.cardMeta}>
          {item.course.lessonCount} {t("درس", "lessons")} · {Math.round(item.course.totalDuration / 60)} {t("ساعة", "hrs")}
        </Text>
      </View>
      <Feather name="chevron-left" size={18} color={C.textMuted} />
    </Pressable>
  );
}

// ── Teacher Dashboard ─────────────────────────────────────────────────────────

function TeacherDashboard() {
  const insets = useSafeAreaInsets();
  const { apiFetch } = useApi();
  const queryClient = useQueryClient();
  const { t, language } = useLanguage();
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const [createOpen, setCreateOpen] = useState(false);
  const [createListingOpen, setCreateListingOpen] = useState(false);
  const [createCourseOpen, setCreateCourseOpen] = useState(false);
  const [form, setForm] = useState({ title: "", titleAr: "", description: "", scheduledAt: "", durationMinutes: "90", maxParticipants: "50" });
  const [listingForm, setListingForm] = useState({ titleAr: "", title: "", subjectAr: "", subject: "", gradeLevel: "", hourlyRate: "", availableDays: "", availableTimeFrom: "", availableTimeTo: "", sessionDurationMinutes: "60", maxStudents: "1", descriptionAr: "" });
  const [courseForm, setCourseForm] = useState({ title: "", titleAr: "", description: "", descriptionAr: "", price: "0", categoryId: "", level: "beginner", language: "ar" });

  const { data: categories = [] } = useQuery<any[]>({
    queryKey: ["categories"],
    queryFn: () => apiFetch("/categories"),
  });


  const { data: courses = [], isLoading: coursesLoading } = useQuery<any[]>({
    queryKey: ["teacher-courses"],
    queryFn: () => apiFetch("/teacher/courses"),
  });

  const { data: sessions = [] } = useQuery<any[]>({
    queryKey: ["live-sessions"],
    queryFn: () => apiFetch("/live-sessions"),
  });

  const { data: listings = [] } = useQuery<any[]>({
    queryKey: ["tutoring-listings-my"],
    queryFn: () => apiFetch("/tutoring-listings/my"),
  });

  const createSession = async () => {
    try {
      await apiFetch("/live-sessions", {
        method: "POST",
        body: JSON.stringify({
          ...form,
          durationMinutes: parseInt(form.durationMinutes),
          maxParticipants: parseInt(form.maxParticipants),
          scheduledAt: form.scheduledAt,
        }),
      });
      Alert.alert(t("تم!", "Done!"), t("تم إنشاء الجلسة المباشرة.", "Live session created."));
      queryClient.invalidateQueries({ queryKey: ["live-sessions"] });
      setCreateOpen(false);
      setForm({ title: "", titleAr: "", description: "", scheduledAt: "", durationMinutes: "90", maxParticipants: "50" });
    } catch (err: any) {
      Alert.alert(t("خطأ", "Error"), err.message || t("فشل إنشاء الجلسة", "Failed to create session"));
    }
  };

  const createListing = async () => {
    if (!listingForm.titleAr || !listingForm.subjectAr || !listingForm.hourlyRate) {
      Alert.alert(t("خطأ", "Error"), t("يرجى ملء الحقول المطلوبة: العنوان، المادة، والسعر", "Please fill required fields: title, subject, and price"));
      return;
    }
    try {
      await apiFetch("/tutoring-listings", {
        method: "POST",
        body: JSON.stringify({
          ...listingForm,
          hourlyRate: parseFloat(listingForm.hourlyRate),
          sessionDurationMinutes: parseInt(listingForm.sessionDurationMinutes),
          maxStudents: parseInt(listingForm.maxStudents),
        }),
      });
      Alert.alert(t("تم!", "Done!"), t("تم إنشاء إعلان الدروس الخصوصية.", "Tutoring listing created."));
      queryClient.invalidateQueries({ queryKey: ["tutoring-listings-my"] });
      setCreateListingOpen(false);
      setListingForm({ titleAr: "", title: "", subjectAr: "", subject: "", gradeLevel: "", hourlyRate: "", availableDays: "", availableTimeFrom: "", availableTimeTo: "", sessionDurationMinutes: "60", maxStudents: "1", descriptionAr: "" });
    } catch (err: any) {
      Alert.alert(t("خطأ", "Error"), err.message || t("فشل إنشاء الإعلان", "Failed to create listing"));
    }
  };

  const createCourse = async () => {
    if (!courseForm.title || !courseForm.titleAr || !courseForm.categoryId) {
      Alert.alert(t("خطأ", "Error"), t("يرجى ملء الحقول المطلوبة: العنوان والتصنيف", "Please fill required fields: title and category"));
      return;
    }
    try {
      const newCourse = await apiFetch("/courses", {
        method: "POST",
        body: JSON.stringify({
          ...courseForm,
          price: parseFloat(courseForm.price) || 0,
          categoryId: parseInt(courseForm.categoryId),
        }),
      });
      Alert.alert(t("تم!", "Done!"), t("تم إنشاء الدورة بنجاح.", "Course created successfully."));
      queryClient.invalidateQueries({ queryKey: ["teacher-courses"] });
      setCreateCourseOpen(false);
      setCourseForm({ title: "", titleAr: "", description: "", descriptionAr: "", price: "0", categoryId: "", level: "beginner", language: "ar" });
      // Navigate to the manage-course screen
      router.push({ pathname: "/manage-course", params: { id: newCourse.id.toString() } } as any);
    } catch (err: any) {
      Alert.alert(t("خطأ", "Error"), err.message || t("فشل إنشاء الدورة", "Failed to create course"));
    }
  };

  const mySessions = (sessions as any[]).filter(() => true);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: Platform.OS === "web" ? 34 : insets.bottom + 90 }}
    >
      <View style={[styles.header, { paddingTop: topPad + 16 }]}>
        <Text style={styles.headerTitle}>{t("لوحة تحكم المعلم", "Teacher Dashboard")}</Text>
        <Text style={styles.headerSubtitle}>{t("إدارة دوراتك وجلساتك", "Manage your courses and sessions")}</Text>
      </View>

      {/* Stats */}
      <View style={styles.statsRow}>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{(courses as any[]).length}</Text>
          <Text style={styles.statLabel}>{t("دوراتي", "My Courses")}</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.stat}>
          <Text style={styles.statValue}>{mySessions.length}</Text>
          <Text style={styles.statLabel}>{t("جلسات مباشرة", "Live Sessions")}</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.stat}>
          <Text style={styles.statValue}>{(listings as any[]).length}</Text>
          <Text style={styles.statLabel}>{t("إعلانات خصوصي", "Tutoring Listings")}</Text>
        </View>
      </View>

      {/* Quick Actions */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t("إجراءات سريعة", "Quick Actions")}</Text>
        <View style={styles.actionsRow}>
          <Pressable style={styles.actionBtn} onPress={() => setCreateCourseOpen(true)}>
            <View style={[styles.actionIcon, { backgroundColor: "#FDF2F8" }]}>
              <Feather name="plus-circle" size={22} color="#EC4899" />
            </View>
            <Text style={styles.actionLabel}>{t("إضافة دورة", "Add Course")}</Text>
          </Pressable>
          <Pressable style={styles.actionBtn} onPress={() => setCreateOpen(true)}>
            <View style={[styles.actionIcon, { backgroundColor: "#EFF6FF" }]}>
              <Feather name="video" size={22} color="#3B82F6" />
            </View>
            <Text style={styles.actionLabel}>{t("جلسة مباشرة", "Live Session")}</Text>
          </Pressable>
          <Pressable style={styles.actionBtn} onPress={() => setCreateListingOpen(true)}>
            <View style={[styles.actionIcon, { backgroundColor: "#F0FDF4" }]}>
              <Feather name="users" size={22} color="#22C55E" />
            </View>
            <Text style={styles.actionLabel}>{t("إعلان خصوصي", "Tutoring Ad")}</Text>
          </Pressable>
        </View>
      </View>

      {/* My Courses */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t("دوراتي", "My Courses")}</Text>
        {coursesLoading ? (
          <ActivityIndicator color={C.tint} />
        ) : (courses as any[]).length === 0 ? (
          <View style={styles.emptyBox}>
            <Feather name="book-open" size={32} color={C.textMuted} />
            <Text style={styles.emptyText}>{t("لا توجد دورات بعد", "No courses yet")}</Text>
            <Pressable style={[styles.applyBtn, { marginTop: 8, paddingHorizontal: 24 }]} onPress={() => setCreateCourseOpen(true)}>
              <Text style={styles.applyBtnText}>{t("إضافة أول دورة", "Add First Course")}</Text>
            </Pressable>
          </View>
        ) : (
          (courses as any[]).slice(0, 5).map((c: any) => (
            <Pressable key={c.id} style={styles.courseRow} onPress={() => router.push({ pathname: "/manage-course", params: { id: c.id.toString() } } as any)}>
              <View style={{ flex: 1 }}>
                <Text style={styles.courseName} numberOfLines={1}>{t(c.titleAr || c.title, c.title)}</Text>
                <Text style={styles.courseMeta}>{c.lessonCount} {t("درس", "lessons")} · {c.enrollmentCount} {t("طالب", "students")}</Text>
              </View>
              <Feather name="chevron-left" size={16} color={C.textMuted} />
            </Pressable>
          ))
        )}
      </View>

      {/* Recent Live Sessions */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t("الجلسات المباشرة", "Live Sessions")}</Text>
        {mySessions.length === 0 ? (
          <View style={styles.emptyBox}>
            <Feather name="video-off" size={32} color={C.textMuted} />
            <Text style={styles.emptyText}>{t("لا توجد جلسات", "No sessions")}</Text>
          </View>
        ) : (
          mySessions.slice(0, 3).map((s: any) => (
            <View key={s.id} style={styles.sessionRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.courseName} numberOfLines={1}>{t(s.titleAr || s.title, s.title)}</Text>
                <Text style={styles.courseMeta}>{new Date(s.scheduledAt).toLocaleDateString(language === "ar" ? "ar-LY" : "en-US")}</Text>
              </View>
              <View style={[styles.statusPill, { backgroundColor: s.status === "live" ? "#FEE2E2" : "#EFF6FF" }]}>
                <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 11, color: s.status === "live" ? "#DC2626" : C.tint }}>{s.status === "live" ? t("مباشر", "Live") : t("قادم", "Upcoming")}</Text>
              </View>
            </View>
          ))
        )}
      </View>

      {/* Create Live Session Modal */}
      <Modal visible={createOpen} transparent animationType="slide" onRequestClose={() => setCreateOpen(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>{t("إنشاء جلسة مباشرة", "Create Live Session")}</Text>
            <Text style={styles.inputLabel}>{t("العنوان (عربي) *", "Title (Arabic) *")}</Text>
            <TextInput style={styles.input} value={form.titleAr} onChangeText={v => setForm(f => ({ ...f, titleAr: v }))} placeholder={t("عنوان الجلسة", "Session title")} textAlign="right" />
            <Text style={styles.inputLabel}>{t("العنوان (إنجليزي)", "Title (English)")}</Text>
            <TextInput style={styles.input} value={form.title} onChangeText={v => setForm(f => ({ ...f, title: v }))} placeholder="Session title" />
            <Text style={styles.inputLabel}>{t("الوصف", "Description")}</Text>
            <TextInput style={[styles.input, { height: 70 }]} multiline value={form.description} onChangeText={v => setForm(f => ({ ...f, description: v }))} placeholder={t("وصف الجلسة", "Session description")} textAlign="right" />
            <Text style={styles.inputLabel}>{t("التاريخ والوقت *", "Date & Time *")}</Text>
            <TextInput style={styles.input} value={form.scheduledAt} onChangeText={v => setForm(f => ({ ...f, scheduledAt: v }))} placeholder="2026-04-01T18:00:00" />
            <View style={{ flexDirection: "row", gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.inputLabel}>{t("المدة (دقيقة)", "Duration (min)")}</Text>
                <TextInput style={styles.input} value={form.durationMinutes} onChangeText={v => setForm(f => ({ ...f, durationMinutes: v }))} keyboardType="numeric" placeholder="90" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.inputLabel}>{t("الحد الأقصى للمشاركين", "Max Participants")}</Text>
                <TextInput style={styles.input} value={form.maxParticipants} onChangeText={v => setForm(f => ({ ...f, maxParticipants: v }))} keyboardType="numeric" placeholder="50" />
              </View>
            </View>
            <View style={{ flexDirection: "row", gap: 10, marginTop: 16 }}>
              <Pressable style={[styles.applyBtn, { flex: 1 }]} onPress={createSession}>
                <Text style={styles.applyBtnText}>{t("إنشاء الجلسة", "Create Session")}</Text>
              </Pressable>
              <Pressable style={[styles.cancelBtn, { flex: 1 }]} onPress={() => setCreateOpen(false)}>
                <Text style={styles.cancelBtnText}>{t("إلغاء", "Cancel")}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Create Tutoring Listing Modal */}
      <Modal visible={createListingOpen} transparent animationType="slide" onRequestClose={() => setCreateListingOpen(false)}>
        <View style={styles.modalOverlay}>
          <ScrollView style={[styles.modalBox, { maxHeight: "90%" }]} keyboardShouldPersistTaps="handled">
            <Text style={styles.modalTitle}>{t("إنشاء إعلان دروس خصوصية", "Create Tutoring Listing")}</Text>

            <Text style={styles.inputLabel}>{t("العنوان بالعربية *", "Title (Arabic) *")}</Text>
            <TextInput style={styles.input} value={listingForm.titleAr} onChangeText={v => setListingForm(f => ({ ...f, titleAr: v }))} placeholder={t("مثال: دروس رياضيات - الثانوي", "e.g. Math Lessons - High School")} textAlign="right" />

            <Text style={styles.inputLabel}>{t("المادة بالعربية *", "Subject (Arabic) *")}</Text>
            <TextInput style={styles.input} value={listingForm.subjectAr} onChangeText={v => setListingForm(f => ({ ...f, subjectAr: v }))} placeholder={t("مثال: الرياضيات", "e.g. Mathematics")} textAlign="right" />

            <Text style={styles.inputLabel}>{t("Subject (English)", "Subject (English)")}</Text>
            <TextInput style={styles.input} value={listingForm.subject} onChangeText={v => setListingForm(f => ({ ...f, subject: v }))} placeholder="e.g. Mathematics" />

            <Text style={styles.inputLabel}>{t("المستوى الدراسي", "Grade Level")}</Text>
            <TextInput style={styles.input} value={listingForm.gradeLevel} onChangeText={v => setListingForm(f => ({ ...f, gradeLevel: v }))} placeholder="grade_10 / grade_11 / grade_12 / university" />

            <Text style={styles.inputLabel}>{t("السعر بالساعة (دينار) *", "Hourly Rate (LYD) *")}</Text>
            <TextInput style={styles.input} value={listingForm.hourlyRate} onChangeText={v => setListingForm(f => ({ ...f, hourlyRate: v }))} keyboardType="numeric" placeholder="50" />

            <View style={{ flexDirection: "row", gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.inputLabel}>{t("مدة الجلسة (دقيقة)", "Session Duration (min)")}</Text>
                <TextInput style={styles.input} value={listingForm.sessionDurationMinutes} onChangeText={v => setListingForm(f => ({ ...f, sessionDurationMinutes: v }))} keyboardType="numeric" placeholder="60" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.inputLabel}>{t("الحد الأقصى للطلاب", "Max Students")}</Text>
                <TextInput style={styles.input} value={listingForm.maxStudents} onChangeText={v => setListingForm(f => ({ ...f, maxStudents: v }))} keyboardType="numeric" placeholder="1" />
              </View>
            </View>

            <Text style={styles.inputLabel}>{t("أيام التوفر (مثال: Mon,Tue,Wed)", "Available Days (e.g. Mon,Tue,Wed)")}</Text>
            <TextInput style={styles.input} value={listingForm.availableDays} onChangeText={v => setListingForm(f => ({ ...f, availableDays: v }))} placeholder="Mon,Tue,Thu" />

            <View style={{ flexDirection: "row", gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.inputLabel}>{t("من الساعة", "From")}</Text>
                <TextInput style={styles.input} value={listingForm.availableTimeFrom} onChangeText={v => setListingForm(f => ({ ...f, availableTimeFrom: v }))} placeholder="16:00" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.inputLabel}>{t("حتى الساعة", "To")}</Text>
                <TextInput style={styles.input} value={listingForm.availableTimeTo} onChangeText={v => setListingForm(f => ({ ...f, availableTimeTo: v }))} placeholder="21:00" />
              </View>
            </View>

            <Text style={styles.inputLabel}>{t("وصف الدرس", "Lesson Description")}</Text>
            <TextInput style={[styles.input, { height: 70 }]} multiline value={listingForm.descriptionAr} onChangeText={v => setListingForm(f => ({ ...f, descriptionAr: v }))} placeholder={t("اكتب تفاصيل الدرس والمحتوى...", "Write lesson details...")} textAlign="right" />

            <View style={{ flexDirection: "row", gap: 10, marginTop: 16, marginBottom: 24 }}>
              <Pressable style={[styles.applyBtn, { flex: 1 }]} onPress={createListing}>
                <Text style={styles.applyBtnText}>{t("إنشاء الإعلان", "Create Listing")}</Text>
              </Pressable>
              <Pressable style={[styles.cancelBtn, { flex: 1 }]} onPress={() => setCreateListingOpen(false)}>
                <Text style={styles.cancelBtnText}>{t("إلغاء", "Cancel")}</Text>
              </Pressable>
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* Create Course Modal */}
      <Modal visible={createCourseOpen} transparent animationType="slide" onRequestClose={() => setCreateCourseOpen(false)}>
        <View style={styles.modalOverlay}>
          <ScrollView style={[styles.modalBox, { maxHeight: "90%" }]} keyboardShouldPersistTaps="handled">
            <Text style={styles.modalTitle}>{t("إنشاء دورة جديدة", "Create New Course")}</Text>

            <Text style={styles.inputLabel}>{t("العنوان (عربي) *", "Title (Arabic) *")}</Text>
            <TextInput style={styles.input} value={courseForm.titleAr} onChangeText={v => setCourseForm(f => ({ ...f, titleAr: v }))} placeholder={t("عنوان الدورة بالعربي", "Course title in Arabic")} textAlign="right" />

            <Text style={styles.inputLabel}>{t("Title (English) *", "Title (English) *")}</Text>
            <TextInput style={styles.input} value={courseForm.title} onChangeText={v => setCourseForm(f => ({ ...f, title: v }))} placeholder="Course title" />

            <Text style={styles.inputLabel}>{t("الوصف (عربي)", "Description (Arabic)")}</Text>
            <TextInput style={[styles.input, { height: 70 }]} multiline value={courseForm.descriptionAr} onChangeText={v => setCourseForm(f => ({ ...f, descriptionAr: v }))} placeholder={t("وصف الدورة", "Course description")} textAlign="right" />

            <Text style={styles.inputLabel}>{t("Description (English)", "Description (English)")}</Text>
            <TextInput style={[styles.input, { height: 70 }]} multiline value={courseForm.description} onChangeText={v => setCourseForm(f => ({ ...f, description: v }))} placeholder="Course description" />

            <Text style={styles.inputLabel}>{t("التصنيف *", "Category *")}</Text>
            <View style={{ backgroundColor: C.pill, borderRadius: 12, borderWidth: 1, borderColor: C.cardBorder, marginBottom: 4 }}>
              {(categories as any[]).length === 0 ? (
                <Text style={{ padding: 12, color: C.textMuted, fontFamily: "Inter_400Regular", fontSize: 13, textAlign: "right" }}>{t("لا توجد تصنيفات — يرجى تشغيل سكربت البذر", "No categories — restart the server")}</Text>
              ) : (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ padding: 8, gap: 6 }}>
                  {(categories as any[]).map((cat: any) => (
                    <Pressable
                      key={cat.id}
                      onPress={() => setCourseForm(f => ({ ...f, categoryId: cat.id.toString() }))}
                      style={{
                        paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10,
                        backgroundColor: courseForm.categoryId === cat.id.toString() ? C.tint : C.background,
                      }}
                    >
                      <Text style={{
                        fontFamily: "Inter_600SemiBold", fontSize: 12,
                        color: courseForm.categoryId === cat.id.toString() ? "#fff" : C.textSecondary,
                      }}>{cat.icon} {t(cat.nameAr || cat.name, cat.name)}</Text>
                    </Pressable>
                  ))}
                </ScrollView>
              )}
            </View>

            <View style={{ flexDirection: "row", gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.inputLabel}>{t("السعر (دينار)", "Price (LYD)")}</Text>
                <TextInput style={styles.input} value={courseForm.price} onChangeText={v => setCourseForm(f => ({ ...f, price: v }))} keyboardType="numeric" placeholder={t("0 = مجاني", "0 = Free")} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.inputLabel}>{t("المستوى", "Level")}</Text>
                <View style={{ backgroundColor: C.pill, borderRadius: 12, borderWidth: 1, borderColor: C.cardBorder }}>
                  {["beginner", "intermediate", "advanced"].map(lv => (
                    <Pressable
                      key={lv}
                      onPress={() => setCourseForm(f => ({ ...f, level: lv }))}
                      style={{ paddingVertical: 8, paddingHorizontal: 12, backgroundColor: courseForm.level === lv ? C.tint : "transparent", borderRadius: 10 }}
                    >
                      <Text style={{ fontFamily: "Inter_500Medium", fontSize: 12, color: courseForm.level === lv ? "#fff" : C.textSecondary, textAlign: "center" }}>
                        {lv === "beginner" ? t("مبتدئ", "Beginner") : lv === "intermediate" ? t("متوسط", "Intermediate") : t("متقدم", "Advanced")}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            </View>

            <Text style={styles.inputLabel}>{t("لغة الدورة", "Course Language")}</Text>
            <View style={{ flexDirection: "row", gap: 8, marginBottom: 10 }}>
              {([["ar", "العربية 🇱🇾"], ["en", "English 🇬🇧"]] as const).map(([code, label]) => (
                <Pressable
                  key={code}
                  onPress={() => setCourseForm(f => ({ ...f, language: code }))}
                  style={{
                    flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: "center",
                    backgroundColor: courseForm.language === code ? C.tint : C.pill,
                  }}
                >
                  <Text style={{
                    fontFamily: "Inter_600SemiBold", fontSize: 13,
                    color: courseForm.language === code ? "#fff" : C.textSecondary,
                  }}>{label}</Text>
                </Pressable>
              ))}
            </View>

            <View style={{ flexDirection: "row", gap: 10, marginTop: 16, marginBottom: 24 }}>
              <Pressable style={[styles.applyBtn, { flex: 1 }]} onPress={createCourse}>
                <Text style={styles.applyBtnText}>{t("إنشاء الدورة", "Create Course")}</Text>
              </Pressable>
              <Pressable style={[styles.cancelBtn, { flex: 1 }]} onPress={() => setCreateCourseOpen(false)}>
                <Text style={styles.cancelBtnText}>{t("إلغاء", "Cancel")}</Text>
              </Pressable>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </ScrollView>
  );
}

// ── Student My Learning ───────────────────────────────────────────────────────

function StudentMyLearning() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { apiFetch } = useApi();
  const { t, language } = useLanguage();
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const { data: enrollments, isLoading } = useQuery<Enrollment[]>({
    queryKey: ["enrollments"],
    queryFn: () => apiFetch("/enrollments"),
    enabled: !!user,
  });

  const { data: liveSessions = [] } = useQuery<any[]>({
    queryKey: ["student-live-sessions"],
    queryFn: () => apiFetch("/live-sessions"),
    enabled: !!user,
  });

  const active = enrollments?.filter(e => e.progress < 100) || [];
  const completed = enrollments?.filter(e => e.progress >= 100) || [];
  const upcomingSessions = (liveSessions as any[]).filter((s: any) => s.status === "scheduled" || s.status === "live").slice(0, 3);

  if (!user) {
    return (
      <View style={[styles.container, styles.centered, { paddingTop: topPad }]}>
        <Feather name="book-open" size={48} color={C.tint} />
        <Text style={styles.guestTitle}>{t("دوراتك تنتظرك!", "Your courses await!")}</Text>
        <Text style={styles.guestSubtitle}>{t("سجّل دخولك لرؤية دوراتك المسجّلة", "Sign in to see your enrolled courses")}</Text>
        <Pressable style={styles.loginBtn} onPress={() => router.push("/auth/login")}>
          <Text style={styles.loginBtnText}>{t("تسجيل الدخول", "Sign In")}</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t("تعلّمي", "My Learning")}</Text>
        <Text style={styles.headerSubtitle}>{t("استمر في رحلتك التعليمية", "Continue your learning journey")}</Text>
      </View>

      {isLoading ? (
        <ActivityIndicator color={C.tint} style={{ flex: 1 }} />
      ) : (
        <FlatList
          data={[...active, ...completed]}
          keyExtractor={item => item.id.toString()}
          renderItem={({ item }) => <EnrollmentCard item={item} />}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: Platform.OS === "web" ? 34 : insets.bottom + 90, paddingTop: 8, gap: 12 }}
          ListHeaderComponent={() => (
            <>
              {enrollments && enrollments.length > 0 ? (
                <View style={styles.statsRow}>
                  <View style={styles.stat}>
                    <Text style={styles.statValue}>{enrollments.length}</Text>
                    <Text style={styles.statLabel}>{t("دورة مسجّلة", "Enrolled")}</Text>
                  </View>
                  <View style={styles.statDivider} />
                  <View style={styles.stat}>
                    <Text style={styles.statValue}>{completed.length}</Text>
                    <Text style={styles.statLabel}>{t("مكتملة", "Completed")}</Text>
                  </View>
                  <View style={styles.statDivider} />
                  <View style={styles.stat}>
                    <Text style={styles.statValue}>{active.length}</Text>
                    <Text style={styles.statLabel}>{t("جارية", "In Progress")}</Text>
                  </View>
                  <View style={styles.statDivider} />
                  <View style={styles.stat}>
                    <Text style={styles.statValue}>{upcomingSessions.length}</Text>
                    <Text style={styles.statLabel}>{t("جلسات قادمة", "Upcoming")}</Text>
                  </View>
                </View>
              ) : null}

              {/* Upcoming Live Sessions Preview */}
              {upcomingSessions.length > 0 && (
                <View style={{ marginBottom: 16 }}>
                  <View style={{ flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                    <Text style={styles.sectionTitle}>{t("جلسات مباشرة قادمة", "Upcoming Live Sessions")}</Text>
                    <Pressable onPress={() => router.push("/(tabs)/live")}>
                      <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 12, color: C.tint }}>{t("عرض الكل", "See All")}</Text>
                    </Pressable>
                  </View>
                  {upcomingSessions.map((session: any) => (
                    <Pressable
                      key={session.id}
                      style={{
                        backgroundColor: session.status === "live" ? "#FFF5F5" : C.card,
                        borderRadius: 14, padding: 14, marginBottom: 8,
                        borderWidth: 1, borderColor: session.status === "live" ? "#EF444430" : C.cardBorder,
                      }}
                      onPress={() => router.push("/(tabs)/live")}
                    >
                      <View style={{ flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "flex-start" }}>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 14, color: C.text, textAlign: "right" }}>{t(session.titleAr || session.title, session.title)}</Text>
                          <Text style={{ fontFamily: "Inter_400Regular", fontSize: 12, color: C.textSecondary, textAlign: "right", marginTop: 2 }}>{session.teacherName}</Text>
                        </View>
                        {session.status === "live" ? (
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#FEE2E2", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 }}>
                            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: "#EF4444" }} />
                            <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 10, color: "#EF4444" }}>{t("مباشر", "Live")}</Text>
                          </View>
                        ) : (
                          <View style={{ backgroundColor: `${C.tint}15`, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 }}>
                            <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 10, color: C.tint }}>{t("قادم", "Upcoming")}</Text>
                          </View>
                        )}
                      </View>
                      <View style={{ flexDirection: "row-reverse", gap: 12, marginTop: 8 }}>
                        <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 4 }}>
                          <Feather name="calendar" size={11} color={C.textMuted} />
                          <Text style={{ fontFamily: "Inter_400Regular", fontSize: 11, color: C.textMuted }}>
                            {new Date(session.scheduledAt).toLocaleDateString(language === "ar" ? "ar-LY" : "en-US", { month: "short", day: "numeric" })}
                          </Text>
                        </View>
                        <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 4 }}>
                          <Feather name="clock" size={11} color={C.textMuted} />
                          <Text style={{ fontFamily: "Inter_400Regular", fontSize: 11, color: C.textMuted }}>
                            {new Date(session.scheduledAt).toLocaleTimeString("ar-LY", { hour: "2-digit", minute: "2-digit" })}
                          </Text>
                        </View>
                      </View>
                    </Pressable>
                  ))}
                </View>
              )}
            </>
          )}
          ListEmptyComponent={() => (
            <View style={styles.emptyState}>
              <Feather name="book-open" size={48} color={C.textMuted} />
              <Text style={styles.emptyTitle}>لم تسجّل في أي دورة بعد</Text>
              <Text style={styles.emptySubtitle}>تصفّح الدورات المتاحة وابدأ التعلّم</Text>
              <Pressable style={styles.loginBtn} onPress={() => router.push("/courses" as any)}>
                <Text style={styles.loginBtnText}>تصفّح الدورات</Text>
              </Pressable>
            </View>
          )}
        />
      )}
    </View>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

export default function MyLearningScreen() {
  const { user } = useAuth();
  const isTeacher = user?.role === "teacher" || user?.role === "admin";
  return isTeacher ? <TeacherDashboard /> : <StudentMyLearning />;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
  centered: { alignItems: "center", justifyContent: "center", gap: 12, padding: 32 },
  header: { paddingHorizontal: 20, paddingBottom: 16 },
  headerTitle: { fontFamily: "Inter_700Bold", fontSize: 28, color: C.text },
  headerSubtitle: { fontFamily: "Inter_400Regular", fontSize: 13, color: C.textSecondary, marginTop: 4 },
  statsRow: { flexDirection: "row", backgroundColor: C.card, marginHorizontal: 20, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: C.cardBorder, marginBottom: 16 },
  stat: { flex: 1, alignItems: "center" },
  statValue: { fontFamily: "Inter_700Bold", fontSize: 22, color: C.text, marginBottom: 4 },
  statLabel: { fontFamily: "Inter_400Regular", fontSize: 11, color: C.textSecondary, textAlign: "center" },
  statDivider: { width: 1, backgroundColor: C.cardBorder, marginVertical: 4 },
  card: { flexDirection: "row-reverse", alignItems: "center", backgroundColor: C.card, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: C.cardBorder, gap: 12 },
  cardThumb: { width: 56, height: 56, borderRadius: 12, backgroundColor: C.pill, alignItems: "center", justifyContent: "center" },
  cardInfo: { flex: 1 },
  cardTitle: { fontFamily: "Inter_600SemiBold", fontSize: 14, color: C.text, textAlign: "right", marginBottom: 2, lineHeight: 20 },
  cardTeacher: { fontFamily: "Inter_400Regular", fontSize: 12, color: C.textSecondary, textAlign: "right", marginBottom: 6 },
  progressRow: { flexDirection: "row-reverse", alignItems: "center", gap: 8, marginBottom: 4 },
  progressBar: { flex: 1, height: 5, backgroundColor: C.pill, borderRadius: 3 },
  progressFill: { height: 5, backgroundColor: C.tint, borderRadius: 3 },
  progressPct: { fontFamily: "Inter_600SemiBold", fontSize: 11, color: C.tint, width: 32, textAlign: "right" },
  cardMeta: { fontFamily: "Inter_400Regular", fontSize: 11, color: C.textMuted, textAlign: "right" },
  section: { paddingHorizontal: 20, marginBottom: 20 },
  sectionTitle: { fontFamily: "Inter_600SemiBold", fontSize: 14, color: C.textMuted, textAlign: "right", marginBottom: 10 },
  actionsRow: { flexDirection: "row-reverse", gap: 12 },
  actionBtn: { flex: 1, alignItems: "center", gap: 8 },
  actionIcon: { width: 52, height: 52, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  actionLabel: { fontFamily: "Inter_500Medium", fontSize: 11, color: C.textSecondary, textAlign: "center" },
  courseRow: { flexDirection: "row-reverse", alignItems: "center", backgroundColor: C.card, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: C.cardBorder, marginBottom: 8, gap: 10 },
  courseName: { fontFamily: "Inter_600SemiBold", fontSize: 14, color: C.text, textAlign: "right" },
  courseMeta: { fontFamily: "Inter_400Regular", fontSize: 12, color: C.textMuted, textAlign: "right" },
  sessionRow: { flexDirection: "row-reverse", alignItems: "center", backgroundColor: C.card, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: C.cardBorder, marginBottom: 8, gap: 10 },
  statusPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  emptyBox: { alignItems: "center", paddingVertical: 24, gap: 8, backgroundColor: C.card, borderRadius: 16, borderWidth: 1, borderColor: C.cardBorder },
  emptyText: { fontFamily: "Inter_400Regular", fontSize: 13, color: C.textMuted },
  emptyState: { alignItems: "center", paddingTop: 60, gap: 12 },
  emptyTitle: { fontFamily: "Inter_600SemiBold", fontSize: 17, color: C.text },
  emptySubtitle: { fontFamily: "Inter_400Regular", fontSize: 13, color: C.textSecondary, textAlign: "center" },
  guestTitle: { fontFamily: "Inter_700Bold", fontSize: 22, color: C.text, textAlign: "center" },
  guestSubtitle: { fontFamily: "Inter_400Regular", fontSize: 14, color: C.textSecondary, textAlign: "center", maxWidth: 260 },
  loginBtn: { backgroundColor: C.tint, borderRadius: 14, paddingHorizontal: 32, paddingVertical: 12, marginTop: 8 },
  loginBtnText: { fontFamily: "Inter_600SemiBold", fontSize: 15, color: "#fff", textAlign: "center" },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalBox: { backgroundColor: C.background, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24 },
  modalTitle: { fontFamily: "Inter_700Bold", fontSize: 20, color: C.text, textAlign: "right", marginBottom: 14 },
  inputLabel: { fontFamily: "Inter_600SemiBold", fontSize: 13, color: C.textSecondary, textAlign: "right", marginBottom: 4, marginTop: 8 },
  input: { backgroundColor: C.pill, borderRadius: 12, padding: 12, fontFamily: "Inter_400Regular", fontSize: 14, color: C.text, borderWidth: 1, borderColor: C.cardBorder },
  applyBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", backgroundColor: C.tint, borderRadius: 14, paddingVertical: 12 },
  applyBtnText: { fontFamily: "Inter_600SemiBold", fontSize: 14, color: "#fff" },
  cancelBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", backgroundColor: C.pill, borderRadius: 14, paddingVertical: 12 },
  cancelBtnText: { fontFamily: "Inter_600SemiBold", fontSize: 14, color: C.textSecondary },
});
