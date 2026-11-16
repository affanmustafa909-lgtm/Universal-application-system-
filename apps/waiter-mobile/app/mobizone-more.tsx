import { Ionicons } from "@expo/vector-icons";
import Constants from "expo-constants";
import { Redirect, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  AppState,
  type AppStateStatus,
  Linking,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { getApiBaseUrl } from "../src/lib/apiBase";
import {
  disconnectGoogleDrive,
  fetchGoogleDriveStatus,
  MOBIZONE_DRIVE_RETURN_TO,
  startGoogleDriveConnect,
  type GoogleDriveStatus,
} from "../src/mobizone/googleDrive";
import { syncMobizoneLedgerNow } from "../src/mobizone/ledgerSync";
import { MzShell } from "../src/mobizone/MzShell";
import { useMz, useMzLayout } from "../src/mobizone/theme";
import { MzCard, MzScreenTitle, MzSection } from "../src/mobizone/ui";
import { useMobizoneDb } from "../src/mobizone/useMobizone";
import { useBranchStore } from "../src/stores/branchStore";
import { useSessionStore } from "../src/stores/sessionStore";

const extra = Constants.expoConfig?.extra as { appVariant?: string; appVersion?: string } | undefined;
const isMobizoneApp = extra?.appVariant === "mobizone";

const LINK_GROUPS = [
  {
    title: "Trade",
    links: [
      { href: "/mobizone-sale", title: "New sale", note: "Sell + note + print/WA", icon: "cart-outline" as const },
      { href: "/mobizone-purchase", title: "Purchase entry", note: "Buy phone · add stock", icon: "bag-add-outline" as const },
      { href: "/mobizone-history", title: "Sale / Purchase history", note: "Return · soft delete · backup", icon: "time-outline" as const },
      { href: "/mobizone-scan", title: "Scan & capture", note: "IMEI · CNIC · face photo", icon: "scan-outline" as const },
      { href: "/mobizone-stock", title: "Stock / Inventory", note: "In-stock phones & IMEI", icon: "cube-outline" as const },
      { href: "/mobizone-customers", title: "Customers", note: "CNIC / phone book", icon: "people-outline" as const },
    ],
  },
  {
    title: "Money",
    links: [
      { href: "/mobizone-reports", title: "Reports", note: "Profit, dues, investment", icon: "stats-chart-outline" as const },
      { href: "/mobizone-contra", title: "Contra Voucher", note: "Cash ↔ Bank · gale capital", icon: "swap-horizontal-outline" as const },
      { href: "/mobizone-general-voucher", title: "General Voucher", note: "Double entry + documents", icon: "document-text-outline" as const },
      { href: "/mobizone-expenses", title: "Create Expense", note: "Record by expense account", icon: "wallet-outline" as const },
      { href: "/mobizone-expense-accounts", title: "Account Expense", note: "Rent, Electricity, Food…", icon: "list-outline" as const },
    ],
  },
  {
    title: "Settings",
    links: [
      { href: "/mobizone-receipt-settings", title: "Bill print settings", note: "Phone-shop receipt · not restaurant POS", icon: "print-outline" as const },
    ],
  },
] as const;

function DriveDetailRow({
  label,
  value,
  muted,
  onPress,
}: {
  label: string;
  value: string;
  muted: string;
  onPress?: () => void;
}): React.JSX.Element {
  const mz = useMz();
  const body = (
    <View style={{ gap: 2, paddingVertical: 6 }}>
      <Text style={{ color: muted, fontSize: 11, fontWeight: "700" }}>{label}</Text>
      <Text style={{ color: mz.ink, fontSize: 13, fontWeight: "700" }}>{value}</Text>
    </View>
  );
  if (!onPress) return body;
  return (
    <Pressable onPress={onPress} style={{ opacity: 1 }}>
      {body}
      <Text style={{ color: mz.accent, fontSize: 11, fontWeight: "700", marginBottom: 4 }}>
        Open in Drive →
      </Text>
    </Pressable>
  );
}

export default function MobizoneMoreScreen(): React.JSX.Element {
  const mz = useMz();
  const { pad, gap } = useMzLayout();
  const router = useRouter();
  const accessToken = useSessionStore((s) => s.accessToken);
  const waiterEmail = useSessionStore((s) => s.waiterEmail);
  const clearSession = useSessionStore((s) => s.clear);
  const branch = useBranchStore((s) => s.branch);
  const clearBranch = useBranchStore((s) => s.clear);
  const { branchCode, db, refresh } = useMobizoneDb();
  const [drive, setDrive] = useState<GoogleDriveStatus | null>(null);
  const [driveBusy, setDriveBusy] = useState(false);
  const [driveMsg, setDriveMsg] = useState<string | null>(null);
  const [syncBusy, setSyncBusy] = useState(false);

  const refreshDrive = useCallback(async () => {
    try {
      const next = await fetchGoogleDriveStatus();
      setDrive(next);
      return next;
    } catch {
      setDrive(null);
      return null;
    }
  }, []);

  useEffect(() => {
    void refreshDrive();
  }, [refreshDrive]);

  // After Google OAuth browser closes / deep-link returns, refresh account details.
  useEffect(() => {
    function onAppState(next: AppStateStatus): void {
      if (next === "active") {
        void refreshDrive().then((status) => {
          if (status?.connected) {
            setDriveMsg(
              status.email
                ? `Connected as ${status.email}`
                : "Drive connected — status refreshed.",
            );
          }
        });
      }
    }
    function onUrl({ url }: { url: string }): void {
      if (!url.includes("google-drive")) return;
      void refreshDrive().then((status) => {
        setDriveMsg(
          status?.email
            ? `Connected as ${status.email}`
            : "Google Drive connected — status refreshed.",
        );
      });
    }
    const appSub = AppState.addEventListener("change", onAppState);
    const linkSub = Linking.addEventListener("url", onUrl);
    void Linking.getInitialURL().then((url) => {
      if (url?.includes("google-drive")) onUrl({ url });
    });
    return () => {
      appSub.remove();
      linkSub.remove();
    };
  }, [refreshDrive]);

  if (!accessToken) return <Redirect href="/" />;
  if (extra?.appVariant && !isMobizoneApp) return <Redirect href="/home" />;

  return (
    <MzShell>
      <ScrollView contentContainerStyle={{ paddingHorizontal: pad, paddingTop: 8, paddingBottom: 20, gap }}>
        <MzScreenTitle title="More" subtitle="Shop tools & settings" />

        <MzCard
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 12,
            borderColor: mz.accent,
            backgroundColor: mz.navyDeep,
          }}
        >
          <View
            style={{
              width: 42,
              height: 42,
              borderRadius: 10,
              backgroundColor: "rgba(15,155,142,0.22)",
              alignItems: "center",
              justifyContent: "center",
              borderWidth: 1,
              borderColor: mz.accent,
            }}
          >
            <Ionicons name="phone-portrait" size={20} color={mz.accent} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ color: mz.onNavy, fontWeight: "800", fontSize: 15 }} numberOfLines={1}>
              {waiterEmail ?? "Shop user"}
            </Text>
            <Text style={{ color: "rgba(233,238,243,0.65)", marginTop: 2, fontSize: 12 }}>
              {branch?.name ?? "Main"} · Connected
            </Text>
          </View>
        </MzCard>

        <Pressable
          disabled={syncBusy}
          onPress={() => {
            void (async () => {
              setSyncBusy(true);
              try {
                const result = await syncMobizoneLedgerNow(branchCode);
                refresh();
                if (result === "pulled") {
                  Alert.alert("Sync", "Loaded shop ledger from cloud (laptop ↔ mobile).");
                } else if (result === "pushed") {
                  Alert.alert("Sync", "Pushed this phone’s ledger to cloud.");
                } else if (result === "ok") {
                  Alert.alert("Sync", "Already in sync.");
                } else {
                  Alert.alert("Sync", "Cloud unreachable — local data still on this phone.");
                }
              } catch (err) {
                Alert.alert("Sync", err instanceof Error ? err.message : "Sync failed");
              } finally {
                setSyncBusy(false);
              }
            })();
          }}
          style={({ pressed }) => ({
            borderRadius: 12,
            borderWidth: 1,
            borderColor: mz.border,
            backgroundColor: mz.card,
            paddingHorizontal: 14,
            paddingVertical: 12,
            opacity: pressed || syncBusy ? 0.7 : 1,
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
          })}
        >
          <Ionicons name="cloud-upload-outline" size={18} color={mz.accent} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: mz.ink, fontWeight: "800", fontSize: 14 }}>
              {syncBusy ? "Syncing…" : "Sync laptop ↔ mobile"}
            </Text>
            <Text style={{ color: mz.muted, fontSize: 12, marginTop: 2 }}>
              Pull/push stock, sales, cash — fixes empty Rs 0 dashboard
            </Text>
          </View>
        </Pressable>

        {LINK_GROUPS.map((group) => (
          <MzSection key={group.title} title={group.title}>
            <View style={{ gap: 8 }}>
              {group.links.map((link) => (
                <Pressable
                  key={link.href}
                  onPress={() => router.push(link.href as never)}
                  style={{
                    backgroundColor: mz.cardSoft,
                    borderRadius: 10,
                    paddingVertical: 10,
                    paddingHorizontal: 12,
                    borderWidth: 1,
                    borderColor: mz.border,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 10,
                  }}
                >
                  <View
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 9,
                      backgroundColor: mz.card,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Ionicons name={link.icon} size={17} color={mz.accent} />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={{ color: mz.ink, fontWeight: "700", fontSize: 14 }}>{link.title}</Text>
                    <Text style={{ color: mz.muted, fontSize: 11, marginTop: 1 }}>{link.note}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={mz.muted} />
                </Pressable>
              ))}
            </View>
          </MzSection>
        ))}

        <MzCard style={{ borderColor: mz.border, gap: 8 }}>
          <Text style={{ color: mz.accent, fontWeight: "800", fontSize: 11, letterSpacing: 0.6 }}>
            GOOGLE DRIVE (OPTIONAL)
          </Text>
          <Text style={{ color: mz.muted, fontSize: 12, lineHeight: 16 }}>
            Agar connect karo to photos / CNIC Drive pe save hongi. Warna pehle jaisa app mein hi
            rahengi.
          </Text>
          {drive?.connected ? (
            <View
              style={{
                borderRadius: 10,
                borderWidth: 1,
                borderColor: mz.border,
                backgroundColor: mz.cardSoft,
                paddingHorizontal: 12,
                paddingVertical: 6,
                gap: 2,
              }}
            >
              <Text style={{ color: mz.green, fontWeight: "800", fontSize: 13, paddingVertical: 4 }}>
                Connected
              </Text>
              <DriveDetailRow
                label="Google account"
                value={drive.email || "—"}
                muted={mz.muted}
              />
              {drive.displayName ? (
                <DriveDetailRow label="Name" value={drive.displayName} muted={mz.muted} />
              ) : null}
              {drive.connectedAt ? (
                <DriveDetailRow
                  label="Connected since"
                  value={new Date(drive.connectedAt).toLocaleString()}
                  muted={mz.muted}
                />
              ) : null}
              <DriveDetailRow
                label="Drive folder"
                value={drive.folderName || "POPS-MobiZone-…"}
                muted={mz.muted}
                onPress={
                  drive.folderUrl
                    ? () => {
                        void Linking.openURL(drive.folderUrl!);
                      }
                    : undefined
                }
              />
              {!drive.email ? (
                <Text style={{ color: mz.orange, fontSize: 11, fontWeight: "600", paddingBottom: 6 }}>
                  Account email missing — Refresh dabao. Agar blank rahe to Disconnect → Connect.
                </Text>
              ) : null}
            </View>
          ) : (
            <Text style={{ color: mz.muted, fontSize: 12 }}>
              {drive && !drive.configured
                ? "Server pe Drive env set nahi (admin)."
                : "Not connected"}
            </Text>
          )}
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {drive?.configured && !drive.connected ? (
              <Pressable
                disabled={driveBusy}
                onPress={() => {
                  setDriveBusy(true);
                  setDriveMsg(null);
                  void startGoogleDriveConnect()
                    .then(() =>
                      Alert.alert(
                        "Google Drive",
                        `Browser mein Google sign-in complete karo. Wapas aane ke baad details yahan refresh hongi (${MOBIZONE_DRIVE_RETURN_TO}).`,
                      ),
                    )
                    .catch((err) =>
                      Alert.alert(
                        "Google Drive",
                        err instanceof Error ? err.message : "Connect failed",
                      ),
                    )
                    .finally(() => setDriveBusy(false));
                }}
                style={{
                  backgroundColor: mz.accent,
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  borderRadius: 8,
                }}
              >
                <Text style={{ color: mz.onAccent, fontWeight: "800", fontSize: 12 }}>Connect</Text>
              </Pressable>
            ) : null}
            {drive?.connected ? (
              <Pressable
                disabled={driveBusy}
                onPress={() => {
                  setDriveBusy(true);
                  setDriveMsg(null);
                  void disconnectGoogleDrive()
                    .then(setDrive)
                    .catch((err) =>
                      Alert.alert(
                        "Google Drive",
                        err instanceof Error ? err.message : "Disconnect failed",
                      ),
                    )
                    .finally(() => setDriveBusy(false));
                }}
                style={{
                  backgroundColor: mz.dangerSoft,
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  borderRadius: 8,
                  borderWidth: 1,
                  borderColor: mz.dangerBorder,
                }}
              >
                <Text style={{ color: mz.rose, fontWeight: "800", fontSize: 12 }}>Disconnect</Text>
              </Pressable>
            ) : null}
            <Pressable
              disabled={driveBusy}
              onPress={() => {
                void refreshDrive().then((status) => {
                  setDriveMsg(
                    status?.connected
                      ? status.email
                        ? `Connected as ${status.email}`
                        : "Status refreshed"
                      : "Status refreshed",
                  );
                });
              }}
              style={{
                backgroundColor: mz.cardSoft,
                paddingHorizontal: 12,
                paddingVertical: 8,
                borderRadius: 8,
                borderWidth: 1,
                borderColor: mz.border,
              }}
            >
              <Text style={{ color: mz.ink, fontWeight: "700", fontSize: 12 }}>Refresh</Text>
            </Pressable>
          </View>
          {driveMsg ? (
            <Text style={{ color: mz.muted, fontSize: 11, fontWeight: "600" }}>{driveMsg}</Text>
          ) : null}
        </MzCard>

        <MzCard style={{ borderColor: mz.accent, gap: 4 }}>
          <Text style={{ color: mz.accent, fontWeight: "800", fontSize: 11, letterSpacing: 0.6 }}>
            AUTO UPDATE
          </Text>
          <Text style={{ color: mz.ink, fontWeight: "700" }}>
            App v{extra?.appVersion ?? "1.0"}
          </Text>
          <Text style={{ color: mz.muted, fontSize: 12, lineHeight: 16 }}>
            New builds show a top banner — tap Download & install, then reopen.
          </Text>
        </MzCard>

        <Text style={{ color: mz.muted, fontSize: 10, textAlign: "center" }}>
          API {getApiBaseUrl()} · Banks {db.bankAccounts.length} · Devices {db.devices.length}
          {"\n"}v{extra?.appVersion ?? "1.0"} · MobiZone
        </Text>

        <Pressable
          onPress={() => {
            clearSession();
            clearBranch();
            router.replace("/");
          }}
          style={{
            backgroundColor: mz.dangerSoft,
            borderRadius: 10,
            padding: 12,
            borderWidth: 1,
            borderColor: mz.dangerBorder,
            alignItems: "center",
          }}
        >
          <Text style={{ color: mz.rose, fontWeight: "800" }}>Sign out</Text>
        </Pressable>
      </ScrollView>
    </MzShell>
  );
}
