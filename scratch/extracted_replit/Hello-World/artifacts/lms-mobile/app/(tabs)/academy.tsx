import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import React from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Colors from "@/constants/colors";
import { useLanguage } from "@/contexts/LanguageContext";
import { useQuery } from "@tanstack/react-query";
import { useApi } from "@/hooks/useApi";
import { useAuth } from "@/contexts/AuthContext";

const C = Colors.light;

function FeatureCard({ icon, title, desc, colors }: { icon: string; title: string; desc: string; colors: [string, string] }) {
  return (
    <View style={styles.featureCard}>
      <LinearGradient colors={colors} style={styles.featureIcon}>
        <Feather name={icon as any} size={22} color="#fff" />
      </LinearGradient>
      <Text style={styles.featureTitle}>{title}</Text>
      <Text style={styles.featureDesc}>{desc}</Text>
    </View>
  );
}

function StepCard({ step, title, desc }: { step: number; title: string; desc: string }) {
  return (
    <View style={styles.stepCard}>
      <LinearGradient colors={["#f59e0b", "#f97316"]} style={styles.stepNum}>
        <Text style={styles.stepNumText}>{step}</Text>
      </LinearGradient>
      <View style={{ flex: 1 }}>
        <Text style={styles.stepTitle}>{title}</Text>
        <Text style={styles.stepDesc}>{desc}</Text>
      </View>
    </View>
  );
}

export default function AcademyScreen() {
  const insets = useSafeAreaInsets();
  const { t, language } = useLanguage();
  const isAr = language === "ar";

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const features = [
    { icon: "book", title: t("المنهج الليبي", "Libyan Curriculum"), desc: t("منهج وزارة التربية المعتمد", "Official Ministry of Education curriculum"), colors: ["#3b82f6", "#06b6d4"] as [string, string] },
    { icon: "monitor", title: t("تعلم من المنزل", "Learn From Home"), desc: t("محاضرات فيديو متاحة ٢٤/٧", "HD video lectures available 24/7"), colors: ["#8b5cf6", "#a855f7"] as [string, string] },
    { icon: "shield", title: t("اختبارات معتمدة", "Certified Exams"), desc: t("اختبارات في مراكز معتمدة", "Exams at certified centers"), colors: ["#10b981", "#22c55e"] as [string, string] },
    { icon: "users", title: t("كادر متميز", "Expert Faculty"), desc: t("معلمون ذوو خبرة طويلة", "Experienced, certified teachers"), colors: ["#f59e0b", "#f97316"] as [string, string] },
  ];

  const steps = [
    { step: 1, title: t("قدّم طلبك", "Apply"), desc: t("أكمل نموذج التسجيل", "Complete the registration form") },
    { step: 2, title: t("القبول", "Get Accepted"), desc: t("مراجعة طلبك والموافقة", "Application review & approval") },
    { step: 3, title: t("سجّل في الفصل", "Enroll"), desc: t("ادفع الرسوم واحصل على جدولك", "Pay tuition & get your schedule") },
    { step: 4, title: t("تعلّم", "Learn"), desc: t("شاهد المحاضرات وأكمل الواجبات", "Watch lectures & complete assignments") },
    { step: 5, title: t("اختبر", "Take Exams"), desc: t("قدّم اختباراتك في المراكز", "Take exams at testing centers") },
    { step: 6, title: t("تخرّج 🎓", "Graduate 🎓"), desc: t("احصل على شهادتك", "Receive your diploma") },
  ];

  const api = useApi();
  const { user } = useAuth();
  
  const { data: enrollmentData, isLoading: loadingEnrollment } = useQuery({
    queryKey: ['academy-enrollment'],
    queryFn: () => api.apiFetch('/academy/my-enrollment'),
    enabled: !!user,
  });

  const { data: applications } = useQuery({
    queryKey: ['academy-application'],
    queryFn: () => api.apiFetch('/academy/my-application'),
    enabled: !!user,
  });

  const { enrolled, current } = enrollmentData || { enrolled: false, current: null };
  const hasPendingApp = applications?.some((a: any) => a.status === 'pending' || a.status === 'waitlisted');

  const handleApply = () => {
    if (!user) {
      router.push("/auth/login");
    } else {
      router.push("/academy-apply");
    }
  };

  if (enrolled && current) {
    return (
      <View style={[styles.container, { paddingTop: topPad }]}>
        {/* Header Profile */}
        <LinearGradient
          colors={["#f59e0b", "#f97316"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.studentHero}
        >
          <View style={{ flexDirection: isAr ? 'row-reverse' : 'row', alignItems: 'center', gap: 16 }}>
            <View style={styles.studentAvatar}>
              <Text style={styles.studentAvatarText}>{user?.fullName.charAt(0) || 'A'}</Text>
            </View>
            <View style={{ flex: 1, alignItems: isAr ? 'flex-end' : 'flex-start' }}>
              <View style={{ flexDirection: isAr ? 'row-reverse' : 'row', gap: 8, marginBottom: 4 }}>
                <View style={styles.statusBadge}>
                   <Text style={styles.statusBadgeText}>{t('طالب أكاديمية', 'Academy Student')}</Text>
                </View>
              </View>
              <Text style={[styles.studentHeroTitle, { textAlign: isAr ? 'right' : 'left' }]}>
                {user?.fullName}
              </Text>
              <Text style={[styles.studentHeroSubtitle, { textAlign: isAr ? 'right' : 'left' }]}>
                {isAr ? current.programNameAr : current.programName} — {isAr ? `الصف ${current.currentGradeLevel}` : `Grade ${current.currentGradeLevel}`}
              </Text>
            </View>
          </View>
        </LinearGradient>

        <ScrollView
          contentContainerStyle={{ padding: 20, paddingBottom: Platform.OS === "web" ? 34 : insets.bottom + 90, gap: 24 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Quick Stats */}
          <View style={{ flexDirection: isAr ? 'row-reverse' : 'row', gap: 12, flexWrap: 'wrap' }}>
            <View style={styles.statCard}>
              <View style={[styles.statIconBg, { backgroundColor: '#fef3c7' }]}>
                <Feather name="calendar" size={18} color="#d97706" />
              </View>
              <View style={{ flex: 1, alignItems: isAr ? 'flex-end' : 'flex-start' }}>
                <Text style={styles.statLabel}>{t('الفصل الدراسي', 'Semester')}</Text>
                <Text style={styles.statValue}>{isAr ? current.semesterNameAr : current.semesterName}</Text>
              </View>
            </View>
            <View style={styles.statCard}>
              <View style={[styles.statIconBg, { backgroundColor: '#dbeafe' }]}>
                <Feather name="book-open" size={18} color="#2563eb" />
              </View>
              <View style={{ flex: 1, alignItems: isAr ? 'flex-end' : 'flex-start' }}>
                <Text style={styles.statLabel}>{t('المقررات', 'Subjects')}</Text>
                <Text style={styles.statValue}>{current.registrations?.length || 0} {t('مواد', 'Classes')}</Text>
              </View>
            </View>
          </View>

          {/* Subjects List */}
          <View>
            <Text style={[styles.sectionTitle, { textAlign: isAr ? 'right' : 'left', paddingHorizontal: 0, marginBottom: 16 }]}>
              {t('مقررات الفصل الدراسي', 'Semester Subjects')}
            </Text>
            
            {current.registrations && current.registrations.length > 0 ? (
              <View style={{ gap: 12 }}>
                {current.registrations.map((reg: any) => (
                  <View key={reg.id} style={styles.subjectCard}>
                    <View style={{ flexDirection: isAr ? 'row-reverse' : 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                      <View style={{ flexDirection: isAr ? 'row-reverse' : 'row', alignItems: 'center', gap: 12 }}>
                         <View style={styles.subjectIconBg}>
                           <Feather name="file-text" size={20} color="#d97706" />
                         </View>
                         <View style={{ alignItems: isAr ? 'flex-end' : 'flex-start' }}>
                            <Text style={styles.subjectTitle}>{isAr ? reg.subjectNameAr : reg.subjectName}</Text>
                            <Text style={styles.subjectTeacher}>{t('أستاذ:', 'Prof.')} {reg.teacherName || t('المنصة', 'Platform')}</Text>
                         </View>
                      </View>
                    </View>
                    
                    <View style={{ backgroundColor: '#fffbeb', borderTopWidth: 1, borderTopColor: '#fef3c7', padding: 12, flexDirection: isAr ? 'row-reverse' : 'row', alignItems: 'center', justifyContent: 'center' }}>
                      <Text style={{ color: '#d97706', fontFamily: 'Inter_600SemiBold', fontSize: 13 }}>
                        {t('دخول قاعة الدروس', 'Enter Classroom')}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            ) : (
              <View style={styles.emptySubjectCard}>
                <Feather name="book" size={32} color={C.textMuted} style={{ marginBottom: 12 }} />
                <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 16, color: C.text, marginBottom: 4 }}>
                  {t('قيد التسجيل', 'Registration in Progress')}
                </Text>
                <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 13, color: C.textMuted, textAlign: 'center' }}>
                  {t('ستظهر مقرراتك هنا قريباً', 'Your subjects will appear here soon')}
                </Text>
              </View>
            )}
          </View>
        </ScrollView>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: Platform.OS === "web" ? 34 : insets.bottom + 90 }}
      showsVerticalScrollIndicator={false}
    >
      {/* Hero */}
      <LinearGradient
        colors={["#f59e0b", "#f97316", "#ef4444"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.hero, { paddingTop: topPad + 30 }]}
      >
        <View style={styles.comingSoonBadge}>
          <Text style={styles.comingSoonText}>✨ {t("التسجيل مفتوح", "Enrollment Open")}</Text>
        </View>
        <Text style={styles.heroTitle}>
          {t("أكاديمية\nEduLibya", "EduLibya\nAcademy")}
        </Text>
        <Text style={styles.heroSubtitle}>
          {t(
            "أول أكاديمية إلكترونية ليبية للتعليم الأساسي والثانوي",
            "The first Libyan online academy for primary & secondary education"
          )}
        </Text>

        <View style={styles.heroStats}>
          {[
            { label: t("الصفوف", "Grades"), value: "1-12" },
            { label: t("المنهج", "Curriculum"), value: t("ليبي", "Libyan") },
            { label: t("الشهادة", "Diploma"), value: t("معتمدة", "Certified") },
          ].map((s) => (
            <View key={s.label} style={styles.heroStat}>
              <Text style={styles.heroStatValue}>{s.value}</Text>
              <Text style={styles.heroStatLabel}>{s.label}</Text>
            </View>
          ))}
        </View>
      </LinearGradient>

      {/* Grade Levels */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t("المراحل الدراسية", "Grade Levels")}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingHorizontal: 20 }}>
          {[
            { emoji: "📚", range: t("الصفوف ١-٦", "Grades 1-6"), label: t("تعليم أساسي", "Primary") },
            { emoji: "📖", range: t("الصفوف ٧-٩", "Grades 7-9"), label: t("إعدادي", "Preparatory") },
            { emoji: "🔬", range: t("الصف ١٠", "Grade 10"), label: t("أولى ثانوي", "1st Secondary") },
            { emoji: "🎓", range: t("الصفوف ١١-١٢", "Grades 11-12"), label: t("علمي / أدبي", "Sci. / Lit.") },
          ].map((g) => (
            <View key={g.range} style={styles.gradeCard}>
              <Text style={styles.gradeEmoji}>{g.emoji}</Text>
              <Text style={styles.gradeRange}>{g.range}</Text>
              <Text style={styles.gradeLabel}>{g.label}</Text>
            </View>
          ))}
        </ScrollView>
      </View>

      {/* Features */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t("لماذا أكاديمية EduLibya؟", "Why EduLibya Academy?")}</Text>
        <View style={{ paddingHorizontal: 20, gap: 12 }}>
          {features.map((f) => (
            <FeatureCard key={f.title} {...f} />
          ))}
        </View>
      </View>

      {/* How it works */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t("رحلتك الأكاديمية", "Your Academic Journey")}</Text>
        <View style={{ paddingHorizontal: 20, gap: 10 }}>
          {steps.map((s) => (
            <StepCard key={s.step} {...s} />
          ))}
        </View>
      </View>

      {/* CTA */}
      <View style={styles.ctaBox}>
        {hasPendingApp ? (
           <>
             <Text style={styles.ctaEmoji}>⌛</Text>
             <Text style={styles.ctaTitle}>{t("طلبك قيد المراجعة", "Application Under Review")}</Text>
             <Text style={styles.ctaDesc}>{t("تقوم الإدارة حالياً بمراجعة طلبك وسنعلمك بالنتيجة قريباً.", "The administration is currently reviewing your application and we will notify you soon.")}</Text>
           </>
        ) : (
           <>
             <Text style={styles.ctaEmoji}>🎓</Text>
             <Text style={styles.ctaTitle}>{t("كن أول من ينضم!", "Join the Academy!")}</Text>
             <Text style={styles.ctaDesc}>{t("مستقبلك الأكاديمي يبدأ من هنا. قدم طلب الالتحاق الآن.", "Your academic future starts here. Apply for admission now.")}</Text>
             <Pressable style={styles.ctaBtn} onPress={handleApply}>
               <Text style={styles.ctaBtnText}>{t("تقديم طلب التحاق", "Apply Now")}</Text>
             </Pressable>
           </>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
  hero: {
    paddingHorizontal: 24,
    paddingBottom: 32,
    borderBottomLeftRadius: 40,
    borderBottomRightRadius: 40,
    alignItems: "center",
  },
  comingSoonBadge: {
    backgroundColor: "rgba(255,255,255,0.25)",
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 16,
  },
  comingSoonText: {
    fontFamily: "Inter_700Bold",
    fontSize: 13,
    color: "#fff",
  },
  heroTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 36,
    color: "#fff",
    textAlign: "center",
    lineHeight: 44,
    marginBottom: 12,
  },
  heroSubtitle: {
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    color: "rgba(255,255,255,0.85)",
    textAlign: "center",
    lineHeight: 22,
    maxWidth: 300,
    marginBottom: 24,
  },
  heroStats: {
    flexDirection: "row",
    gap: 16,
  },
  heroStat: {
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: 16,
    paddingHorizontal: 18,
    paddingVertical: 12,
    alignItems: "center",
    minWidth: 90,
  },
  heroStatValue: { fontFamily: "Inter_700Bold", fontSize: 18, color: "#fff" },
  heroStatLabel: { fontFamily: "Inter_400Regular", fontSize: 11, color: "rgba(255,255,255,0.8)", marginTop: 2 },
  section: { marginTop: 28 },
  sectionTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 18,
    color: C.text,
    paddingHorizontal: 20,
    marginBottom: 14,
    textAlign: "right",
  },
  gradeCard: {
    width: 130,
    backgroundColor: C.card,
    borderRadius: 20,
    padding: 18,
    alignItems: "center",
    borderWidth: 1,
    borderColor: C.cardBorder,
  },
  gradeEmoji: { fontSize: 32, marginBottom: 8 },
  gradeRange: { fontFamily: "Inter_700Bold", fontSize: 14, color: C.text, textAlign: "center" },
  gradeLabel: { fontFamily: "Inter_400Regular", fontSize: 11, color: C.textMuted, marginTop: 4, textAlign: "center" },
  featureCard: {
    backgroundColor: C.card,
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: C.cardBorder,
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 14,
  },
  featureIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  featureTitle: { fontFamily: "Inter_600SemiBold", fontSize: 15, color: C.text, textAlign: "right", flex: 1 },
  featureDesc: { display: "none" }, // Hidden on mobile for compactness
  stepCard: {
    backgroundColor: C.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: C.cardBorder,
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 14,
  },
  stepNum: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  stepNumText: { fontFamily: "Inter_700Bold", fontSize: 16, color: "#fff" },
  stepTitle: { fontFamily: "Inter_600SemiBold", fontSize: 14, color: C.text, textAlign: "right" },
  stepDesc: { fontFamily: "Inter_400Regular", fontSize: 12, color: C.textMuted, textAlign: "right", marginTop: 2 },
  ctaBox: {
    margin: 20,
    marginTop: 28,
    backgroundColor: C.card,
    borderRadius: 24,
    padding: 28,
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "rgba(245,158,11,0.3)",
  },
  ctaEmoji: { fontSize: 40, marginBottom: 12 },
  ctaTitle: { fontFamily: "Inter_700Bold", fontSize: 20, color: C.text, marginBottom: 8, textAlign: "center" },
  ctaDesc: { fontFamily: "Inter_400Regular", fontSize: 14, color: C.textSecondary, textAlign: "center", lineHeight: 20, marginBottom: 20 },
  ctaBtn: {
    backgroundColor: "#f59e0b",
    borderRadius: 14,
    paddingHorizontal: 28,
    paddingVertical: 14,
    width: "100%",
  },
  ctaBtnText: { fontFamily: "Inter_600SemiBold", fontSize: 15, color: "#fff", textAlign: "center" },
  studentHero: {
    paddingHorizontal: 24,
    paddingBottom: 24,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    shadowColor: "#f59e0b",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 10,
  },
  studentAvatar: {
    width: 60,
    height: 60,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.4)'
  },
  studentAvatarText: { fontFamily: "Inter_700Bold", fontSize: 24, color: "#fff" },
  statusBadge: { backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  statusBadgeText: { fontFamily: "Inter_700Bold", fontSize: 10, color: "#fff", textTransform: 'uppercase' },
  studentHeroTitle: { fontFamily: "Inter_700Bold", fontSize: 24, color: "#fff", marginBottom: 2 },
  studentHeroSubtitle: { fontFamily: "Inter_500Medium", fontSize: 14, color: "rgba(255,255,255,0.85)" },
  statCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: C.card,
    borderRadius: 20,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: C.cardBorder,
  },
  statIconBg: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  statLabel: { fontFamily: "Inter_500Medium", fontSize: 12, color: C.textMuted, marginBottom: 2 },
  statValue: { fontFamily: "Inter_700Bold", fontSize: 14, color: C.text },
  subjectCard: {
    backgroundColor: C.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: C.cardBorder,
    overflow: 'hidden',
  },
  subjectIconBg: { width: 48, height: 48, borderRadius: 14, backgroundColor: '#fef3c7', alignItems: 'center', justifyContent: 'center' },
  subjectTitle: { fontFamily: "Inter_700Bold", fontSize: 16, color: C.text, marginBottom: 4 },
  subjectTeacher: { fontFamily: "Inter_500Medium", fontSize: 13, color: C.textMuted },
  emptySubjectCard: {
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.cardBorder,
    borderStyle: 'dashed',
    borderRadius: 20,
    padding: 32,
    alignItems: 'center',
  }
});
