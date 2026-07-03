import React, { useState, useRef, useEffect } from "react";
import {
  ActivityIndicator, Alert, Platform, Pressable, ScrollView,
  StyleSheet, Text, TextInput, View,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import Colors from "@/constants/colors";
import { useApi } from "@/hooks/useApi";
import * as DocumentPicker from "expo-document-picker";

const C = Colors.light;

interface Props {
  onComplete: () => void;
}

export default function TeacherOnboarding({ onComplete }: Props) {
  const { apiFetch } = useApi();
  const [step, setStep] = useState(1);
  const [copyrightChecked, setCopyrightChecked] = useState(false);
  const [bio, setBio] = useState("");
  const [bioAr, setBioAr] = useState("");
  const [expertise, setExpertise] = useState("");
  const [loading, setLoading] = useState(false);

  // Step 1: Copyright agreement
  const handleCopyrightAgree = async () => {
    setLoading(true);
    try {
      await apiFetch("/teacher-profile/copyright-agree", { method: "POST", body: JSON.stringify({}) });
      setStep(2);
    } catch (err: any) {
      Alert.alert("خطأ", err.message);
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Face photo — on mobile we use expo-camera or gallery
  const handleFaceCapture = async () => {
    setLoading(true);
    try {
      // Use document picker as a simpler alternative (works on all platforms)
      const result = await DocumentPicker.getDocumentAsync({ type: "image/*" });
      if (result.canceled || !result.assets?.[0]) { setLoading(false); return; }
      const file = result.assets[0];

      const formData = new FormData();
      formData.append("photo", {
        uri: file.uri,
        name: file.name || "face.jpg",
        type: file.mimeType || "image/jpeg",
      } as any);

      await apiFetch("/teacher-profile/face-capture", {
        method: "POST",
        body: formData,
        headers: {} as any,
      });
      setStep(3);
    } catch (err: any) {
      Alert.alert("خطأ", err.message);
    } finally {
      setLoading(false);
    }
  };

  // Step 3: Profile setup
  const handleProfileComplete = async () => {
    setLoading(true);
    try {
      await apiFetch("/teacher-profile", {
        method: "PUT",
        body: JSON.stringify({ bio, bioAr, expertise }),
      });
      await apiFetch("/teacher-profile/complete-onboarding", {
        method: "POST",
        body: JSON.stringify({}),
      });
      Alert.alert("تم!", "تم إكمال الإعداد بنجاح", [{ text: "حسناً", onPress: onComplete }]);
    } catch (err: any) {
      Alert.alert("خطأ", err.message);
    } finally {
      setLoading(false);
    }
  };

  const stepLabels = ["حقوق النشر", "صورة الوجه", "الملف الشخصي"];

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Progress */}
        <View style={styles.progressRow}>
          {[1, 2, 3].map(s => (
            <React.Fragment key={s}>
              {s > 1 && <View style={[styles.progressLine, s <= step && styles.progressLineDone]} />}
              <View style={styles.stepCol}>
                <View style={[styles.stepCircle, s < step && styles.stepDone, s === step && styles.stepCurrent]}>
                  {s < step ? (
                    <Feather name="check" size={16} color="#fff" />
                  ) : (
                    <Text style={[styles.stepNum, s === step && { color: C.tint }]}>{s}</Text>
                  )}
                </View>
                <Text style={styles.stepLabel}>{stepLabels[s - 1]}</Text>
              </View>
            </React.Fragment>
          ))}
        </View>

        {/* Step 1: Copyright */}
        {step === 1 && (
          <View style={styles.card}>
            <Feather name="shield" size={40} color={C.tint} style={{ alignSelf: "center", marginBottom: 16 }} />
            <Text style={styles.cardTitle}>إقرار حقوق النشر</Text>
            <Text style={styles.cardSubtitle}>يرجى قراءة والموافقة على الإقرار التالي قبل المتابعة</Text>

            <View style={styles.copyrightBox}>
              <Text style={styles.copyrightText}>
                أقر وأتعهد بأن جميع المواد التعليمية التي أقوم برفعها على هذه المنصة، بما في ذلك الفيديوهات والمستندات والاختبارات، هي من إعدادي الشخصي ولا تنتهك حقوق أي طرف آخر.
              </Text>
              <Text style={styles.copyrightText}>
                أتحمل المسؤولية الكاملة عن أي مطالبات تتعلق بحقوق النشر أو الملكية الفكرية الناتجة عن المحتوى الذي أقوم برفعه.
              </Text>
              <Text style={[styles.copyrightText, { fontFamily: "Inter_700Bold" }]}>
                في حالة ثبوت انتهاك حقوق النشر، يحق للمنصة حذف المحتوى وتعليق حسابي فوراً.
              </Text>
            </View>

            <Pressable style={styles.checkboxRow} onPress={() => setCopyrightChecked(!copyrightChecked)}>
              <Feather name={copyrightChecked ? "check-square" : "square"} size={20} color={copyrightChecked ? C.tint : C.textMuted} />
              <Text style={styles.checkboxText}>أوافق على الإقرار وأتحمل المسؤولية الكاملة</Text>
            </Pressable>

            <Pressable style={[styles.primaryBtn, !copyrightChecked && { opacity: 0.5 }]} disabled={!copyrightChecked || loading} onPress={handleCopyrightAgree}>
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>أوافق وأتابع</Text>}
            </Pressable>
          </View>
        )}

        {/* Step 2: Face Capture */}
        {step === 2 && (
          <View style={styles.card}>
            <Feather name="camera" size={40} color={C.tint} style={{ alignSelf: "center", marginBottom: 16 }} />
            <Text style={styles.cardTitle}>تصوير الوجه للتحقق</Text>
            <Text style={styles.cardSubtitle}>سيتم استخدام هذه الصورة داخلياً للتحقق من هويتك. لن تظهر في ملفك الشخصي.</Text>

            <Pressable style={styles.primaryBtn} disabled={loading} onPress={handleFaceCapture}>
              {loading ? <ActivityIndicator color="#fff" /> : (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Feather name="camera" size={18} color="#fff" />
                  <Text style={styles.primaryBtnText}>اختر أو التقط صورة</Text>
                </View>
              )}
            </Pressable>
          </View>
        )}

        {/* Step 3: Profile */}
        {step === 3 && (
          <View style={styles.card}>
            <Feather name="user" size={40} color={C.tint} style={{ alignSelf: "center", marginBottom: 16 }} />
            <Text style={styles.cardTitle}>إعداد الملف الشخصي</Text>
            <Text style={styles.cardSubtitle}>أكمل معلومات ملفك الشخصي ليراها الطلاب</Text>

            <View style={styles.field}>
              <Text style={styles.fieldLabel}>نبذة عنك (عربي)</Text>
              <TextInput style={[styles.textInput, { height: 80, textAlignVertical: "top" }]} value={bioAr} onChangeText={setBioAr}
                placeholder="اكتب نبذة مختصرة عنك..." multiline textAlign="right" />
            </View>
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>نبذة عنك (إنجليزي)</Text>
              <TextInput style={[styles.textInput, { height: 80, textAlignVertical: "top" }]} value={bio} onChangeText={setBio}
                placeholder="Write a short bio in English..." multiline textAlign="left" />
            </View>
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>التخصص</Text>
              <TextInput style={styles.textInput} value={expertise} onChangeText={setExpertise}
                placeholder="مثال: رياضيات، فيزياء" textAlign="right" />
            </View>

            <Pressable style={styles.primaryBtn} disabled={loading} onPress={handleProfileComplete}>
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>إكمال الإعداد</Text>}
            </Pressable>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
  scroll: { padding: 20, paddingTop: 60 },
  progressRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", marginBottom: 30, gap: 0 },
  progressLine: { width: 40, height: 2, backgroundColor: C.cardBorder, borderRadius: 1 },
  progressLineDone: { backgroundColor: C.tint },
  stepCol: { alignItems: "center", gap: 4 },
  stepCircle: { width: 36, height: 36, borderRadius: 18, backgroundColor: C.backgroundSecondary, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: C.cardBorder },
  stepDone: { backgroundColor: C.tint, borderColor: C.tint },
  stepCurrent: { borderColor: C.tint, backgroundColor: `${C.tint}15` },
  stepNum: { fontFamily: "Inter_700Bold", fontSize: 14, color: C.textMuted },
  stepLabel: { fontFamily: "Inter_400Regular", fontSize: 10, color: C.textMuted },
  card: { backgroundColor: C.card, borderRadius: 20, padding: 24, borderWidth: 1, borderColor: C.cardBorder },
  cardTitle: { fontFamily: "Inter_700Bold", fontSize: 20, color: C.text, textAlign: "center", marginBottom: 6 },
  cardSubtitle: { fontFamily: "Inter_400Regular", fontSize: 13, color: C.textMuted, textAlign: "center", marginBottom: 20, lineHeight: 20 },
  copyrightBox: { backgroundColor: "#fffbeb", borderWidth: 1, borderColor: "#fcd34d", borderRadius: 12, padding: 14, gap: 8, marginBottom: 16 },
  copyrightText: { fontFamily: "Inter_400Regular", fontSize: 12, color: "#92400e", textAlign: "right", lineHeight: 18 },
  checkboxRow: { flexDirection: "row-reverse", alignItems: "center", gap: 8, paddingVertical: 10, marginBottom: 16 },
  checkboxText: { fontFamily: "Inter_500Medium", fontSize: 13, color: C.text, flex: 1, textAlign: "right" },
  primaryBtn: { backgroundColor: C.tint, borderRadius: 12, paddingVertical: 14, alignItems: "center", justifyContent: "center" },
  primaryBtnText: { fontFamily: "Inter_600SemiBold", fontSize: 15, color: "#fff" },
  field: { marginBottom: 14 },
  fieldLabel: { fontFamily: "Inter_500Medium", fontSize: 13, color: C.text, textAlign: "right", marginBottom: 6 },
  textInput: { backgroundColor: C.backgroundSecondary, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, fontFamily: "Inter_400Regular", color: C.text, borderWidth: 1, borderColor: C.cardBorder },
});
