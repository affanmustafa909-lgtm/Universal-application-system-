import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  Text,
  View,
} from "react-native";
import { maybeUploadToGoogleDrive } from "./googleDrive";
import { MzGuidedCameraCapture } from "./MzGuidedCameraCapture";
import {
  captureConditionVideo,
  isVideoUri,
  pickFromGallery,
  uriToDataUrl,
  type CaptureKind,
} from "./mediaCapture";
import { useMz } from "./theme";

export type AttachBundle = {
  photoDataUrl: string | null;
  cnicFrontDataUrl: string | null;
  cnicBackDataUrl: string | null;
  otherPhotoDataUrl: string | null;
};

type Props = {
  value: AttachBundle;
  onChange: (next: AttachBundle) => void;
  photoLabel?: string;
};

type Slot = {
  key: keyof AttachBundle;
  kind: CaptureKind;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  hint: string;
};

const SLOTS: Slot[] = [
  {
    key: "photoDataUrl",
    kind: "photo",
    label: "Face photo",
    icon: "person-circle-outline",
    hint: "Face template",
  },
  {
    key: "cnicFrontDataUrl",
    kind: "cnic-front",
    label: "CNIC front",
    icon: "card-outline",
    hint: "Card template",
  },
  {
    key: "cnicBackDataUrl",
    kind: "cnic-back",
    label: "CNIC back",
    icon: "card-outline",
    hint: "Card template",
  },
  {
    key: "otherPhotoDataUrl",
    kind: "condition",
    label: "Phone condition",
    icon: "phone-portrait-outline",
    hint: "Photo / Video",
  },
];

export function MzAttachStrip({
  value,
  onChange,
  photoLabel = "Face photo",
}: Props): React.JSX.Element {
  const mz = useMz();
  const [busy, setBusy] = useState<CaptureKind | null>(null);
  const [guidedKind, setGuidedKind] = useState<CaptureKind | null>(null);

  async function applyCaptured(kind: CaptureKind, uri: string): Promise<void> {
    const slot = SLOTS.find((s) => s.kind === kind);
    if (!slot) return;
    setBusy(kind);
    try {
      if (isVideoUri(uri)) {
        // Keep file URI for video (too large for data URL); Drive upload if configured.
        const stored = await maybeUploadToGoogleDrive(uri, `${slot.kind}-${Date.now()}.mp4`);
        onChange({ ...value, [slot.key]: stored || uri });
        return;
      }
      const dataUrl = await uriToDataUrl(uri);
      const stored = await maybeUploadToGoogleDrive(
        dataUrl,
        `${slot.kind}-${Date.now()}.jpg`,
      );
      onChange({ ...value, [slot.key]: stored });
    } catch (err) {
      Alert.alert("Photo", err instanceof Error ? err.message : "Could not save media");
    } finally {
      setBusy(null);
    }
  }

  async function captureFromGallery(slot: Slot): Promise<void> {
    setBusy(slot.kind);
    try {
      const dataUrl = await pickFromGallery(slot.kind);
      if (!dataUrl) return;
      if (isVideoUri(dataUrl)) {
        const stored = await maybeUploadToGoogleDrive(
          dataUrl,
          `${slot.kind}-${Date.now()}.mp4`,
        );
        onChange({ ...value, [slot.key]: stored || dataUrl });
        return;
      }
      const stored = await maybeUploadToGoogleDrive(
        dataUrl,
        `${slot.kind}-${Date.now()}.jpg`,
      );
      onChange({ ...value, [slot.key]: stored });
    } catch (err) {
      Alert.alert("Photo", err instanceof Error ? err.message : "Could not open gallery");
    } finally {
      setBusy(null);
    }
  }

  async function recordVideo(): Promise<void> {
    setBusy("condition");
    try {
      const uri = await captureConditionVideo();
      if (!uri) return;
      await applyCaptured("condition", uri);
    } catch (err) {
      Alert.alert("Video", err instanceof Error ? err.message : "Could not open video camera");
      setBusy(null);
    }
  }

  function openSlot(slot: Slot): void {
    if (slot.kind !== "condition") {
      setGuidedKind(slot.kind);
      return;
    }
    // Condition: let user pick photo vs real video recorder (not still camera).
    Alert.alert("Phone condition", "Live camera photo, live video record, or gallery?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Photo",
        onPress: () => setGuidedKind("condition"),
      },
      {
        text: "Video (live)",
        onPress: () => void recordVideo(),
      },
      {
        text: "Gallery",
        onPress: () => void captureFromGallery(slot),
      },
    ]);
  }

  return (
    <View style={{ gap: 6 }}>
      <Text
        style={{
          color: mz.muted,
          fontSize: 11,
          fontWeight: "800",
          letterSpacing: 0.5,
          textTransform: "uppercase",
        }}
      >
        Photos · CNIC · condition (photo / video) · gallery (long-press)
      </Text>
      <View style={{ flexDirection: "row", gap: 6 }}>
        {SLOTS.map((slot) => {
          const uri = value[slot.key];
          const label = slot.key === "photoDataUrl" ? photoLabel : slot.label;
          const loading = busy === slot.kind;
          const video = isVideoUri(uri);
          return (
            <Pressable
              key={slot.key}
              onPress={() => openSlot(slot)}
              onLongPress={() => void captureFromGallery(slot)}
              style={({ pressed }) => ({
                flex: 1,
                minWidth: 0,
                backgroundColor: mz.cardSoft,
                borderRadius: 10,
                borderWidth: 1,
                borderColor: mz.border,
                padding: 6,
                alignItems: "center",
                gap: 3,
                minHeight: 96,
                opacity: pressed ? 0.9 : 1,
              })}
            >
              {uri ? (
                !video &&
                (uri.startsWith("data:image") || /\.(jpe?g|png|webp|gif)(\?|$)/i.test(uri)) ? (
                  <Image
                    source={{ uri }}
                    style={{
                      width: "100%",
                      aspectRatio: 1.15,
                      borderRadius: 8,
                      backgroundColor: mz.navy,
                    }}
                  />
                ) : (
                  <View
                    style={{
                      width: "100%",
                      aspectRatio: 1.15,
                      borderRadius: 8,
                      backgroundColor: mz.navy,
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 4,
                    }}
                  >
                    <Ionicons name="videocam" size={22} color={mz.accent} />
                    <Text style={{ color: mz.onNavy, fontSize: 9, fontWeight: "800" }}>VIDEO</Text>
                  </View>
                )
              ) : (
                <View
                  style={{
                    width: "100%",
                    aspectRatio: 1.15,
                    borderRadius: 8,
                    backgroundColor: mz.inputBg,
                    borderWidth: 1,
                    borderColor: mz.border,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {loading ? (
                    <ActivityIndicator color={mz.accent} />
                  ) : (
                    <Ionicons
                      name={slot.kind === "condition" ? "videocam-outline" : slot.icon}
                      size={20}
                      color={mz.accent}
                    />
                  )}
                </View>
              )}
              <Text
                style={{ color: mz.ink, fontSize: 10, fontWeight: "800" }}
                numberOfLines={1}
              >
                {uri ? `${label} ✓` : label}
              </Text>
              <Text style={{ color: mz.muted, fontSize: 9, fontWeight: "600" }}>{slot.hint}</Text>
              {uri ? (
                <Pressable
                  hitSlop={8}
                  onPress={() => onChange({ ...value, [slot.key]: null })}
                  style={{ position: "absolute", top: 2, right: 2 }}
                >
                  <Ionicons name="close-circle" size={15} color={mz.rose} />
                </Pressable>
              ) : null}
            </Pressable>
          );
        })}
      </View>

      {guidedKind ? (
        <MzGuidedCameraCapture
          visible
          kind={guidedKind}
          onClose={() => setGuidedKind(null)}
          onCaptured={(uri) => {
            const kind = guidedKind;
            setGuidedKind(null);
            void applyCaptured(kind, uri);
          }}
        />
      ) : null}
    </View>
  );
}
