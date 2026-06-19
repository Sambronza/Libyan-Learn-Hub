import { BlurView } from "expo-blur";
import { Tabs } from "expo-router";
import { Feather, Ionicons } from "@expo/vector-icons";
import React from "react";
import { Platform, StyleSheet, View, useColorScheme } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Colors from "@/constants/colors";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const isIOS = Platform.OS === "ios";
  const isWeb = Platform.OS === "web";
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { t } = useLanguage();

  const isTeacher = user?.role === "teacher" || user?.role === "admin";

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors.light.tint,
        tabBarInactiveTintColor: Colors.light.tabIconDefault,
        headerShown: false,
        tabBarStyle: {
          position: "absolute",
          backgroundColor: isIOS ? "transparent" : isDark ? "#0F172A" : "#fff",
          borderTopWidth: isWeb ? 1 : 0,
          borderTopColor: isDark ? "#1E293B" : "#E2E8F0",
          elevation: 0,
          paddingBottom: isWeb ? 0 : insets.bottom,
          ...(isWeb ? { height: 84 } : {}),
        },
        tabBarLabelStyle: {
          fontFamily: "Inter_500Medium",
          fontSize: 10,
          marginTop: -2,
        },
        tabBarBackground: () =>
          isIOS ? (
            <BlurView
              intensity={100}
              tint={isDark ? "dark" : "light"}
              style={StyleSheet.absoluteFill}
            />
          ) : isWeb ? (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: isDark ? "#0F172A" : "#fff" }]} />
          ) : null,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t("الرئيسية", "Home"),
          tabBarIcon: ({ color }) => <Feather name="home" size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="courses"
        options={{
          title: t("استكشف", "Explore"),
          tabBarIcon: ({ color }) => <Feather name="compass" size={22} color={color} />,
        }}
      />

      {/* Teacher sees "Manage" tab; students see "My Learning" */}
      <Tabs.Screen
        name="my-learning"
        options={{
          title: isTeacher ? t("تدريسي", "Teaching") : t("تعلمي", "My Learning"),
          tabBarIcon: ({ color }) =>
            isTeacher
              ? <Feather name="briefcase" size={22} color={color} />
              : <Ionicons name="school-outline" size={22} color={color} />,
        }}
      />

      <Tabs.Screen
        name="academy"
        options={{
          title: t("الأكاديمية", "Academy"),
          tabBarIcon: ({ color }) => <Ionicons name="school" size={22} color={color} />,
        }}
      />

      <Tabs.Screen
        name="profile"
        options={{
          title: t("حسابي", "Profile"),
          tabBarIcon: ({ color }) => <Feather name="user" size={22} color={color} />,
        }}
      />

      {/* Hidden tabs - still accessible via routes but not shown in tab bar */}
      <Tabs.Screen
        name="tutoring"
        options={{
          href: null, // Hide from tab bar
        }}
      />
      <Tabs.Screen
        name="live"
        options={{
          href: null, // Hide from tab bar
        }}
      />
    </Tabs>
  );
}
