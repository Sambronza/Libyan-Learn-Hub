import React, { useState } from "react";
import {
  ActivityIndicator, FlatList, Linking, Platform, Pressable, ScrollView,
  Share, StyleSheet, Text, View, Image
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Colors from "@/constants/colors";
import { useApi } from "@/hooks/useApi";
import { ReportModal } from "@/components/ReportModal";

const C = Colors.light;

const ENDORSEMENT_TRAITS = [
  { key: "clear_explanations", en: "Clear Explanations", ar: "شرح واضح" },
  { key: "fast_replies", en: "Fast Replies", ar: "ردود سريعة" },
  { key: "helpful", en: "Very Helpful", ar: "مساعد جداً" },
  { key: "organized", en: "Well Organized", ar: "منظم جداً" },
  { key: "patient", en: "Patient", ar: "صبور" },
  { key: "engaging", en: "Engaging", ar: "شيق" },
];

export default function TeacherProfileScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const insets = useSafeAreaInsets();
  const { apiFetch } = useApi();
  const queryClient = useQueryClient();
  const [reportVisible, setReportVisible] = useState(false);

  const { data: teacher, isLoading } = useQuery({
    queryKey: ["teacher-profile", slug],
    queryFn: () => apiFetch(`/teacher-profile/${slug}`),
    enabled: !!slug,
  });

  const handleShare = async () => {
    try {
      const url = `https://edulybia.com/teachers/${slug}`;
      await Share.share({ message: `${teacher?.fullNameAr || teacher?.fullName} - ${url}`, url });
    } catch {}
  };

  const handleDownloadCV = () => {
    if (teacher?.cvUrl) Linking.openURL(teacher.cvUrl);
  };

  if (isLoading) {
    return <View style={[styles.container, { paddingTop: insets.top }]}><ActivityIndicator color={C.tint} style={{ flex: 1 }} /></View>;
  }

  if (!teacher) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.emptyState}>
          <Feather name="user-x" size={48} color={C.textMuted} style={{ opacity: 0.3 }} />
          <Text style={styles.emptyTitle}>المعلم غير موجود</Text>
        </View>
      </View>
    );
  }

  const name = teacher.fullNameAr || teacher.fullName;

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}>
        {/* Header */}
        <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
          <Pressable style={styles.backBtn} onPress={() => router.back()}>
            <Feather name="arrow-right" size={20} color={C.text} />
          </Pressable>

          <View style={styles.profileSection}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{name?.charAt(0)}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <View style={styles.nameRow}>
                <Text style={styles.name}>{name}</Text>
                {teacher.isVerified && <Feather name="check-circle" size={18} color={C.tint} />}
                {teacher.isSponsored && (
                  <View style={styles.sponsoredBadge}>
                    <Text style={styles.sponsoredText}>مميز</Text>
                  </View>
                )}
              </View>
              {teacher.expertise && <Text style={styles.expertise}>{teacher.expertise}</Text>}
            </View>
          </View>

          {/* Stats */}
          <View style={styles.statsRow}>
            <View style={styles.stat}><Text style={styles.statNum}>{teacher.courseCount}</Text><Text style={styles.statLabel}>دورات</Text></View>
            <View style={styles.stat}><Text style={styles.statNum}>{teacher.studentCount}</Text><Text style={styles.statLabel}>طلاب</Text></View>
            <View style={styles.stat}><Text style={styles.statNum}>{teacher.rating?.toFixed(1)}</Text><Text style={styles.statLabel}>تقييم</Text></View>
          </View>

          {/* Bio */}
          {(teacher.bioAr || teacher.bio) && (
            <Text style={styles.bio}>{teacher.bioAr || teacher.bio}</Text>
          )}

          {/* Actions */}
          <View style={styles.actionsRow}>
            <Pressable style={styles.actionBtn} onPress={handleShare}>
              <Feather name="share-2" size={16} color={C.tint} />
              <Text style={styles.actionText}>مشاركة</Text>
            </Pressable>
            {teacher.cvUrl && (
              <Pressable style={styles.actionBtn} onPress={handleDownloadCV}>
                <Feather name="download" size={16} color={C.tint} />
                <Text style={styles.actionText}>السيرة الذاتية</Text>
              </Pressable>
            )}
            <Pressable style={[styles.actionBtn, { borderColor: "#fee2e2" }]} onPress={() => setReportVisible(true)}>
              <Feather name="flag" size={16} color="#ef4444" />
              <Text style={[styles.actionText, { color: "#ef4444" }]}>بلاغ</Text>
            </Pressable>
          </View>
        </View>

        {/* Endorsements */}
        {teacher.endorsements?.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>توصيات الطلاب</Text>
            <View style={styles.endorsementsList}>
              {teacher.endorsements.map((e: any) => {
                const trait = ENDORSEMENT_TRAITS.find(t => t.key === e.trait);
                return (
                  <View key={e.trait} style={styles.endorsementBadge}>
                    <Feather name="award" size={12} color="#d97706" />
                    <Text style={styles.endorsementText}>{trait?.ar || e.trait}</Text>
                    <Text style={styles.endorsementCount}>×{e.count}</Text>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* Student Reviews */}
        {teacher.reviews && teacher.reviews.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>مراجعات الطلاب</Text>
            <View style={styles.reviewList}>
              {teacher.reviews.map((r: any) => (
                <View key={r.id} style={styles.reviewCard}>
                  <View style={styles.reviewHeader}>
                    <View style={styles.reviewUser}>
                      {r.user?.avatarUrl ? (
                        <Image source={{ uri: r.user.avatarUrl }} style={styles.reviewAvatar} />
                      ) : (
                        <View style={[styles.reviewAvatar, { backgroundColor: C.pill, alignItems: "center", justifyContent: "center" }]}>
                          <Feather name="user" size={14} color={C.tint} />
                        </View>
                      )}
                      <View>
                        <Text style={styles.reviewName}>{r.user?.fullNameAr || r.user?.fullName}</Text>
                        <Text style={styles.reviewDate}>{new Date(r.createdAt).toLocaleDateString()}</Text>
                      </View>
                    </View>
                    <View style={styles.reviewStars}>
                      {[1, 2, 3, 4, 5].map((s) => (
                        <Feather key={s} name="star" size={12} color={s <= r.rating ? C.star : C.cardBorder} />
                      ))}
                    </View>
                  </View>
                  {r.comment && <Text style={styles.reviewCommentText}>&ldquo;{r.comment}&rdquo;</Text>}
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Courses */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>الدورات ({teacher.courses?.length || 0})</Text>
          {teacher.courses?.length === 0 ? (
            <View style={styles.emptyState}>
              <Feather name="book-open" size={32} color={C.textMuted} style={{ opacity: 0.3 }} />
              <Text style={styles.emptyTitle}>لا توجد دورات</Text>
            </View>
          ) : (
            teacher.courses?.map((course: any) => (
              <Pressable key={course.id} style={styles.courseCard} onPress={() => router.push(`/course/${course.id}`)}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.courseTitle} numberOfLines={2}>{course.titleAr || course.title}</Text>
                  <Text style={styles.coursePrice}>{course.price === 0 ? "مجاناً" : `${course.price} د.ل`}</Text>
                </View>
                <View style={styles.levelBadge}><Text style={styles.levelText}>{course.level}</Text></View>
              </Pressable>
            ))
          )}
        </View>
      </ScrollView>

      {reportVisible && (
        <ReportModal visible={true} onClose={() => setReportVisible(false)} type="teacher" targetId={teacher.id} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
  header: { backgroundColor: C.card, paddingHorizontal: 20, paddingBottom: 20, borderBottomWidth: 1, borderBottomColor: C.cardBorder },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: C.backgroundSecondary, alignItems: "center", justifyContent: "center", alignSelf: "flex-end", marginBottom: 16 },
  profileSection: { flexDirection: "row-reverse", alignItems: "center", marginBottom: 16, gap: 14 },
  avatar: { width: 64, height: 64, borderRadius: 20, backgroundColor: `${C.tint}15`, alignItems: "center", justifyContent: "center" },
  avatarText: { fontFamily: "Inter_700Bold", fontSize: 26, color: C.tint },
  nameRow: { flexDirection: "row-reverse", alignItems: "center", gap: 6, flexWrap: "wrap", marginBottom: 4 },
  name: { fontFamily: "Inter_700Bold", fontSize: 20, color: C.text, textAlign: "right" },
  expertise: { fontFamily: "Inter_400Regular", fontSize: 13, color: C.textSecondary, textAlign: "right" },
  sponsoredBadge: { backgroundColor: "#fef3c7", borderWidth: 1, borderColor: "#fcd34d", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2 },
  sponsoredText: { fontFamily: "Inter_600SemiBold", fontSize: 10, color: "#d97706" },
  statsRow: { flexDirection: "row-reverse", gap: 16, marginBottom: 16 },
  stat: { alignItems: "center", flex: 1, backgroundColor: C.backgroundSecondary, borderRadius: 12, padding: 10 },
  statNum: { fontFamily: "Inter_700Bold", fontSize: 18, color: C.text },
  statLabel: { fontFamily: "Inter_400Regular", fontSize: 11, color: C.textMuted, marginTop: 2 },
  bio: { fontFamily: "Inter_400Regular", fontSize: 13, color: C.textSecondary, textAlign: "right", lineHeight: 20, marginBottom: 16 },
  actionsRow: { flexDirection: "row-reverse", gap: 8 },
  actionBtn: { flex: 1, flexDirection: "row-reverse", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: C.backgroundSecondary, borderRadius: 12, paddingVertical: 10, borderWidth: 1, borderColor: C.cardBorder },
  actionText: { fontFamily: "Inter_500Medium", fontSize: 12, color: C.tint },
  section: { paddingHorizontal: 20, paddingTop: 20 },
  sectionTitle: { fontFamily: "Inter_700Bold", fontSize: 16, color: C.text, textAlign: "right", marginBottom: 12 },
  endorsementsList: { flexDirection: "row-reverse", flexWrap: "wrap", gap: 8 },
  endorsementBadge: { flexDirection: "row-reverse", alignItems: "center", gap: 4, backgroundColor: "#fffbeb", borderWidth: 1, borderColor: "#fcd34d", borderRadius: 16, paddingHorizontal: 10, paddingVertical: 5 },
  endorsementText: { fontFamily: "Inter_500Medium", fontSize: 11, color: "#92400e" },
  endorsementCount: { fontFamily: "Inter_700Bold", fontSize: 10, color: "#d97706" },
  courseCard: { flexDirection: "row-reverse", alignItems: "center", backgroundColor: C.card, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: C.cardBorder, marginBottom: 10, gap: 12 },
  courseTitle: { fontFamily: "Inter_600SemiBold", fontSize: 14, color: C.text, textAlign: "right", marginBottom: 4 },
  coursePrice: { fontFamily: "Inter_700Bold", fontSize: 13, color: C.tint, textAlign: "right" },
  levelBadge: { backgroundColor: C.backgroundSecondary, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  levelText: { fontFamily: "Inter_500Medium", fontSize: 10, color: C.textMuted },
  emptyState: { padding: 40, alignItems: "center" },
  emptyTitle: { fontFamily: "Inter_600SemiBold", fontSize: 16, color: C.text, marginTop: 12 },
  reviewList: { gap: 12 },
  reviewCard: { backgroundColor: C.backgroundSecondary, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: C.cardBorder },
  reviewHeader: { flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 },
  reviewUser: { flexDirection: "row-reverse", alignItems: "center", gap: 10 },
  reviewAvatar: { width: 36, height: 36, borderRadius: 18 },
  reviewName: { fontFamily: "Inter_600SemiBold", fontSize: 13, color: C.text, textAlign: "right" },
  reviewDate: { fontFamily: "Inter_400Regular", fontSize: 11, color: C.textMuted, textAlign: "right", marginTop: 2 },
  reviewStars: { flexDirection: "row-reverse", gap: 2 },
  reviewCommentText: { fontFamily: "Inter_400Regular", fontSize: 13, color: C.textSecondary, textAlign: "right", lineHeight: 20, fontStyle: "italic" },
});
