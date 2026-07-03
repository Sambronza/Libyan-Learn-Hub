import React, { useState } from "react";
import {
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  Alert,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import Colors from "@/constants/colors";
import { useApi } from "@/hooks/useApi";
import { useAuth } from "@/contexts/AuthContext";

const C = Colors.light;

interface ReportModalProps {
  visible: boolean;
  onClose: () => void;
  type: "course" | "lesson" | "teacher" | "session";
  targetId: number;
}

const REASONS = [
  { value: "inappropriate", label: "محتوى غير لائق" },
  { value: "spam", label: "بريد مزعج أو احتيال" },
  { value: "harassment", label: "مضايقة أو تنمر" },
  { value: "quality", label: "جودة رديئة جداً" },
  { value: "wrong_category", label: "في غير مكانه الصحيح" },
  { value: "other", label: "سبب آخر" },
];

export function ReportModal({ visible, onClose, type, targetId }: ReportModalProps) {
  const { apiFetch } = useApi();
  const { user } = useAuth();
  const [reason, setReason] = useState(REASONS[0].value);
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!user) {
      Alert.alert("تنبيه", "يجب تسجيل الدخول لتقديم بلاغ");
      return;
    }
    setLoading(true);
    try {
      await apiFetch("/reports", {
        method: "POST",
        body: JSON.stringify({
          type,
          reason,
          description,
          reportedCourseId: type === "course" ? targetId : undefined,
          reportedLessonId: type === "lesson" ? targetId : undefined,
          reportedSessionId: type === "session" ? targetId : undefined,
          reportedUserId: type === "teacher" ? targetId : undefined,
        }),
      });
      Alert.alert("تم الإرسال", "تم رفع بلاغك للإدارة بنجاح. شكراً لك.");
      onClose();
      setDescription("");
      setReason(REASONS[0].value);
    } catch (err: any) {
      Alert.alert("خطأ", err.message || "فشل تقديم البلاغ");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.box}>
          <View style={styles.header}>
            <Text style={styles.title}>الإبلاغ عن محتوى</Text>
            <Pressable onPress={onClose} style={styles.closeBtn}>
              <Feather name="x" size={20} color={C.textMuted} />
            </Pressable>
          </View>

          <Text style={styles.label}>اختر سبب الإبلاغ:</Text>
          <View style={styles.reasonWrap}>
            {REASONS.map((r) => (
              <Pressable
                key={r.value}
                style={[styles.reasonChip, reason === r.value && styles.reasonChipActive]}
                onPress={() => setReason(r.value)}
              >
                <Text style={[styles.reasonText, reason === r.value && styles.reasonTextActive]}>
                  {r.label}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.label}>تفاصيل إضافية (اختياري):</Text>
          <TextInput
            style={styles.input}
            multiline
            numberOfLines={4}
            value={description}
            onChangeText={setDescription}
            placeholder="اكتب أي تفاصيل أخرى قد تساعدنا..."
            textAlign="right"
          />

          <View style={styles.footer}>
            <Pressable
              style={[styles.submitBtn, loading && { opacity: 0.7 }]}
              onPress={handleSubmit}
              disabled={loading}
            >
              <Text style={styles.submitBtnText}>{loading ? "جاري الإرسال..." : "إرسال البلاغ"}</Text>
            </Pressable>
            <Pressable style={styles.cancelBtn} onPress={onClose}>
              <Text style={styles.cancelBtnText}>إلغاء</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  box: {
    backgroundColor: C.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: Platform.OS === "ios" ? 40 : 24,
  },
  header: {
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  title: { fontFamily: "Inter_700Bold", fontSize: 18, color: C.text },
  closeBtn: { padding: 4 },
  label: { fontFamily: "Inter_600SemiBold", fontSize: 14, color: C.text, textAlign: "right", marginBottom: 10 },
  reasonWrap: {
    flexDirection: "row-reverse",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 20,
  },
  reasonChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: C.pill,
    borderWidth: 1,
    borderColor: "transparent",
  },
  reasonChipActive: {
    backgroundColor: `${C.tint}15`,
    borderColor: C.tint,
  },
  reasonText: { fontFamily: "Inter_500Medium", fontSize: 13, color: C.textSecondary },
  reasonTextActive: { color: C.tint },
  input: {
    backgroundColor: C.pill,
    borderRadius: 12,
    padding: 14,
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: C.text,
    minHeight: 100,
    textAlignVertical: "top",
    borderWidth: 1,
    borderColor: C.cardBorder,
    marginBottom: 20,
  },
  footer: { flexDirection: "row", gap: 10 },
  submitBtn: {
    flex: 2,
    backgroundColor: C.tint,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  submitBtnText: { fontFamily: "Inter_600SemiBold", fontSize: 15, color: "#fff" },
  cancelBtn: {
    flex: 1,
    backgroundColor: C.pill,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  cancelBtnText: { fontFamily: "Inter_600SemiBold", fontSize: 15, color: C.textSecondary },
});
