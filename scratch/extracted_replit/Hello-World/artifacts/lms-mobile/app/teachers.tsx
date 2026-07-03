import React, { useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import Colors from "@/constants/colors";
import { useApi } from "@/hooks/useApi";
import { ReportModal } from "@/components/ReportModal";

const C = Colors.light;

interface Teacher {
  id: number;
  fullName: string;
  fullNameAr?: string;
  email: string;
  bioAr?: string;
  expertise?: string;
  isTutoringEnabled?: boolean;
}

function TeacherCard({ teacher, onReport }: { teacher: Teacher; onReport: (id: number) => void }) {
  const name = teacher.fullNameAr || teacher.fullName;
  const initial = name.charAt(0).toUpperCase();

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initial}</Text>
        </View>
        <View style={styles.info}>
          <Text style={styles.name} numberOfLines={1}>{name}</Text>
          {teacher.expertise ? (
            <Text style={styles.expertise} numberOfLines={1}>{teacher.expertise}</Text>
          ) : (
            <Text style={styles.expertise} numberOfLines={1}>معلم في إديوليبيا</Text>
          )}
        </View>
        <Pressable onPress={() => onReport(teacher.id)} style={styles.reportBtn}>
          <Feather name="flag" size={16} color={C.textMuted} />
        </Pressable>
      </View>
      
      {teacher.bioAr && (
        <Text style={styles.bio} numberOfLines={2}>{teacher.bioAr}</Text>
      )}

      {teacher.isTutoringEnabled && (
        <View style={styles.tutorBadge}>
          <Feather name="book-open" size={12} color={C.tint} />
          <Text style={styles.tutorBadgeText}>متاح للدروس الخصوصية</Text>
        </View>
      )}
    </View>
  );
}

export default function TeachersScreen() {
  const insets = useSafeAreaInsets();
  const { apiFetch } = useApi();
  const [search, setSearch] = useState("");
  const [tutorOnly, setTutorOnly] = useState(false);
  const [reportTeacherId, setReportTeacherId] = useState<number | null>(null);

  const { data: teachers, isLoading } = useQuery<Teacher[]>({
    queryKey: ["teachers"],
    queryFn: () => apiFetch("/teachers"),
  });

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const filtered = (teachers || []).filter((t) => {
    const matchesSearch = !search || 
      (t.fullName.toLowerCase().includes(search.toLowerCase())) ||
      (t.fullNameAr && t.fullNameAr.includes(search)) ||
      (t.expertise && t.expertise.toLowerCase().includes(search.toLowerCase()));
    
    const matchesTutor = !tutorOnly || t.isTutoringEnabled;
    return matchesSearch && matchesTutor;
  });

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: topPad + 12 }]}>
        <View style={styles.headerTop}>
          <Text style={styles.headerTitle}>نخبة المعلمين</Text>
          <Pressable style={styles.backBtn} onPress={() => router.back()}>
            <Feather name="arrow-right" size={20} color={C.text} />
          </Pressable>
        </View>

        <View style={styles.searchRow}>
          <View style={styles.searchBox}>
            <Feather name="search" size={18} color={C.textMuted} />
            <TextInput
              style={styles.searchInput}
              value={search}
              onChangeText={setSearch}
              placeholder="ابحث عن معلم أو مادة..."
              textAlign="right"
              placeholderTextColor={C.textMuted}
            />
          </View>
        </View>

        <Pressable 
          style={[styles.filterBtn, tutorOnly && styles.filterBtnActive]} 
          onPress={() => setTutorOnly(!tutorOnly)}
        >
          <Feather name="check-circle" size={14} color={tutorOnly ? C.tint : C.textMuted} />
          <Text style={[styles.filterBtnText, tutorOnly && styles.filterBtnTextActive]}>متاح للدروس الخصوصية فقط</Text>
        </Pressable>
      </View>

      {isLoading ? (
        <ActivityIndicator color={C.tint} style={{ flex: 1 }} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id.toString()}
          renderItem={({ item }) => <TeacherCard teacher={item} onReport={setReportTeacherId} />}
          contentContainerStyle={{
            paddingHorizontal: 20,
            paddingBottom: insets.bottom + 20,
            paddingTop: 16,
            gap: 14,
          }}
          ListEmptyComponent={() => (
            <View style={styles.emptyState}>
              <Feather name="users" size={48} color={C.textMuted} style={{ opacity: 0.3, marginBottom: 12 }} />
              <Text style={styles.emptyTitle}>لا يوجد معلمين</Text>
            </View>
          )}
        />
      )}

      {reportTeacherId && (
        <ReportModal 
          visible={true} 
          onClose={() => setReportTeacherId(null)} 
          type="teacher" 
          targetId={reportTeacherId} 
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
  header: {
    backgroundColor: C.background,
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: C.cardBorder,
  },
  headerTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  headerTitle: { fontFamily: "Inter_700Bold", fontSize: 20, color: C.text },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: C.backgroundSecondary,
    alignItems: "center",
    justifyContent: "center",
  },
  searchRow: { flexDirection: "row", gap: 10, marginBottom: 12 },
  searchBox: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: C.backgroundSecondary,
    borderRadius: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: C.cardBorder,
    height: 44,
  },
  searchInput: {
    flex: 1,
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: C.text,
    marginLeft: 8,
    height: "100%",
  },
  filterBtn: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-end",
    backgroundColor: C.backgroundSecondary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: C.cardBorder,
  },
  filterBtnActive: {
    backgroundColor: `${C.tint}15`,
    borderColor: C.tint,
  },
  filterBtnText: { fontFamily: "Inter_500Medium", fontSize: 12, color: C.textSecondary },
  filterBtnTextActive: { color: C.tint },
  card: {
    backgroundColor: C.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: C.cardBorder,
  },
  cardHeader: {
    flexDirection: "row-reverse",
    alignItems: "center",
    marginBottom: 10,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 16,
    backgroundColor: `${C.tint}15`,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 12,
  },
  avatarText: { fontFamily: "Inter_700Bold", fontSize: 20, color: C.tint },
  info: { flex: 1 },
  name: { fontFamily: "Inter_600SemiBold", fontSize: 15, color: C.text, textAlign: "right", marginBottom: 4 },
  expertise: { fontFamily: "Inter_400Regular", fontSize: 13, color: C.textSecondary, textAlign: "right" },
  reportBtn: { padding: 8, marginRight: -8 },
  bio: { fontFamily: "Inter_400Regular", fontSize: 13, color: C.textMuted, textAlign: "right", lineHeight: 20, marginBottom: 12 },
  tutorBadge: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-end",
    backgroundColor: `${C.tint}15`,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  tutorBadgeText: { fontFamily: "Inter_500Medium", fontSize: 11, color: C.tint },
  emptyState: { padding: 40, alignItems: "center" },
  emptyTitle: { fontFamily: "Inter_600SemiBold", fontSize: 16, color: C.text },
});
