import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Colors from "@/constants/colors";
import { useAuth } from "@/contexts/AuthContext";
import { useApi } from "@/hooks/useApi";
import { useLanguage } from "@/contexts/LanguageContext";

const C = Colors.light;

function formatDate(iso: string, lang: string) {
  return new Date(iso).toLocaleDateString(lang === "ar" ? "ar-LY" : "en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function txIcon(type: string) {
  if (type === "credit" || type === "deposit" || type === "redeem") return "arrow-down-left";
  if (type === "debit" || type === "withdrawal" || type === "purchase") return "arrow-up-right";
  return "circle";
}

function txColor(type: string) {
  if (type === "credit" || type === "deposit" || type === "redeem") return C.success;
  return C.error;
}

function TransactionRow({ tx, lang }: { tx: any; lang: string }) {
  const isCredit = tx.type === "credit" || tx.type === "deposit" || tx.type === "redeem";
  return (
    <View style={styles.txRow}>
      <View style={[styles.txIcon, { backgroundColor: isCredit ? "#10B98115" : "#EF444415" }]}>
        <Feather name={txIcon(tx.type)} size={16} color={txColor(tx.type)} />
      </View>
      <View style={styles.txInfo}>
        <Text style={styles.txDesc} numberOfLines={1}>{tx.description || (lang === "ar" ? "معاملة" : "Transaction")}</Text>
        <Text style={styles.txDate}>{formatDate(tx.createdAt, lang)}</Text>
      </View>
      <Text style={[styles.txAmount, { color: txColor(tx.type) }]}>
        {isCredit ? "+" : "-"}{Math.abs(parseFloat(tx.amount || "0")).toFixed(2)} {lang === "ar" ? "د.ل" : "LYD"}
      </Text>
    </View>
  );
}

export default function WalletScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { apiFetch } = useApi();
  const { t, language } = useLanguage();
  const queryClient = useQueryClient();
  const [code, setCode] = useState("");
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const { data: walletData, isLoading } = useQuery({
    queryKey: ["wallet-balance"],
    queryFn: () => apiFetch("/wallet/balance"),
    enabled: !!user,
  });

  const redeemMutation = useMutation({
    mutationFn: (c: string) =>
      apiFetch("/payments/redeem-code", { method: "POST", body: JSON.stringify({ code: c }) }),
    onSuccess: () => {
      Alert.alert(t("تم!", "Success!"), t("تم شحن رصيدك بنجاح", "Your balance has been topped up."));
      setCode("");
      queryClient.invalidateQueries({ queryKey: ["wallet-balance"] });
    },
    onError: (e: any) => Alert.alert(t("خطأ", "Error"), e.message),
  });

  const balance = parseFloat(walletData?.balance ?? "0").toFixed(2);
  const transactions: any[] = walletData?.transactions ?? [];

  // Referral code (lazily generated server-side)
  const { data: referralData } = useQuery<any>({
    queryKey: ["referral-code"],
    queryFn: () => apiFetch("/coupons/referral/my-code"),
    enabled: !!user,
  });

  return (
    <View style={[styles.container, { paddingTop: topPad }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-right" size={22} color={C.text} />
        </Pressable>
        <Text style={styles.headerTitle}>{t("محفظتي", "My Wallet")}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: Platform.OS === "web" ? 34 : insets.bottom + 24, gap: 20, padding: 20 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Balance Card */}
        <View style={styles.balanceCard}>
          <View style={styles.balanceIconRow}>
            <View style={styles.balanceIconBg}>
              <Feather name="credit-card" size={28} color="#fff" />
            </View>
          </View>
          {isLoading ? (
            <ActivityIndicator color="#fff" style={{ marginVertical: 16 }} />
          ) : (
            <>
              <Text style={styles.balanceLabel}>{t("رصيدك الحالي", "Current Balance")}</Text>
              <Text style={styles.balanceAmount}>{balance}</Text>
              <Text style={styles.balanceCurrency}>{t("دينار ليبي", "Libyan Dinar (LYD)")}</Text>
            </>
          )}
        </View>

        {/* Referral code */}
        {referralData?.code && (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Feather name="gift" size={18} color={C.tint} />
              <Text style={styles.cardTitle}>{t("ادعُ أصدقاءك واربح رصيدًا", "Invite friends, earn credit")}</Text>
            </View>
            <Text style={{ fontFamily: "Inter_400Regular", fontSize: 12, color: C.textSecondary, textAlign: "right", marginBottom: 10 }}>
              {language === "ar" ? referralData.messageAr : referralData.message}
            </Text>
            <Pressable
              onPress={async () => {
                const { Share } = await import("react-native");
                Share.share({ message: t(`رمز الإحالة الخاص بي في EduLibya: ${referralData.code}`, `My EduLibya referral code: ${referralData.code}`) });
              }}
              style={{ backgroundColor: C.backgroundSecondary, borderRadius: 12, padding: 12, alignItems: "center" }}
            >
              <Text style={{ fontFamily: "Inter_700Bold", fontSize: 18, letterSpacing: 3, color: C.tint }}>{referralData.code}</Text>
              <Text style={{ fontFamily: "Inter_400Regular", fontSize: 11, color: C.textMuted, marginTop: 4 }}>{t("اضغط للمشاركة", "Tap to share")}</Text>
            </Pressable>
          </View>
        )}

        {/* Redeem Code */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Feather name="tag" size={18} color={C.tint} />
            <Text style={styles.cardTitle}>{t("شحن البطاقة المدفوعة مسبقاً", "Redeem Prepaid Card")}</Text>
          </View>
          <Text style={styles.cardSubtitle}>
            {t("أدخل رمز البطاقة لشحن رصيدك", "Enter the card code to top up your balance")}
          </Text>
          <View style={styles.redeemRow}>
            <TextInput
              style={styles.codeInput}
              value={code}
              onChangeText={setCode}
              placeholder={t("أدخل الرمز هنا", "Enter code here")}
              placeholderTextColor={C.textMuted}
              autoCapitalize="characters"
            />
            <Pressable
              style={({ pressed }) => [styles.redeemBtn, pressed && { opacity: 0.85 }, (!code.trim() || redeemMutation.isPending) && { opacity: 0.5 }]}
              onPress={() => { if (code.trim()) redeemMutation.mutate(code.trim()); }}
              disabled={!code.trim() || redeemMutation.isPending}
            >
              {redeemMutation.isPending ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.redeemBtnText}>{t("شحن", "Redeem")}</Text>
              )}
            </Pressable>
          </View>
        </View>

        {/* Transaction History */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Feather name="list" size={18} color={C.tint} />
            <Text style={styles.cardTitle}>{t("سجل المعاملات", "Transaction History")}</Text>
          </View>
          {isLoading ? (
            <ActivityIndicator color={C.tint} style={{ marginVertical: 16 }} />
          ) : transactions.length === 0 ? (
            <View style={styles.emptyBox}>
              <Feather name="inbox" size={36} color={C.textMuted} />
              <Text style={styles.emptyText}>{t("لا توجد معاملات بعد", "No transactions yet")}</Text>
            </View>
          ) : (
            <View style={{ gap: 2 }}>
              {transactions.map((tx: any, i: number) => (
                <TransactionRow key={tx.id ?? i} tx={tx} lang={language} />
              ))}
            </View>
          )}
        </View>
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
  balanceCard: {
    borderRadius: 24,
    padding: 28,
    alignItems: "center",
    gap: 6,
    backgroundColor: C.tint,
    shadowColor: C.shadow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 1,
    shadowRadius: 24,
    elevation: 8,
  },
  balanceIconRow: { marginBottom: 8 },
  balanceIconBg: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  balanceLabel: { fontFamily: "Inter_500Medium", fontSize: 14, color: "rgba(255,255,255,0.85)" },
  balanceAmount: { fontFamily: "Inter_700Bold", fontSize: 48, color: "#fff", letterSpacing: -1 },
  balanceCurrency: { fontFamily: "Inter_400Regular", fontSize: 14, color: "rgba(255,255,255,0.7)" },
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
  cardSubtitle: { fontFamily: "Inter_400Regular", fontSize: 13, color: C.textSecondary, textAlign: "right" },
  redeemRow: { flexDirection: "row-reverse", gap: 10 },
  codeInput: {
    flex: 1,
    backgroundColor: C.inputBg,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontFamily: "Inter_500Medium",
    fontSize: 14,
    color: C.text,
    borderWidth: 1,
    borderColor: C.inputBorder,
    textAlign: "right",
    letterSpacing: 2,
  },
  redeemBtn: {
    backgroundColor: C.tint,
    borderRadius: 14,
    paddingHorizontal: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  redeemBtnText: { fontFamily: "Inter_700Bold", fontSize: 15, color: "#fff" },
  txRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: C.cardBorder,
  },
  txIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  txInfo: { flex: 1 },
  txDesc: { fontFamily: "Inter_500Medium", fontSize: 14, color: C.text, textAlign: "right" },
  txDate: { fontFamily: "Inter_400Regular", fontSize: 12, color: C.textMuted, textAlign: "right", marginTop: 2 },
  txAmount: { fontFamily: "Inter_700Bold", fontSize: 15 },
  emptyBox: { alignItems: "center", paddingVertical: 24, gap: 10 },
  emptyText: { fontFamily: "Inter_400Regular", fontSize: 14, color: C.textMuted },
});
