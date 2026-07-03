import React, { useState } from "react";
import {
  ActivityIndicator, FlatList, Platform, Pressable, StyleSheet,
  Text, TextInput, View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import Colors from "@/constants/colors";
import { useApi } from "@/hooks/useApi";

const C = Colors.light;

const SCHOOL_YEARS = [
  { value: "1-primary", ar: "الصف الأول ابتدائي" },
  { value: "2-primary", ar: "الصف الثاني ابتدائي" },
  { value: "3-primary", ar: "الصف الثالث ابتدائي" },
  { value: "1-preparatory", ar: "الصف الأول إعدادي" },
  { value: "2-preparatory", ar: "الصف الثاني إعدادي" },
  { value: "3-preparatory", ar: "الصف الثالث إعدادي" },
  { value: "1-secondary", ar: "الصف الأول ثانوي" },
  { value: "2-secondary", ar: "الصف الثاني ثانوي" },
  { value: "3-secondary", ar: "الصف الثالث ثانوي" },
  { value: "university", ar: "جامعي" },
];

type TabKey = "all" | "courses" | "teachers";

export default function SearchScreen() {
  const insets = useSafeAreaInsets();
  const { apiFetch } = useApi();
  const [keyword, setKeyword] = useState("");
  const [activeTab, setActiveTab] = useState<TabKey>("all");
  const [submitted, setSubmitted] = useState(false);

  const { data: courses, isLoading: cLoading } = useQuery({
    queryKey: ["search-courses", keyword],
    queryFn: () => apiFetch(`/courses?search=${encodeURIComponent(keyword)}&limit=20`),
    enabled: submitted && (activeTab === "all" || activeTab === "courses"),
  });

  const { data: teachers, isLoading: tLoading } = useQuery({
    queryKey: ["search-teachers"],
    queryFn: () => apiFetch("/teachers"),
    enabled: submitted && (activeTab === "all" || activeTab === "teachers"),
  });

  const isLoading = cLoading || tLoading;

  const filteredTeachers = (teachers || []).filter((t: any) =>
    !keyword || t.fullName?.toLowerCase().includes(keyword.toLowerCase()) ||
    t.fullNameAr?.includes(keyword) || t.expertise?.toLowerCase().includes(keyword.toLowerCase())
  );

  const handleSearch = () => { if (keyword.trim()) setSubmitted(true); };

  const tabs: { key: TabKey; label: string }[] = [
    { key: "all", label: "الكل" },
    { key: "courses", label: "الدورات" },
    { key: "teachers", label: "المعلمون" },
  ];

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 12 }]}>
        <View style={styles.headerTop}>
          <Text style={styles.headerTitle}>البحث المتقدم</Text>
          <Pressable style={styles.backBtn} onPress={() => router.back()}>
            <Feather name="arrow-right" size={20} color={C.text} />
          </Pressable>
        </View>

        <View style={styles.searchRow}>
          <Pressable style={styles.searchBtn} onPress={handleSearch}>
            <Feather name="search" size={18} color="#fff" />
          </Pressable>
          <View style={styles.searchBox}>
            <TextInput
              style={styles.searchInput}
              value={keyword}
              onChangeText={setKeyword}
              onSubmitEditing={handleSearch}
              placeholder="ابحث عن مادة، كتاب، أو موضوع..."
              textAlign="right"
              placeholderTextColor={C.textMuted}
              returnKeyType="search"
            />
          </View>
        </View>

        {/* Tabs */}
        <View style={styles.tabsRow}>
          {tabs.map(tab => (
            <Pressable key={tab.key}
              style={[styles.tab, activeTab === tab.key && styles.tabActive]}
              onPress={() => setActiveTab(tab.key)}>
              <Text style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}>{tab.label}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* Results */}
      {!submitted ? (
        <View style={styles.emptyState}>
          <Feather name="search" size={48} color={C.textMuted} style={{ opacity: 0.2, marginBottom: 12 }} />
          <Text style={styles.emptyTitle}>ابدأ البحث عن موضوعاتك المفضلة</Text>
          <Text style={styles.emptySubtitle}>يمكنك البحث بالمادة، اسم الكتاب، أو الفصل</Text>
        </View>
      ) : isLoading ? (
        <ActivityIndicator color={C.tint} style={{ flex: 1 }} />
      ) : (
        <FlatList
          data={[
            ...(activeTab !== "courses" ? filteredTeachers.map((t: any) => ({ ...t, _type: "teacher" })) : []),
            ...(activeTab !== "teachers" ? (courses?.courses || []).map((c: any) => ({ ...c, _type: "course" })) : []),
          ]}
          keyExtractor={(item, i) => `${item._type}-${item.id}-${i}`}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 20, paddingTop: 16, gap: 12 }}
          renderItem={({ item }) => {
            if (item._type === "teacher") {
              return (
                <Pressable style={styles.teacherCard} onPress={() => item.profileSlug && router.push(`/teacher-profile/${item.profileSlug}`)}>
                  <View style={styles.teacherAvatar}><Text style={styles.teacherAvatarText}>{(item.fullNameAr || item.fullName)?.charAt(0)}</Text></View>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 6, marginBottom: 2 }}>
                      <Text style={styles.teacherName}>{item.fullNameAr || item.fullName}</Text>
                      {item.isVerified && <Feather name="check-circle" size={14} color={C.tint} />}
                      {item.isSponsored && <View style={styles.sponsoredBadge}><Text style={styles.sponsoredText}>مميز</Text></View>}
                    </View>
                    {item.expertise && <Text style={styles.teacherExpertise}>{item.expertise}</Text>}
                    <Text style={styles.teacherStats}>{item.courseCount} دورات · {item.studentCount} طلاب</Text>
                  </View>
                </Pressable>
              );
            }
            return (
              <Pressable style={styles.courseCard} onPress={() => router.push(`/course/${item.id}`)}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.courseTitle} numberOfLines={2}>{item.titleAr || item.title}</Text>
                  <Text style={styles.courseTeacher}>{item.teacherName}</Text>
                  <Text style={styles.coursePrice}>{item.price === 0 ? "مجاناً" : `${item.price} د.ل`}</Text>
                </View>
              </Pressable>
            );
          }}
          ListEmptyComponent={() => (
            <View style={styles.emptyState}>
              <Feather name="search" size={48} color={C.textMuted} style={{ opacity: 0.2, marginBottom: 12 }} />
              <Text style={styles.emptyTitle}>لا توجد نتائج</Text>
              <Text style={styles.emptySubtitle}>جرب كلمات بحث مختلفة</Text>
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
  header: { backgroundColor: C.background, paddingHorizontal: 20, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: C.cardBorder },
  headerTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  headerTitle: { fontFamily: "Inter_700Bold", fontSize: 20, color: C.text },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: C.backgroundSecondary, alignItems: "center", justifyContent: "center" },
  searchRow: { flexDirection: "row-reverse", gap: 8, marginBottom: 12 },
  searchBox: { flex: 1, backgroundColor: C.backgroundSecondary, borderRadius: 12, paddingHorizontal: 12, borderWidth: 1, borderColor: C.cardBorder, height: 44, justifyContent: "center" },
  searchInput: { fontFamily: "Inter_400Regular", fontSize: 14, color: C.text, height: "100%" },
  searchBtn: { width: 44, height: 44, borderRadius: 12, backgroundColor: C.tint, alignItems: "center", justifyContent: "center" },
  tabsRow: { flexDirection: "row-reverse", backgroundColor: C.backgroundSecondary, borderRadius: 10, padding: 3 },
  tab: { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: "center" },
  tabActive: { backgroundColor: C.card },
  tabText: { fontFamily: "Inter_500Medium", fontSize: 12, color: C.textMuted },
  tabTextActive: { color: C.text },
  teacherCard: { flexDirection: "row-reverse", alignItems: "center", backgroundColor: C.card, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: C.cardBorder, gap: 12 },
  teacherAvatar: { width: 44, height: 44, borderRadius: 14, backgroundColor: `${C.tint}15`, alignItems: "center", justifyContent: "center" },
  teacherAvatarText: { fontFamily: "Inter_700Bold", fontSize: 18, color: C.tint },
  teacherName: { fontFamily: "Inter_600SemiBold", fontSize: 14, color: C.text, textAlign: "right" },
  teacherExpertise: { fontFamily: "Inter_400Regular", fontSize: 11, color: C.textSecondary, textAlign: "right" },
  teacherStats: { fontFamily: "Inter_400Regular", fontSize: 11, color: C.textMuted, textAlign: "right", marginTop: 2 },
  sponsoredBadge: { backgroundColor: "#fef3c7", borderWidth: 1, borderColor: "#fcd34d", borderRadius: 6, paddingHorizontal: 6, paddingVertical: 1 },
  sponsoredText: { fontFamily: "Inter_600SemiBold", fontSize: 9, color: "#d97706" },
  courseCard: { backgroundColor: C.card, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: C.cardBorder },
  courseTitle: { fontFamily: "Inter_600SemiBold", fontSize: 14, color: C.text, textAlign: "right", marginBottom: 4 },
  courseTeacher: { fontFamily: "Inter_400Regular", fontSize: 12, color: C.textSecondary, textAlign: "right", marginBottom: 4 },
  coursePrice: { fontFamily: "Inter_700Bold", fontSize: 13, color: C.tint, textAlign: "right" },
  emptyState: { flex: 1, alignItems: "center", justifyContent: "center", padding: 40 },
  emptyTitle: { fontFamily: "Inter_600SemiBold", fontSize: 16, color: C.text, textAlign: "center" },
  emptySubtitle: { fontFamily: "Inter_400Regular", fontSize: 13, color: C.textMuted, textAlign: "center", marginTop: 4 },
});
