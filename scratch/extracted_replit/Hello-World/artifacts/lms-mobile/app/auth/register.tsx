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

type Role = "student" | "teacher";

export default function RegisterScreen() {
  const insets = useSafeAreaInsets();
  const { register } = useAuth();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>("student");
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  async function handleRegister() {
    if (!fullName || !email || !password) { setError("أكمل جميع الحقول"); return; }
    if (password.length < 6) { setError("كلمة المرور يجب أن تكون 6 أحرف على الأقل"); return; }
    setLoading(true);
    setError("");
    try {
      await register({ fullName, email: email.trim(), password, role });
      router.replace("/(tabs)");
    } catch (e: any) {
      setError(e.message || "فشل التسجيل");
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
        <Pressable style={styles.closeBtn} onPress={() => router.back()}>
          <Feather name="x" size={22} color={C.textSecondary} />
        </Pressable>

        <View style={styles.logoArea}>
          <View style={styles.logoCircle}>
            <Feather name="book-open" size={32} color="#fff" />
          </View>
          <Text style={styles.logoText}>EduLibya</Text>
        </View>

        <Text style={styles.title}>إنشاء حساب جديد</Text>
        <Text style={styles.subtitle}>انضم إلى آلاف الطلاب والمعلمين الليبيين</Text>

        {/* Role Selector */}
        <View style={styles.roleSelector}>
          <Pressable
            style={[styles.roleOption, role === "student" && styles.roleOptionActive]}
            onPress={() => setRole("student")}
          >
            <Feather name="user" size={20} color={role === "student" ? "#fff" : C.textSecondary} />
            <Text style={[styles.roleText, role === "student" && styles.roleTextActive]}>طالب</Text>
          </Pressable>
          <Pressable
            style={[styles.roleOption, role === "teacher" && styles.roleOptionActive]}
            onPress={() => setRole("teacher")}
          >
            <Feather name="briefcase" size={20} color={role === "teacher" ? "#fff" : C.textSecondary} />
            <Text style={[styles.roleText, role === "teacher" && styles.roleTextActive]}>معلم</Text>
          </Pressable>
        </View>

        {error ? (
          <View style={styles.errorBox}>
            <Feather name="alert-circle" size={15} color={C.error} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <View style={styles.field}>
          <Text style={styles.label}>الاسم الكامل</Text>
          <View style={styles.inputWrap}>
            <Feather name="user" size={18} color={C.textMuted} />
            <TextInput
              style={styles.input}
              placeholder="أدخل اسمك الكامل"
              placeholderTextColor={C.textMuted}
              value={fullName}
              onChangeText={setFullName}
            />
          </View>
        </View>

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
              placeholder="6 أحرف على الأقل"
              placeholderTextColor={C.textMuted}
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPwd}
              textContentType="newPassword"
            />
          </View>
        </View>

        <Pressable
          style={({ pressed }) => [styles.submitBtn, pressed && { opacity: 0.85 }, loading && styles.submitBtnDisabled]}
          onPress={handleRegister}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.submitBtnText}>إنشاء الحساب</Text>
          )}
        </Pressable>

        <Pressable style={styles.switchBtn} onPress={() => router.replace("/auth/login")}>
          <Text style={styles.switchText}>لدي حساب بالفعل؟ </Text>
          <Text style={[styles.switchText, { color: C.tint }]}>تسجيل الدخول</Text>
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
  logoArea: { alignItems: "center", marginBottom: 28 },
  logoCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: C.tint,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  logoText: { fontFamily: "Inter_700Bold", fontSize: 22, color: C.text },
  title: { fontFamily: "Inter_700Bold", fontSize: 24, color: C.text, textAlign: "right", marginBottom: 6 },
  subtitle: { fontFamily: "Inter_400Regular", fontSize: 13, color: C.textSecondary, textAlign: "right", marginBottom: 20 },
  roleSelector: { flexDirection: "row", gap: 12, marginBottom: 20 },
  roleOption: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: C.backgroundSecondary,
    borderRadius: 14,
    paddingVertical: 14,
    borderWidth: 1.5,
    borderColor: C.cardBorder,
  },
  roleOptionActive: { backgroundColor: C.tint, borderColor: C.tint },
  roleText: { fontFamily: "Inter_600SemiBold", fontSize: 15, color: C.textSecondary },
  roleTextActive: { color: "#fff" },
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
    marginBottom: 20,
    shadowColor: C.tint,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  submitBtnDisabled: { opacity: 0.7 },
  submitBtnText: { fontFamily: "Inter_700Bold", fontSize: 16, color: "#fff" },
  switchBtn: { flexDirection: "row-reverse", justifyContent: "center", alignItems: "center" },
  switchText: { fontFamily: "Inter_500Medium", fontSize: 14, color: C.textSecondary },
});
