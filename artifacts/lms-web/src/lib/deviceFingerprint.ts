/**
 * Device fingerprint for student device binding.
 *
 * Approach: a persistent random UUID stored in localStorage. Simple,
 * dependency-free and stable. Clearing browser storage makes this look like a
 * new device — acceptable, since switching devices only requires passing the
 * face identity check.
 */

const STORAGE_KEY = "lms_device_id";

export function getDeviceFingerprint(): string {
  let id = localStorage.getItem(STORAGE_KEY);
  if (!id) {
    id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    localStorage.setItem(STORAGE_KEY, id);
  }
  return id;
}

/** Human-readable device name derived from the user agent (shown to admins). */
export function getDeviceName(): string {
  const ua = navigator.userAgent;
  let browser = "Browser";
  if (ua.includes("Edg/")) browser = "Edge";
  else if (ua.includes("Chrome/")) browser = "Chrome";
  else if (ua.includes("Firefox/")) browser = "Firefox";
  else if (ua.includes("Safari/")) browser = "Safari";

  let os = "Unknown OS";
  if (ua.includes("Windows")) os = "Windows";
  else if (ua.includes("Mac OS")) os = "macOS";
  else if (ua.includes("Android")) os = "Android";
  else if (ua.includes("iPhone") || ua.includes("iPad")) os = "iOS";
  else if (ua.includes("Linux")) os = "Linux";

  return `${browser} on ${os}`;
}

/** Extra payload appended to auth requests for device binding. */
export function getDeviceInfo() {
  return {
    deviceFingerprint: getDeviceFingerprint(),
    deviceName: getDeviceName(),
    devicePlatform: "web" as const,
  };
}
