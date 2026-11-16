import { Ionicons } from "@expo/vector-icons";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useRef, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import type { CaptureKind } from "./mediaCapture";
import { useMz } from "./theme";

type Props = {
  visible: boolean;
  kind: CaptureKind;
  onClose: () => void;
  /** Returns a file URI (or data URL on web) ready to persist. */
  onCaptured: (uri: string) => void;
};

const META: Record<
  CaptureKind,
  {
    title: string;
    hint: string;
    badge: string;
    facing: "front" | "back";
    icon: keyof typeof Ionicons.glyphMap;
  }
> = {
  photo: {
    title: "Face photo",
    hint: "Chehra oval ke andar — saamne se seedha",
    badge: "Front camera",
    facing: "front",
    icon: "person-circle-outline",
  },
  "cnic-front": {
    title: "CNIC front",
    hint: "CNIC front card rectangle mein fit karein",
    badge: "ID front",
    facing: "back",
    icon: "card-outline",
  },
  "cnic-back": {
    title: "CNIC back",
    hint: "CNIC back (chip / MRZ) frame mein fit karein",
    badge: "ID back",
    facing: "back",
    icon: "card-outline",
  },
  condition: {
    title: "Phone condition · photo",
    hint: "Phone outline mein — scratches / screen clear (video alag option se)",
    badge: "Proof photo",
    facing: "back",
    icon: "phone-portrait-outline",
  },
};

/**
 * Custom camera with purpose-specific template overlays
 * (face oval, CNIC card, phone outline) — replaces bare ImagePicker for guided capture.
 */
export function MzGuidedCameraCapture({
  visible,
  kind,
  onClose,
  onCaptured,
}: Props): React.JSX.Element {
  const mz = useMz();
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const [busy, setBusy] = useState(false);
  const meta = META[kind];

  async function snap(): Promise<void> {
    if (busy) return;
    setBusy(true);
    try {
      const photo = await cameraRef.current?.takePictureAsync({
        quality: 0.72,
        skipProcessing: Platform.OS === "android",
      });
      if (!photo?.uri) {
        setBusy(false);
        return;
      }
      onCaptured(photo.uri);
      onClose();
    } catch {
      // keep open so user can retry
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: mz.navyDeep }}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
            paddingHorizontal: 14,
            paddingTop: 48,
            paddingBottom: 12,
          }}
        >
          <Pressable
            onPress={onClose}
            hitSlop={10}
            style={{
              width: 40,
              height: 40,
              borderRadius: 10,
              backgroundColor: "rgba(255,255,255,0.08)",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Ionicons name="close" size={22} color={mz.onNavy} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={{ color: mz.onNavy, fontSize: 17, fontWeight: "800" }}>{meta.title}</Text>
            <Text style={{ color: "rgba(233,238,243,0.6)", fontSize: 12, marginTop: 2 }}>
              {meta.hint}
            </Text>
          </View>
          <Ionicons name={meta.icon} size={22} color={mz.accent} />
        </View>

        {!permission?.granted ? (
          <View
            style={{
              flex: 1,
              alignItems: "center",
              justifyContent: "center",
              padding: 24,
              gap: 14,
            }}
          >
            <Ionicons name="camera-outline" size={40} color={mz.accent} />
            <Text
              style={{
                color: "rgba(233,238,243,0.75)",
                textAlign: "center",
                fontSize: 14,
                lineHeight: 20,
              }}
            >
              Camera access needed for {meta.title.toLowerCase()}.
            </Text>
            <Pressable
              style={{
                backgroundColor: mz.accent,
                paddingHorizontal: 18,
                paddingVertical: 12,
                borderRadius: 10,
              }}
              onPress={() => void requestPermission()}
            >
              <Text style={{ color: mz.onAccent, fontWeight: "800" }}>Allow camera</Text>
            </Pressable>
          </View>
        ) : (
          <View style={{ flex: 1, margin: 14, borderRadius: 16, overflow: "hidden" }}>
            <CameraView
              ref={cameraRef}
              style={StyleSheet.absoluteFill}
              facing={meta.facing}
            />
            <TemplateOverlay kind={kind} accent={mz.accent} />
            <View
              style={{
                position: "absolute",
                left: 14,
                right: 14,
                bottom: 18,
                alignItems: "center",
                gap: 10,
              }}
            >
              <View
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  borderRadius: 10,
                  backgroundColor: "rgba(7,14,24,0.72)",
                  alignItems: "center",
                }}
              >
                <Text
                  style={{
                    color: mz.accent,
                    fontSize: 10,
                    fontWeight: "800",
                    letterSpacing: 0.8,
                    textTransform: "uppercase",
                  }}
                >
                  {meta.badge}
                </Text>
                <Text style={{ color: mz.onNavy, fontSize: 12, fontWeight: "700", marginTop: 2 }}>
                  {meta.hint}
                </Text>
              </View>
              <Pressable
                onPress={() => void snap()}
                disabled={busy}
                style={{
                  width: 72,
                  height: 72,
                  borderRadius: 36,
                  borderWidth: 4,
                  borderColor: "#fff",
                  backgroundColor: busy ? "rgba(255,255,255,0.35)" : mz.accent,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {busy ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Ionicons name="camera" size={28} color="#fff" />
                )}
              </Pressable>
            </View>
          </View>
        )}
      </View>
    </Modal>
  );
}

function TemplateOverlay({
  kind,
  accent,
}: {
  kind: CaptureKind;
  accent: string;
}): React.JSX.Element {
  const corner = {
    position: "absolute" as const,
    width: 26,
    height: 26,
    borderColor: accent,
  };

  if (kind === "photo") {
    return (
      <View style={styles.fill} pointerEvents="none">
        <View
          style={{
            ...StyleSheet.absoluteFillObject,
            backgroundColor: "rgba(0,0,0,0.35)",
          }}
        />
        <View
          style={{
            alignSelf: "center",
            marginTop: "18%",
            width: 210,
            height: 270,
            borderRadius: 999,
            borderWidth: 2,
            borderStyle: "dashed",
            borderColor: accent,
            backgroundColor: "transparent",
          }}
        />
      </View>
    );
  }

  if (kind === "cnic-front" || kind === "cnic-back") {
    const isFront = kind === "cnic-front";
    return (
      <View style={styles.fill} pointerEvents="none">
        <View
          style={{
            ...StyleSheet.absoluteFillObject,
            marginVertical: "22%",
            marginHorizontal: "7%",
            borderRadius: 12,
            borderWidth: 1.5,
            borderStyle: "dashed",
            borderColor: accent,
            backgroundColor: "rgba(15,155,142,0.06)",
            padding: 14,
          }}
        >
          {isFront ? (
            <View style={{ flex: 1, flexDirection: "row", gap: 12, alignItems: "center" }}>
              <View
                style={{
                  width: "28%",
                  aspectRatio: 3 / 4,
                  borderRadius: 6,
                  borderWidth: 1.5,
                  borderColor: "rgba(233,238,243,0.55)",
                  backgroundColor: "rgba(233,238,243,0.12)",
                }}
              />
              <View style={{ flex: 1, gap: 10 }}>
                <View style={styles.cnicLine} />
                <View style={styles.cnicLine} />
                <View style={[styles.cnicLine, { width: "55%" }]} />
              </View>
            </View>
          ) : (
            <View style={{ flex: 1 }}>
              <View
                style={{
                  position: "absolute",
                  top: "12%",
                  left: "8%",
                  width: "18%",
                  aspectRatio: 1.4,
                  borderRadius: 4,
                  borderWidth: 1.5,
                  borderColor: "rgba(251,191,36,0.8)",
                  backgroundColor: "rgba(251,191,36,0.18)",
                }}
              />
              <View
                style={{
                  position: "absolute",
                  left: "8%",
                  right: "8%",
                  bottom: "12%",
                  height: "26%",
                  borderRadius: 4,
                  borderWidth: 1,
                  borderStyle: "dashed",
                  borderColor: "rgba(233,238,243,0.5)",
                }}
              />
            </View>
          )}
          <View style={{ ...corner, top: 0, left: 0, borderTopWidth: 3, borderLeftWidth: 3 }} />
          <View style={{ ...corner, top: 0, right: 0, borderTopWidth: 3, borderRightWidth: 3 }} />
          <View
            style={{ ...corner, bottom: 0, left: 0, borderBottomWidth: 3, borderLeftWidth: 3 }}
          />
          <View
            style={{ ...corner, bottom: 0, right: 0, borderBottomWidth: 3, borderRightWidth: 3 }}
          />
        </View>
      </View>
    );
  }

  // condition — phone outline
  return (
    <View style={styles.fill} pointerEvents="none">
      <View
        style={{
          alignSelf: "center",
          marginTop: "14%",
          width: 150,
          height: 300,
          borderRadius: 28,
          borderWidth: 2,
          borderStyle: "dashed",
          borderColor: accent,
          backgroundColor: "rgba(15,155,142,0.07)",
          padding: 12,
          alignItems: "center",
          gap: 10,
        }}
      >
        <View
          style={{
            width: "38%",
            height: 8,
            borderRadius: 99,
            backgroundColor: "rgba(233,238,243,0.45)",
          }}
        />
        <View
          style={{
            flex: 1,
            width: "100%",
            borderRadius: 12,
            borderWidth: 1,
            borderColor: "rgba(233,238,243,0.28)",
            backgroundColor: "rgba(0,0,0,0.2)",
          }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: {
    ...StyleSheet.absoluteFillObject,
  },
  cnicLine: {
    height: 8,
    borderRadius: 99,
    backgroundColor: "rgba(233,238,243,0.45)",
    width: "100%",
  },
});
