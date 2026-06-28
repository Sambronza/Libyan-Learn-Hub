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
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Colors from "@/constants/colors";
import { useAuth } from "@/contexts/AuthContext";
import { useApi } from "@/hooks/useApi";
import { useLanguage } from "@/contexts/LanguageContext";

const C = Colors.light;

type PaymentMethod = "wallet" | "gateway";

export default function CheckoutScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { apiFetch } = useApi();
  const { t, language } = useLanguage();
  const queryClient = useQueryClient();
  const params = useLocalSearchParams<{ type: string; id: string; title?: string; titleAr?: string; price?: string; currency?: string }>();
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const [method, setMethod] = useState<PaymentMethod>("wallet");
  const [done, setDone] = useState(false);

  const { data: walletData } = useQuery({
    queryKey: ["wallet-balance"],
    queryFn: () => apiFetch("/wallet/balance"),
    enabled: !!user,
  });

  const balance = parseFloat(walletData?.balance ?? "0");
  const price = parseFloat(params.price ?? "0");
  const hasEnoughBalance = balance >= price;

  const payMutation = useMutation({
    mutationFn: async () => {
      if (method === "wallet") {
        if (params.type === "course") {
          return apiFetch(`/courses/${params.id}/enroll`, { method: "POST", body: JSON.stringify({ paymentMethod: "wallet" }) });
        } else {
          return apiFetch(`/live-sessions/${params.id}/register`, { method: "POST", body: JSON.stringify({ paymentMethod: "wallet" }) });
        }
      } else {
        return apiFetch("/payments/create-session", {
          method: "POST",
          body: JSON.stringify({ type: params.type, itemId: parseInt(params.id!) }),
        });
      }
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["wallet-balance"] });
      queryClient.invalidateQueries({ queryKey: ["enrollments"] });
      queryClient.invalidateQueries({ queryKey: ["course", params.id] });
      if (method === "gateway" && data?.url) {
        setDone(true);
      } else {
        setDone(true);
      }
    },
    onError: (e: any) => Alert.alert(t("خطأ", "Error"), e.message),
  });

  const title = language === "ar" ? (params.titleAr || params.title || "") : (params.title || params.titleAr || "");

  if (done) {
    return (
      <View style={[styles.container, { paddingTop: topPad }]}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <Feather name="arrow-right" size={22} color={C.text} />
          </Pressable>
          <Text style={styles.headerTitle}>{t("الدفع", "Checkout")}</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.successContainer}>
          <View style={styles.successIcon}>
            <Feather name="check-circle" size={52} color={C.success} />
          </View>
          <Text style={styles.successTitle}>
            {method === "wallet"
              ? t("تم التسجيل بنجاح!", "Successfully enrolled!")
              : t("تم إنشاء طلب الدفع", "Payment request created")}
          </Text>
          <Text style={styles.successSubtitle}>
            {method === "wallet"
              ? t("تم خصم المبلغ من رصيدك", "Amount deducted from your wallet")
              : t("سيتم تأكيد تسجيلك بعد تحويل المبلغ", "Your enrollment will be confirmed after payment transfer")}
          </Text>
          <Pressable style={styles.doneBtn} onPress={() => router.back()}>
            <Text style={styles.doneBtnText}>{t("العودة", "Go Back")}</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-right" size={22} color={C.text} />
        </Pressable>
        <Text style={styles.headerTitle}>{t("الدفع", "Checkout")}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 20, gap: 20, paddingBottom: Platform.OS === "web" ? 34 : insets.bottom + 24 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Item Summary */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Feather name={params.type === "course" ? "book-open" : "video"} size={18} color={C.tint} />
            <Text style={styles.cardTitle}>{t("ملخص الطلب", "Order Summary")}</Text>
          </View>
          <Text style={styles.itemTitle} numberOfLines={2}>{title}</Text>
          <View style={styles.divider} />
          <View style={styles.priceRow}>
            <Text style={styles.priceLabel}>{t("المبلغ المطلوب", "Amount Due")}</Text>
            <Text style={styles.priceValue}>{price.toFixed(2)} {params.currency === "USD" ? "USD" : t("د.ل", "LYD")}</Text>
          </View>
        </View>

        {/* Payment Method */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Feather name="credit-card" size={18} color={C.tint} />
            <Text style={styles.cardTitle}>{t("طريقة الدفع", "Payment Method")}</Text>
          </View>

          <Pressable
            style={[styles.methodRow, method === "wallet" && styles.methodRowSelected]}
            onPress={() => setMethod("wallet")}
          >
            <View style={[styles.radio, method === "wallet" && styles.radioSelected]}>
              {method === "wallet" && <View style={styles.radioInner} />}
            </View>
            <View style={{ flex: 1, alignItems: "flex-end" }}>
              <Text style={styles.methodTitle}>{t("المحفظة الإلكترونية", "My Wallet")}</Text>
              <Text style={styles.methodSub}>
                {t("رصيدك الحالي:", "Your balance:")} {balance.toFixed(2)} {t("د.ل", "LYD")}
                {!hasEnoughBalance && (
                  <Text style={{ color: C.error }}>{" "}{t("(رصيد غير كافٍ)", "(Insufficient balance)")}</Text>
                )}
              </Text>
            </View>
            <View style={[styles.methodIcon, { backgroundColor: `${C.tint}15` }]}>
              <Feather name="credit-card" size={22} color={C.tint} />
            </View>
          </Pressable>

          <View style={styles.methodDivider} />

          <Pressable
            style={[styles.methodRow, method === "gateway" && styles.methodRowSelected]}
            onPress={() => setMethod("gateway")}
          >
            <View style={[styles.radio, method === "gateway" && styles.radioSelected]}>
              {method === "gateway" && <View style={styles.radioInner} />}
            </View>
            <View style={{ flex: 1, alignItems: "flex-end" }}>
              <Text style={styles.methodTitle}>{t("بوابة الدفع الإلكتروني", "Secure Payment Gateway")}</Text>
              <Text style={styles.methodSub}>{t("تحويل بنكي أو موبي كاش", "Bank transfer or MobiCash")}</Text>
            </View>
            <View style={[styles.methodIcon, { backgroundColor: "#10B98115" }]}>
              <Feather name="smartphone" size={22} color={C.success} />
            </View>
          </Pressable>
        </View>

        {/* Gateway Info */}
        {method === "gateway" && (
          <View style={[styles.card, { borderColor: `${C.warning}40`, borderWidth: 1 }]}>
            <View style={styles.cardHeader}>
              <Feather name="info" size={16} color={C.warning} />
              <Text style={[styles.cardTitle, { color: C.warning }]}>{t("تعليمات الدفع", "Payment Instructions")}</Text>
            </View>
            <Text style={styles.infoText}>
              {t(
                "بعد الضغط على \"إتمام الدفع\"، سيتم إنشاء طلب دفع. يرجى تحويل المبلغ عبر البنك أو موبي كاش وإرسال إيصال الدفع للدعم.",
                "After tapping \"Complete Payment\", a payment request will be created. Please transfer the amount via bank or MobiCash and send the receipt to support."
              )}
            </Text>
          </View>
        )}

        {/* Confirm Button */}
        <Pressable
          style={({ pressed }) => [
            styles.confirmBtn,
            pressed && { opacity: 0.85 },
            (payMutation.isPending || (method === "wallet" && !hasEnoughBalance)) && { opacity: 0.5 },
          ]}
          onPress={() => {
            if (method === "wallet" && !hasEnoughBalance) {
              Alert.alert(
                t("رصيد غير كافٍ", "Insufficient Balance"),
                t("يرجى شحن محفظتك أولاً أو اختيار طريقة دفع أخرى", "Please top up your wallet first or choose another payment method"),
                [
                  { text: t("شحن المحفظة", "Top Up Wallet"), onPress: () => router.push("/wallet" as any) },
                  { text: t("إلغاء", "Cancel"), style: "cancel" },
                ]
              );
              return;
            }
            payMutation.mutate();
          }}
          disabled={payMutation.isPending}
        >
          {payMutation.isPending ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Feather name="check-circle" size={18} color="#fff" />
              <Text style={styles.confirmBtnText}>{t("إتمام الدفع", "Complete Payment")}</Text>
            </>
          )}
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
  header: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: C.cardBorder,
  },
  backBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontFamily: "Inter_700Bold", fontSize: 20, color: C.text },
  card: {
    backgroundColor: C.card,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: C.cardBorder,
    gap: 14,
  },
  cardHeader: { flexDirection: "row-reverse", alignItems: "center", gap: 10 },
  cardTitle: { fontFamily: "Inter_700Bold", fontSize: 16, color: C.text, flex: 1, textAlign: "right" },
  itemTitle: { fontFamily: "Inter_600SemiBold", fontSize: 15, color: C.text, textAlign: "right", lineHeight: 22 },
  divider: { height: 1, backgroundColor: C.cardBorder },
  priceRow: { flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center" },
  priceLabel: { fontFamily: "Inter_500Medium", fontSize: 14, color: C.textSecondary },
  priceValue: { fontFamily: "Inter_700Bold", fontSize: 22, color: C.tint },
  methodRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 14,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1.5,
    borderColor: "transparent",
  },
  methodRowSelected: { borderColor: C.tint, backgroundColor: `${C.tint}08` },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: C.textMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  radioSelected: { borderColor: C.tint },
  radioInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: C.tint },
  methodIcon: { width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  methodTitle: { fontFamily: "Inter_600SemiBold", fontSize: 14, color: C.text },
  methodSub: { fontFamily: "Inter_400Regular", fontSize: 12, color: C.textSecondary, marginTop: 2 },
  methodDivider: { height: 1, backgroundColor: C.cardBorder },
  infoText: { fontFamily: "Inter_400Regular", fontSize: 13, color: C.textSecondary, textAlign: "right", lineHeight: 20 },
  confirmBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: C.tint,
    borderRadius: 18,
    paddingVertical: 16,
  },
  confirmBtnText: { fontFamily: "Inter_700Bold", fontSize: 17, color: "#fff" },
  successContainer: { flex: 1, alignItems: "center", justifyContent: "center", padding: 40, gap: 16 },
  successIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "#10B98115",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  successTitle: { fontFamily: "Inter_700Bold", fontSize: 22, color: C.text, textAlign: "center" },
  successSubtitle: { fontFamily: "Inter_400Regular", fontSize: 15, color: C.textSecondary, textAlign: "center", lineHeight: 22 },
  doneBtn: { backgroundColor: C.tint, borderRadius: 16, paddingHorizontal: 40, paddingVertical: 14, marginTop: 8 },
  doneBtnText: { fontFamily: "Inter_700Bold", fontSize: 16, color: "#fff" },
});
