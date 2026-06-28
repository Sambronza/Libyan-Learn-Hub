import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import React from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import Colors from "@/constants/colors";
import { useAuth } from "@/contexts/AuthContext";
import { useApi } from "@/hooks/useApi";
import { useLanguage } from "@/contexts/LanguageContext";

const C = Colors.light;

function SubjectCard({ reg, isAr }: { reg: any; isAr: boolean }) {
  return (
    <View style={styles.subjectCard}>
      <View style={styles.subjectHeader}>
        <View style={styles.subjectIconBg}>
          <Feather name="book-open" size={18} color="#d97706" />
        </View>
        <View style={{ flex: 1, alignItems: isAr ? "flex-end" : "flex-start" }}>
          <Text style={styles.subjectName}>{isAr ? reg.subjectNameAr : reg.subjectName}</Text>
          <Text style={styles.subjectTeacher}>{isAr ? "أستاذ:" : "Prof."} {reg.teacherName || (isAr ? "المنصة" : "Platform")}</Text>
        </View>
      </View>
      <View style={styles.subjectFooter}>
        <Feather name="play-circle" size={14} color="#d97706" />
        <Text style={styles.subjectEnterText}>{isAr ? "دخول قاعة الدروس" : "Enter Classroom"}</Text>
      </View>
    </View>
  );
}

export default function AcademyDashboardScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { apiFetch } = useApi();
  const { t, language } = useLanguage();
  const isAr = language === "ar";
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const { data: enrollmentData, isLoading: loadingEnrollment } = useQuery({
    queryKey: ["academy-enrollment"],
    queryFn: () => apiFetch("/academy/my-enrollment"),
    enabled: !!user,
  });

  const { data: applications, isLoading: loadingApps } = useQuery({
    queryKey: ["academy-application"],
    queryFn: () => apiFetch("/academy/my-application"),
    enabled: !!user,
  });

  if (loadingEnrollment || loadingApps) {
    return (
      <View style={[styles.container, { paddingTop: topPad, alignItems: "center", justifyContent: "center" }]}>
        <ActivityIndicator color={C.tint} size="large" />
      </View>
    );
  }

  const { enrolled, current } = enrollmentData || { enrolled: false, current: null };
  const hasPendingApp = applications?.some((a: any) => a.status === "pending" || a.status === "waitlisted");
  const latestApp = applications?.[0];

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-right" size={22} color={C.text} />
        </Pressable>
        <Text style={styles.headerTitle}>{t("أكاديميتي", "My Academy")}</Text>
        <View style={{ width: 40 }} />
      </View>

      {enrolled && current ? (
        <ScrollView
          contentContainerStyle={{ paddingBottom: Platform.OS === "web" ? 34 : insets.bottom + 24 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Hero Banner */}
          <LinearGradient colors={["#f59e0b", "#f97316"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
            <View style={styles.heroInner}>
              <View style={styles.heroAvatar}>
                <Text style={styles.heroAvatarText}>{user?.fullName.charAt(0) || "A"}</Text>
              </View>
              <View style={{ flex: 1, alignItems: isAr ? "flex-end" : "flex-start" }}>
                <View style={styles.heroBadge}>
                  <Text style={styles.heroBadgeText}>{t("طالب أكاديمية", "Academy Student")}</Text>
                </View>
                <Text style={styles.heroName}>{isAr ? (user?.fullNameAr || user?.fullName) : user?.fullName}</Text>
                <Text style={styles.heroProgram}>
                  {isAr ? current.programNameAr : current.programName} — {isAr ? `الصف ${current.currentGradeLevel}` : `Grade ${current.currentGradeLevel}`}
                </Text>
              </View>
            </View>
          </LinearGradient>

          {/* Stats */}
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <View style={[styles.statIcon, { backgroundColor: "#fef3c7" }]}>
                <Feather name="calendar" size={18} color="#d97706" />
              </View>
              <Text style={styles.statLabel}>{t("الفصل الدراسي", "Semester")}</Text>
              <Text style={styles.statValue}>{isAr ? current.semesterNameAr : current.semesterName}</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <View style={[styles.statIcon, { backgroundColor: "#dbeafe" }]}>
                <Feather name="book-open" size={18} color="#2563eb" />
              </View>
              <Text style={styles.statLabel}>{t("المواد", "Subjects")}</Text>
              <Text style={styles.statValue}>{current.registrations?.length || 0}</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <View style={[styles.statIcon, { backgroundColor: "#d1fae5" }]}>
                <Feather name="award" size={18} color="#059669" />
              </View>
              <Text style={styles.statLabel}>{t("الدرجة", "Grade")}</Text>
              <Text style={styles.statValue}>{current.currentGradeLevel}</Text>
            </View>
          </View>

          {/* Semester Subjects */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { textAlign: isAr ? "right" : "left" }]}>
              {t("مقررات الفصل الدراسي", "Semester Subjects")}
            </Text>
            {current.registrations && current.registrations.length > 0 ? (
              current.registrations.map((reg: any) => (
                <SubjectCard key={reg.id} reg={reg} isAr={isAr} />
              ))
            ) : (
              <View style={styles.emptyBox}>
                <Feather name="book" size={32} color={C.textMuted} />
                <Text style={styles.emptyTitle}>{t("قيد التسجيل", "Registration in Progress")}</Text>
                <Text style={styles.emptySubtitle}>{t("ستظهر مقرراتك هنا قريباً", "Your subjects will appear here soon")}</Text>
              </View>
            )}
          </View>

          {/* Applications */}
          {applications && applications.length > 0 && (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { textAlign: isAr ? "right" : "left" }]}>
                {t("طلبات التسجيل", "Applications")}
              </Text>
              {applications.map((app: any) => (
                <View key={app.id} style={styles.appCard}>
                  <View style={[styles.statusPill, {
                    backgroundColor: app.status === "approved" ? "#d1fae5" : app.status === "pending" ? "#fef3c7" : "#fee2e2"
                  }]}>
                    <Text style={[styles.statusText, {
                      color: app.status === "approved" ? "#059669" : app.status === "pending" ? "#d97706" : "#dc2626"
                    }]}>
                      {app.status === "approved" ? t("مقبول", "Approved") :
                       app.status === "pending" ? t("قيد المراجعة", "Under Review") :
                       app.status === "waitlisted" ? t("قائمة الانتظار", "Waitlisted") : t("مرفوض", "Rejected")}
                    </Text>
                  </View>
                  <View style={{ flex: 1, alignItems: isAr ? "flex-end" : "flex-start" }}>
                    <Text style={styles.appGrade}>
                      {t("الصف", "Grade")} {app.gradeLevel} — {isAr ? app.programNameAr : app.programName}
                    </Text>
                    <Text style={styles.appDate}>
                      {new Date(app.createdAt).toLocaleDateString(isAr ? "ar-LY" : "en-US", { year: "numeric", month: "short", day: "numeric" })}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      ) : hasPendingApp ? (
        <View style={styles.pendingContainer}>
          <View style={[styles.pendingIcon, { backgroundColor: "#eff6ff" }]}>
            <Feather name="clock" size={40} color="#2563eb" />
          </View>
          <Text style={styles.pendingTitle}>{t("طلبك قيد المراجعة", "Application Under Review")}</Text>
          <Text style={styles.pendingSubtitle}>
            {t("سيتم إشعارك بمجرد البت في طلبك", "You will be notified once your application is reviewed.")}
          </Text>
          {latestApp && (
            <View style={styles.appCard}>
              <View style={[styles.statusPill, { backgroundColor: "#fef3c7" }]}>
                <Text style={[styles.statusText, { color: "#d97706" }]}>{t("قيد المراجعة", "Under Review")}</Text>
              </View>
              <Text style={styles.appGrade}>{t("الصف", "Grade")} {latestApp.gradeLevel}</Text>
            </View>
          )}
        </View>
      ) : (
        <View style={styles.pendingContainer}>
          <View style={[styles.pendingIcon, { backgroundColor: "#fef3c7" }]}>
            <Feather name="award" size={40} color="#d97706" />
          </View>
          <Text style={styles.pendingTitle}>{t("انضم إلى الأكاديمية", "Join the Academy")}</Text>
          <Text style={styles.pendingSubtitle}>
            {t("ابدأ رحلتك الأكاديمية مع المنهج الليبي", "Start your academic journey with the Libyan curriculum")}
          </Text>
          <Pressable style={styles.applyBtn} onPress={() => router.push("/academy-apply")}>
            <Feather name="edit" size={16} color="#fff" />
            <Text style={styles.applyBtnText}>{t("قدّم طلبك الآن", "Apply Now")}</Text>
          </Pressable>
        </View>
      )}
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
  hero: { padding: 24 },
  heroInner: { flexDirection: "row-reverse", alignItems: "center", gap: 16 },
  heroAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "rgba(255,255,255,0.3)",
    alignItems: "center",
    justifyContent: "center",
  },
  heroAvatarText: { fontFamily: "Inter_700Bold", fontSize: 24, color: "#fff" },
  heroBadge: { backgroundColor: "rgba(255,255,255,0.2)", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, marginBottom: 6 },
  heroBadgeText: { fontFamily: "Inter_600SemiBold", fontSize: 12, color: "#fff" },
  heroName: { fontFamily: "Inter_700Bold", fontSize: 18, color: "#fff", marginBottom: 4 },
  heroProgram: { fontFamily: "Inter_400Regular", fontSize: 13, color: "rgba(255,255,255,0.85)" },
  statsRow: {
    flexDirection: "row",
    backgroundColor: C.card,
    marginHorizontal: 20,
    marginTop: 16,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: C.cardBorder,
    gap: 4,
  },
  statItem: { flex: 1, alignItems: "center", gap: 6 },
  statIcon: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  statLabel: { fontFamily: "Inter_400Regular", fontSize: 11, color: C.textSecondary, textAlign: "center" },
  statValue: { fontFamily: "Inter_700Bold", fontSize: 15, color: C.text, textAlign: "center" },
  statDivider: { width: 1, backgroundColor: C.cardBorder, marginVertical: 8 },
  section: { padding: 20, gap: 12 },
  sectionTitle: { fontFamily: "Inter_700Bold", fontSize: 16, color: C.text },
  subjectCard: {
    backgroundColor: C.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#fef3c7",
    overflow: "hidden",
  },
  subjectHeader: { flexDirection: "row-reverse", alignItems: "center", gap: 12, padding: 14 },
  subjectIconBg: { width: 40, height: 40, borderRadius: 12, backgroundColor: "#fffbeb", alignItems: "center", justifyContent: "center" },
  subjectName: { fontFamily: "Inter_700Bold", fontSize: 15, color: C.text, textAlign: "right" },
  subjectTeacher: { fontFamily: "Inter_400Regular", fontSize: 12, color: C.textSecondary, textAlign: "right", marginTop: 2 },
  subjectFooter: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#fffbeb",
    borderTopWidth: 1,
    borderTopColor: "#fef3c7",
    paddingVertical: 10,
  },
  subjectEnterText: { fontFamily: "Inter_600SemiBold", fontSize: 13, color: "#d97706" },
  appCard: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 12,
    backgroundColor: C.card,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: C.cardBorder,
  },
  statusPill: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  statusText: { fontFamily: "Inter_600SemiBold", fontSize: 12 },
  appGrade: { fontFamily: "Inter_600SemiBold", fontSize: 14, color: C.text, textAlign: "right" },
  appDate: { fontFamily: "Inter_400Regular", fontSize: 12, color: C.textMuted, textAlign: "right", marginTop: 2 },
  emptyBox: { alignItems: "center", paddingVertical: 32, gap: 10, backgroundColor: C.card, borderRadius: 16, borderWidth: 1, borderColor: C.cardBorder },
  emptyTitle: { fontFamily: "Inter_600SemiBold", fontSize: 16, color: C.text },
  emptySubtitle: { fontFamily: "Inter_400Regular", fontSize: 13, color: C.textSecondary, textAlign: "center", paddingHorizontal: 20 },
  pendingContainer: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32, gap: 16 },
  pendingIcon: { width: 90, height: 90, borderRadius: 45, alignItems: "center", justifyContent: "center", marginBottom: 8 },
  pendingTitle: { fontFamily: "Inter_700Bold", fontSize: 22, color: C.text, textAlign: "center" },
  pendingSubtitle: { fontFamily: "Inter_400Regular", fontSize: 15, color: C.textSecondary, textAlign: "center", lineHeight: 22, maxWidth: 300 },
  applyBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: C.tint,
    borderRadius: 16,
    paddingHorizontal: 32,
    paddingVertical: 14,
    marginTop: 8,
  },
  applyBtnText: { fontFamily: "Inter_700Bold", fontSize: 16, color: "#fff" },
});
