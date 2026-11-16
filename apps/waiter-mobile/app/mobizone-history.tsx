import { Ionicons } from "@expo/vector-icons";
import Constants from "expo-constants";
import { Redirect } from "expo-router";
import { useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import { MzShell } from "../src/mobizone/MzShell";
import {
  formatPkr,
  printPurchaseReceipt,
  printSaleReceipt,
  returnPurchase,
  returnSale,
  voidPurchase,
  voidSale,
} from "../src/mobizone/storeCore";
import { useMz, useMzLayout } from "../src/mobizone/theme";
import { MzCard, MzChip, MzScreenTitle } from "../src/mobizone/ui";
import { useMobizoneDb } from "../src/mobizone/useMobizone";
import { useSessionStore } from "../src/stores/sessionStore";

const extra = Constants.expoConfig?.extra as { appVariant?: string } | undefined;
const isMobizoneApp = extra?.appVariant === "mobizone";

type Tab = "sales" | "purchases";

export default function MobizoneHistoryScreen(): React.JSX.Element {
  const mz = useMz();
  const { pad, gap } = useMzLayout();
  const accessToken = useSessionStore((s) => s.accessToken);
  const { branchCode, db, refresh } = useMobizoneDb();
  const [tab, setTab] = useState<Tab>("sales");
  const [showDeleted, setShowDeleted] = useState(false);

  const sales = useMemo(() => {
    const rows = [...db.sales].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return showDeleted ? rows.filter((s) => !!s.deletedAt) : rows.filter((s) => !s.deletedAt);
  }, [db.sales, showDeleted]);

  const purchases = useMemo(() => {
    const rows = [...db.purchases].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return showDeleted ? rows.filter((p) => !!p.deletedAt) : rows.filter((p) => !p.deletedAt);
  }, [db.purchases, showDeleted]);

  if (!accessToken) return <Redirect href="/" />;
  if (extra?.appVariant && !isMobizoneApp) return <Redirect href="/home" />;

  function confirmDeleteSale(id: string, label: string): void {
    Alert.alert(
      "Delete sale?",
      `${label}\n\nSoft delete: stock wapas · money reverse · history/backup mein rehti hai.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            try {
              voidSale(branchCode, id, "Wrong entry");
              refresh();
            } catch (e) {
              Alert.alert("Delete failed", e instanceof Error ? e.message : "Error");
            }
          },
        },
      ],
    );
  }

  function confirmDeletePurchase(id: string, label: string): void {
    Alert.alert(
      "Delete purchase?",
      `${label}\n\nSoft delete: stock se hata · money reverse · history/backup mein rehti hai.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            try {
              voidPurchase(branchCode, id, "Wrong entry");
              refresh();
            } catch (e) {
              Alert.alert("Delete failed", e instanceof Error ? e.message : "Error");
            }
          },
        },
      ],
    );
  }

  return (
    <MzShell>
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: pad, paddingTop: 8, paddingBottom: 24, gap }}
      >
        <MzScreenTitle
          title="History"
          subtitle="Sales / purchases · return · soft delete (backup)"
        />

        <View style={{ flexDirection: "row", gap: 8 }}>
          <MzChip label="Sales" active={tab === "sales"} onPress={() => setTab("sales")} />
          <MzChip
            label="Purchases"
            active={tab === "purchases"}
            onPress={() => setTab("purchases")}
          />
          <MzChip
            label={showDeleted ? "Deleted ✓" : "Deleted"}
            active={showDeleted}
            onPress={() => setShowDeleted((v) => !v)}
          />
        </View>

        {tab === "sales"
          ? sales.slice(0, 60).map((s) => {
              const live = !s.returnedAt && !s.deletedAt;
              return (
                <MzCard key={s.id} style={{ gap: 8 }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 8 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: mz.ink, fontWeight: "800", fontSize: 15 }}>
                        {s.brand} {s.model}
                        {s.deletedAt ? " · DELETED" : s.returnedAt ? " · RETURNED" : ""}
                      </Text>
                      <Text style={{ color: mz.muted, fontSize: 12 }}>
                        {s.customerName} · {s.imei}
                      </Text>
                      {s.note ? (
                        <Text style={{ color: mz.muted, fontSize: 12 }}>Note: {s.note}</Text>
                      ) : null}
                      {s.deletedReason ? (
                        <Text style={{ color: mz.rose, fontSize: 11 }}>{s.deletedReason}</Text>
                      ) : null}
                    </View>
                    <Text style={{ color: mz.ink, fontWeight: "800" }}>{formatPkr(s.pricePkr)}</Text>
                  </View>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                    <Action
                      icon="print-outline"
                      label="Print"
                      onPress={() => void printSaleReceipt(s, branchCode)}
                    />
                    {live ? (
                      <>
                        <Action
                          icon="return-down-back-outline"
                          label="Return"
                          onPress={() => {
                            Alert.alert("Sale return?", "Phone stock mein wapas?", [
                              { text: "Cancel", style: "cancel" },
                              {
                                text: "Return",
                                onPress: () => {
                                  try {
                                    returnSale(branchCode, s.id, "Customer return");
                                    refresh();
                                  } catch (e) {
                                    Alert.alert(
                                      "Return failed",
                                      e instanceof Error ? e.message : "Error",
                                    );
                                  }
                                },
                              },
                            ]);
                          }}
                        />
                        <Action
                          icon="trash-outline"
                          label="Delete"
                          danger
                          onPress={() =>
                            confirmDeleteSale(s.id, `${s.brand} ${s.model} · ${s.imei}`)
                          }
                        />
                      </>
                    ) : null}
                  </View>
                </MzCard>
              );
            })
          : purchases.slice(0, 60).map((p) => {
              const device = db.devices.find((d) => d.id === p.deviceId);
              const live = !p.returnedAt && !p.deletedAt;
              const canReturn = live && device?.status === "in_stock";
              return (
                <MzCard key={p.id} style={{ gap: 8 }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 8 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: mz.ink, fontWeight: "800", fontSize: 15 }}>
                        {p.brand} {p.model}
                        {p.deletedAt ? " · DELETED" : p.returnedAt ? " · RETURNED" : ""}
                      </Text>
                      <Text style={{ color: mz.muted, fontSize: 12 }}>
                        {p.sellerName} · {p.imei}
                      </Text>
                      {p.note ? (
                        <Text style={{ color: mz.muted, fontSize: 12 }}>Note: {p.note}</Text>
                      ) : null}
                    </View>
                    <Text style={{ color: mz.ink, fontWeight: "800" }}>
                      {formatPkr(p.purchasePricePkr)}
                    </Text>
                  </View>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                    <Action
                      icon="print-outline"
                      label="Print"
                      onPress={() => void printPurchaseReceipt(p, branchCode)}
                    />
                    {canReturn ? (
                      <Action
                        icon="return-down-back-outline"
                        label="Return"
                        onPress={() => {
                          Alert.alert("Purchase return?", "Phone stock se hata dein?", [
                            { text: "Cancel", style: "cancel" },
                            {
                              text: "Return",
                              onPress: () => {
                                try {
                                  returnPurchase(branchCode, p.id, "Seller return");
                                  refresh();
                                } catch (e) {
                                  Alert.alert(
                                    "Return failed",
                                    e instanceof Error ? e.message : "Error",
                                  );
                                }
                              },
                            },
                          ]);
                        }}
                      />
                    ) : null}
                    {live && (!device || device.status === "in_stock") ? (
                      <Action
                        icon="trash-outline"
                        label="Delete"
                        danger
                        onPress={() =>
                          confirmDeletePurchase(p.id, `${p.brand} ${p.model} · ${p.imei}`)
                        }
                      />
                    ) : null}
                  </View>
                </MzCard>
              );
            })}

        {(tab === "sales" ? sales : purchases).length === 0 ? (
          <Text style={{ color: mz.muted, textAlign: "center", paddingVertical: 24 }}>
            {showDeleted ? "No deleted entries." : "No entries yet."}
          </Text>
        ) : null}
      </ScrollView>
    </MzShell>
  );
}

function Action({
  icon,
  label,
  onPress,
  danger,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  danger?: boolean;
}): React.JSX.Element {
  const mz = useMz();
  return (
    <Pressable
      onPress={onPress}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        paddingHorizontal: 10,
        paddingVertical: 8,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: danger ? mz.rose : mz.border,
        backgroundColor: mz.cardSoft,
      }}
    >
      <Ionicons name={icon} size={14} color={danger ? mz.rose : mz.accent} />
      <Text style={{ color: danger ? mz.rose : mz.ink, fontWeight: "700", fontSize: 12 }}>
        {label}
      </Text>
    </Pressable>
  );
}
