import { Feather } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { ResizeMode, Video } from "expo-av";
import React, { useRef, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Colors from "@/constants/colors";
import { useAuth } from "@/contexts/AuthContext";
import { useApi } from "@/hooks/useApi";
import { ReportModal } from "@/components/ReportModal";
import { OfflineDownloader, OfflineVideo } from "@/utils/OfflineDownloader";

const C = Colors.light;

interface LessonDetail {
  id: number;
  title: string;
  titleAr: string;
  content?: string | null;
  contentAr?: string | null;
  videoUrl?: string | null;
  duration: number;
  order: number;
  type: string;
  watchedSeconds?: number;
  isCompleted?: boolean;
}

interface CourseLesson {
  id: number;
  title: string;
  titleAr: string;
  order: number;
}

export default function LessonViewerScreen() {
  const { courseId, lessonId } = useLocalSearchParams<{ courseId: string; lessonId: string }>();
  const insets = useSafeAreaInsets();
  const { user, apiBase } = useAuth();
  const { apiFetch } = useApi();
  const queryClient = useQueryClient();
  const videoRef = useRef<any>(null);
  const [videoStatus, setVideoStatus] = useState<any>({});
  const [secureUrl, setSecureUrl] = useState<string | null>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [localVideoUri, setLocalVideoUri] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);

  const { data: lesson, isLoading } = useQuery<LessonDetail>({
    queryKey: ["lesson", courseId, lessonId],
    queryFn: () => apiFetch(`/courses/${courseId}/lessons/${lessonId}`),
    enabled: !!user,
  });

  React.useEffect(() => {
    if (!lessonId || !courseId) return;
    OfflineDownloader.getOfflineVideos().then(vids => {
      const local = vids.find(v => v.id === `${courseId}_${lessonId}`);
      if (local) {
        setLocalVideoUri(local.localPlaylistPath);
      } else {
        setLocalVideoUri(null);
      }
    });
  }, [courseId, lessonId]);

  React.useEffect(() => {
    if (localVideoUri) {
      setSecureUrl(localVideoUri);
      return;
    }

    if (lesson?.videoUrl && user && courseId && lessonId) {
      apiFetch(`/video/generate-token`, {
        method: "POST",
        body: JSON.stringify({ courseId: parseInt(courseId), lessonId: parseInt(lessonId) }),
      })
      .then((data: any) => {
        if (data.url && apiBase) {
          const host = apiBase.replace('/api', '');
          setSecureUrl(`${host}${data.url}`);
        }
      })
      .catch((e: any) => {
        console.log("Failed to load secure video", e);
        setSecureUrl(lesson.videoUrl || null); // fallback if mock
      });
    } else if (lesson?.videoUrl) {
      setSecureUrl(lesson.videoUrl);
    } else {
      setSecureUrl(null);
    }
  }, [lesson?.videoUrl, user, courseId, lessonId, apiBase, localVideoUri]);

  const { data: courseLessons } = useQuery<CourseLesson[]>({
    queryKey: ["course-lessons", courseId],
    queryFn: () => apiFetch(`/courses/${courseId}/lessons`),
  });

  const progressMutation = useMutation({
    mutationFn: (data: { isCompleted: boolean; watchedSeconds: number }) =>
      apiFetch(`/progress/${courseId}/${lessonId}`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["enrollments"] });
    },
  });

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const lessons = courseLessons || [];
  const currentIdx = lessons.findIndex(l => l.id === Number(lessonId));
  const prevLesson = currentIdx > 0 ? lessons[currentIdx - 1] : null;
  const nextLesson = currentIdx < lessons.length - 1 ? lessons[currentIdx + 1] : null;

  const navigateLesson = (lid: number) => {
    router.replace({ pathname: "/lesson/[courseId]/[lessonId]", params: { courseId, lessonId: lid.toString() } });
  };

  const handleDownload = async () => {
    if (localVideoUri) {
      // Delete
      await OfflineDownloader.deleteOfflineVideo(Number(courseId), Number(lessonId));
      setLocalVideoUri(null);
      return;
    }
    if (!secureUrl) return;

    try {
      setIsDownloading(true);
      setDownloadProgress(0);
      const hostUrl = secureUrl.startsWith('/') && apiBase 
          ? `${apiBase.replace('/api', '')}${secureUrl}` 
          : secureUrl;
      const path = await OfflineDownloader.downloadHLS(
        hostUrl, 
        Number(courseId), 
        Number(lessonId), 
        lesson?.titleAr || lesson?.title || "Lesson",
        (prog) => setDownloadProgress(prog)
      );
      setLocalVideoUri(path);
      setSecureUrl(path);
    } catch (e: any) {
      alert("Failed to download video: " + e.message);
    } finally {
      setIsDownloading(false);
      setDownloadProgress(0);
    }
  };

  if (isLoading) {
    return (
      <View style={[styles.container, { alignItems: "center", justifyContent: "center" }]}>
        <ActivityIndicator color={C.tint} size="large" />
      </View>
    );
  }

  if (!lesson) {
    return (
      <View style={[styles.container, { alignItems: "center", justifyContent: "center" }]}>
        <Text style={styles.errorMsg}>الدرس غير موجود</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Top bar */}
      <View style={[styles.topBar, { paddingTop: topPad + 8 }]}>
        <View style={{ flexDirection: "row", gap: 10 }}>
          <Pressable style={styles.reportBtn} onPress={() => setReportOpen(true)}>
            <Feather name="flag" size={18} color={C.textMuted} />
          </Pressable>
          <Pressable style={styles.reportBtn} onPress={handleDownload} disabled={isDownloading}>
            {isDownloading ? (
               <Text style={{ fontSize: 10, color: C.tint }}>{Math.round(downloadProgress * 100)}%</Text>
            ) : (
               <Feather name={localVideoUri ? "trash-2" : "download"} size={18} color={localVideoUri ? C.tint : C.textMuted} />
            )}
          </Pressable>
        </View>
        <Text style={styles.lessonNum} numberOfLines={1}>
          {currentIdx >= 0 ? `الدرس ${currentIdx + 1} / ${lessons.length}` : ""}
        </Text>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Feather name="arrow-right" size={20} color={C.text} />
        </Pressable>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
        {/* Video player */}
        <View style={styles.videoSection}>
          {lesson.videoUrl ? (
            <View style={styles.videoWrap}>
              {/* Content protection overlay to prevent right-click save */}
              <View style={styles.videoProtect} pointerEvents="none">
                {user && (
                  <Text style={styles.watermark}>{user.email}</Text>
                )}
              </View>
              {secureUrl ? (
                  <Video
                    ref={videoRef}
                    source={{ uri: secureUrl }}
                    style={styles.video}
                    resizeMode={ResizeMode.CONTAIN}
                    useNativeControls
                    progressUpdateIntervalMillis={10000}
                    onLoad={() => {
                      if (lesson.watchedSeconds && lesson.watchedSeconds > 0) {
                        videoRef.current?.setPositionAsync(lesson.watchedSeconds * 1000);
                      }
                    }}
                    onPlaybackStatusUpdate={(status: any) => {
                      setVideoStatus(status);
                      if (status.isLoaded) {
                        const isCompleteCheck = status.positionMillis > (lesson.duration * 60 * 1000 * 0.9);
                        if (status.isPlaying) {
                           progressMutation.mutate({ 
                             isCompleted: isCompleteCheck || !!lesson.isCompleted, 
                             watchedSeconds: Math.floor(status.positionMillis / 1000) 
                           });
                        } else if (status.didJustFinish && user) {
                           progressMutation.mutate({ isCompleted: true, watchedSeconds: Math.floor(status.durationMillis / 1000) });
                        }
                      }
                    }}
                  />
              ) : (
                <View style={[styles.video, { alignItems: 'center', justifyContent: 'center' }]}>
                  <ActivityIndicator color={C.tint} size="small" />
                </View>
              )}
            </View>
          ) : (
            <View style={styles.noVideoBox}>
              <Feather name="file-text" size={48} color={C.tint} />
              <Text style={styles.noVideoText}>محتوى نصي</Text>
            </View>
          )}
        </View>

        {/* Progress mark */}
        {user && (
          <View style={styles.progressSection}>
            <Pressable
              style={styles.markCompleteBtn}
              onPress={() => progressMutation.mutate({ isCompleted: true, watchedSeconds: 0 })}
            >
              <Feather name="check-circle" size={16} color={C.tint} />
              <Text style={styles.markCompleteText}>
                {progressMutation.isSuccess ? "تم التحديد كمكتمل ✓" : "تحديد كمكتمل"}
              </Text>
            </Pressable>
          </View>
        )}

        {/* Lesson info */}
        <View style={styles.lessonInfo}>
          <Text style={styles.lessonTitle}>{lesson.titleAr || lesson.title}</Text>
          <View style={styles.lessonMetaRow}>
            <Feather name="clock" size={13} color={C.textMuted} />
            <Text style={styles.lessonMeta}>{lesson.duration} دقيقة</Text>
          </View>
          {(lesson.contentAr || lesson.content) && (
            <View style={styles.contentBox}>
              <Text style={styles.contentText}>{lesson.contentAr || lesson.content}</Text>
            </View>
          )}
        </View>

        {/* Lessons list */}
        {lessons.length > 0 && (
          <View style={styles.lessonsSection}>
            <Text style={styles.sectionTitle}>دروس الدورة</Text>
            {lessons.map((l, idx) => (
              <Pressable
                key={l.id}
                style={[styles.lessonItem, l.id === Number(lessonId) && styles.lessonItemActive]}
                onPress={() => navigateLesson(l.id)}
              >
                <View style={[styles.lessonItemNum, l.id === Number(lessonId) && styles.lessonItemNumActive]}>
                  {l.id === Number(lessonId) ? (
                    <Feather name="play" size={12} color="#fff" />
                  ) : (
                    <Text style={styles.lessonItemNumText}>{idx + 1}</Text>
                  )}
                </View>
                <Text
                  style={[styles.lessonItemTitle, l.id === Number(lessonId) && styles.lessonItemTitleActive]}
                  numberOfLines={1}
                >
                  {l.titleAr || l.title}
                </Text>
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Bottom nav */}
      <View style={[styles.bottomNav, { paddingBottom: Platform.OS === "web" ? 16 : insets.bottom + 16 }]}>
        <Pressable
          style={[styles.navBtn, !prevLesson && styles.navBtnDisabled]}
          onPress={() => prevLesson && navigateLesson(prevLesson.id)}
          disabled={!prevLesson}
        >
          <Feather name="arrow-right" size={18} color={prevLesson ? C.tint : C.textMuted} />
          <Text style={[styles.navBtnText, !prevLesson && styles.navBtnTextDisabled]}>السابق</Text>
        </Pressable>

        <View style={styles.navCenter}>
          <Text style={styles.navProgress}>{currentIdx + 1} / {lessons.length}</Text>
        </View>

        <Pressable
          style={[styles.navBtn, styles.navBtnNext, !nextLesson && styles.navBtnDisabled]}
          onPress={() => nextLesson && navigateLesson(nextLesson.id)}
          disabled={!nextLesson}
        >
          <Text style={[styles.navBtnText, styles.navBtnTextNext, !nextLesson && styles.navBtnTextDisabled]}>التالي</Text>
          <Feather name="arrow-left" size={18} color={nextLesson ? "#fff" : C.textMuted} />
        </Pressable>
      </View>

      <ReportModal 
        visible={reportOpen} 
        onClose={() => setReportOpen(false)} 
        type="lesson" 
        targetId={parseInt(lessonId!)} 
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
  topBar: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: C.cardBorder,
    backgroundColor: C.background,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: C.backgroundSecondary,
    alignItems: "center",
    justifyContent: "center",
  },
  reportBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: C.backgroundSecondary,
    alignItems: "center",
    justifyContent: "center",
  },
  lessonNum: { fontFamily: "Inter_600SemiBold", fontSize: 14, color: C.textSecondary },
  videoSection: { backgroundColor: "#0F172A" },
  videoWrap: { position: "relative", aspectRatio: 16 / 9 },
  video: { width: "100%", aspectRatio: 16 / 9 },
  videoProtect: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 10,
    alignItems: "flex-end",
    justifyContent: "flex-start",
    padding: 12,
  },
  watermark: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    color: "rgba(255,255,255,0.35)",
    textAlign: "right",
  },
  noVideoBox: {
    aspectRatio: 16 / 9,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: C.pill,
    gap: 12,
  },
  noVideoText: { fontFamily: "Inter_500Medium", fontSize: 15, color: C.tint },
  progressSection: {
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 4,
  },
  markCompleteBtn: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 8,
    alignSelf: "flex-end",
    backgroundColor: C.pill,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.tint + "40",
  },
  markCompleteText: { fontFamily: "Inter_600SemiBold", fontSize: 13, color: C.tint },
  lessonInfo: { padding: 20 },
  lessonTitle: { fontFamily: "Inter_700Bold", fontSize: 20, color: C.text, textAlign: "right", marginBottom: 8 },
  lessonMetaRow: { flexDirection: "row-reverse", alignItems: "center", gap: 5, marginBottom: 16 },
  lessonMeta: { fontFamily: "Inter_400Regular", fontSize: 13, color: C.textMuted },
  contentBox: {
    backgroundColor: C.backgroundSecondary,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: C.cardBorder,
  },
  contentText: { fontFamily: "Inter_400Regular", fontSize: 14, color: C.textSecondary, textAlign: "right", lineHeight: 22 },
  lessonsSection: { paddingHorizontal: 20, paddingTop: 8 },
  sectionTitle: { fontFamily: "Inter_700Bold", fontSize: 16, color: C.text, textAlign: "right", marginBottom: 12 },
  lessonItem: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    marginBottom: 6,
  },
  lessonItemActive: { backgroundColor: C.pill },
  lessonItemNum: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: C.backgroundTertiary,
    alignItems: "center",
    justifyContent: "center",
  },
  lessonItemNumActive: { backgroundColor: C.tint },
  lessonItemNumText: { fontFamily: "Inter_600SemiBold", fontSize: 12, color: C.textMuted },
  lessonItemTitle: { flex: 1, fontFamily: "Inter_500Medium", fontSize: 14, color: C.text, textAlign: "right" },
  lessonItemTitleActive: { color: C.tint, fontFamily: "Inter_600SemiBold" },
  bottomNav: {
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
    paddingTop: 12,
  },
  navBtn: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.tint,
  },
  navBtnNext: { backgroundColor: C.tint, borderColor: C.tint },
  navBtnDisabled: { borderColor: C.cardBorder, opacity: 0.5 },
  navBtnText: { fontFamily: "Inter_600SemiBold", fontSize: 14, color: C.tint },
  navBtnTextNext: { color: "#fff" },
  navBtnTextDisabled: { color: C.textMuted },
  navCenter: { alignItems: "center" },
  navProgress: { fontFamily: "Inter_500Medium", fontSize: 12, color: C.textMuted },
  errorMsg: { fontFamily: "Inter_500Medium", fontSize: 15, color: C.textMuted },
});
