import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Device from "expo-device";
import { Platform } from "react-native";

/**
 * Device fingerprint for student device binding: a persistent random UUID in
 * AsyncStorage. Reinstalling the app looks like a new device — acceptable,
 * since switching devices only requires passing the face identity check.
 */

const STORAGE_KEY = "lms_device_id";

function randomId(): string {
  // RFC4122-ish v4 without needing expo-crypto
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export async function getDeviceFingerprint(): Promise<string> {
  let id = await AsyncStorage.getItem(STORAGE_KEY);
  if (!id) {
    id = randomId();
    await AsyncStorage.setItem(STORAGE_KEY, id);
  }
  return id;
}

export function getDeviceName(): string {
  const model = Device.modelName || Device.deviceName || "Mobile device";
  return `${model} (${Platform.OS})`;
}

export async function getDeviceInfo() {
  return {
    deviceFingerprint: await getDeviceFingerprint(),
    deviceName: getDeviceName(),
    devicePlatform: Platform.OS === "ios" ? "ios" : "android",
  };
}
