import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import React from "react";
import {
  ActivityIndicator,
  Image,
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

interface Course {
  id: number;
  title: string;
  titleAr: string;
  teacherName: string;
  price: number;
  currency: string;
  rating: number;
  enrollmentCount: number;
  level: string;
  language: string;
  thumbnailUrl?: string | null;
  lessonCount: number;
}

interface Category {
  id: number;
  name: string;
  nameAr: string;
  icon?: string | null;
  courseCount: number;
}

function StarRow({ rating }: { rating: number }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 2 }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Feather
          key={i}
          name="star"
          size={10}
          color={i <= Math.round(rating) ? C.star : C.textMuted}
        />
      ))}
      <Text style={styles.ratingText}>{rating > 0 ? rating.toFixed(1) : "New"}</Text>
    </View>
  );
}

function CourseCard({ course }: { course: Course }) {
  const { t } = useLanguage();
  return (
    <Pressable
      style={({ pressed }) => [styles.courseCard, pressed && { opacity: 0.85 }]}
      onPress={() => router.push({ pathname: "/course/[id]", params: { id: course.id.toString() } })}
    >
      <View style={styles.courseThumb}>
        {course.thumbnailUrl ? (
          <Image source={{ uri: course.thumbnailUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" />
        ) : (
          <View style={[StyleSheet.absoluteFill, styles.thumbPlaceholder]}>
            <Feather name="book-open" size={28} color={C.tint} />
          </View>
        )}
        <View style={styles.levelBadge}>
          <Text style={styles.levelBadgeText}>
            {course.level === "beginner" ? t("مبتدئ", "Beginner") : course.level === "intermediate" ? t("متوسط", "Intermediate") : t("متقدم", "Advanced")}
          </Text>
        </View>
      </View>
      <View style={styles.courseInfo}>
        <Text style={styles.courseTitleCard} numberOfLines={2}>{t(course.titleAr || course.title, course.title)}</Text>
        <Text style={styles.courseTeacher}>{course.teacherName}</Text>
        <StarRow rating={course.rating} />
        <View style={styles.courseFooter}>
          <Text style={styles.coursePrice}>
            {course.price === 0 ? t("مجاني", "Free") : `${course.price} ${course.currency}`}
          </Text>
          <Text style={styles.lessonCount}>{course.lessonCount} {t("درس", "lessons")}</Text>
        </View>
      </View>
    </Pressable>
  );
}

function CategoryChip({ cat, onPress }: { cat: Category; onPress: () => void }) {
  const { t } = useLanguage();
  return (
    <Pressable
      style={({ pressed }) => [styles.categoryChip, pressed && { opacity: 0.75 }]}
      onPress={onPress}
    >
      <Text style={styles.categoryIcon}>{cat.icon || "📚"}</Text>
      <Text style={styles.categoryName}>{t(cat.nameAr, cat.name)}</Text>
      <Text style={styles.categoryCount}>{cat.courseCount}</Text>
    </Pressable>
  );
}

function AdCard({ ad }: { ad: any }) {
  const { t, language } = useLanguage();
  return (
    <Pressable
      style={({ pressed }) => [styles.adCard, pressed && { opacity: 0.85 }]}
      onPress={() => router.push(`/teacher-profile/${ad.teacherSlug}` as any)}
    >
      <View style={styles.adAvatarBox}>
        {ad.teacherAvatar ? (
          <Image source={{ uri: ad.teacherAvatar }} style={styles.adAvatar} />
        ) : (
          <Text style={styles.adAvatarText}>{ad.teacherName?.charAt(0)}</Text>
        )}
      </View>
      <Text style={styles.adName} numberOfLines={1}>{language === 'ar' ? (ad.teacherNameAr || ad.teacherName) : ad.teacherName}</Text>
      <View style={styles.adBadge}>
        <Text style={styles.adBadgeText}>{t("مميز", "Sponsored")}</Text>
      </View>
    </Pressable>
  );
}

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { apiFetch } = useApi();
  const { t, language } = useLanguage();

  const { data: coursesData, isLoading: loadingCourses } = useQuery({
    queryKey: ["courses-featured"],
    queryFn: () => apiFetch("/courses?limit=6"),
  });

  const { data: categories, isLoading: loadingCats } = useQuery({
    queryKey: ["categories"],
    queryFn: () => apiFetch("/categories"),
  });

  const { data: activeAds } = useQuery({
    queryKey: ["active-ads"],
    queryFn: () => apiFetch("/advertisements/active"),
  });
  const bannerAds = (activeAds as any[])?.filter(ad => ad.adType === "banner") || [];

  const { data: continueWatching } = useQuery({
    queryKey: ['continue-watching'],
    queryFn: () => apiFetch('/progress/continue-watching'),
    enabled: !!user && user.role === 'student',
  });

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return t("صباح الخير", "Good Morning");
    if (h < 18) return t("مساء الخير", "Good Afternoon");
    return t("مساء النور", "Good Evening");
  };

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: Platform.OS === "web" ? 34 : insets.bottom + 90 }}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 16 }]}>
        <View>
          <Text style={styles.greeting}>{greeting()}</Text>
          <Text style={styles.userName}>{language === "ar" ? (user?.fullNameAr || user?.fullName || "مرحباً بك") : (user?.fullName || "Welcome")}</Text>
        </View>
        <Pressable
          style={styles.searchBtn}
          onPress={() => router.push("/courses")}
        >
          <Feather name="search" size={20} color={C.textSecondary} />
        </Pressable>
      </View>

      {/* Premium Hero banner with Gradient */}
      <LinearGradient 
        colors={[C.tint, C.secondary]} 
        start={{ x: 0, y: 0 }} 
        end={{ x: 1, y: 1 }} 
        style={styles.heroBanner}
      >
        <View style={styles.heroContent}>
          <Text style={styles.heroTag}>{t("منصة التعلم الليبية", "Libyan Learning Platform")}</Text>
          <Text style={styles.heroTitle}>{t("ابدأ رحلة\nالتعلم اليوم", "Start Your\nLearning Journey")}</Text>
          <Pressable
            style={styles.heroBtn}
            onPress={() => router.push("/courses")}
          >
            <Text style={styles.heroBtnText}>{t("استكشف الدورات", "Explore Courses")}</Text>
            <Feather name={language === "ar" ? "arrow-left" : "arrow-right"} size={16} color="#fff" />
          </Pressable>
          <Pressable
            style={[styles.heroBtn, { marginTop: 8, backgroundColor: "transparent", borderWidth: 1, borderColor: "rgba(255,255,255,0.3)" }]}
            onPress={() => router.push("/teachers")}
          >
            <Text style={styles.heroBtnText}>{t("تصفح المعلمين", "Browse Teachers")}</Text>
            <Feather name="users" size={16} color="#fff" />
          </Pressable>
        </View>
        <View style={styles.heroIllustration}>
          <Feather name="book-open" size={70} color="rgba(255,255,255,0.2)" />
        </View>
      </LinearGradient>

      {/* Continue Watching */}
      {continueWatching && continueWatching.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Feather name="play-circle" size={16} color={C.tint} />
              <Text style={styles.sectionTitle}>{t("متابعة التعلم", "Continue Watching")}</Text>
            </View>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 14, paddingHorizontal: 20 }}>
            {continueWatching.map((item: any) => {
              const progressPct = item.totalDuration > 0 ? (item.watchedSeconds / (item.totalDuration * 60)) * 100 : 0;
              return (
                <Pressable
                  key={item.lessonId}
                  style={({ pressed }) => [styles.continueCard, pressed && { opacity: 0.85 }]}
                  onPress={() => router.push({ pathname: "/lesson/[courseId]/[lessonId]", params: { courseId: item.courseId.toString(), lessonId: item.lessonId.toString() } })}
                >
                  <View style={styles.continueThumb}>
                    {item.courseThumbnailUrl ? (
                      <Image source={{ uri: item.courseThumbnailUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" />
                    ) : (
                      <View style={[StyleSheet.absoluteFill, styles.thumbPlaceholder]}>
                        <Feather name="video" size={24} color={C.tint} />
                      </View>
                    )}
                    <View style={styles.playOverlay}>
                      <Feather name="play" size={20} color="#fff" style={{ marginLeft: 2 }} />
                    </View>
                  </View>
                  <View style={styles.continueInfo}>
                    <Text style={styles.continueCourseTitle} numberOfLines={1}>{language === 'ar' ? (item.courseTitleAr || item.courseTitle) : item.courseTitle}</Text>
                    <Text style={styles.continueLessonTitle} numberOfLines={2}>{language === 'ar' ? (item.lessonTitleAr || item.lessonTitle) : item.lessonTitle}</Text>
                    <View style={styles.continueProgressBarContainer}>
                      <View style={[styles.continueProgressBar, { width: `${Math.min(progressPct, 100)}%` }]} />
                    </View>
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      )}

      {/* Sponsored Instructors */}
      {bannerAds.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Feather name="star" size={16} color="#eab308" />
              <Text style={styles.sectionTitle}>{t("معلمون مميزون", "Featured Instructors")}</Text>
            </View>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingHorizontal: 20 }}>
            {bannerAds.map((ad: any) => (
              <AdCard key={ad.id} ad={ad} />
            ))}
          </ScrollView>
        </View>
      )}

      {/* Categories */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{t("التخصصات", "Categories")}</Text>
          <Pressable onPress={() => router.push("/courses")}>
            <Text style={styles.seeAll}>{t("عرض الكل", "See All")}</Text>
          </Pressable>
        </View>
        {loadingCats ? (
          <ActivityIndicator color={C.tint} style={{ marginVertical: 20 }} />
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingHorizontal: 20 }}>
            {(categories as Category[] || []).slice(0, 8).map((cat) => (
              <CategoryChip key={cat.id} cat={cat} onPress={() => router.push("/courses")} />
            ))}
          </ScrollView>
        )}
      </View>

      {/* Featured Courses */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{t("دورات مميزة", "Featured Courses")}</Text>
          <Pressable onPress={() => router.push("/courses")}>
            <Text style={styles.seeAll}>{t("عرض الكل", "See All")}</Text>
          </Pressable>
        </View>
        {loadingCourses ? (
          <ActivityIndicator color={C.tint} style={{ marginVertical: 20 }} />
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 14, paddingHorizontal: 20 }}>
            {(coursesData?.courses as Course[] || []).map((course) => (
              <CourseCard key={course.id} course={course} />
            ))}
          </ScrollView>
        )}
      </View>

      {/* CTA for guest */}
      {!user && (
        <View style={styles.ctaBox}>
          <Feather name="award" size={32} color={C.tint} />
          <Text style={styles.ctaTitle}>{t("انضم إلى EduLibya", "Join EduLibya")}</Text>
          <Text style={styles.ctaSubtitle}>{t("سجّل مجاناً وابدأ التعلم مع أفضل المعلمين الليبيين", "Sign up for free and learn from the best Libyan teachers")}</Text>
          <Pressable style={styles.ctaBtn} onPress={() => router.push("/auth/register")}>
            <Text style={styles.ctaBtnText}>{t("إنشاء حساب مجاني", "Create Free Account")}</Text>
          </Pressable>
          <Pressable onPress={() => router.push("/auth/login")}>
            <Text style={styles.ctaLogin}>{t("لدي حساب بالفعل", "I already have an account")}</Text>
          </Pressable>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  greeting: { fontFamily: "Inter_400Regular", fontSize: 13, color: C.textSecondary },
  userName: { fontFamily: "Inter_700Bold", fontSize: 20, color: C.text, marginTop: 2 },
  searchBtn: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: C.card,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  heroBanner: {
    marginHorizontal: 20,
    borderRadius: 30,
    padding: 28,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
    overflow: "hidden",
  },
  heroContent: { flex: 1 },
  heroTag: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 11,
    color: "rgba(255,255,255,0.8)",
    backgroundColor: "rgba(255,255,255,0.2)",
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    marginBottom: 10,
    overflow: "hidden",
  },
  heroTitle: { fontFamily: "Inter_700Bold", fontSize: 22, color: "#fff", lineHeight: 30, marginBottom: 16 },
  heroBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(255,255,255,0.25)",
    alignSelf: "flex-start",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
  },
  heroBtnText: { fontFamily: "Inter_600SemiBold", fontSize: 14, color: "#fff" },
  heroIllustration: { opacity: 0.4, marginLeft: 12 },
  section: { marginTop: 24 },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    marginBottom: 14,
  },
  sectionTitle: { fontFamily: "Inter_700Bold", fontSize: 17, color: C.text },
  seeAll: { fontFamily: "Inter_500Medium", fontSize: 13, color: C.tint },
  categoryChip: {
    alignItems: "center",
    backgroundColor: C.backgroundSecondary,
    borderRadius: 24,
    padding: 18,
    width: 105,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  categoryIcon: { fontSize: 26, marginBottom: 8 },
  categoryName: { fontFamily: "Inter_500Medium", fontSize: 12, color: C.text, textAlign: "center" },
  categoryCount: { fontFamily: "Inter_400Regular", fontSize: 11, color: C.textMuted, marginTop: 4 },
  courseCard: {
    width: 240,
    backgroundColor: C.card,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    overflow: "hidden",
  },
  courseThumb: {
    height: 110,
    backgroundColor: C.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  thumbPlaceholder: { alignItems: "center", justifyContent: "center", backgroundColor: C.pill },
  levelBadge: {
    position: "absolute",
    top: 8,
    left: 8,
    backgroundColor: "rgba(0,0,0,0.6)",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  levelBadgeText: { fontFamily: "Inter_500Medium", fontSize: 10, color: "#fff" },
  courseInfo: { padding: 12 },
  courseTitleCard: { fontFamily: "Inter_600SemiBold", fontSize: 13, color: C.text, marginBottom: 4, lineHeight: 18 },
  courseTeacher: { fontFamily: "Inter_400Regular", fontSize: 11, color: C.textSecondary, marginBottom: 6 },
  ratingText: { fontFamily: "Inter_500Medium", fontSize: 10, color: C.textSecondary, marginLeft: 4 },
  courseFooter: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 8 },
  coursePrice: { fontFamily: "Inter_700Bold", fontSize: 13, color: C.tint },
  lessonCount: { fontFamily: "Inter_400Regular", fontSize: 11, color: C.textMuted },
  ctaBox: {
    margin: 20,
    backgroundColor: C.backgroundSecondary,
    borderRadius: 20,
    padding: 24,
    alignItems: "center",
    borderWidth: 1,
    borderColor: C.cardBorder,
  },
  ctaTitle: { fontFamily: "Inter_700Bold", fontSize: 18, color: C.text, marginTop: 12, marginBottom: 8 },
  ctaSubtitle: { fontFamily: "Inter_400Regular", fontSize: 14, color: C.textSecondary, textAlign: "center", lineHeight: 20, marginBottom: 20 },
  ctaBtn: { backgroundColor: C.tint, borderRadius: 14, paddingHorizontal: 28, paddingVertical: 14, width: "100%" },
  ctaBtnText: { fontFamily: "Inter_600SemiBold", fontSize: 15, color: "#fff", textAlign: "center" },
  ctaLogin: { fontFamily: "Inter_500Medium", fontSize: 13, color: C.tint, marginTop: 14 },
  
  adCard: {
    backgroundColor: C.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(234,179,8,0.3)", // amber/yellow border
    padding: 16,
    width: 140,
    alignItems: "center",
  },
  adAvatarBox: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: C.tint,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
    overflow: "hidden",
  },
  adAvatar: { width: "100%", height: "100%", resizeMode: "cover" },
  adAvatarText: { fontFamily: "Inter_700Bold", fontSize: 24, color: "#fff" },
  adName: { fontFamily: "Inter_600SemiBold", fontSize: 13, color: C.text, textAlign: "center", marginBottom: 6 },
  adBadge: {
    backgroundColor: "rgba(234,179,8,0.15)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  adBadgeText: { fontFamily: "Inter_500Medium", fontSize: 10, color: "#ca8a04" },
  
  continueCard: {
    width: 260,
    flexDirection: "row",
    backgroundColor: C.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    overflow: "hidden",
  },
  continueThumb: {
    width: 90,
    backgroundColor: C.pill,
    alignItems: "center",
    justifyContent: "center",
    position: 'relative'
  },
  playOverlay: {
    position: 'absolute',
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  continueInfo: {
    flex: 1,
    padding: 12,
    justifyContent: 'center'
  },
  continueCourseTitle: { fontFamily: "Inter_600SemiBold", fontSize: 10, color: C.tint, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 },
  continueLessonTitle: { fontFamily: "Inter_600SemiBold", fontSize: 13, color: C.text, marginBottom: 8, lineHeight: 18 },
  continueProgressBarContainer: {
    height: 4,
    backgroundColor: C.backgroundSecondary,
    borderRadius: 2,
    overflow: 'hidden'
  },
  continueProgressBar: {
    height: '100%',
    backgroundColor: C.tint,
    borderRadius: 2
  }
});
