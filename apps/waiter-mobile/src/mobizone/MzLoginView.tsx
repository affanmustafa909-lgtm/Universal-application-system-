import { Ionicons } from "@expo/vector-icons";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MOBIZONE_DEMO_EMAIL, MOBIZONE_DEMO_PASSWORD } from "./assertMobizoneAccount";
import { useMzLayout } from "./theme";
import { MzThemeToggle } from "./ui";

type Props = {
  email: string;
  password: string;
  loading: boolean;
  error: string | null;
  onEmailChange: (v: string) => void;
  onPasswordChange: (v: string) => void;
  onSubmit: () => void;
};

export function MzLoginView({
  email,
  password,
  loading,
  error,
  onEmailChange,
  onPasswordChange,
  onSubmit,
}: Props): JSX.Element {
  const insets = useSafeAreaInsets();
  const { pad } = useMzLayout();

  return (
    <View style={[styles.shell, { paddingTop: insets.top + 12 }]}>
      <View style={styles.glowTop} pointerEvents="none" />
      <View style={styles.glowBottom} pointerEvents="none" />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: pad,
            paddingBottom: Math.max(24, insets.bottom + 16),
            flexGrow: 1,
            justifyContent: "center",
            maxWidth: 440,
            width: "100%",
            alignSelf: "center",
            gap: 28,
          }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.topRow}>
            <View style={{ flex: 1 }} />
            <MzThemeToggle />
          </View>

          <View style={styles.brandBlock}>
            <Text style={styles.mark}>MobiZone</Text>
            <Text style={styles.tagline}>
              Phone shop ERP for IMEI stock, buy / sell, and udhaar.
            </Text>
          </View>

          <View style={styles.panel}>
            <Text style={styles.kicker}>SECURE ACCESS</Text>
            <Text style={styles.heading}>Sign in</Text>
            <Text style={styles.sub}>MobiZone accounts only — other ERP users are blocked.</Text>

            <View style={styles.fieldGap}>
              <Text style={styles.label}>Email</Text>
              <View style={styles.inputWrap}>
                <Ionicons name="mail-outline" size={17} color="rgba(233,238,243,0.45)" />
                <TextInput
                  style={styles.input}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                  placeholder={MOBIZONE_DEMO_EMAIL}
                  placeholderTextColor="rgba(233,238,243,0.35)"
                  value={email}
                  onChangeText={onEmailChange}
                />
              </View>
            </View>

            <View style={styles.fieldGap}>
              <Text style={styles.label}>Password</Text>
              <View style={styles.inputWrap}>
                <Ionicons name="lock-closed-outline" size={17} color="rgba(233,238,243,0.45)" />
                <TextInput
                  style={styles.input}
                  placeholder="Password"
                  placeholderTextColor="rgba(233,238,243,0.35)"
                  secureTextEntry
                  value={password}
                  onChangeText={onPasswordChange}
                  onSubmitEditing={onSubmit}
                />
              </View>
            </View>

            {error ? (
              <View style={styles.errorBox}>
                <Ionicons name="alert-circle" size={16} color="#FECDD3" />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            <Pressable
              onPress={onSubmit}
              disabled={loading}
              style={({ pressed }) => [styles.submit, { opacity: pressed || loading ? 0.88 : 1 }]}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Text style={styles.submitText}>Continue</Text>
                  <Ionicons name="arrow-forward" size={18} color="#fff" />
                </>
              )}
            </Pressable>

            <Text style={styles.hint}>
              Same central login as desktop EXE · demo {MOBIZONE_DEMO_EMAIL} / {MOBIZONE_DEMO_PASSWORD}
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    flex: 1,
    backgroundColor: "#050a12",
  },
  glowTop: {
    position: "absolute",
    top: -60,
    left: -40,
    width: 220,
    height: 220,
    borderRadius: 220,
    backgroundColor: "rgba(20,184,166,0.18)",
  },
  glowBottom: {
    position: "absolute",
    left: -40,
    right: -40,
    bottom: -80,
    height: 220,
    borderRadius: 220,
    backgroundColor: "rgba(15,155,142,0.14)",
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
  },
  brandBlock: { gap: 10 },
  mark: {
    color: "#f4faf8",
    fontSize: 42,
    fontWeight: "800",
    letterSpacing: -1.4,
    lineHeight: 44,
  },
  tagline: {
    color: "rgba(233,238,243,0.68)",
    fontSize: 15,
    fontWeight: "500",
    lineHeight: 22,
    maxWidth: 320,
  },
  panel: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#243847",
    backgroundColor: "rgba(8,16,26,0.9)",
    padding: 16,
    gap: 10,
  },
  kicker: {
    color: "#2DD4BF",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.4,
  },
  heading: {
    color: "#E9EEF3",
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: -0.3,
  },
  sub: {
    color: "rgba(233,238,243,0.55)",
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 4,
  },
  fieldGap: { gap: 6 },
  label: {
    color: "rgba(233,238,243,0.55)",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "rgba(255,255,255,0.04)",
    paddingHorizontal: 12,
  },
  input: {
    flex: 1,
    color: "#E9EEF3",
    fontSize: 15,
    paddingVertical: Platform.OS === "ios" ? 12 : 10,
  },
  errorBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    backgroundColor: "rgba(225,29,72,0.22)",
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: "rgba(254,205,211,0.35)",
  },
  errorText: {
    flex: 1,
    color: "#FECDD3",
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "600",
  },
  submit: {
    marginTop: 4,
    minHeight: 50,
    borderRadius: 12,
    backgroundColor: "#0F9B8E",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  submitText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "800",
  },
  hint: {
    color: "rgba(233,238,243,0.42)",
    fontSize: 11,
    lineHeight: 15,
  },
});
