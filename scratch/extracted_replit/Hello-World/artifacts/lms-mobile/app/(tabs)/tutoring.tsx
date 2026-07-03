import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
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
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Colors from "@/constants/colors";
import { useAuth } from "@/contexts/AuthContext";
import { useApi } from "@/hooks/useApi";
import { ReportModal } from "@/components/ReportModal";
import { useLanguage } from "@/contexts/LanguageContext";

const C = Colors.light;

const GRADE_LEVELS_AR = [
  { value: "grade_10", label: "الصف العاشر" },
  { value: "grade_11", label: "الصف الحادي عشر" },
  { value: "grade_12", label: "الصف الثاني عشر" },
  { value: "university", label: "الجامعة" },
  { value: "all", label: "جميع المستويات" },
];
const GRADE_LEVELS_EN = [
  { value: "grade_10", label: "Grade 10" },
  { value: "grade_11", label: "Grade 11" },
  { value: "grade_12", label: "Grade 12" },
  { value: "university", label: "University" },
  { value: "all", label: "All Levels" },
];

function gradeLabelAr(value: string, lang = "ar") {
  const levels = lang === "ar" ? GRADE_LEVELS_AR : GRADE_LEVELS_EN;
  return levels.find(g => g.value === value)?.label || value || "–";
}

function StatusBadge({ status }: { status: string }) {
  const { t } = useLanguage();
  const map: Record<string, { label: string; bg: string; color: string }> = {
    pending:   { label: t("قيد الانتظار", "Pending"),   bg: "#FEF9C3", color: "#A16207" },
    accepted:  { label: t("مقبول", "Accepted"),       bg: "#DCFCE7", color: "#15803D" },
    declined:  { label: t("مرفوض", "Declined"),       bg: "#FEE2E2", color: "#DC2626" },
    cancelled: { label: t("ملغي", "Cancelled"),        bg: "#F1F5F9", color: "#64748B" },
  };
  const b = map[status] || { label: status, bg: "#F1F5F9", color: "#64748B" };
  return (
    <View style={{ backgroundColor: b.bg, paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20, alignSelf: "flex-start" }}>
      <Text style={{ color: b.color, fontFamily: "Inter_600SemiBold", fontSize: 11 }}>{b.label}</Text>
    </View>
  );
}

function ListingCard({ listing, isTeacher, onApply, onViewApps }: any) {
  const [reportOpen, setReportOpen] = useState(false);
  const { t, language } = useLanguage();
  return (
    <View style={styles.card}>
      <View style={{ flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardTitle}>{t(listing.titleAr, listing.title || listing.titleAr)}</Text>
          {!isTeacher && (
            <View style={{ flexDirection: "row-reverse", alignItems: "center" }}>
              <Text style={styles.teacherName}>{language === "ar" ? (listing.teacherNameAr || listing.teacherName) : listing.teacherName}</Text>
              <Pressable onPress={() => setReportOpen(true)} style={{ marginRight: 8, padding: 4 }}>
                <Feather name="flag" size={14} color={C.textMuted} />
              </Pressable>
            </View>
          )}
        </View>
        <View style={styles.rateTag}>
          <Text style={styles.rateText}>{listing.hourlyRate} LYD/{t("ساعة", "hr")}</Text>
        </View>
      </View>

      <View style={{ flexDirection: "row-reverse", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
        <View style={styles.chip}><Text style={styles.chipText}>{t(listing.subjectAr, listing.subject || listing.subjectAr)}</Text></View>
        <View style={styles.chip}><Text style={styles.chipText}>{gradeLabelAr(listing.gradeLevel, language)}</Text></View>
        <View style={styles.chip}><Text style={styles.chipText}>{listing.sessionDurationMinutes} {t("دقيقة", "min")}</Text></View>
      </View>

      {listing.descriptionAr ? (
        <Text style={styles.desc} numberOfLines={2}>{t(listing.descriptionAr, listing.description || listing.descriptionAr)}</Text>
      ) : null}

      {listing.availableTimeFrom ? (
        <View style={{ flexDirection: "row-reverse", alignItems: "center", gap: 4, marginBottom: 10 }}>
          <Feather name="clock" size={12} color={C.textMuted} />
          <Text style={styles.meta}>{listing.availableTimeFrom} - {listing.availableTimeTo}</Text>
        </View>
      ) : null}

      {isTeacher ? (
        <Pressable style={styles.applyBtn} onPress={() => onViewApps(listing)}>
          <Feather name="users" size={15} color="#fff" />
          <Text style={styles.applyBtnText}>{t("الطلبات", "Applications")} ({listing.totalApplications})</Text>
        </Pressable>
      ) : (
        <Pressable style={styles.applyBtn} onPress={() => onApply(listing)}>
          <Feather name="send" size={15} color="#fff" />
          <Text style={styles.applyBtnText}>{t("تقديم طلب", "Apply")}</Text>
        </Pressable>
      )}

      <ReportModal 
        visible={reportOpen} 
        onClose={() => setReportOpen(false)} 
        type="teacher" 
        targetId={listing.userId || listing.id} 
      />
    </View>
  );
}

function ApplyModal({ listing, visible, onClose, onApply }: any) {
  const [message, setMessage] = useState("");
  const { t } = useLanguage();
  if (!listing) return null;
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalBox}>
          <Text style={styles.modalTitle}>{t("التقديم على الدرس", "Apply for Lesson")}</Text>
          <View style={styles.modalInfo}>
            <Text style={styles.modalInfoTitle}>{t(listing.titleAr, listing.title || listing.titleAr)}</Text>
            <Text style={styles.modalInfoSub}>{t(listing.subjectAr, listing.subject || listing.subjectAr)} · {gradeLabelAr(listing.gradeLevel)}</Text>
            <Text style={styles.modalInfoRate}>{listing.hourlyRate} LYD/{t("ساعة", "hr")}</Text>
          </View>
          <Text style={styles.inputLabel}>{t("رسالة للمعلم (اختياري)", "Message to teacher (optional)")}</Text>
          <TextInput
            style={styles.textArea}
            multiline
            numberOfLines={4}
            value={message}
            onChangeText={setMessage}
            placeholder={t("اكتب رسالة تعريفية أو تفاصيل...", "Write an introductory message...")}
            textAlign="right"
          />
          <View style={{ flexDirection: "row", gap: 8, marginTop: 16 }}>
            <Pressable style={[styles.applyBtn, { flex: 1 }]} onPress={() => onApply(listing, message)}>
              <Text style={styles.applyBtnText}>{t("تقديم الطلب", "Submit")}</Text>
            </Pressable>
            <Pressable style={[styles.cancelBtn, { flex: 1 }]} onPress={onClose}>
              <Text style={styles.cancelBtnText}>{t("إلغاء", "Cancel")}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function ApplicationsModal({ listing, visible, onClose, apiFetch, queryClient, token }: any) {
  const { data: apps = [], isLoading } = useQuery<any[]>({
    queryKey: ["listing-apps", listing?.id],
    queryFn: () => apiFetch(`/tutoring-listings/${listing?.id}/applications`),
    enabled: !!listing,
  });

  const accept = async (appId: number) => {
    await apiFetch(`/tutoring-listings/applications/${appId}/accept`, { method: "POST", body: JSON.stringify({}) });
    queryClient.invalidateQueries({ queryKey: ["listing-apps", listing?.id] });
  };
  const decline = async (appId: number) => {
    await apiFetch(`/tutoring-listings/applications/${appId}/decline`, { method: "POST", body: JSON.stringify({}) });
    queryClient.invalidateQueries({ queryKey: ["listing-apps", listing?.id] });
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalBox, { maxHeight: "80%" }]}>
          <View style={{ flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <Text style={styles.modalTitle}>طلبات الطلاب</Text>
            <Pressable onPress={onClose}><Feather name="x" size={20} color={C.textMuted} /></Pressable>
          </View>
          {isLoading ? <ActivityIndicator color={C.tint} /> : (
            <ScrollView>
              {apps.length === 0 ? (
                <Text style={{ textAlign: "center", color: C.textMuted, paddingVertical: 20 }}>لا توجد طلبات بعد</Text>
              ) : apps.map((app: any) => (
                <View key={app.id} style={{ borderBottomWidth: 1, borderBottomColor: C.cardBorder, paddingVertical: 12 }}>
                  <View style={{ flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                    <View>
                      <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 14, color: C.text, textAlign: "right" }}>{app.studentNameAr || app.studentName}</Text>
                      <Text style={{ fontFamily: "Inter_400Regular", fontSize: 12, color: C.textMuted }}>{app.studentEmail}</Text>
                    </View>
                    <StatusBadge status={app.status} />
                  </View>
                  {app.message ? <Text style={{ fontFamily: "Inter_400Regular", fontSize: 13, color: C.textSecondary, textAlign: "right", marginBottom: 8 }}>{app.message}</Text> : null}
                  {app.status === "pending" && (
                    <View style={{ flexDirection: "row-reverse", gap: 8 }}>
                      <Pressable style={[styles.applyBtn, { flex: 1, paddingVertical: 8 }]} onPress={() => accept(app.id)}>
                        <Text style={styles.applyBtnText}>قبول</Text>
                      </Pressable>
                      <Pressable style={[styles.cancelBtn, { flex: 1, paddingVertical: 8 }]} onPress={() => decline(app.id)}>
                        <Text style={styles.cancelBtnText}>رفض</Text>
                      </Pressable>
                    </View>
                  )}
                  {app.status === "accepted" && (
                    <Pressable
                      style={{ marginTop: 8, padding: 8, backgroundColor: C.tint, borderRadius: 8 }}
                      onPress={() => {
                        const webAppDomain = process.env.EXPO_PUBLIC_DOMAIN || 'eduonline.net.ly';
                        import('react-native').then(m => m.Linking.openURL(`https://${webAppDomain}/tutoring/room/${app.id}?token=${token}&type=listing`));
                      }}
                    >
                      <Text style={{ color: '#fff', textAlign: 'center', fontFamily: 'Inter_600SemiBold', fontSize: 13 }}>Join Session (Browser)</Text>
                    </Pressable>
                  )}
                </View>
              ))}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

export default function TutoringScreen() {
  const insets = useSafeAreaInsets();
  const { user, token } = useAuth();
  const { apiFetch } = useApi();
  const queryClient = useQueryClient();
  const { t } = useLanguage();
  const [tab, setTab] = useState<"browse" | "mine">("browse");
  const [applyFor, setApplyFor] = useState<any>(null);
  const [appsFor, setAppsFor] = useState<any>(null);

  const isTeacher = user?.role === "teacher" || user?.role === "admin";
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const { data: listings = [], isLoading } = useQuery<any[]>({
    queryKey: ["tutoring-listings"],
    queryFn: () => apiFetch("/tutoring-listings"),
  });

  const { data: myListings = [] } = useQuery<any[]>({
    queryKey: ["tutoring-listings-my"],
    queryFn: () => apiFetch("/tutoring-listings/my"),
    enabled: isTeacher,
  });

  const { data: myApps = [] } = useQuery<any[]>({
    queryKey: ["tutoring-my-apps"],
    queryFn: () => apiFetch("/tutoring-listings/my-applications/list"),
    enabled: !!user && !isTeacher,
  });

  const handleApply = async (listing: any, message: string) => {
    try {
      await apiFetch(`/tutoring-listings/${listing.id}/apply`, {
        method: "POST",
        body: JSON.stringify({ message }),
      });
      Alert.alert(t("تم!", "Done!"), t("تم تقديم طلبك بنجاح. سيتواصل معك المعلم قريباً.", "Your application was submitted successfully."));
      queryClient.invalidateQueries({ queryKey: ["tutoring-my-apps"] });
      setApplyFor(null);
    } catch (err: any) {
      Alert.alert(t("خطأ", "Error"), err.message || t("فشل تقديم الطلب", "Failed to submit application"));
    }
  };

  const displayData = tab === "browse" ? listings : (isTeacher ? myListings : myApps);

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: topPad + 16 }]}>
        <Text style={styles.headerTitle}>{t("الدروس الخصوصية", "Private Tutoring")}</Text>
        <Text style={styles.headerSubtitle}>
          {isTeacher ? t("أنشئ إعلاناتك واستقبل طلبات الطلاب", "Create listings and receive student applications") : t("تصفّح المعلمين المتاحين", "Browse available teachers")}
        </Text>
      </View>

      <View style={styles.tabRow}>
        <Pressable style={[styles.tabBtn, tab === "browse" && styles.tabBtnActive]} onPress={() => setTab("browse")}>
          <Text style={[styles.tabBtnText, tab === "browse" && styles.tabBtnTextActive]}>{t("تصفّح", "Browse")}</Text>
        </Pressable>
        <Pressable style={[styles.tabBtn, tab === "mine" && styles.tabBtnActive]} onPress={() => setTab("mine")}>
          <Text style={[styles.tabBtnText, tab === "mine" && styles.tabBtnTextActive]}>
            {isTeacher ? t("إعلاناتي", "My Listings") : t("طلباتي", "My Applications")}
          </Text>
        </Pressable>
      </View>

      {isLoading && tab === "browse" ? (
        <ActivityIndicator color={C.tint} style={{ flex: 1 }} />
      ) : tab === "browse" ? (
        <FlatList
          data={listings as any[]}
          keyExtractor={item => item.id.toString()}
          renderItem={({ item }) => (
            <ListingCard
              listing={item}
              isTeacher={isTeacher}
              onApply={() => {
                if (!user) { router.push("/auth/login"); return; }
                setApplyFor(item);
              }}
              onViewApps={setAppsFor}
            />
          )}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: Platform.OS === "web" ? 34 : insets.bottom + 90, paddingTop: 8, gap: 14 }}
          ListEmptyComponent={() => (
            <View style={styles.emptyState}>
              <Feather name="book-open" size={48} color={C.textMuted} />
              <Text style={styles.emptyTitle}>{t("لا توجد إعلانات متاحة", "No listings available")}</Text>
              <Text style={styles.emptySubtitle}>{t("سيُضاف معلمون قريباً", "Teachers will be added soon")}</Text>
            </View>
          )}
        />
      ) : isTeacher ? (
        <FlatList
          data={myListings as any[]}
          keyExtractor={item => item.id.toString()}
          renderItem={({ item }) => (
            <ListingCard listing={item} isTeacher onApply={() => {}} onViewApps={setAppsFor} />
          )}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: Platform.OS === "web" ? 34 : insets.bottom + 90, paddingTop: 8, gap: 14 }}
          ListEmptyComponent={() => (
            <View style={styles.emptyState}>
              <Feather name="plus-circle" size={48} color={C.textMuted} />
              <Text style={styles.emptyTitle}>لم تنشر أي إعلان</Text>
              <Text style={styles.emptySubtitle}>أنشئ إعلانًا من لوحة تحكم المعلم</Text>
            </View>
          )}
        />
      ) : (
        <FlatList
          data={myApps as any[]}
          keyExtractor={item => item.id.toString()}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={{ flexDirection: "row-reverse", justifyContent: "space-between", marginBottom: 6 }}>
                <StatusBadge status={item.status} />
                <Text style={styles.meta}>{new Date(item.createdAt).toLocaleDateString("ar-LY")}</Text>
              </View>
              <Text style={styles.cardTitle}>{item.listing?.titleAr || "–"}</Text>
              <Text style={styles.teacherName}>{item.teacherNameAr}</Text>
              {item.message ? <Text style={{ fontFamily: "Inter_400Regular", fontSize: 13, color: C.textSecondary, marginTop: 6, textAlign: "right" }}>{item.message}</Text> : null}
              {item.teacherNote ? <Text style={{ fontFamily: "Inter_400Regular", fontSize: 13, color: C.tint, marginTop: 6, textAlign: "right", backgroundColor: `${C.tint}10`, padding: 8, borderRadius: 8 }}>ملاحظة المعلم: {item.teacherNote}</Text> : null}
              {item.status === "accepted" && (
                <Pressable
                  style={{ marginTop: 8, padding: 8, backgroundColor: C.tint, borderRadius: 8 }}
                  onPress={() => {
                    const webAppDomain = process.env.EXPO_PUBLIC_DOMAIN || 'eduonline.net.ly';
                    import('react-native').then(m => m.Linking.openURL(`https://${webAppDomain}/tutoring/room/${item.id}?token=${token}&type=listing`));
                  }}
                >
                  <Text style={{ color: '#fff', textAlign: 'center', fontFamily: 'Inter_600SemiBold', fontSize: 13 }}>Join Session (Browser)</Text>
                </Pressable>
              )}
            </View>
          )}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: Platform.OS === "web" ? 34 : insets.bottom + 90, paddingTop: 8, gap: 14 }}
          ListEmptyComponent={() => (
            <View style={styles.emptyState}>
              <Feather name="send" size={48} color={C.textMuted} />
              <Text style={styles.emptyTitle}>لا توجد طلبات</Text>
              <Text style={styles.emptySubtitle}>تصفّح المعلمين وتقدّم لدرس</Text>
            </View>
          )}
        />
      )}

      <ApplyModal listing={applyFor} visible={!!applyFor} onClose={() => setApplyFor(null)} onApply={handleApply} />
      <ApplicationsModal listing={appsFor} visible={!!appsFor} onClose={() => setAppsFor(null)} apiFetch={apiFetch} queryClient={queryClient} token={token} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
  header: { paddingHorizontal: 20, paddingBottom: 16 },
  headerTitle: { fontFamily: "Inter_700Bold", fontSize: 28, color: C.text },
  headerSubtitle: { fontFamily: "Inter_400Regular", fontSize: 13, color: C.textSecondary, marginTop: 4 },
  tabRow: { flexDirection: "row-reverse", paddingHorizontal: 20, paddingBottom: 8, gap: 10 },
  tabBtn: { flex: 1, paddingVertical: 10, borderRadius: 12, backgroundColor: C.pill, alignItems: "center" },
  tabBtnActive: { backgroundColor: C.tint },
  tabBtnText: { fontFamily: "Inter_600SemiBold", fontSize: 14, color: C.textSecondary },
  tabBtnTextActive: { color: "#fff" },
  card: {
    backgroundColor: C.card,
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: C.cardBorder,
    shadowColor: C.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 2,
  },
  cardTitle: { fontFamily: "Inter_700Bold", fontSize: 16, color: C.text, textAlign: "right", lineHeight: 22 },
  teacherName: { fontFamily: "Inter_500Medium", fontSize: 13, color: C.tint, textAlign: "right", marginTop: 2 },
  rateTag: { backgroundColor: `${C.tint}15`, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  rateText: { fontFamily: "Inter_700Bold", fontSize: 12, color: C.tint },
  chip: { backgroundColor: C.pill, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  chipText: { fontFamily: "Inter_500Medium", fontSize: 11, color: C.textSecondary },
  desc: { fontFamily: "Inter_400Regular", fontSize: 13, color: C.textSecondary, textAlign: "right", lineHeight: 18, marginBottom: 8 },
  meta: { fontFamily: "Inter_400Regular", fontSize: 12, color: C.textMuted },
  applyBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: C.tint, borderRadius: 14, paddingVertical: 12 },
  applyBtnText: { fontFamily: "Inter_600SemiBold", fontSize: 14, color: "#fff" },
  cancelBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: C.pill, borderRadius: 14, paddingVertical: 12 },
  cancelBtnText: { fontFamily: "Inter_600SemiBold", fontSize: 14, color: C.textSecondary },
  emptyState: { alignItems: "center", paddingTop: 60, gap: 12 },
  emptyTitle: { fontFamily: "Inter_600SemiBold", fontSize: 17, color: C.text },
  emptySubtitle: { fontFamily: "Inter_400Regular", fontSize: 13, color: C.textSecondary, textAlign: "center" },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalBox: { backgroundColor: C.background, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24 },
  modalTitle: { fontFamily: "Inter_700Bold", fontSize: 20, color: C.text, textAlign: "right", marginBottom: 14 },
  modalInfo: { backgroundColor: C.pill, borderRadius: 14, padding: 14, marginBottom: 14 },
  modalInfoTitle: { fontFamily: "Inter_700Bold", fontSize: 15, color: C.text, textAlign: "right" },
  modalInfoSub: { fontFamily: "Inter_400Regular", fontSize: 13, color: C.textSecondary, textAlign: "right", marginTop: 4 },
  modalInfoRate: { fontFamily: "Inter_700Bold", fontSize: 16, color: C.tint, textAlign: "right", marginTop: 6 },
  inputLabel: { fontFamily: "Inter_600SemiBold", fontSize: 13, color: C.textSecondary, textAlign: "right", marginBottom: 6 },
  textArea: {
    backgroundColor: C.pill,
    borderRadius: 12,
    padding: 12,
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: C.text,
    minHeight: 100,
    textAlignVertical: "top",
    borderWidth: 1,
    borderColor: C.cardBorder,
  },
});
