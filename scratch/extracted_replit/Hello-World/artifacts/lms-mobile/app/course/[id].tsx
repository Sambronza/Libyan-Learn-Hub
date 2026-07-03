import { Feather } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  Linking,
  TextInput,
  Image,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Colors from "@/constants/colors";
import { useAuth } from "@/contexts/AuthContext";
import { useApi } from "@/hooks/useApi";
import { ReportModal } from "@/components/ReportModal";

const C = Colors.light;

interface Lesson {
  id: number;
  title: string;
  titleAr: string;
  order: number;
  duration: number;
  isFree: boolean;
  videoUrl?: string | null;
  type: string;
}

interface CourseDetail {
  id: number;
  title: string;
  titleAr: string;
  description: string;
  descriptionAr: string;
  teacherName: string;
  teacherNameAr?: string;
  teacherBio?: string;
  price: number;
  currency: string;
  rating: number;
  reviewCount: number;
  enrollmentCount: number;
  level: string;
  language: string;
  lessonCount: number;
  totalDuration: number;
  thumbnailUrl?: string | null;
  lessons: Lesson[];
  isEnrolled?: boolean;
}

function StarRow({ rating, count }: { rating: number; count: number }) {
  return (
    <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 4 }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Feather key={i} name="star" size={14} color={i <= Math.round(rating) ? C.star : C.cardBorder} />
      ))}
      <Text style={styles.ratingText}>{rating > 0 ? rating.toFixed(1) : "جديد"}</Text>
      <Text style={styles.reviewCount}>({count} تقييم)</Text>
    </View>
  );
}

function LessonRow({ lesson, isEnrolled, courseId, index }: {
  lesson: Lesson;
  isEnrolled: boolean;
  courseId: string;
  index: number;
}) {
  const accessible = lesson.isFree || isEnrolled;
  return (
    <Pressable
      style={({ pressed }) => [
        styles.lessonRow,
        pressed && accessible && { backgroundColor: C.backgroundSecondary },
        !accessible && styles.lessonLocked,
      ]}
      onPress={() => {
        if (!accessible) {
          Alert.alert("مقفل", "سجّل في الدورة للوصول إلى هذا الدرس");
          return;
        }
        router.push({
          pathname: "/lesson/[courseId]/[lessonId]",
          params: { courseId, lessonId: lesson.id.toString() }
        });
      }}
    >
      <View style={[styles.lessonNum, accessible && styles.lessonNumActive]}>
        <Text style={[styles.lessonNumText, accessible && styles.lessonNumTextActive]}>
          {String(index + 1).padStart(2, "0")}
        </Text>
      </View>
      <View style={styles.lessonInfo}>
        <Text style={[styles.lessonTitle, !accessible && styles.lessonTitleLocked]} numberOfLines={2}>
          {lesson.titleAr || lesson.title}
        </Text>
        <View style={styles.lessonMeta}>
          {lesson.isFree && (
            <View style={styles.freeBadge}>
              <Text style={styles.freeBadgeText}>مجاني</Text>
            </View>
          )}
          <Feather name="clock" size={11} color={C.textMuted} />
          <Text style={styles.lessonDuration}>{lesson.duration} د</Text>
        </View>
      </View>
      <Feather
        name={accessible ? "play-circle" : "lock"}
        size={20}
        color={accessible ? C.tint : C.textMuted}
      />
    </Pressable>
  );
}

export default function CourseDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { user, apiBase } = useAuth();
  const { apiFetch } = useApi();
  const queryClient = useQueryClient();
  const [showFullDesc, setShowFullDesc] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState("");

  const { data: course, isLoading } = useQuery<CourseDetail>({
    queryKey: ["course", id],
    queryFn: () => apiFetch(`/courses/${id}`),
  });

  const { data: reviews = [] } = useQuery({
    queryKey: ["course", id, "reviews"],
    queryFn: () => apiFetch(`/courses/${id}/reviews`),
  });

  const reviewMutation = useMutation({
    mutationFn: () => apiFetch(`/courses/${id}/reviews`, {
      method: "POST",
      body: JSON.stringify({ rating: reviewRating, comment: reviewComment })
    }),
    onSuccess: () => {
      Alert.alert("نجاح", "تم إرسال تقييمك بنجاح. شكراً لك!");
      setReviewComment("");
      queryClient.invalidateQueries({ queryKey: ["course", id, "reviews"] });
      queryClient.invalidateQueries({ queryKey: ["course", id] });
    },
    onError: (e: any) => Alert.alert("خطأ", e.message),
  });

  const enrollMutation = useMutation({
    mutationFn: async () => {
      if (!course) throw new Error("Course not found");
      if (course.price === 0) {
        return apiFetch(`/courses/${id}/enroll`, { method: "POST" });
      } else {
        // Paid course -> create payment session
        return apiFetch(`/payments/create-session`, {
          method: "POST",
          body: JSON.stringify({ type: "course", itemId: parseInt(id!) }),
        });
      }
    },
    onSuccess: (data) => {
      if (data?.url && !data.url.includes("success=true")) {
        // Redirect to external secure payment gateway
        // data.url from our backend is like `/api/payments/...`
        const host = apiBase.replace('/api', '');
        Linking.openURL(`${host}${data.url}`);
      } else {
        // Free enrollment success
        queryClient.invalidateQueries({ queryKey: ["course", id] });
        queryClient.invalidateQueries({ queryKey: ["enrollments"] });
        Alert.alert("تهانينا!", "تم تأكيد تسجيلك بنجاح");
      }
    },
    onError: (e: any) => Alert.alert("خطأ", e.message),
  });

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  if (isLoading) {
    return (
      <View style={[styles.container, { alignItems: "center", justifyContent: "center" }]}>
        <ActivityIndicator color={C.tint} size="large" />
      </View>
    );
  }

  if (!course) {
    return (
      <View style={[styles.container, { alignItems: "center", justifyContent: "center" }]}>
        <Text style={styles.errorMsg}>الدورة غير موجودة</Text>
      </View>
    );
  }

  const levelLabel = course.level === "beginner" ? "مبتدئ" : course.level === "intermediate" ? "متوسط" : "متقدم";
  const desc = course.descriptionAr || course.description || "";

  return (
    <View style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: bottomPad + 100 }}
      >
        {/* Top banner */}
        <View style={[styles.banner, { paddingTop: topPad }]}>
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <Pressable style={styles.reportBtn} onPress={() => setReportOpen(true)}>
              <Feather name="flag" size={20} color="#fff" />
            </Pressable>
            <Pressable style={styles.backBtn} onPress={() => router.back()}>
              <Feather name="arrow-right" size={22} color="#fff" />
            </Pressable>
          </View>
          <View style={styles.bannerIllustration}>
            <Feather name="book-open" size={64} color="rgba(255,255,255,0.3)" />
          </View>
          <View style={styles.bannerInfo}>
            <View style={styles.levelBadge}>
              <Text style={styles.levelBadgeText}>{levelLabel}</Text>
            </View>
            <Text style={styles.courseTitle}>{course.titleAr || course.title}</Text>
          </View>
        </View>

        {/* Meta info */}
        <View style={styles.metaBar}>
          <View style={styles.metaItem}>
            <Feather name="users" size={14} color={C.tint} />
            <Text style={styles.metaText}>{course.enrollmentCount} طالب</Text>
          </View>
          <View style={styles.metaItem}>
            <Feather name="book" size={14} color={C.tint} />
            <Text style={styles.metaText}>{course.lessonCount} درس</Text>
          </View>
          <View style={styles.metaItem}>
            <Feather name="clock" size={14} color={C.tint} />
            <Text style={styles.metaText}>{course.totalDuration} دقيقة</Text>
          </View>
        </View>

        <View style={styles.body}>
          {/* Rating */}
          <StarRow rating={course.rating} count={course.reviewCount} />

          {/* Teacher */}
          <View style={styles.teacherRow}>
            <View style={styles.teacherAvatar}>
              <Feather name="user" size={18} color={C.tint} />
            </View>
            <View>
              <Text style={styles.teacherLabel}>المعلم</Text>
              <Text style={styles.teacherName}>{course.teacherNameAr || course.teacherName}</Text>
            </View>
          </View>

          {/* Description */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>عن الدورة</Text>
            <Text style={styles.descText} numberOfLines={showFullDesc ? undefined : 3}>
              {desc}
            </Text>
            {desc.length > 120 && (
              <Pressable onPress={() => setShowFullDesc(!showFullDesc)}>
                <Text style={styles.readMore}>{showFullDesc ? "عرض أقل" : "اقرأ المزيد"}</Text>
              </Pressable>
            )}
          </View>

          {/* Lessons */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>محتوى الدورة</Text>
            <View style={styles.lessonList}>
              {(course.lessons || []).map((lesson, idx) => (
                <LessonRow
                  key={lesson.id}
                  lesson={lesson}
                  isEnrolled={!!course.isEnrolled}
                  courseId={id!}
                  index={idx}
                />
              ))}
            </View>
          </View>

          {/* Student Reviews */}
          <View style={styles.section}>
             <Text style={styles.sectionTitle}>تقييمات الطلاب</Text>

             {/* Add a review inline if enrolled */}
             {course.isEnrolled && (
               <View style={styles.addReviewBox}>
                 <Text style={styles.addReviewTitle}>أضف تقييمك</Text>
                 <View style={styles.starPickerRow}>
                   {[1, 2, 3, 4, 5].map((star) => (
                     <Pressable key={star} onPress={() => setReviewRating(star)}>
                       <Feather name="star" size={32} color={star <= reviewRating ? C.star : C.cardBorder} />
                     </Pressable>
                   ))}
                 </View>
                 <TextInput
                   style={styles.reviewInput}
                   placeholder="ما رأيك في هذه الدورة؟ اترك تعليقك..."
                   value={reviewComment}
                   onChangeText={setReviewComment}
                   multiline
                   textAlign="right"
                 />
                 <Pressable
                   style={styles.submitReviewBtn}
                   onPress={() => reviewMutation.mutate()}
                   disabled={reviewMutation.isPending}
                 >
                   <Text style={styles.submitReviewText}>
                     {reviewMutation.isPending ? "جاري الإرسال..." : "إرسال التقييم"}
                   </Text>
                 </Pressable>
               </View>
             )}

             {reviews.length === 0 ? (
               <Text style={styles.noReviews}>لا توجد تقييمات حتى الآن.</Text>
             ) : (
               <View style={styles.reviewList}>
                 {reviews.map((r: any) => (
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
                     {r.comment && <Text style={styles.reviewCommentText}>{r.comment}</Text>}
                   </View>
                 ))}
               </View>
             )}
          </View>
        </View>
      </ScrollView>

      {/* Bottom CTA */}
      <View style={[styles.bottomBar, { paddingBottom: bottomPad + 16 }]}>
        <View style={styles.priceArea}>
          <Text style={styles.price}>
            {course.price === 0 ? "مجاني" : `${course.price}`}
          </Text>
          {course.price > 0 && <Text style={styles.currency}>{course.currency}</Text>}
        </View>
        {course.isEnrolled ? (
          <View style={styles.enrolledBadge}>
            <Feather name="check-circle" size={18} color={C.tint} />
            <Text style={styles.enrolledText}>مسجّل بالفعل</Text>
          </View>
        ) : (
          <Pressable
            style={({ pressed }) => [styles.enrollBtn, pressed && { opacity: 0.85 }, enrollMutation.isPending && { opacity: 0.7 }]}
            onPress={() => {
              if (!user) { router.push("/auth/login"); return; }
              enrollMutation.mutate();
            }}
            disabled={enrollMutation.isPending}
          >
            {enrollMutation.isPending ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.enrollBtnText}>{course.price === 0 ? "سجّل مجاناً" : "سجّل الآن"}</Text>
            )}
          </Pressable>
        )}
      </View>

      <ReportModal 
        visible={reportOpen} 
        onClose={() => setReportOpen(false)} 
        type="course" 
        targetId={parseInt(id!)} 
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
  banner: {
    backgroundColor: C.tint,
    padding: 20,
    minHeight: 200,
    justifyContent: "space-between",
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  reportBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  bannerIllustration: { position: "absolute", right: 20, bottom: 20, opacity: 0.4 },
  bannerInfo: { marginTop: 20 },
  levelBadge: {
    alignSelf: "flex-end",
    backgroundColor: "rgba(255,255,255,0.25)",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginBottom: 10,
  },
  levelBadgeText: { fontFamily: "Inter_600SemiBold", fontSize: 12, color: "#fff" },
  courseTitle: { fontFamily: "Inter_700Bold", fontSize: 20, color: "#fff", textAlign: "right", lineHeight: 28 },
  metaBar: {
    flexDirection: "row-reverse",
    justifyContent: "space-around",
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: C.cardBorder,
    backgroundColor: C.backgroundSecondary,
  },
  metaItem: { flexDirection: "row-reverse", alignItems: "center", gap: 5 },
  metaText: { fontFamily: "Inter_500Medium", fontSize: 12, color: C.textSecondary },
  body: { padding: 20 },
  ratingText: { fontFamily: "Inter_700Bold", fontSize: 13, color: C.text },
  reviewCount: { fontFamily: "Inter_400Regular", fontSize: 12, color: C.textMuted },
  teacherRow: { flexDirection: "row-reverse", alignItems: "center", gap: 12, marginTop: 16, marginBottom: 8 },
  teacherAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: C.pill, alignItems: "center", justifyContent: "center" },
  teacherLabel: { fontFamily: "Inter_400Regular", fontSize: 11, color: C.textMuted, textAlign: "right" },
  teacherName: { fontFamily: "Inter_600SemiBold", fontSize: 14, color: C.text, textAlign: "right" },
  section: { marginTop: 24 },
  sectionTitle: { fontFamily: "Inter_700Bold", fontSize: 16, color: C.text, textAlign: "right", marginBottom: 12 },
  descText: { fontFamily: "Inter_400Regular", fontSize: 14, color: C.textSecondary, textAlign: "right", lineHeight: 22 },
  readMore: { fontFamily: "Inter_600SemiBold", fontSize: 13, color: C.tint, textAlign: "right", marginTop: 6 },
  lessonList: { gap: 8 },
  lessonRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 12,
    backgroundColor: C.backgroundSecondary,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: C.cardBorder,
  },
  lessonLocked: { opacity: 0.6 },
  lessonNum: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: C.backgroundTertiary,
    alignItems: "center",
    justifyContent: "center",
  },
  lessonNumActive: { backgroundColor: C.pill },
  lessonNumText: { fontFamily: "Inter_700Bold", fontSize: 12, color: C.textMuted },
  lessonNumTextActive: { color: C.tint },
  lessonInfo: { flex: 1 },
  lessonTitle: { fontFamily: "Inter_600SemiBold", fontSize: 13, color: C.text, textAlign: "right", marginBottom: 4 },
  lessonTitleLocked: { color: C.textMuted },
  lessonMeta: { flexDirection: "row-reverse", alignItems: "center", gap: 4 },
  freeBadge: { backgroundColor: "#D1FAE5", borderRadius: 5, paddingHorizontal: 6, paddingVertical: 2 },
  freeBadgeText: { fontFamily: "Inter_600SemiBold", fontSize: 9, color: "#065F46" },
  lessonDuration: { fontFamily: "Inter_400Regular", fontSize: 11, color: C.textMuted },
  bottomBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: C.background,
    borderTopWidth: 1,
    borderTopColor: C.cardBorder,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  priceArea: { alignItems: "center" },
  price: { fontFamily: "Inter_700Bold", fontSize: 24, color: C.tint },
  currency: { fontFamily: "Inter_400Regular", fontSize: 12, color: C.textMuted },
  enrolledBadge: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: C.pill, paddingHorizontal: 18, paddingVertical: 12, borderRadius: 14 },
  enrolledText: { fontFamily: "Inter_600SemiBold", fontSize: 14, color: C.tint },
  enrollBtn: {
    backgroundColor: C.tint,
    borderRadius: 14,
    paddingHorizontal: 32,
    paddingVertical: 14,
    shadowColor: C.tint,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  enrollBtnText: { fontFamily: "Inter_700Bold", fontSize: 15, color: "#fff" },
  errorMsg: { fontFamily: "Inter_500Medium", fontSize: 15, color: C.textMuted },
  addReviewBox: { backgroundColor: C.backgroundSecondary, borderRadius: 16, padding: 16, marginBottom: 20, borderWidth: 1, borderColor: C.cardBorder },
  addReviewTitle: { fontFamily: "Inter_700Bold", fontSize: 15, color: C.text, textAlign: "right", marginBottom: 12 },
  starPickerRow: { flexDirection: "row-reverse", justifyContent: "center", gap: 12, marginBottom: 16 },
  reviewInput: { backgroundColor: C.background, borderWidth: 1, borderColor: C.cardBorder, borderRadius: 12, padding: 12, minHeight: 80, fontFamily: "Inter_400Regular", fontSize: 14, color: C.text, textAlignVertical: "top", marginBottom: 12 },
  submitReviewBtn: { backgroundColor: C.tint, borderRadius: 10, paddingVertical: 12, alignItems: "center" },
  submitReviewText: { fontFamily: "Inter_600SemiBold", color: "#fff", fontSize: 14 },
  noReviews: { fontFamily: "Inter_400Regular", fontSize: 14, color: C.textMuted, textAlign: "center", marginTop: 10 },
  reviewList: { gap: 12 },
  reviewCard: { backgroundColor: C.backgroundSecondary, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: C.cardBorder },
  reviewHeader: { flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 },
  reviewUser: { flexDirection: "row-reverse", alignItems: "center", gap: 10 },
  reviewAvatar: { width: 36, height: 36, borderRadius: 18 },
  reviewName: { fontFamily: "Inter_600SemiBold", fontSize: 13, color: C.text, textAlign: "right" },
  reviewDate: { fontFamily: "Inter_400Regular", fontSize: 11, color: C.textMuted, textAlign: "right", marginTop: 2 },
  reviewStars: { flexDirection: "row-reverse", gap: 2 },
  reviewCommentText: { fontFamily: "Inter_400Regular", fontSize: 13, color: C.textSecondary, textAlign: "right", lineHeight: 20 },
});
