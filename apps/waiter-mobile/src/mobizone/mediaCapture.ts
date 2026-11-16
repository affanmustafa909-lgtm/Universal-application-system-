import * as FileSystem from "expo-file-system";
import * as ImagePicker from "expo-image-picker";
import { Platform } from "react-native";

export type CaptureKind = "photo" | "cnic-front" | "cnic-back" | "condition";

async function ensureCameraPermission(): Promise<boolean> {
  const current = await ImagePicker.getCameraPermissionsAsync();
  if (current.granted) return true;
  const asked = await ImagePicker.requestCameraPermissionsAsync();
  return asked.granted;
}

export async function uriToDataUrl(uri: string, mime = "image/jpeg"): Promise<string> {
  if (uri.startsWith("data:")) return uri;
  if (Platform.OS === "web") {
    const res = await fetch(uri);
    const blob = await res.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(String(reader.result ?? ""));
      reader.onerror = () => reject(new Error("Could not read photo"));
      reader.readAsDataURL(blob);
    });
  }
  const base64 = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  return `data:${mime};base64,${base64}`;
}

/**
 * Opens the device camera (not gallery) for party photo or CNIC sides.
 * Returns a data URL ready to persist on purchase/sale/customer records.
 */
export async function captureWithCamera(kind: CaptureKind): Promise<string | null> {
  const ok = await ensureCameraPermission();
  if (!ok) {
    throw new Error("Camera permission is required to capture photos / CNIC.");
  }

  const isCnic = kind === "cnic-front" || kind === "cnic-back";
  const isCondition = kind === "condition";
  const result = await ImagePicker.launchCameraAsync({
    // Condition default path is photo; use captureConditionVideo() for video recorder.
    mediaTypes: ["images"],
    allowsEditing: !isCondition,
    aspect: isCnic ? [16, 10] : isCondition ? undefined : [3, 4],
    quality: 0.72,
    cameraType: isCnic || isCondition ? ImagePicker.CameraType.back : ImagePicker.CameraType.front,
    exif: false,
  });

  if (result.canceled || !result.assets[0]?.uri) return null;
  const asset = result.assets[0];
  const mime = asset.mimeType || (asset.type === "video" ? "video/mp4" : "image/jpeg");
  // Videos stay as file URIs (too large for data URLs); images become data URLs.
  if (asset.type === "video" || mime.startsWith("video/")) {
    return asset.uri.startsWith("data:") ? asset.uri : asset.uri;
  }
  return uriToDataUrl(asset.uri, mime);
}

/**
 * Opens the native video recorder (not still-photo camera) for phone-condition proof.
 * Returns a file URI (not a data URL).
 */
export async function captureConditionVideo(): Promise<string | null> {
  const ok = await ensureCameraPermission();
  if (!ok) {
    throw new Error("Camera permission is required to record condition video.");
  }
  // Android also needs mic for video with audio.
  try {
    await ImagePicker.requestCameraPermissionsAsync();
  } catch {
    // ignore
  }
  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ["videos"],
    allowsEditing: false,
    quality: 0.72,
    videoMaxDuration: 45,
    cameraType: ImagePicker.CameraType.back,
    exif: false,
  });
  if (result.canceled || !result.assets[0]?.uri) return null;
  const asset = result.assets[0];
  return asset.uri.startsWith("data:") ? asset.uri : asset.uri;
}

export function isVideoUri(uri: string | null | undefined): boolean {
  if (!uri) return false;
  if (uri.startsWith("data:video")) return true;
  return /\.(mp4|mov|webm|m4v|avi)(\?|$)/i.test(uri) || /\/video\//i.test(uri);
}

async function ensureLibraryPermission(): Promise<boolean> {
  const current = await ImagePicker.getMediaLibraryPermissionsAsync();
  if (current.granted) return true;
  const asked = await ImagePicker.requestMediaLibraryPermissionsAsync();
  return asked.granted;
}

/** Gallery / file picker for accessories & CNIC when camera is unavailable. */
export async function pickFromGallery(kind: CaptureKind): Promise<string | null> {
  const ok = await ensureLibraryPermission();
  if (!ok) {
    throw new Error("Gallery permission is required to pick photos.");
  }
  const isCnic = kind === "cnic-front" || kind === "cnic-back";
  const isCondition = kind === "condition";
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: isCondition ? ["images", "videos"] : ["images"],
    allowsEditing: !isCondition,
    aspect: isCnic ? [16, 10] : isCondition ? undefined : [3, 4],
    quality: 0.72,
    exif: false,
  });
  if (result.canceled || !result.assets[0]?.uri) return null;
  const asset = result.assets[0];
  const mime = asset.mimeType || (asset.type === "video" ? "video/mp4" : "image/jpeg");
  if (asset.type === "video" || mime.startsWith("video/")) {
    return asset.uri.startsWith("data:") ? asset.uri : asset.uri;
  }
  return uriToDataUrl(asset.uri, mime);
}
