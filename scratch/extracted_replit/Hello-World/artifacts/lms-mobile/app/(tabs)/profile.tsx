import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import React from "react";
import {
  Alert,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import Colors from "@/constants/colors";
import { useAuth } from "@/contexts/AuthContext";
import { useApi } from "@/hooks/useApi";
import { useLanguage } from "@/contexts/LanguageContext";
import { OfflineDownloader } from "@/utils/OfflineDownloader";

const C = Colors.light;

function MenuRow({ icon, label, onPress, danger = false, value }: {
  icon: string;
  label: string;
  onPress: () => void;
  danger?: boolean;
  value?: string;
}) {
  return (
    <Pressable
      style={({ pressed }) => [styles.menuRow, pressed && { backgroundColor: C.backgroundSecondary }]}
      onPress={onPress}
    >
      <Feather name={icon as any} size={18} color={danger ? C.error : C.textSecondary} />
      <Text style={[styles.menuLabel, danger && { color: C.error }]}>{label}</Text>
      <View style={styles.menuRight}>
        {value && <Text style={styles.menuValue}>{value}</Text>}
        {!danger && <Feather name="chevron-left" size={16} color={C.textMuted} />}
      </View>
    </Pressable>
  );
}

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { user, logout } = useAuth();
  const { apiFetch } = useApi();
  const { language, setLanguage, t } = useLanguage();

  const { data: enrollments } = useQuery({
    queryKey: ["enrollments"],
    queryFn: () => apiFetch("/enrollments"),
    enabled: !!user,
  });

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const handleLanguageToggle = () => {
    Alert.alert(
      t("اختر اللغة", "Choose Language"),
      "",
      [
        { text: "العربية", onPress: () => setLanguage("ar") },
        { text: "English", onPress: () => setLanguage("en") },
        { text: t("إلغاء", "Cancel"), style: "cancel" },
      ]
    );
  };

  if (!user) {
    return (
      <View style={[styles.container, styles.centered, { paddingTop: topPad }]}>
        <View style={styles.guestIcon}>
          <Feather name="user" size={40} color={C.tint} />
        </View>
        <Text style={styles.guestTitle}>{t("أهلاً بك في EduLibya", "Welcome to EduLibya")}</Text>
        <Text style={styles.guestSubtitle}>{t("سجّل دخولك للوصول إلى حسابك ودوراتك", "Sign in to access your account and courses")}</Text>
        <Pressable style={styles.loginBtn} onPress={() => router.push("/auth/login")}>
          <Text style={styles.loginBtnText}>{t("تسجيل الدخول", "Sign In")}</Text>
        </Pressable>
        <Pressable style={styles.registerBtn} onPress={() => router.push("/auth/register")}>
          <Text style={styles.registerBtnText}>{t("إنشاء حساب جديد", "Create Account")}</Text>
        </Pressable>
        <Pressable style={{ marginTop: 16 }} onPress={handleLanguageToggle}>
          <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 14, color: C.tint }}>
            {language === "ar" ? "🌐 English" : "🌐 العربية"}
          </Text>
        </Pressable>
      </View>
    );
  }

  const handleLogout = () => {
    Alert.alert(t("تسجيل الخروج", "Sign Out"), t("هل أنت متأكد من تسجيل الخروج؟", "Are you sure you want to sign out?"), [
      { text: t("إلغاء", "Cancel"), style: "cancel" },
      { text: t("خروج", "Sign Out"), style: "destructive", onPress: () => logout() },
    ]);
  };

  const clearOfflineVideos = () => {
    Alert.alert(
      t("مسح التنزيلات", "Clear Downloads"),
      t("هل أنت متأكد من مسح جميع الفيديوهات المحملة؟", "Are you sure you want to clear all offline downloaded videos?"),
      [
        { text: t("إلغاء", "Cancel"), style: "cancel" },
        { 
          text: t("مسح", "Clear"), 
          style: "destructive", 
          onPress: async () => {
            try {
              await OfflineDownloader.clearAllOfflineVideos();
              Alert.alert(t("تم بنجاح", "Success"), t("تم مسح الفيديوهات لتوفير المساحة", "Offline videos cleared to free up space."));
            } catch (err: any) {
              Alert.alert(t("خطأ", "Error"), err.message);
            }
          }
        },
      ]
    );
  };

  const roleName = user.role === "teacher"
    ? t("معلم", "Teacher")
    : user.role === "admin"
    ? t("مشرف", "Admin")
    : t("طالب", "Student");
  const enrolledCount = Array.isArray(enrollments) ? enrollments.length : 0;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: Platform.OS === "web" ? 34 : insets.bottom + 90 }}
      showsVerticalScrollIndicator={false}
    >
      {/* Profile header */}
      <View style={[styles.profileHeader, { paddingTop: topPad + 20 }]}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {(user.fullNameAr || user.fullName).charAt(0).toUpperCase()}
          </Text>
        </View>
        <Text style={styles.userName}>{language === "ar" ? (user.fullNameAr || user.fullName) : user.fullName}</Text>
        <Text style={styles.userEmail}>{user.email}</Text>
        <View style={styles.roleBadge}>
          <Text style={styles.roleText}>{roleName}</Text>
        </View>
      </View>

      {/* Stats */}
      <View style={styles.statsRow}>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{enrolledCount}</Text>
          <Text style={styles.statLabel}>{t("دورة مسجّلة", "Enrolled")}</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.stat}>
          <Text style={styles.statValue}>
            {Array.isArray(enrollments)
              ? enrollments.filter((e: any) => e.progress >= 100).length
              : 0}
          </Text>
          <Text style={styles.statLabel}>{t("دورة مكتملة", "Completed")}</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.stat}>
          <Text style={styles.statValue}>
            {Array.isArray(enrollments)
              ? Math.round(enrollments.reduce((acc: number, e: any) => acc + (e.progress || 0), 0) / Math.max(enrolledCount, 1))
              : 0}%
          </Text>
          <Text style={styles.statLabel}>{t("متوسط التقدم", "Avg Progress")}</Text>
        </View>
      </View>

      {/* Enrolled Courses Progress */}
      {user.role === 'student' && enrollments && enrollments.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t("تقدم التعلم", "My Learning Progress")}</Text>
          <View style={styles.coursesList}>
            {enrollments.map((enrollment: any) => (
              <Pressable 
                key={enrollment.id} 
                style={({pressed}) => [styles.courseProgressCard, pressed && { opacity: 0.8 }]}
                onPress={() => router.push({ pathname: "/lesson/[courseId]/[lessonId]", params: { courseId: enrollment.courseId.toString(), lessonId: "0" } })}
              >
                <View style={styles.courseThumbProgress}>
                  {enrollment.course?.thumbnailUrl ? (
                    <Image source={{ uri: enrollment.course.thumbnailUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" />
                  ) : (
                    <Feather name="book" size={20} color={C.tint} />
                  )}
                </View>
                <View style={styles.courseProgressInfo}>
                  <Text style={styles.courseProgressTitle} numberOfLines={1}>
                    {language === 'ar' ? (enrollment.course?.titleAr || enrollment.course?.title) : enrollment.course?.title}
                  </Text>
                  <View style={styles.courseProgressBarBg}>
                    <View style={[styles.courseProgressBarFill, { width: `${Math.min(enrollment.progress || 0, 100)}%` }]} />
                  </View>
                  <Text style={styles.courseProgressText}>
                    {Math.round(enrollment.progress || 0)}% {t("مكتمل", "Complete")}
                  </Text>
                </View>
                <Feather name={language === 'ar' ? "chevron-left" : "chevron-right"} size={16} color={C.textMuted} />
              </Pressable>
            ))}
          </View>
        </View>
      )}

      {/* Menu */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t("الحساب", "Account")}</Text>
        <View style={styles.menuGroup}>
          <MenuRow
            icon="user"
            label={t("معلومات الحساب", "Account Info")}
            value={roleName}
            onPress={() => {}}
          />
          <View style={styles.menuSeparator} />
          <MenuRow
            icon="globe"
            label={t("اللغة", "Language")}
            value={language === "ar" ? "العربية" : "English"}
            onPress={handleLanguageToggle}
          />
        </View>
      </View>

      {user.role === "teacher" && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t("إدارة المحتوى", "Content Management")}</Text>
          <View style={styles.menuGroup}>
            <MenuRow icon="book" label={t("دوراتي", "My Courses")} onPress={() => router.push("/courses")} />
            <View style={styles.menuSeparator} />
            <MenuRow icon="users" label={t("الطلاب", "Students")} onPress={() => {}} />
            <View style={styles.menuSeparator} />
            <MenuRow icon="video" label={t("جلساتي المباشرة", "My Live Sessions")} onPress={() => router.push("/live")} />
            <View style={styles.menuSeparator} />
            <MenuRow icon="star" label={t("الترويج والإعلانات (Pro)", "Promote & Ads (Pro)")} onPress={() => router.push("/teacher-profile/promote" as any)} />
          </View>
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t("عام", "General")}</Text>
        <View style={styles.menuGroup}>
          <MenuRow icon="hard-drive" label={t("مساحة التخزين (حذف التنزيلات)", "Storage (Clear Downloads)")} onPress={clearOfflineVideos} />
          <View style={styles.menuSeparator} />
          <MenuRow icon="help-circle" label={t("المساعدة والدعم", "Help & Support")} onPress={() => {}} />
          <View style={styles.menuSeparator} />
          <MenuRow icon="info" label={t("عن التطبيق", "About")} onPress={() => {}} />
          <View style={styles.menuSeparator} />
          <MenuRow icon="shield" label={t("سياسة الخصوصية", "Privacy Policy")} onPress={() => {}} />
          <View style={styles.menuSeparator} />
          <MenuRow icon="file-text" label={t("بلاغ حقوق ملكية (DMCA)", "DMCA Copyright")} onPress={() => router.push("/dmca" as any)} />
        </View>
      </View>

      <View style={[styles.section, { marginTop: 8 }]}>
        <View style={styles.menuGroup}>
          <MenuRow icon="log-out" label={t("تسجيل الخروج", "Sign Out")} onPress={handleLogout} danger />
        </View>
      </View>

      <Text style={styles.version}>EduLibya v1.0.0</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.backgroundSecondary },
  centered: { alignItems: "center", justifyContent: "center", gap: 12, padding: 32 },
  profileHeader: {
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 24,
    backgroundColor: C.background,
    borderBottomWidth: 1,
    borderBottomColor: C.cardBorder,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: C.tint,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  avatarText: { fontFamily: "Inter_700Bold", fontSize: 32, color: "#fff" },
  userName: { fontFamily: "Inter_700Bold", fontSize: 20, color: C.text, marginBottom: 4 },
  userEmail: { fontFamily: "Inter_400Regular", fontSize: 14, color: C.textSecondary, marginBottom: 10 },
  roleBadge: {
    backgroundColor: C.pill,
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 20,
  },
  roleText: { fontFamily: "Inter_600SemiBold", fontSize: 13, color: C.tint },
  statsRow: {
    flexDirection: "row",
    backgroundColor: C.background,
    marginTop: 16,
    marginHorizontal: 20,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: C.cardBorder,
  },
  stat: { flex: 1, alignItems: "center" },
  statValue: { fontFamily: "Inter_700Bold", fontSize: 22, color: C.text, marginBottom: 4 },
  statLabel: { fontFamily: "Inter_400Regular", fontSize: 11, color: C.textSecondary, textAlign: "center" },
  statDivider: { width: 1, backgroundColor: C.cardBorder, marginVertical: 4 },
  section: { marginTop: 24, paddingHorizontal: 20 },
  sectionTitle: { fontFamily: "Inter_600SemiBold", fontSize: 13, color: C.textMuted, marginBottom: 10, textAlign: "right" },
  menuGroup: {
    backgroundColor: C.background,
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: C.cardBorder,
  },
  menuRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    padding: 16,
    gap: 12,
  },
  menuLabel: { flex: 1, fontFamily: "Inter_500Medium", fontSize: 15, color: C.text, textAlign: "right" },
  menuRight: { flexDirection: "row-reverse", alignItems: "center", gap: 6 },
  menuValue: { fontFamily: "Inter_400Regular", fontSize: 13, color: C.textMuted },
  menuSeparator: { height: 1, backgroundColor: C.cardBorder, marginRight: 16 },
  guestIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: C.pill,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  guestTitle: { fontFamily: "Inter_700Bold", fontSize: 22, color: C.text, textAlign: "center" },
  guestSubtitle: { fontFamily: "Inter_400Regular", fontSize: 14, color: C.textSecondary, textAlign: "center", maxWidth: 260, lineHeight: 20 },
  loginBtn: { backgroundColor: C.tint, borderRadius: 14, paddingHorizontal: 40, paddingVertical: 14, width: "100%", marginTop: 8 },
  loginBtnText: { fontFamily: "Inter_600SemiBold", fontSize: 15, color: "#fff", textAlign: "center" },
  registerBtn: { borderWidth: 1.5, borderColor: C.tint, borderRadius: 14, paddingHorizontal: 40, paddingVertical: 14, width: "100%" },
  registerBtnText: { fontFamily: "Inter_600SemiBold", fontSize: 15, color: C.tint, textAlign: "center" },
  version: { fontFamily: "Inter_400Regular", fontSize: 12, color: C.textMuted, textAlign: "center", marginTop: 24, marginBottom: 8 },
  coursesList: { gap: 10 },
  courseProgressCard: {
    flexDirection: "row-reverse",
    alignItems: "center",
    backgroundColor: C.background,
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.cardBorder,
    gap: 12
  },
  courseThumbProgress: {
    width: 60,
    height: 60,
    borderRadius: 12,
    backgroundColor: C.backgroundSecondary,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center"
  },
  courseProgressInfo: {
    flex: 1,
    justifyContent: "center"
  },
  courseProgressTitle: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    color: C.text,
    textAlign: "right",
    marginBottom: 6
  },
  courseProgressBarBg: {
    height: 4,
    backgroundColor: C.pill,
    borderRadius: 2,
    flexDirection: "row-reverse",
    overflow: "hidden",
    marginBottom: 4
  },
  courseProgressBarFill: {
    height: "100%",
    backgroundColor: C.tint,
    borderRadius: 2
  },
  courseProgressText: {
    fontFamily: "Inter_500Medium",
    fontSize: 11,
    color: C.textMuted,
    textAlign: "right"
  }
});
