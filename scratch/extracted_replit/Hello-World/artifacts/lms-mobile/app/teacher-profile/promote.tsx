import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useState, useEffect } from "react";
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
import Colors from "@/constants/colors";
import { useAuth } from "@/contexts/AuthContext";
import { useApi } from "@/hooks/useApi";
import { useLanguage } from "@/contexts/LanguageContext";

const C = Colors.light;

export default function TeacherPromoteScreen() {
  const insets = useSafeAreaInsets();
  const { user, refreshUser } = useAuth();
  const { apiFetch } = useApi();
  const { t, language } = useLanguage();

  const [ads, setAds] = useState<any[]>([]);
  const [stats, setStats] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  const isRtl = language === "ar";
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const loadData = async () => {
    try {
      setLoading(true);
      const [adsData, statsData] = await Promise.all([
        apiFetch("/advertisements/my").catch(() => []),
        apiFetch("/teacher-profile/analytics/summary").catch(() => []),
      ]);
      setAds(adsData || []);
      setStats(statsData || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const profileViews = Array.isArray(stats) ? stats.find(s => s.eventType === 'profile_view')?.count || 0 : 0;
  const activeAdsCount = ads.filter(a => a.isActive).length;

  const handleUpgradePro = async () => {
    setProcessing(true);
    try {
      await apiFetch('/teacher-profile/upgrade-pro', { method: 'POST' });
      await refreshUser();
      Alert.alert(t("تمت الترقية!", "Upgraded!"), t("لقد أصبحت الآن معلم Pro.", "You are now a Pro teacher."));
    } catch (err: any) {
      Alert.alert(t("خطأ", "Error"), err.message);
    } finally {
      setProcessing(false);
    }
  };

  const handleBuyAd = async (adType: "banner" | "featured_search") => {
    setProcessing(true);
    try {
      const startDate = new Date();
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + 7); // 7 day ad

      await apiFetch('/advertisements', {
        method: 'POST',
        body: JSON.stringify({
          adType,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          budgetPaid: '50',
        })
      });
      Alert.alert(t("تم تفعيل الإعلان", "Ad Started!"), t("إعلانك الآن نشط لمدة 7 أيام.", "Your ad is now active for 7 days."));
      loadData();
    } catch (err: any) {
      Alert.alert(t("خطأ", "Error"), err.message);
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: "center" }]}>
        <ActivityIndicator size="large" color={C.tint} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 10 }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Feather name={isRtl ? "chevron-right" : "chevron-left"} size={26} color={C.text} />
        </Pressable>
        <Text style={styles.headerTitle}>{t("الترويج والإعلانات", "Promote & Ads")}</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        {/* Stats Row */}
        <View style={styles.statsContainer}>
          <View style={styles.statBox}>
            <View style={[styles.statIcon, { backgroundColor: "rgba(37,99,235,0.1)" }]}>
              <Feather name="eye" size={20} color="#2563eb" />
            </View>
            <Text style={styles.statValue}>{profileViews}</Text>
            <Text style={styles.statLabel}>{t("مشاهدات", "Views")}</Text>
          </View>
          <View style={styles.statBox}>
            <View style={[styles.statIcon, { backgroundColor: "rgba(234,179,8,0.1)" }]}>
              <Feather name="star" size={20} color="#eab308" />
            </View>
            <Text style={styles.statValue}>{user?.tier === 'pro' ? 'Pro' : 'Free'}</Text>
            <Text style={styles.statLabel}>{t("الحالة", "Status")}</Text>
          </View>
          <View style={styles.statBox}>
            <View style={[styles.statIcon, { backgroundColor: "rgba(34,197,94,0.1)" }]}>
              <Feather name="bar-chart-2" size={20} color="#22c55e" />
            </View>
            <Text style={styles.statValue}>{activeAdsCount}</Text>
            <Text style={styles.statLabel}>{t("إعلانات", "Active Ads")}</Text>
          </View>
        </View>

        {/* Pro Subscription */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>{t("عضوية Pro", "Pro Subscription")}</Text>
            {user?.tier === "pro" && (
              <View style={styles.proBadge}>
                <Text style={styles.proBadgeText}>PRO ACTIVE</Text>
              </View>
            )}
          </View>
          <Text style={styles.cardDesc}>
            {t("احصل على ميزات متقدمة وميزة الظهور كمعلم موثوق لزيادة مبيعاتك.", "Get advanced features and a trusted badge to boost your sales.")}
          </Text>
          
          <View style={styles.featuresList}>
            <View style={styles.featureRow}>
              <Feather name="check-circle" size={16} color="#22c55e" />
              <Text style={styles.featureText}>{t("شارة Pro الحصرية", "Exclusive Pro badge")}</Text>
            </View>
            <View style={styles.featureRow}>
              <Feather name="check-circle" size={16} color="#22c55e" />
              <Text style={styles.featureText}>{t("أولوية في نتائج البحث", "Priority in search results")}</Text>
            </View>
            <View style={styles.featureRow}>
              <Feather name="check-circle" size={16} color="#22c55e" />
              <Text style={styles.featureText}>{t("إحصائيات متقدمة للطلاب", "Advanced student analytics")}</Text>
            </View>
          </View>

          {user?.tier !== "pro" ? (
            <Pressable 
              style={({pressed}) => [styles.primaryBtn, { backgroundColor: "#eab308" }, pressed && { opacity: 0.8 }, processing && { opacity: 0.5 }]} 
              onPress={handleUpgradePro}
              disabled={processing}
            >
              <Text style={styles.primaryBtnText}>{t("ترقية حسابك مجاناً (تجريبي)", "Get Pro (Free Demo)")}</Text>
            </Pressable>
          ) : (
            <View style={styles.activePlanBox}>
              <Text style={styles.activePlanText}>{t("اشتراكك نشط", "Your subscription is active")}</Text>
            </View>
          )}
        </View>

        {/* Advertisements */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>{t("الإعلانات", "Advertisements")}</Text>
          </View>
          <Text style={styles.cardDesc}>
            {t("اختر باقة إعلانية لتسليط الضوء على دوراتك وزيادة نسبة مشاهداتك.", "Choose an ad package to highlight your courses and increase your views.")}
          </Text>
          
          <View style={styles.adsGrid}>
            <View style={styles.adOption}>
              <Feather name="airplay" size={28} color={C.tint} style={{ marginBottom: 10 }} />
              <Text style={styles.adOptionTitle}>{t("بانر الرئيسية", "Homepage Banner")}</Text>
              <Text style={styles.adOptionDesc}>{t("الظهور في أعلى قائمة الموقع.", "Feature prominently on the landing page.")}</Text>
              <Pressable 
                style={styles.outlineBtn} 
                onPress={() => handleBuyAd('banner')}
                disabled={processing}
              >
                <Text style={styles.outlineBtnText}>50 LYD / wk</Text>
              </Pressable>
            </View>
            <View style={styles.adOption}>
              <Feather name="search" size={28} color="#eab308" style={{ marginBottom: 10 }} />
              <Text style={styles.adOptionTitle}>{t("بحث مميز", "Featured Search")}</Text>
              <Text style={styles.adOptionDesc}>{t("أولوية الظهور للطلاب في البحث.", "Priority presence when students search.")}</Text>
              <Pressable 
                style={styles.outlineBtn}
                onPress={() => handleBuyAd('featured_search')}
                disabled={processing}
              >
                <Text style={styles.outlineBtnText}>30 LYD / wk</Text>
              </Pressable>
            </View>
          </View>

          {/* Active Campaigns */}
          {ads.length > 0 && (
            <View style={styles.campaignsBox}>
              <Text style={styles.campaignsTitle}>{t("حملاتك", "Your Campaigns")}</Text>
              {ads.map((ad, i) => (
                <View key={i} style={styles.campaignRow}>
                  <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
                    <View style={[styles.campaignDot, { backgroundColor: ad.isActive ? "#22c55e" : "#ef4444" }]} />
                    <Text style={styles.campaignLabel}>{ad.adType.replace('_', ' ')}</Text>
                  </View>
                  <Text style={styles.campaignDate}>{new Date(ad.endDate).toLocaleDateString()}</Text>
                </View>
              ))}
            </View>
          )}

        </View>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.backgroundSecondary },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 16,
    backgroundColor: C.background,
    borderBottomWidth: 1,
    borderBottomColor: C.cardBorder,
  },
  backBtn: { width: 44, height: 44, justifyContent: "center" },
  headerTitle: { fontFamily: "Inter_700Bold", fontSize: 18, color: C.text },
  scrollContent: { padding: 16, gap: 16, paddingBottom: 60 },
  
  statsContainer: { flexDirection: "row", gap: 12 },
  statBox: { 
    flex: 1, 
    backgroundColor: C.card, 
    borderRadius: 16, 
    padding: 16, 
    alignItems: "center",
    borderWidth: 1,
    borderColor: C.cardBorder,
  },
  statIcon: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", marginBottom: 8 },
  statValue: { fontFamily: "Inter_700Bold", fontSize: 20, color: C.text, marginBottom: 4 },
  statLabel: { fontFamily: "Inter_500Medium", fontSize: 11, color: C.textSecondary },

  card: {
    backgroundColor: C.card,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: C.cardBorder,
  },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  cardTitle: { fontFamily: "Inter_700Bold", fontSize: 18, color: C.text },
  cardDesc: { fontFamily: "Inter_400Regular", fontSize: 13, color: C.textSecondary, marginBottom: 20, lineHeight: 20 },
  proBadge: { backgroundColor: "#eab308", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  proBadgeText: { fontFamily: "Inter_700Bold", fontSize: 10, color: "#fff" },
  
  featuresList: { gap: 12, marginBottom: 24 },
  featureRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  featureText: { fontFamily: "Inter_500Medium", fontSize: 14, color: C.text },
  
  primaryBtn: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  primaryBtnText: { fontFamily: "Inter_600SemiBold", fontSize: 15, color: "#fff" },
  
  activePlanBox: { backgroundColor: "rgba(34,197,94,0.1)", padding: 14, borderRadius: 12, alignItems: "center" },
  activePlanText: { fontFamily: "Inter_600SemiBold", fontSize: 14, color: "#166534" },

  adsGrid: { flexDirection: "row", gap: 12, marginBottom: 16 },
  adOption: { 
    flex: 1, 
    borderWidth: 1, 
    borderColor: C.cardBorder, 
    borderRadius: 16, 
    padding: 16, 
    alignItems: "center" 
  },
  adOptionTitle: { fontFamily: "Inter_700Bold", fontSize: 14, color: C.text, marginBottom: 6, textAlign: "center" },
  adOptionDesc: { fontFamily: "Inter_400Regular", fontSize: 11, color: C.textSecondary, textAlign: "center", marginBottom: 16, flex: 1 },
  outlineBtn: { borderWidth: 1, borderColor: C.tint, borderRadius: 8, paddingVertical: 8, paddingHorizontal: 12, width: "100%", alignItems: "center" },
  outlineBtnText: { fontFamily: "Inter_600SemiBold", fontSize: 12, color: C.tint },

  campaignsBox: { marginTop: 16, borderTopWidth: 1, borderTopColor: C.cardBorder, paddingTop: 16 },
  campaignsTitle: { fontFamily: "Inter_600SemiBold", fontSize: 14, color: C.text, marginBottom: 12 },
  campaignRow: { flexDirection: "row",justifyContent: "space-between", alignItems: "center", backgroundColor: C.backgroundSecondary, padding: 12, borderRadius: 10, marginBottom: 8 },
  campaignDot: { width: 8, height: 8, borderRadius: 4 },
  campaignLabel: { fontFamily: "Inter_500Medium", fontSize: 13, color: C.text, textTransform: "capitalize" },
  campaignDate: { fontFamily: "Inter_400Regular", fontSize: 12, color: C.textSecondary },
});
