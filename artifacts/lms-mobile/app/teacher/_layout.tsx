import { Stack } from "expo-router";
import React from "react";

export default function TeacherLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="edit-course" />
    </Stack>
  );
}
