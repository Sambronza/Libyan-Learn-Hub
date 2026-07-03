import { Feather } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as DocumentPicker from "expo-document-picker";
import Colors from "@/constants/colors";
import { useAuth } from "@/contexts/AuthContext";
import { useApi } from "@/hooks/useApi";
import { useLanguage } from "@/contexts/LanguageContext";

const C = Colors.light;

export default function ManageCourseScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { apiFetch } = useApi();
  const queryClient = useQueryClient();
  const { t } = useLanguage();
  const params = useLocalSearchParams<{ id: string }>();
  const courseId = params.id;
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  // Modals
  const [addSectionOpen, setAddSectionOpen] = useState(false);
  const [editSectionTarget, setEditSectionTarget] = useState<any>(null);
  const [addLessonSectionId, setAddLessonSectionId] = useState<number | null>(null);
  const [editLessonTarget, setEditLessonTarget] = useState<any>(null);

  // Forms
  const [sectionForm, setSectionForm] = useState({ title: "", titleAr: "", description: "", descriptionAr: "" });
  const [lessonForm, setLessonForm] = useState({ 
    title: "", titleAr: "", videoUrl: "", videoFilePath: "", documentFilePath: "", documentFileName: "", 
    content: "", contentAr: "", duration: "0", isFree: false, type: "video",
    bookName: "", bookNameAr: "", schoolYear: "", chapter: "", pageNumber: "", subjectTags: "" 
  });

  // File upload state
  const [videoFile, setVideoFile] = useState<DocumentPicker.DocumentPickerAsset | null>(null);
  const [documentFile, setDocumentFile] = useState<DocumentPicker.DocumentPickerAsset | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState("");

  // Expanded
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  const { data: course, isLoading: courseLoading } = useQuery<any>({
    queryKey: ["course-detail", courseId],
    queryFn: () => apiFetch(`/courses/${courseId}`),
    enabled: !!courseId,
  });

  const { data: sections = [], isLoading: sectionsLoading } = useQuery<any[]>({
    queryKey: ["course-sections", courseId],
    queryFn: async () => {
      const res = await apiFetch(`/courses/${courseId}/sections`);
      // Auto-expand all sections
      setExpanded(new Set((res || []).map((s: any) => s.id)));
      return res;
    },
    enabled: !!courseId,
  });

  const enrollCount = course?.enrollmentCount || 0;
  const canDelete = enrollCount === 0;

  // ── Section CRUD ──────────────────────────────────────────────
  const handleAddSection = async () => {
    if (!sectionForm.title || !sectionForm.titleAr) {
      Alert.alert(t("خطأ", "Error"), t("يرجى ملء عنوان القسم بالعربي والإنجليزي", "Please fill section title in both Arabic and English"));
      return;
    }
    try {
      await apiFetch(`/courses/${courseId}/sections`, {
        method: "POST",
        body: JSON.stringify({ ...sectionForm, order: sections.length }),
      });
      Alert.alert(t("تم!", "Done!"), t("تمت إضافة القسم.", "Section added."));
      queryClient.invalidateQueries({ queryKey: ["course-sections", courseId] });
      setAddSectionOpen(false);
      setSectionForm({ title: "", titleAr: "", description: "", descriptionAr: "" });
    } catch (err: any) {
      Alert.alert(t("خطأ", "Error"), err.message);
    }
  };

  const handleEditSection = async () => {
    if (!editSectionTarget) return;
    try {
      await apiFetch(`/courses/${courseId}/sections/${editSectionTarget.id}`, {
        method: "PUT",
        body: JSON.stringify({ ...sectionForm, order: editSectionTarget.order }),
      });
      Alert.alert(t("تم!", "Done!"), t("تم تحديث القسم.", "Section updated."));
      queryClient.invalidateQueries({ queryKey: ["course-sections", courseId] });
      setEditSectionTarget(null);
    } catch (err: any) {
      Alert.alert(t("خطأ", "Error"), err.message);
    }
  };

  const handleDeleteSection = (section: any) => {
    if (!canDelete) {
      Alert.alert("غير مسموح", "لا يمكن حذف القسم — يوجد طلاب مسجلون في هذه الدورة.");
      return;
    }
    Alert.alert("حذف القسم", `هل تريد حذف "${section.titleAr}"؟ سيتم حذف جميع الدروس بداخله.`, [
      { text: "إلغاء", style: "cancel" },
      {
        text: "حذف", style: "destructive", onPress: async () => {
          try {
            await apiFetch(`/courses/${courseId}/sections/${section.id}`, { method: "DELETE" });
            queryClient.invalidateQueries({ queryKey: ["course-sections", courseId] });
          } catch (err: any) { Alert.alert("خطأ", err.message); }
        },
      },
    ]);
  };

  // ── File Pickers ──────────────────────────────────────────────
  const pickVideo = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["video/mp4", "video/webm", "video/quicktime"],
        copyToCacheDirectory: true,
      });
      if (!result.canceled && result.assets.length > 0) {
        setVideoFile(result.assets[0]);
      }
    } catch (err: any) {
      Alert.alert(t("خطأ", "Error"), err.message);
    }
  };

  const pickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          "application/pdf",
          "application/msword",
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        ],
        copyToCacheDirectory: true,
      });
      if (!result.canceled && result.assets.length > 0) {
        setDocumentFile(result.assets[0]);
      }
    } catch (err: any) {
      Alert.alert(t("خطأ", "Error"), err.message);
    }
  };

  const uploadFile = async (file: DocumentPicker.DocumentPickerAsset, type: "video" | "document"): Promise<any> => {
    const formData = new FormData();
    formData.append(type, {
      uri: file.uri,
      name: file.name,
      type: file.mimeType || (type === "video" ? "video/mp4" : "application/pdf"),
    } as any);

    const res = await fetch(`${apiBase}/upload/${type}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
      body: formData,
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: "Upload failed" }));
      throw new Error(err.error || "Upload failed");
    }
    return res.json();
  };

  const { token: authToken, apiBase } = useAuth();

  // ── Lesson CRUD ───────────────────────────────────────────────
  const handleAddLesson = async () => {
    if (!addLessonSectionId || !lessonForm.title || !lessonForm.titleAr) {
      Alert.alert(t("خطأ", "Error"), t("يرجى ملء عنوان الدرس", "Please fill lesson title"));
      return;
    }
    
    if (lessonForm.type === "video" && videoFile) {
      Alert.alert(
        t("مطلوب التحقق من الهوية", "Identity Verification Required"),
        t("لدواعي أمنية، يرجى استخدام منصة الويب لرفع الفيديوهات حيث يتطلب ذلك التحقق من الوجه.", "For security reasons, please use the web platform to upload videos as it requires face verification.")
      );
      return;
    }
    
    const sectionLessons = sections.find(s => s.id === addLessonSectionId)?.lessons || [];
    try {
      setUploading(true);
      let videoFilePath = lessonForm.videoFilePath;
      let documentFilePath = lessonForm.documentFilePath;
      let documentFileName = lessonForm.documentFileName;
      let duration = parseInt(lessonForm.duration) || 0;

      // Upload video if selected
      if (videoFile) {
        setUploadProgress(t("جاري رفع الفيديو...", "Uploading video..."));
        const result = await uploadFile(videoFile, "video");
        videoFilePath = result.url;
        if (result.duration) duration = result.duration;
      }

      // Upload document if selected
      if (documentFile) {
        setUploadProgress(t("جاري رفع المستند...", "Uploading document..."));
        const result = await uploadFile(documentFile, "document");
        documentFilePath = result.url;
        documentFileName = result.fileName;
      }

      setUploadProgress(t("جاري حفظ الدرس...", "Saving lesson..."));
      await apiFetch(`/courses/${courseId}/sections/${addLessonSectionId}/lessons`, {
        method: "POST",
        body: JSON.stringify({
          ...lessonForm,
          videoFilePath,
          documentFilePath,
          documentFileName,
          duration,
          order: sectionLessons.length,
          isFree: lessonForm.isFree,
        }),
      });
      Alert.alert(t("تم!", "Done!"), t("تمت إضافة الدرس.", "Lesson added."));
      queryClient.invalidateQueries({ queryKey: ["course-sections", courseId] });
      setAddLessonSectionId(null);
      setLessonForm({ 
        title: "", titleAr: "", videoUrl: "", videoFilePath: "", documentFilePath: "", documentFileName: "", 
        content: "", contentAr: "", duration: "0", isFree: false, type: "video",
        bookName: "", bookNameAr: "", schoolYear: "", chapter: "", pageNumber: "", subjectTags: "" 
      });
      setVideoFile(null);
      setDocumentFile(null);
    } catch (err: any) {
      Alert.alert(t("خطأ", "Error"), err.message);
    } finally {
      setUploading(false);
      setUploadProgress("");
    }
  };

  const handleEditLesson = async () => {
    if (!editLessonTarget) return;

    if (lessonForm.type === "video" && videoFile) {
      Alert.alert(
        t("مطلوب التحقق من الهوية", "Identity Verification Required"),
        t("لدواعي أمنية، يرجى استخدام منصة الويب لتعديل الفيديوهات حيث يتطلب ذلك التحقق من الوجه.", "For security reasons, please use the web platform to update videos as it requires face verification.")
      );
      return;
    }

    try {
      setUploading(true);
      let videoFilePath = lessonForm.videoFilePath;
      let documentFilePath = lessonForm.documentFilePath;
      let documentFileName = lessonForm.documentFileName;
      let duration = parseInt(lessonForm.duration) || 0;

      if (videoFile) {
        setUploadProgress(t("جاري رفع الفيديو...", "Uploading video..."));
        const result = await uploadFile(videoFile, "video");
        videoFilePath = result.url;
        if (result.duration) duration = result.duration;
      }

      if (documentFile) {
        setUploadProgress(t("جاري رفع المستند...", "Uploading document..."));
        const result = await uploadFile(documentFile, "document");
        documentFilePath = result.url;
        documentFileName = result.fileName;
      }

      setUploadProgress(t("جاري حفظ التعديلات...", "Saving changes..."));
      await apiFetch(`/courses/${courseId}/lessons/${editLessonTarget.id}`, {
        method: "PUT",
        body: JSON.stringify({
          ...lessonForm,
          videoFilePath,
          documentFilePath,
          documentFileName,
          duration,
          order: editLessonTarget.order,
          isFree: lessonForm.isFree,
        }),
      });
      Alert.alert(t("تم!", "Done!"), t("تم تحديث الدرس.", "Lesson updated."));
      queryClient.invalidateQueries({ queryKey: ["course-sections", courseId] });
      setEditLessonTarget(null);
      setVideoFile(null);
      setDocumentFile(null);
    } catch (err: any) {
      Alert.alert(t("خطأ", "Error"), err.message);
    } finally {
      setUploading(false);
      setUploadProgress("");
    }
  };

  const handleDeleteLesson = (lesson: any) => {
    if (!canDelete) {
      Alert.alert("غير مسموح", "لا يمكن حذف الدرس — يوجد طلاب مسجلون.");
      return;
    }
    Alert.alert("حذف الدرس", `هل تريد حذف "${lesson.titleAr}"؟`, [
      { text: "إلغاء", style: "cancel" },
      {
        text: "حذف", style: "destructive", onPress: async () => {
          try {
            await apiFetch(`/courses/${courseId}/lessons/${lesson.id}`, { method: "DELETE" });
            queryClient.invalidateQueries({ queryKey: ["course-sections", courseId] });
          } catch (err: any) { Alert.alert("خطأ", err.message); }
        },
      },
    ]);
  };

  const handlePublishToggle = async () => {
    if (!course) return;
    try {
      await apiFetch(`/courses/${courseId}`, {
        method: "PUT",
        body: JSON.stringify({
          title: course.title, titleAr: course.titleAr,
          description: course.description, descriptionAr: course.descriptionAr,
          price: course.price, level: course.level, language: course.language,
          categoryId: course.categoryId, isPublished: !course.isPublished,
        }),
      });
      queryClient.invalidateQueries({ queryKey: ["course-detail", courseId] });
      queryClient.invalidateQueries({ queryKey: ["teacher-courses"] });
      Alert.alert(t("تم!", "Done!"), course.isPublished ? t("تم إلغاء نشر الدورة", "Course unpublished") : t("تم نشر الدورة بنجاح!", "Course published!"));
    } catch (err: any) {
      Alert.alert(t("خطأ", "Error"), err.message);
    }
  };

  const toggleExpand = (id: number) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const totalLessons = sections.reduce((sum, s) => sum + (s.lessons?.length || 0), 0);

  if (courseLoading || sectionsLoading) {
    return (
      <View style={[styles.container, { paddingTop: topPad + 16 }]}>
        <ActivityIndicator color={C.tint} style={{ flex: 1 }} />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: Platform.OS === "web" ? 34 : insets.bottom + 90 }}
    >
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 16 }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-right" size={20} color={C.text} />
          <Text style={styles.backText}>{t("رجوع", "Back")}</Text>
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={2}>{t(course?.titleAr || course?.title, course?.title)}</Text>
        <Text style={styles.headerSubtitle}>{course?.title}</Text>

        {/* Course stats */}
        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{sections.length}</Text>
            <Text style={styles.statLabel}>{t("أقسام", "Sections")}</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.stat}>
            <Text style={styles.statValue}>{totalLessons}</Text>
            <Text style={styles.statLabel}>{t("دروس", "Lessons")}</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.stat}>
            <Text style={styles.statValue}>{enrollCount}</Text>
            <Text style={styles.statLabel}>{t("طلاب", "Students")}</Text>
          </View>
        </View>

        {/* Publish & Add Section buttons */}
        <View style={{ flexDirection: "row-reverse", gap: 10, marginTop: 16 }}>
          <Pressable
            style={[styles.primaryBtn, course?.isPublished && { backgroundColor: "#F97316" }]}
            onPress={handlePublishToggle}
          >
            <Feather name={course?.isPublished ? "eye-off" : "check-circle"} size={16} color="#fff" />
            <Text style={styles.primaryBtnText}>{course?.isPublished ? t("إلغاء النشر", "Unpublish") : t("نشر الدورة", "Publish Course")}</Text>
          </Pressable>
          <Pressable style={styles.outlineBtn} onPress={() => {
            setSectionForm({ title: "", titleAr: "", description: "", descriptionAr: "" });
            setAddSectionOpen(true);
          }}>
            <Feather name="plus" size={16} color={C.tint} />
            <Text style={[styles.primaryBtnText, { color: C.tint }]}>{t("إضافة قسم", "Add Section")}</Text>
          </Pressable>
        </View>
      </View>

      {/* Enrollment warning */}
      {!canDelete && (
        <View style={styles.warningBar}>
          <Feather name="alert-triangle" size={16} color="#92400E" />
          <Text style={styles.warningText}>{t(`يوجد ${enrollCount} طالب مسجل — لا يمكن حذف المحتوى`, `${enrollCount} students enrolled — content cannot be deleted`)}</Text>
        </View>
      )}

      {/* Empty state */}
      {sections.length === 0 ? (
        <View style={styles.emptyBox}>
          <Feather name="folder" size={48} color={C.textMuted} />
          <Text style={styles.emptyTitle}>{t("لا توجد أقسام بعد", "No sections yet")}</Text>
          <Text style={styles.emptySubtitle}>{t("أنشئ أول قسم لتنظيم محتوى دورتك", "Create your first section to organize course content")}</Text>
          <Pressable style={[styles.primaryBtn, { marginTop: 12 }]} onPress={() => setAddSectionOpen(true)}>
            <Feather name="plus" size={16} color="#fff" />
            <Text style={styles.primaryBtnText}>{t("إضافة أول قسم", "Add First Section")}</Text>
          </Pressable>
        </View>
      ) : (
        <View style={{ padding: 20, gap: 14 }}>
          {sections.map((section, sIdx) => {
            const isOpen = expanded.has(section.id);
            const lessons = section.lessons || [];
            return (
              <View key={section.id} style={styles.sectionCard}>
                {/* Section header */}
                <Pressable style={styles.sectionHeader} onPress={() => toggleExpand(section.id)}>
                  <Feather name={isOpen ? "chevron-down" : "chevron-left"} size={18} color={C.textMuted} />
                  <View style={styles.sectionNum}>
                    <Text style={styles.sectionNumText}>{sIdx + 1}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.sectionTitle}>{t(section.titleAr || section.title, section.title)}</Text>
                    <Text style={styles.sectionMeta}>{lessons.length} {t("درس", "lessons")}</Text>
                  </View>
                  <Pressable style={styles.iconBtn} onPress={() => {
                    setEditSectionTarget(section);
                    setSectionForm({
                      title: section.title || "", titleAr: section.titleAr || "",
                      description: section.description || "", descriptionAr: section.descriptionAr || "",
                    });
                  }}>
                    <Feather name="edit-2" size={14} color={C.textMuted} />
                  </Pressable>
                  {canDelete && (
                    <Pressable style={styles.iconBtn} onPress={() => handleDeleteSection(section)}>
                      <Feather name="trash-2" size={14} color="#EF4444" />
                    </Pressable>
                  )}
                </Pressable>

                {/* Lessons list */}
                {isOpen && (
                  <View style={styles.lessonsList}>
                    {lessons.length === 0 ? (
                      <Text style={styles.noLessonsText}>{t("لا توجد دروس في هذا القسم", "No lessons in this section")}</Text>
                    ) : (
                      lessons.map((lesson: any, lIdx: number) => (
                        <View key={lesson.id} style={styles.lessonRow}>
                          <View style={styles.lessonIcon}>
                            <Feather name={lesson.type === "video" ? "play-circle" : "file-text"} size={14} color={C.tint} />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.lessonTitle}>{t(lesson.titleAr || lesson.title, lesson.title)}</Text>
                            {lesson.isFree && <Text style={styles.freeBadge}>{t("مجاني", "Free")}</Text>}
                          </View>
                          <Pressable style={styles.iconBtn} onPress={() => {
                            setEditLessonTarget(lesson);
                            setLessonForm({
                              title: lesson.title || "", titleAr: lesson.titleAr || "",
                              videoUrl: lesson.videoUrl || "", videoFilePath: lesson.videoFilePath || "",
                              documentFilePath: lesson.documentFilePath || "", documentFileName: lesson.documentFileName || "",
                              content: lesson.content || "",
                              contentAr: lesson.contentAr || "", duration: (lesson.duration || 0).toString(),
                              isFree: lesson.isFree, type: lesson.type || "video",
                              bookName: lesson.bookName || "", bookNameAr: lesson.bookNameAr || "",
                              schoolYear: lesson.schoolYear || "", chapter: lesson.chapter || "",
                              pageNumber: (lesson.pageNumber || "").toString(), subjectTags: lesson.subjectTags || "",
                            });
                            setVideoFile(null);
                            setDocumentFile(null);
                          }}>
                            <Feather name="edit-2" size={12} color={C.textMuted} />
                          </Pressable>
                          {canDelete && (
                            <Pressable style={styles.iconBtn} onPress={() => handleDeleteLesson(lesson)}>
                              <Feather name="trash-2" size={12} color="#EF4444" />
                            </Pressable>
                          )}
                        </View>
                      ))
                    )}
                    <Pressable style={styles.addLessonBtn} onPress={() => {
                      setAddLessonSectionId(section.id);
                      setLessonForm({ 
                        title: "", titleAr: "", videoUrl: "", videoFilePath: "", documentFilePath: "", documentFileName: "", 
                        content: "", contentAr: "", duration: "0", isFree: false, type: "video",
                        bookName: "", bookNameAr: "", schoolYear: "", chapter: "", pageNumber: "", subjectTags: "" 
                      });
                      setVideoFile(null);
                      setDocumentFile(null);
                    }}>
                      <Feather name="plus" size={14} color={C.tint} />
                      <Text style={styles.addLessonText}>{t("إضافة درس", "Add Lesson")}</Text>
                    </Pressable>
                  </View>
                )}
              </View>
            );
          })}
        </View>
      )}

      {/* ── Add Section Modal ──────────────────────────────────── */}
      <Modal visible={addSectionOpen} transparent animationType="slide" onRequestClose={() => setAddSectionOpen(false)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
          <View style={styles.modalOverlay}>
            <ScrollView style={styles.modalBox} keyboardShouldPersistTaps="handled">
              <Text style={styles.modalTitle}>{t("إضافة قسم جديد", "Add New Section")}</Text>
              <Text style={styles.inputLabel}>{t("عنوان القسم (عربي) *", "Section Title (AR) *")}</Text>
              <TextInput style={styles.input} value={sectionForm.titleAr} onChangeText={v => setSectionForm(f => ({ ...f, titleAr: v }))} placeholder={t("مثال: المقدمة", "e.g. Introduction")} textAlign="right" />
              <Text style={styles.inputLabel}>{t("Section Title (EN) *", "Section Title (EN) *")}</Text>
              <TextInput style={styles.input} value={sectionForm.title} onChangeText={v => setSectionForm(f => ({ ...f, title: v }))} placeholder="e.g. Introduction" />
              <Text style={styles.inputLabel}>{t("الوصف (اختياري)", "Description (optional)")}</Text>
              <TextInput style={[styles.input, { height: 60 }]} multiline value={sectionForm.descriptionAr} onChangeText={v => setSectionForm(f => ({ ...f, descriptionAr: v }))} placeholder={t("وصف القسم", "Section description")} textAlign="right" />
              <View style={[styles.modalBtns, { marginBottom: 30 }]}>
                <Pressable style={[styles.primaryBtn, { flex: 1 }]} onPress={handleAddSection}>
                  <Text style={styles.primaryBtnText}>{t("إضافة", "Add")}</Text>
                </Pressable>
                <Pressable style={[styles.outlineBtn, { flex: 1 }]} onPress={() => setAddSectionOpen(false)}>
                  <Text style={[styles.primaryBtnText, { color: C.textSecondary }]}>{t("إلغاء", "Cancel")}</Text>
                </Pressable>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Edit Section Modal ─────────────────────────────────── */}
      <Modal visible={!!editSectionTarget} transparent animationType="slide" onRequestClose={() => setEditSectionTarget(null)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
          <View style={styles.modalOverlay}>
            <ScrollView style={styles.modalBox} keyboardShouldPersistTaps="handled">
              <Text style={styles.modalTitle}>{t("تعديل القسم", "Edit Section")}</Text>
              <Text style={styles.inputLabel}>{t("عنوان القسم (عربي) *", "Section Title (AR) *")}</Text>
              <TextInput style={styles.input} value={sectionForm.titleAr} onChangeText={v => setSectionForm(f => ({ ...f, titleAr: v }))} textAlign="right" />
              <Text style={styles.inputLabel}>{t("Section Title (EN) *", "Section Title (EN) *")}</Text>
              <TextInput style={styles.input} value={sectionForm.title} onChangeText={v => setSectionForm(f => ({ ...f, title: v }))} />
              <Text style={styles.inputLabel}>{t("الوصف", "Description")}</Text>
              <TextInput style={[styles.input, { height: 60 }]} multiline value={sectionForm.descriptionAr} onChangeText={v => setSectionForm(f => ({ ...f, descriptionAr: v }))} textAlign="right" />
              <View style={[styles.modalBtns, { marginBottom: 30 }]}>
                <Pressable style={[styles.primaryBtn, { flex: 1 }]} onPress={handleEditSection}>
                  <Text style={styles.primaryBtnText}>{t("حفظ", "Save")}</Text>
                </Pressable>
                <Pressable style={[styles.outlineBtn, { flex: 1 }]} onPress={() => setEditSectionTarget(null)}>
                  <Text style={[styles.primaryBtnText, { color: C.textSecondary }]}>{t("إلغاء", "Cancel")}</Text>
                </Pressable>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Add Lesson Modal ───────────────────────────────────── */}
      <Modal visible={!!addLessonSectionId} transparent animationType="slide" onRequestClose={() => setAddLessonSectionId(null)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
          <View style={styles.modalOverlay}>
            <ScrollView style={[styles.modalBox, { maxHeight: "85%" }]} keyboardShouldPersistTaps="handled">
              <Text style={styles.modalTitle}>{t("إضافة درس جديد", "Add New Lesson")}</Text>
              <Text style={styles.inputLabel}>{t("عنوان الدرس (عربي) *", "Lesson Title (AR) *")}</Text>
              <TextInput style={styles.input} value={lessonForm.titleAr} onChangeText={v => setLessonForm(f => ({ ...f, titleAr: v }))} placeholder={t("مثال: ما هو الجبر؟", "e.g. What is Algebra?")} textAlign="right" />
              <Text style={styles.inputLabel}>{t("Lesson Title (EN) *", "Lesson Title (EN) *")}</Text>
              <TextInput style={styles.input} value={lessonForm.title} onChangeText={v => setLessonForm(f => ({ ...f, title: v }))} placeholder="e.g. What is Algebra?" />
              <Text style={styles.inputLabel}>{t("نوع الدرس", "Lesson Type")}</Text>
              <View style={{ flexDirection: "row-reverse", gap: 8, marginBottom: 10 }}>
                {(["video", "text"] as const).map(tp => (
                  <Pressable
                    key={tp}
                    style={[styles.typeChip, lessonForm.type === tp && styles.typeChipActive]}
                    onPress={() => setLessonForm(f => ({ ...f, type: tp }))}
                  >
                    <Feather name={tp === "video" ? "play-circle" : "file-text"} size={14} color={lessonForm.type === tp ? "#fff" : C.textSecondary} />
                    <Text style={[styles.typeChipText, lessonForm.type === tp && { color: "#fff" }]}>{tp === "video" ? t("فيديو", "Video") : t("نص", "Text")}</Text>
                  </Pressable>
                ))}
              </View>

              {/* Video Upload Section */}
              {lessonForm.type === "video" && (
                <>
                  <Text style={styles.inputLabel}>{t("رفع فيديو (HD أو أعلى)", "Upload Video (HD or higher)")}</Text>
                  <Pressable style={styles.uploadBtn} onPress={pickVideo}>
                    <Feather name="upload" size={18} color={C.tint} />
                    <Text style={styles.uploadBtnText}>
                      {videoFile ? videoFile.name : (lessonForm.videoFilePath ? t("✓ فيديو مرفوع - اضغط للتغيير", "✓ Video uploaded - tap to change") : t("اختر ملف فيديو", "Pick Video File"))}
                    </Text>
                  </Pressable>
                  {videoFile && (
                    <Text style={styles.fileInfo}>
                      {(videoFile.size ? (videoFile.size / (1024 * 1024)).toFixed(1) : "?")} MB
                    </Text>
                  )}
                </>
              )}

              {/* Document Upload Section */}
              {lessonForm.type === "text" && (
                <>
                  <Text style={styles.inputLabel}>{t("رفع مستند (PDF / Word)", "Upload Document (PDF / Word)")}</Text>
                  <Pressable style={styles.uploadBtn} onPress={pickDocument}>
                    <Feather name="paperclip" size={18} color={C.tint} />
                    <Text style={styles.uploadBtnText}>
                      {documentFile ? documentFile.name : (lessonForm.documentFileName ? `✓ ${lessonForm.documentFileName}` : t("اختر مستند", "Pick Document"))}
                    </Text>
                  </Pressable>
                  {documentFile && (
                    <Text style={styles.fileInfo}>
                      {(documentFile.size ? (documentFile.size / (1024 * 1024)).toFixed(1) : "?")} MB
                    </Text>
                  )}
                </>
              )}

              <Text style={styles.inputLabel}>{t("رابط مرجعي (اختياري)", "Reference Link (optional)")}</Text>
              <TextInput style={styles.input} value={lessonForm.videoUrl} onChangeText={v => setLessonForm(f => ({ ...f, videoUrl: v }))} placeholder="https://example.com/..." />
              <Text style={[styles.fileInfo, { marginBottom: 6 }]}>{t("رابط خارجي لمعلومات إضافية", "External link for additional info")}</Text>

              {/* ── Lesson Metadata ───────────────────────────────────── */}
              <View style={styles.metadataBox}>
                <Text style={styles.metadataTitle}>{t("بيانات الدرس (للبحث)", "Lesson Metadata (Search)")}</Text>
                
                <Text style={styles.inputLabel}>{t("اسم الكتاب (عربي)", "Book Name (AR)")}</Text>
                <TextInput style={styles.input} value={lessonForm.bookNameAr} onChangeText={v => setLessonForm(f => ({ ...f, bookNameAr: v }))} placeholder={t("مثال: الرياضيات الصف الثالث", "e.g. Math Grade 3")} textAlign="right" />
                
                <Text style={styles.inputLabel}>{t("Book Name (EN)", "Book Name (EN)")}</Text>
                <TextInput style={styles.input} value={lessonForm.bookName} onChangeText={v => setLessonForm(f => ({ ...f, bookName: v }))} placeholder="e.g. Math Grade 3" />
                
                <View style={{ flexDirection: "row-reverse", gap: 8 }}>
                  <View style={{ flex: 1 }}>
                     <Text style={styles.inputLabel}>{t("السنة الدراسية", "School Year")}</Text>
                     <TextInput style={styles.input} value={lessonForm.schoolYear} onChangeText={v => setLessonForm(f => ({ ...f, schoolYear: v }))} placeholder={t("مثال: 3-primary", "e.g. 3-primary")} textAlign="right" />
                  </View>
                  <View style={{ flex: 1 }}>
                     <Text style={styles.inputLabel}>{t("الفصل", "Chapter")}</Text>
                     <TextInput style={styles.input} value={lessonForm.chapter} onChangeText={v => setLessonForm(f => ({ ...f, chapter: v }))} placeholder={t("الفصل 3", "Chapter 3")} textAlign="right" />
                  </View>
                  <View style={{ flex: 1 }}>
                     <Text style={styles.inputLabel}>{t("الصفحة", "Page")}</Text>
                     <TextInput style={styles.input} value={lessonForm.pageNumber} onChangeText={v => setLessonForm(f => ({ ...f, pageNumber: v }))} keyboardType="numeric" placeholder="42" textAlign="center" />
                  </View>
                </View>

                <Text style={styles.inputLabel}>{t("الكلمات المفتاحية", "Subject Tags")}</Text>
                <TextInput style={styles.input} value={lessonForm.subjectTags} onChangeText={v => setLessonForm(f => ({ ...f, subjectTags: v }))} placeholder={t("مفصولة بفاصلة (جبر، معادلات)", "Comma separated tags")} textAlign="right" />
              </View>

              <Text style={styles.inputLabel}>{t("المحتوى / الملاحظات", "Content / Notes")}</Text>
              <TextInput style={[styles.input, { height: 60 }]} multiline value={lessonForm.contentAr} onChangeText={v => setLessonForm(f => ({ ...f, contentAr: v }))} placeholder={t("ملاحظات إضافية...", "Additional notes...")} textAlign="right" />
              <View style={{ flexDirection: "row", gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>{t("المدة (ثواني)", "Duration (sec)")}</Text>
                  <TextInput style={styles.input} value={lessonForm.duration} onChangeText={v => setLessonForm(f => ({ ...f, duration: v }))} keyboardType="numeric" placeholder="600" />
                </View>
                <Pressable style={{ flex: 1, justifyContent: "flex-end" }} onPress={() => setLessonForm(f => ({ ...f, isFree: !f.isFree }))}>
                  <View style={[styles.freeToggle, lessonForm.isFree && styles.freeToggleActive]}>
                    <Feather name={lessonForm.isFree ? "check-square" : "square"} size={16} color={lessonForm.isFree ? C.tint : C.textMuted} />
                    <Text style={[styles.freeToggleText, lessonForm.isFree && { color: C.tint }]}>{t("معاينة مجانية", "Free Preview")}</Text>
                  </View>
                </Pressable>
              </View>

              {/* Upload progress */}
              {uploading && (
                <View style={styles.uploadingBar}>
                  <ActivityIndicator size="small" color={C.tint} />
                  <Text style={styles.uploadingText}>{uploadProgress}</Text>
                </View>
              )}

              <View style={[styles.modalBtns, { marginBottom: 30 }]}>
                <Pressable style={[styles.primaryBtn, { flex: 1, opacity: uploading ? 0.6 : 1 }]} onPress={handleAddLesson} disabled={uploading}>
                  <Text style={styles.primaryBtnText}>{uploading ? t("جاري الرفع...", "Uploading...") : t("إضافة الدرس", "Add Lesson")}</Text>
                </Pressable>
                <Pressable style={[styles.outlineBtn, { flex: 1 }]} onPress={() => setAddLessonSectionId(null)} disabled={uploading}>
                  <Text style={[styles.primaryBtnText, { color: C.textSecondary }]}>{t("إلغاء", "Cancel")}</Text>
                </Pressable>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Edit Lesson Modal ──────────────────────────────────── */}
      <Modal visible={!!editLessonTarget} transparent animationType="slide" onRequestClose={() => setEditLessonTarget(null)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
          <View style={styles.modalOverlay}>
            <ScrollView style={[styles.modalBox, { maxHeight: "85%" }]} keyboardShouldPersistTaps="handled">
            <Text style={styles.modalTitle}>{t("تعديل الدرس", "Edit Lesson")}</Text>
            <Text style={styles.inputLabel}>{t("عنوان الدرس (عربي) *", "Lesson Title (AR) *")}</Text>
            <TextInput style={styles.input} value={lessonForm.titleAr} onChangeText={v => setLessonForm(f => ({ ...f, titleAr: v }))} textAlign="right" />
            <Text style={styles.inputLabel}>{t("Lesson Title (EN) *", "Lesson Title (EN) *")}</Text>
            <TextInput style={styles.input} value={lessonForm.title} onChangeText={v => setLessonForm(f => ({ ...f, title: v }))} />
            {/* Video Upload Section */}
            {lessonForm.type === "video" && (
              <>
                <Text style={styles.inputLabel}>{t("رفع فيديو (HD أو أعلى)", "Upload Video (HD or higher)")}</Text>
                <Pressable style={styles.uploadBtn} onPress={pickVideo}>
                  <Feather name="upload" size={18} color={C.tint} />
                  <Text style={styles.uploadBtnText}>
                    {videoFile ? videoFile.name : (lessonForm.videoFilePath ? t("✓ فيديو مرفوع - اضغط للتغيير", "✓ Video uploaded - tap to change") : t("اختر ملف فيديو", "Pick Video File"))}
                  </Text>
                </Pressable>
                {videoFile && (
                  <Text style={styles.fileInfo}>{(videoFile.size ? (videoFile.size / (1024 * 1024)).toFixed(1) : "?")} MB</Text>
                )}
              </>
            )}

            {/* Document Upload Section */}
            {lessonForm.type === "text" && (
              <>
                <Text style={styles.inputLabel}>{t("رفع مستند (PDF / Word)", "Upload Document (PDF / Word)")}</Text>
                <Pressable style={styles.uploadBtn} onPress={pickDocument}>
                  <Feather name="paperclip" size={18} color={C.tint} />
                  <Text style={styles.uploadBtnText}>
                    {documentFile ? documentFile.name : (lessonForm.documentFileName ? `✓ ${lessonForm.documentFileName}` : t("اختر مستند", "Pick Document"))}
                  </Text>
                </Pressable>
                {documentFile && (
                  <Text style={styles.fileInfo}>{(documentFile.size ? (documentFile.size / (1024 * 1024)).toFixed(1) : "?")} MB</Text>
                )}
              </>
            )}

            <Text style={styles.inputLabel}>{t("رابط مرجعي (اختياري)", "Reference Link (optional)")}</Text>
            <TextInput style={styles.input} value={lessonForm.videoUrl} onChangeText={v => setLessonForm(f => ({ ...f, videoUrl: v }))} placeholder="https://example.com/..." />
            <Text style={[styles.fileInfo, { marginBottom: 6 }]}>{t("رابط خارجي لمعلومات إضافية", "External link for additional info")}</Text>

            {/* ── Lesson Metadata ───────────────────────────────────── */}
            <View style={styles.metadataBox}>
              <Text style={styles.metadataTitle}>{t("بيانات الدرس (للبحث)", "Lesson Metadata (Search)")}</Text>
              
              <Text style={styles.inputLabel}>{t("اسم الكتاب (عربي)", "Book Name (AR)")}</Text>
              <TextInput style={styles.input} value={lessonForm.bookNameAr} onChangeText={v => setLessonForm(f => ({ ...f, bookNameAr: v }))} placeholder={t("مثال: الرياضيات الصف الثالث", "e.g. Math Grade 3")} textAlign="right" />
              
              <Text style={styles.inputLabel}>{t("Book Name (EN)", "Book Name (EN)")}</Text>
              <TextInput style={styles.input} value={lessonForm.bookName} onChangeText={v => setLessonForm(f => ({ ...f, bookName: v }))} placeholder="e.g. Math Grade 3" />
              
              <View style={{ flexDirection: "row-reverse", gap: 8 }}>
                <View style={{ flex: 1 }}>
                   <Text style={styles.inputLabel}>{t("السنة الدراسية", "School Year")}</Text>
                   <TextInput style={styles.input} value={lessonForm.schoolYear} onChangeText={v => setLessonForm(f => ({ ...f, schoolYear: v }))} placeholder={t("مثال: 3-primary", "e.g. 3-primary")} textAlign="right" />
                </View>
                <View style={{ flex: 1 }}>
                   <Text style={styles.inputLabel}>{t("الفصل", "Chapter")}</Text>
                   <TextInput style={styles.input} value={lessonForm.chapter} onChangeText={v => setLessonForm(f => ({ ...f, chapter: v }))} placeholder={t("الفصل 3", "Chapter 3")} textAlign="right" />
                </View>
                <View style={{ flex: 1 }}>
                   <Text style={styles.inputLabel}>{t("الصفحة", "Page")}</Text>
                   <TextInput style={styles.input} value={lessonForm.pageNumber} onChangeText={v => setLessonForm(f => ({ ...f, pageNumber: v }))} keyboardType="numeric" placeholder="42" textAlign="center" />
                </View>
              </View>

              <Text style={styles.inputLabel}>{t("الكلمات المفتاحية", "Subject Tags")}</Text>
              <TextInput style={styles.input} value={lessonForm.subjectTags} onChangeText={v => setLessonForm(f => ({ ...f, subjectTags: v }))} placeholder={t("مفصولة بفاصلة (جبر، معادلات)", "Comma separated tags")} textAlign="right" />
            </View>

            <Text style={styles.inputLabel}>{t("المحتوى / الملاحظات", "Content / Notes")}</Text>
            <TextInput style={[styles.input, { height: 60 }]} multiline value={lessonForm.contentAr} onChangeText={v => setLessonForm(f => ({ ...f, contentAr: v }))} textAlign="right" />
            <View style={{ flexDirection: "row", gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.inputLabel}>{t("المدة (ثواني)", "Duration (sec)")}</Text>
                <TextInput style={styles.input} value={lessonForm.duration} onChangeText={v => setLessonForm(f => ({ ...f, duration: v }))} keyboardType="numeric" />
              </View>
              <Pressable style={{ flex: 1, justifyContent: "flex-end" }} onPress={() => setLessonForm(f => ({ ...f, isFree: !f.isFree }))}>
                <View style={[styles.freeToggle, lessonForm.isFree && styles.freeToggleActive]}>
                  <Feather name={lessonForm.isFree ? "check-square" : "square"} size={16} color={lessonForm.isFree ? C.tint : C.textMuted} />
                  <Text style={[styles.freeToggleText, lessonForm.isFree && { color: C.tint }]}>{t("معاينة مجانية", "Free Preview")}</Text>
                </View>
              </Pressable>
            </View>

            {uploading && (
              <View style={styles.uploadingBar}>
                <ActivityIndicator size="small" color={C.tint} />
                <Text style={styles.uploadingText}>{uploadProgress}</Text>
              </View>
            )}

            <View style={[styles.modalBtns, { marginBottom: 30 }]}>
              <Pressable style={[styles.primaryBtn, { flex: 1, opacity: uploading ? 0.6 : 1 }]} onPress={handleEditLesson} disabled={uploading}>
                <Text style={styles.primaryBtnText}>{uploading ? t("جاري الرفع...", "Uploading...") : t("حفظ التعديلات", "Save Changes")}</Text>
              </Pressable>
              <Pressable style={[styles.outlineBtn, { flex: 1 }]} onPress={() => setEditLessonTarget(null)} disabled={uploading}>
                <Text style={[styles.primaryBtnText, { color: C.textSecondary }]}>{t("إلغاء", "Cancel")}</Text>
              </Pressable>
            </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
  header: { paddingHorizontal: 20, paddingBottom: 16 },
  backBtn: { flexDirection: "row-reverse", alignItems: "center", gap: 6, marginBottom: 12 },
  backText: { fontFamily: "Inter_600SemiBold", fontSize: 14, color: C.text },
  headerTitle: { fontFamily: "Inter_700Bold", fontSize: 24, color: C.text, textAlign: "right", lineHeight: 32 },
  headerSubtitle: { fontFamily: "Inter_400Regular", fontSize: 13, color: C.textSecondary, marginTop: 2 },
  statsRow: { flexDirection: "row-reverse", backgroundColor: C.card, borderRadius: 16, padding: 14, marginTop: 14, borderWidth: 1, borderColor: C.cardBorder },
  stat: { flex: 1, alignItems: "center" },
  statValue: { fontFamily: "Inter_700Bold", fontSize: 22, color: C.tint },
  statLabel: { fontFamily: "Inter_400Regular", fontSize: 11, color: C.textMuted, marginTop: 2 },
  statDivider: { width: 1, backgroundColor: C.cardBorder, marginHorizontal: 8 },
  primaryBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: C.tint, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 16 },
  primaryBtnText: { fontFamily: "Inter_600SemiBold", fontSize: 14, color: "#fff" },
  outlineBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 16, borderWidth: 1.5, borderColor: C.tint },
  warningBar: { flexDirection: "row-reverse", alignItems: "center", gap: 8, backgroundColor: "#FFFBEB", marginHorizontal: 20, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: "#FCD34D" },
  warningText: { fontFamily: "Inter_500Medium", fontSize: 12, color: "#92400E", flex: 1, textAlign: "right" },
  emptyBox: { alignItems: "center", marginTop: 40, gap: 8 },
  emptyTitle: { fontFamily: "Inter_600SemiBold", fontSize: 17, color: C.text },
  emptySubtitle: { fontFamily: "Inter_400Regular", fontSize: 13, color: C.textSecondary },
  sectionCard: { backgroundColor: C.card, borderRadius: 18, borderWidth: 1, borderColor: C.cardBorder, overflow: "hidden" },
  sectionHeader: { flexDirection: "row-reverse", alignItems: "center", padding: 14, gap: 10 },
  sectionNum: { width: 30, height: 30, borderRadius: 10, backgroundColor: `${C.tint}15`, alignItems: "center", justifyContent: "center" },
  sectionNumText: { fontFamily: "Inter_700Bold", fontSize: 14, color: C.tint },
  sectionTitle: { fontFamily: "Inter_700Bold", fontSize: 15, color: C.text, textAlign: "right" },
  sectionMeta: { fontFamily: "Inter_400Regular", fontSize: 11, color: C.textMuted, textAlign: "right" },
  iconBtn: { width: 30, height: 30, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  lessonsList: { borderTopWidth: 1, borderTopColor: C.cardBorder, padding: 14, gap: 8 },
  noLessonsText: { fontFamily: "Inter_400Regular", fontSize: 13, color: C.textMuted, textAlign: "center", paddingVertical: 12 },
  lessonRow: { flexDirection: "row-reverse", alignItems: "center", gap: 10, backgroundColor: `${C.tint}08`, borderRadius: 12, padding: 10 },
  lessonIcon: { width: 28, height: 28, borderRadius: 8, backgroundColor: `${C.tint}15`, alignItems: "center", justifyContent: "center" },
  lessonTitle: { fontFamily: "Inter_600SemiBold", fontSize: 13, color: C.text, textAlign: "right" },
  freeBadge: { fontFamily: "Inter_500Medium", fontSize: 10, color: "#3B82F6", backgroundColor: "#EFF6FF", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, alignSelf: "flex-end", marginTop: 2 },
  addLessonBtn: { flexDirection: "row-reverse", alignItems: "center", justifyContent: "center", gap: 6, borderWidth: 1.5, borderColor: C.tint, borderStyle: "dashed", borderRadius: 12, paddingVertical: 10 },
  addLessonText: { fontFamily: "Inter_600SemiBold", fontSize: 13, color: C.tint },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalBox: { backgroundColor: C.background, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24 },
  modalTitle: { fontFamily: "Inter_700Bold", fontSize: 20, color: C.text, textAlign: "right", marginBottom: 14 },
  inputLabel: { fontFamily: "Inter_600SemiBold", fontSize: 13, color: C.textSecondary, textAlign: "right", marginBottom: 4, marginTop: 10 },
  input: { backgroundColor: C.pill, borderRadius: 12, padding: 12, fontFamily: "Inter_400Regular", fontSize: 14, color: C.text, borderWidth: 1, borderColor: C.cardBorder, marginBottom: 4 },
  modalBtns: { flexDirection: "row-reverse", gap: 10, marginTop: 16 },
  typeChip: { flex: 1, flexDirection: "row-reverse", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 10, borderRadius: 10, backgroundColor: C.pill },
  typeChipActive: { backgroundColor: C.tint },
  typeChipText: { fontFamily: "Inter_600SemiBold", fontSize: 13, color: C.textSecondary },
  freeToggle: { flexDirection: "row-reverse", alignItems: "center", gap: 6, padding: 12, borderRadius: 12, backgroundColor: C.pill },
  freeToggleActive: { backgroundColor: `${C.tint}10` },
  freeToggleText: { fontFamily: "Inter_500Medium", fontSize: 13, color: C.textMuted },
  uploadBtn: { flexDirection: "row-reverse", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: `${C.tint}12`, borderRadius: 12, paddingVertical: 14, borderWidth: 1.5, borderColor: C.tint, borderStyle: "dashed", marginBottom: 4 },
  uploadBtnText: { fontFamily: "Inter_600SemiBold", fontSize: 13, color: C.tint },
  fileInfo: { fontFamily: "Inter_400Regular", fontSize: 11, color: C.textMuted, textAlign: "right", marginBottom: 2 },
  uploadingBar: { flexDirection: "row-reverse", alignItems: "center", gap: 10, backgroundColor: `${C.tint}10`, borderRadius: 12, padding: 12, marginTop: 8 },
  uploadingText: { fontFamily: "Inter_500Medium", fontSize: 13, color: C.tint },
  metadataBox: { backgroundColor: `${C.tint}05`, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: `${C.tint}20`, marginVertical: 10, gap: 4 },
  metadataTitle: { fontFamily: "Inter_700Bold", fontSize: 13, color: C.tint, textAlign: "right" },
});
