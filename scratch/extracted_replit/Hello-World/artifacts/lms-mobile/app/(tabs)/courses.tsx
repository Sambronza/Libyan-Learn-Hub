import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import Colors from "@/constants/colors";
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
  lessonCount: number;
  totalDuration: number;
  reviewCount: number;
}

interface Category {
  id: number;
  name: string;
  nameAr: string;
  icon?: string | null;
}

const LEVELS_AR = [
  { key: "", label: "الكل" },
  { key: "beginner", label: "مبتدئ" },
  { key: "intermediate", label: "متوسط" },
  { key: "advanced", label: "متقدم" },
];
const LEVELS_EN = [
  { key: "", label: "All" },
  { key: "beginner", label: "Beginner" },
  { key: "intermediate", label: "Intermediate" },
  { key: "advanced", label: "Advanced" },
];

function CourseRow({ course }: { course: Course }) {
  const { t } = useLanguage();
  const levelLabel = course.level === "beginner" ? t("مبتدئ", "Beginner") : course.level === "intermediate" ? t("متوسط", "Intermediate") : t("متقدم", "Advanced");
  return (
    <Pressable
      style={({ pressed }) => [styles.courseRow, pressed && { opacity: 0.8 }]}
      onPress={() => router.push({ pathname: "/course/[id]", params: { id: course.id.toString() } })}
    >
      <View style={styles.courseRowThumb}>
        <Feather name="book-open" size={24} color={C.tint} />
      </View>
      <View style={styles.courseRowInfo}>
        <Text style={styles.courseRowTitle} numberOfLines={2}>{t(course.titleAr || course.title, course.title)}</Text>
        <Text style={styles.courseRowTeacher}>{course.teacherName}</Text>
        <View style={styles.courseRowMeta}>
          <View style={styles.tag}>
            <Text style={styles.tagText}>{levelLabel}</Text>
          </View>
          <Text style={styles.metaDot}>·</Text>
          <Text style={styles.metaText}>{course.lessonCount} {t("درس", "lessons")}</Text>
          {course.rating > 0 && (
            <>
              <Text style={styles.metaDot}>·</Text>
              <Feather name="star" size={10} color={C.star} />
              <Text style={styles.metaText}>{course.rating.toFixed(1)}</Text>
            </>
          )}
        </View>
      </View>
      <View style={styles.courseRowRight}>
        <Text style={styles.courseRowPrice}>
          {course.price === 0 ? t("مجاني", "Free") : `${course.price}`}
        </Text>
        {course.price > 0 && <Text style={styles.courseRowCurrency}>{course.currency}</Text>}
        <Feather name="chevron-left" size={16} color={C.textMuted} style={{ marginTop: 8 }} />
      </View>
    </Pressable>
  );
}

export default function CoursesScreen() {
  const insets = useSafeAreaInsets();
  const { apiFetch } = useApi();
  const { t, language } = useLanguage();
  const [search, setSearch] = useState("");
  const [selectedCat, setSelectedCat] = useState<number | null>(null);
  const [selectedLevel, setSelectedLevel] = useState("");
  const [exploreSection, setExploreSection] = useState<'courses' | 'tutoring' | 'live'>('courses');

  const LEVELS = language === "ar" ? LEVELS_AR : LEVELS_EN;

  const { data: categories } = useQuery({
    queryKey: ["categories"],
    queryFn: () => apiFetch("/categories"),
  });

  const { data: coursesData, isLoading } = useQuery({
    queryKey: ["courses", search, selectedCat, selectedLevel],
    queryFn: () => {
      const params = new URLSearchParams({ limit: "50" });
      if (search) params.append("search", search);
      if (selectedCat) params.append("categoryId", selectedCat.toString());
      if (selectedLevel) params.append("level", selectedLevel);
      return apiFetch(`/courses?${params}`);
    },
  });

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 16 }]}>
        <Text style={styles.headerTitle}>{t("استكشف", "Explore")}</Text>

        {/* Section Chips */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 10 }}>
          {[
            { key: 'courses' as const, label: t("الدورات", "Courses"), icon: 'book-open' as const },
            { key: 'tutoring' as const, label: t("خصوصي", "Tutoring"), icon: 'users' as const },
            { key: 'live' as const, label: t("مباشر", "Live"), icon: 'video' as const },
          ].map((sec) => (
            <Pressable
              key={sec.key}
              style={[styles.sectionChip, exploreSection === sec.key && styles.sectionChipActive]}
              onPress={() => setExploreSection(sec.key)}
            >
              <Feather name={sec.icon} size={14} color={exploreSection === sec.key ? "#fff" : C.textSecondary} />
              <Text style={[styles.sectionChipText, exploreSection === sec.key && styles.sectionChipTextActive]}>{sec.label}</Text>
            </Pressable>
          ))}
        </ScrollView>

        {exploreSection === 'courses' && (
        <View style={styles.searchBar}>
          <Feather name="search" size={16} color={C.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder={t("ابحث عن دورة...", "Search for a course...")}
            placeholderTextColor={C.textMuted}
            value={search}
            onChangeText={setSearch}
            returnKeyType="search"
          />
          {search.length > 0 && (
            <Pressable onPress={() => setSearch("")}>
              <Feather name="x" size={16} color={C.textMuted} />
            </Pressable>
          )}
        </View>
        )}
      </View>
      {exploreSection === 'courses' ? (
      <>
      {/* Filters */}
      <View style={styles.filters}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 20 }}>
          <Pressable
            style={[styles.filterChip, !selectedCat && styles.filterChipActive]}
            onPress={() => setSelectedCat(null)}
          >
            <Text style={[styles.filterChipText, !selectedCat && styles.filterChipTextActive]}>{t("الكل", "All")}</Text>
          </Pressable>
          {(categories as Category[] || []).map((cat) => (
            <Pressable
              key={cat.id}
              style={[styles.filterChip, selectedCat === cat.id && styles.filterChipActive]}
              onPress={() => setSelectedCat(selectedCat === cat.id ? null : cat.id)}
            >
              <Text style={styles.catIcon}>{cat.icon || "📚"}</Text>
              <Text style={[styles.filterChipText, selectedCat === cat.id && styles.filterChipTextActive]}>
                {t(cat.nameAr, cat.name)}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      {/* Level filters */}
      <View style={styles.levelRow}>
        {LEVELS.map((l) => (
          <Pressable
            key={l.key}
            style={[styles.levelChip, selectedLevel === l.key && styles.levelChipActive]}
            onPress={() => setSelectedLevel(l.key)}
          >
            <Text style={[styles.levelChipText, selectedLevel === l.key && styles.levelChipTextActive]}>
              {l.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Course List */}
      {isLoading ? (
        <ActivityIndicator color={C.tint} style={{ flex: 1, marginTop: 40 }} />
      ) : (
        <FlatList
          data={coursesData?.courses as Course[] || []}
          keyExtractor={(item) => item.id.toString()}
          renderItem={({ item }) => <CourseRow course={item} />}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: Platform.OS === "web" ? 34 : insets.bottom + 90, paddingTop: 8 }}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          ListEmptyComponent={() => (
            <View style={styles.emptyState}>
              <Feather name="search" size={40} color={C.textMuted} />
              <Text style={styles.emptyText}>{t("لا توجد دورات مطابقة", "No matching courses found")}</Text>
            </View>
          )}
          scrollEnabled={!!(coursesData?.courses?.length ?? 0)}
        />
      )}
      </>
      ) : exploreSection === 'tutoring' ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60 }}>
          <Feather name="users" size={48} color={C.tint} />
          <Text style={{ fontFamily: "Inter_700Bold", fontSize: 18, color: C.text, marginTop: 16 }}>
            {t("الدروس الخصوصية", "Private Tutoring")}
          </Text>
          <Text style={{ fontFamily: "Inter_400Regular", fontSize: 14, color: C.textMuted, marginTop: 8, textAlign: 'center', paddingHorizontal: 40 }}>
            {t("ابحث عن معلم خصوصي يناسب احتياجاتك", "Find a private tutor that fits your needs")}
          </Text>
          <Pressable 
            style={{ backgroundColor: C.tint, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 14, marginTop: 20 }}
            onPress={() => router.push("/tutoring")}
          >
            <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 14, color: "#fff" }}>
              {t("تصفح المعلمين", "Browse Tutors")}
            </Text>
          </Pressable>
        </View>
      ) : (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60 }}>
          <Feather name="video" size={48} color={C.tint} />
          <Text style={{ fontFamily: "Inter_700Bold", fontSize: 18, color: C.text, marginTop: 16 }}>
            {t("الجلسات المباشرة", "Live Sessions")}
          </Text>
          <Text style={{ fontFamily: "Inter_400Regular", fontSize: 14, color: C.textMuted, marginTop: 8, textAlign: 'center', paddingHorizontal: 40 }}>
            {t("انضم إلى حصص مباشرة مع أفضل المعلمين", "Join live classes with the best teachers")}
          </Text>
          <Pressable 
            style={{ backgroundColor: C.tint, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 14, marginTop: 20 }}
            onPress={() => router.push("/live")}
          >
            <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 14, color: "#fff" }}>
              {t("عرض الجلسات", "View Sessions")}
            </Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
  header: { paddingHorizontal: 20, paddingBottom: 12 },
  headerTitle: { fontFamily: "Inter_700Bold", fontSize: 28, color: C.text, marginBottom: 12 },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: C.backgroundSecondary,
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 46,
    gap: 8,
    borderWidth: 1,
    borderColor: C.cardBorder,
  },
  searchInput: { flex: 1, fontFamily: "Inter_400Regular", fontSize: 15, color: C.text, textAlign: "right" },
  filters: { paddingBottom: 10 },
  filterChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: C.backgroundSecondary,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: C.cardBorder,
  },
  filterChipActive: { backgroundColor: C.tint, borderColor: C.tint },
  filterChipText: { fontFamily: "Inter_500Medium", fontSize: 13, color: C.textSecondary },
  filterChipTextActive: { color: "#fff" },
  catIcon: { fontSize: 14 },
  levelRow: {
    flexDirection: "row",
    paddingHorizontal: 20,
    gap: 8,
    marginBottom: 8,
  },
  levelChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: C.backgroundSecondary,
    borderWidth: 1,
    borderColor: C.cardBorder,
  },
  levelChipActive: { backgroundColor: C.pill, borderColor: C.tint },
  levelChipText: { fontFamily: "Inter_500Medium", fontSize: 12, color: C.textSecondary },
  levelChipTextActive: { color: C.tint },
  courseRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: C.card,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: C.cardBorder,
  },
  courseRowThumb: {
    width: 52,
    height: 52,
    borderRadius: 12,
    backgroundColor: C.pill,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 12,
  },
  courseRowInfo: { flex: 1 },
  courseRowTitle: { fontFamily: "Inter_600SemiBold", fontSize: 14, color: C.text, marginBottom: 4, textAlign: "right" },
  courseRowTeacher: { fontFamily: "Inter_400Regular", fontSize: 12, color: C.textSecondary, marginBottom: 6, textAlign: "right" },
  courseRowMeta: { flexDirection: "row-reverse", alignItems: "center", gap: 4 },
  tag: { backgroundColor: C.backgroundTertiary, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  tagText: { fontFamily: "Inter_500Medium", fontSize: 10, color: C.textSecondary },
  metaDot: { color: C.textMuted, fontSize: 10 },
  metaText: { fontFamily: "Inter_400Regular", fontSize: 10, color: C.textMuted },
  courseRowRight: { alignItems: "center", minWidth: 50 },
  courseRowPrice: { fontFamily: "Inter_700Bold", fontSize: 14, color: C.tint },
  courseRowCurrency: { fontFamily: "Inter_400Regular", fontSize: 10, color: C.textMuted },
  separator: { height: 10 },
  emptyState: { alignItems: "center", paddingTop: 60, gap: 12 },
  emptyText: { fontFamily: "Inter_500Medium", fontSize: 15, color: C.textMuted },
  sectionChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: C.backgroundSecondary,
    borderWidth: 1,
    borderColor: C.cardBorder,
  },
  sectionChipActive: {
    backgroundColor: C.tint,
    borderColor: C.tint,
  },
  sectionChipText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
    color: C.textSecondary,
  },
  sectionChipTextActive: {
    color: "#fff",
  },
});
