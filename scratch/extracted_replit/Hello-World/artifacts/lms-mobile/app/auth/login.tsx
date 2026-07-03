import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Colors from "@/constants/colors";
import { useAuth } from "@/contexts/AuthContext";

const C = Colors.light;

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  async function handleLogin() {
    if (!email || !password) { setError("أدخل البريد الإلكتروني وكلمة المرور"); return; }
    setLoading(true);
    setError("");
    try {
      await login(email.trim(), password);
      router.replace("/(tabs)");
    } catch (e: any) {
      setError(e.message || "بيانات خاطئة");
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: topPad + 20, paddingBottom: insets.bottom + 40 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Close button */}
        <Pressable style={styles.closeBtn} onPress={() => router.back()}>
          <Feather name="x" size={22} color={C.textSecondary} />
        </Pressable>

        {/* Logo */}
        <View style={styles.logoArea}>
          <View style={styles.logoCircle}>
            <Feather name="book-open" size={32} color="#fff" />
          </View>
          <Text style={styles.logoText}>EduLibya</Text>
          <Text style={styles.logoSub}>المنصة التعليمية الليبية</Text>
        </View>

        <Text style={styles.title}>تسجيل الدخول</Text>
        <Text style={styles.subtitle}>مرحباً بعودتك! أدخل بياناتك للمتابعة</Text>

        {error ? (
          <View style={styles.errorBox}>
            <Feather name="alert-circle" size={15} color={C.error} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <View style={styles.field}>
          <Text style={styles.label}>البريد الإلكتروني</Text>
          <View style={styles.inputWrap}>
            <Feather name="mail" size={18} color={C.textMuted} />
            <TextInput
              style={styles.input}
              placeholder="example@email.com"
              placeholderTextColor={C.textMuted}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              textContentType="emailAddress"
            />
          </View>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>كلمة المرور</Text>
          <View style={styles.inputWrap}>
            <Pressable onPress={() => setShowPwd(!showPwd)}>
              <Feather name={showPwd ? "eye-off" : "eye"} size={18} color={C.textMuted} />
            </Pressable>
            <TextInput
              style={styles.input}
              placeholder="••••••••"
              placeholderTextColor={C.textMuted}
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPwd}
              textContentType="password"
            />
          </View>
        </View>

        <Pressable
          style={({ pressed }) => [styles.submitBtn, pressed && { opacity: 0.85 }, loading && styles.submitBtnDisabled]}
          onPress={handleLogin}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.submitBtnText}>تسجيل الدخول</Text>
          )}
        </Pressable>

        {/* Demo hint */}
        <View style={styles.demoBox}>
          <Feather name="info" size={13} color={C.tint} />
          <Text style={styles.demoText}>للتجربة: student@lms.ly / password123</Text>
        </View>

        <Pressable style={styles.switchBtn} onPress={() => router.replace("/auth/register")}>
          <Text style={styles.switchText}>ليس لديك حساب؟ </Text>
          <Text style={[styles.switchText, { color: C.tint }]}>إنشاء حساب جديد</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
  content: { paddingHorizontal: 24 },
  closeBtn: {
    alignSelf: "flex-start",
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: C.backgroundSecondary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
  },
  logoArea: { alignItems: "center", marginBottom: 32 },
  logoCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: C.tint,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  logoText: { fontFamily: "Inter_700Bold", fontSize: 24, color: C.text },
  logoSub: { fontFamily: "Inter_400Regular", fontSize: 13, color: C.textSecondary, marginTop: 4 },
  title: { fontFamily: "Inter_700Bold", fontSize: 26, color: C.text, textAlign: "right", marginBottom: 8 },
  subtitle: { fontFamily: "Inter_400Regular", fontSize: 14, color: C.textSecondary, textAlign: "right", marginBottom: 24 },
  errorBox: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#FEF2F2",
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#FECACA",
  },
  errorText: { fontFamily: "Inter_500Medium", fontSize: 13, color: C.error, flex: 1, textAlign: "right" },
  field: { marginBottom: 16 },
  label: { fontFamily: "Inter_600SemiBold", fontSize: 13, color: C.text, textAlign: "right", marginBottom: 8 },
  inputWrap: {
    flexDirection: "row-reverse",
    alignItems: "center",
    backgroundColor: C.inputBg,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: C.inputBorder,
    paddingHorizontal: 14,
    height: 52,
    gap: 10,
  },
  input: { flex: 1, fontFamily: "Inter_400Regular", fontSize: 15, color: C.text, textAlign: "right" },
  submitBtn: {
    backgroundColor: C.tint,
    borderRadius: 14,
    height: 54,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
    marginBottom: 16,
    shadowColor: C.tint,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  submitBtnDisabled: { opacity: 0.7 },
  submitBtnText: { fontFamily: "Inter_700Bold", fontSize: 16, color: "#fff" },
  demoBox: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 6,
    backgroundColor: C.pill,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 20,
  },
  demoText: { fontFamily: "Inter_400Regular", fontSize: 12, color: C.tint },
  switchBtn: { flexDirection: "row-reverse", justifyContent: "center", alignItems: "center" },
  switchText: { fontFamily: "Inter_500Medium", fontSize: 14, color: C.textSecondary },
});
