import { Feather } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import React, { useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";

// Cast around the React 19 JSX class-component typing mismatch (same issue as
// BlurView/LinearGradient elsewhere in this app).
const Camera = CameraView as any;
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Colors from "@/constants/colors";
import { useAuth, DeviceSecurityError } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";

const C = Colors.light;

const POSES = [
  { id: "front", label: "انظر للأمام", labelEn: "Look straight" },
  { id: "left", label: "أدر رأسك لليسار", labelEn: "Look left" },
  { id: "right", label: "أدر رأسك لليمين", labelEn: "Look right" },
  { id: "up", label: "انظر للأعلى", labelEn: "Look up" },
  { id: "down", label: "انظر للأسفل", labelEn: "Look down" },
] as const;

/**
 * Face capture screen for student identity security.
 * mode=switch   — new-device face verification (params: email, password)
 * mode=reverify — periodic re-verification (params: email, password)
 * mode=enroll   — 5-pose face profile enrollment (requires logged-in session)
 * Photos are sent to the API; descriptors are extracted server-side.
 */
export default function FaceCaptureScreen() {
  const insets = useSafeAreaInsets();
  const { t } = useLanguage();
  const { deviceSwitchVerify, reverifyFace, enrollFace } = useAuth();
  const params = useLocalSearchParams<{ mode: string; email?: string; password?: string }>();
  const mode = (params.mode as "switch" | "reverify" | "enroll") || "enroll";

  const cameraRef = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [busy, setBusy] = useState(false);
  const [poseIndex, setPoseIndex] = useState(0);
  const [captures, setCaptures] = useState<Record<string, string>>({});

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const isEnroll = mode === "enroll";

  if (!permission) return <View style={styles.container} />;
  if (!permission.granted) {
    return (
      <View style={[styles.container, styles.center, { paddingTop: topPad }]}>
        <Feather name="camera-off" size={40} color={C.textMuted} />
        <Text style={styles.permText}>{t("نحتاج إذن الكاميرا للتحقق من هويتك", "We need camera access to verify your identity")}</Text>
        <Pressable style={styles.submitBtn} onPress={requestPermission}>
          <Text style={styles.submitBtnText}>{t("السماح بالكاميرا", "Allow Camera")}</Text>
        </Pressable>
      </View>
    );
  }

  async function takePhoto(): Promise<string | null> {
    if (!cameraRef.current) return null;
    const photo = await cameraRef.current.takePictureAsync({ base64: true, quality: 0.6 });
    return photo?.base64 ?? null;
  }

  async function handleVerifyCapture() {
    setBusy(true);
    try {
      const base64 = await takePhoto();
      if (!base64) throw new Error(t("فشل التقاط الصورة", "Failed to capture photo"));
      if (mode === "switch") {
        await deviceSwitchVerify(params.email || "", params.password || "", base64);
        Alert.alert(
          t("تم تأكيد هويتك ✓", "Identity confirmed ✓"),
          t("هذا الجهاز أصبح جهازك الموثوق وتم حظر جهازك السابق. سيُطلب منك التحقق من وجهك دوريًا خلال الأسبوعين القادمين.",
            "This device is now trusted and your previous device has been blocked. You'll be asked to re-verify periodically for two weeks."),
        );
      } else {
        await reverifyFace(params.email || "", params.password || "", base64);
      }
      router.replace("/(tabs)");
    } catch (e: any) {
      const msg = e instanceof DeviceSecurityError ? e.messageAr || e.message : e.message;
      Alert.alert(t("فشل التحقق", "Verification failed"), msg);
      if (e instanceof DeviceSecurityError && (e.code === "FACE_MISMATCH" || e.code === "ACCOUNT_BLOCKED")) {
        router.replace("/auth/login");
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleEnrollCapture() {
    setBusy(true);
    try {
      const base64 = await takePhoto();
      if (!base64) throw new Error(t("فشل التقاط الصورة", "Failed to capture photo"));
      const pose = POSES[poseIndex].id;
      const next = { ...captures, [pose]: base64 };
      setCaptures(next);

      if (poseIndex < POSES.length - 1) {
        setPoseIndex(poseIndex + 1);
      } else {
        // All 5 captured — submit for server-side descriptor extraction
        await enrollFace(next, `data:image/jpeg;base64,${next.front}`);
        Alert.alert(t("تم ✓", "Done ✓"), t("تم حفظ ملف الوجه الخاص بك بنجاح.", "Your face profile has been saved."));
        router.replace("/(tabs)");
      }
    } catch (e: any) {
      Alert.alert(t("خطأ", "Error"), e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="x" size={22} color={C.text} />
        </Pressable>
        <Text style={styles.headerTitle}>
          {isEnroll ? t("تسجيل ملف الوجه", "Face Profile Setup") : t("التحقق من الوجه", "Face Verification")}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <Text style={styles.hint}>
        {isEnroll
          ? `${t("الوضعية", "Pose")} ${poseIndex + 1}/5 — ${t(POSES[poseIndex].label, POSES[poseIndex].labelEn)}`
          : t("انظر إلى الكاميرا مباشرة ثم اضغط على زر الالتقاط", "Look directly at the camera, then tap capture")}
      </Text>

      <View style={styles.cameraWrap}>
        <Camera ref={cameraRef} style={styles.camera} facing="front" />
        <View style={styles.ovalGuide} pointerEvents="none" />
      </View>

      {isEnroll && (
        <View style={styles.poseRow}>
          {POSES.map((p, i) => (
            <View key={p.id} style={[styles.poseDot, captures[p.id] ? styles.poseDotDone : i === poseIndex ? styles.poseDotActive : null]}>
              {captures[p.id] ? <Feather name="check" size={12} color="#fff" /> : <Text style={styles.poseDotNum}>{i + 1}</Text>}
            </View>
          ))}
        </View>
      )}

      <Pressable
        style={({ pressed }) => [styles.submitBtn, pressed && { opacity: 0.85 }, busy && { opacity: 0.6 }]}
        onPress={isEnroll ? handleEnrollCapture : handleVerifyCapture}
        disabled={busy}
      >
        {busy ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <>
            <Feather name="camera" size={18} color="#fff" />
            <Text style={styles.submitBtnText}>
              {isEnroll ? t("التقاط الوضعية", "Capture Pose") : t("التقاط والتحقق", "Capture & Verify")}
            </Text>
          </>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background, paddingHorizontal: 20 },
  center: { alignItems: "center", justifyContent: "center", gap: 16 },
  header: { flexDirection: "row-reverse", alignItems: "center", justifyContent: "space-between", paddingVertical: 12 },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: C.backgroundSecondary, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontFamily: "Inter_700Bold", fontSize: 18, color: C.text },
  hint: { fontFamily: "Inter_600SemiBold", fontSize: 15, color: C.tint, textAlign: "center", marginVertical: 14 },
  cameraWrap: { width: "100%", aspectRatio: 3 / 4, borderRadius: 24, overflow: "hidden", backgroundColor: "#000" },
  camera: { flex: 1 },
  ovalGuide: {
    position: "absolute",
    top: "10%",
    bottom: "10%",
    left: "15%",
    right: "15%",
    borderWidth: 3,
    borderStyle: "dashed",
    borderColor: "rgba(255,255,255,0.6)",
    borderRadius: 999,
  },
  poseRow: { flexDirection: "row-reverse", justifyContent: "center", gap: 10, marginTop: 16 },
  poseDot: { width: 28, height: 28, borderRadius: 14, backgroundColor: C.backgroundSecondary, alignItems: "center", justifyContent: "center" },
  poseDotActive: { backgroundColor: C.tint + "40", borderWidth: 2, borderColor: C.tint },
  poseDotDone: { backgroundColor: "#22c55e" },
  poseDotNum: { fontFamily: "Inter_600SemiBold", fontSize: 12, color: C.textSecondary },
  permText: { fontFamily: "Inter_500Medium", fontSize: 14, color: C.textSecondary, textAlign: "center", paddingHorizontal: 30 },
  submitBtn: {
    flexDirection: "row-reverse",
    gap: 8,
    backgroundColor: C.tint,
    borderRadius: 14,
    height: 54,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 20,
  },
  submitBtnText: { fontFamily: "Inter_700Bold", fontSize: 16, color: "#fff" },
});
