import { Ionicons } from "@expo/vector-icons";
import Constants from "expo-constants";
import { Redirect, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { LayoutAnimation, Platform, Pressable, RefreshControl, ScrollView, Text, UIManager, View } from "react-native";
import { MzShell } from "../src/mobizone/MzShell";
import { formatPkr, getPositionMoneyHistory, getTotalPosition } from "../src/mobizone/storeCore";
import { useMz, useMzLayout } from "../src/mobizone/theme";
import { MzCard, MzEmpty, MzNavyHeader } from "../src/mobizone/ui";
import { useMobizoneDb } from "../src/mobizone/useMobizone";
import { useBranchStore } from "../src/stores/branchStore";
import { useSessionStore } from "../src/stores/sessionStore";
import { Badge, Separator } from "../src/ui";

const extra = Constants.expoConfig?.extra as { appVariant?: string } | undefined;
const isMobizoneApp = extra?.appVariant === "mobizone";

type MoreAction = {
  title: string;
  note: string;
  href: string;
  metric?: "sales" | "purchase" | "profit" | "due";
};

/** Everything else stays visible — compact grid under Order strip */
const MORE: MoreAction[] = [
  { title: "Customers", note: "CNIC book", href: "/mobizone-customers" },
  { title: "Stock", note: "IMEI list", href: "/mobizone-stock" },
  { title: "Today Sales", note: "Live", href: "/mobizone-reports", metric: "sales" },
  { title: "Today Buy", note: "Live", href: "/mobizone-reports", metric: "purchase" },
  { title: "Profit", note: "Today", href: "/mobizone-reports", metric: "profit" },
  { title: "Due", note: "Receivable", href: "/mobizone-reports", metric: "due" },
  { title: "Create Expense", note: "By account", href: "/mobizone-expenses" },
  { title: "Account Expense", note: "Categories", href: "/mobizone-expense-accounts" },
  { title: "Contra", note: "Cash ↔ Bank", href: "/mobizone-contra" },
  { title: "General Voucher", note: "Double entry", href: "/mobizone-general-voucher" },
  { title: "Bill print", note: "Receipt", href: "/mobizone-receipt-settings" },
];

export default function MobizoneHomeScreen(): React.JSX.Element {
  const mz = useMz();
  const { pad, gap, tileW } = useMzLayout();
  const router = useRouter();
  const accessToken = useSessionStore((s) => s.accessToken);
  const branch = useBranchStore((s) => s.branch);
  const { dashboard, db, refresh, ready } = useMobizoneDb();
  const [bucket, setBucket] = useState<"all" | "cash" | "bank" | "stock">("all");
  useEffect(() => {
    if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
      UIManager.setLayoutAnimationEnabledExperimental(true);
    }
  }, []);
  const position = useMemo(() => getTotalPosition(db), [db]);
  const moneyLines = useMemo(() => getPositionMoneyHistory(db, 12), [db]);
  const filteredLines = useMemo(() => {
    if (bucket === "all" || bucket === "stock") return moneyLines;
    return moneyLines.filter((l) =>
      bucket === "cash"
        ? l.cashInPkr > 0 || l.cashOutPkr > 0
        : l.bankInPkr > 0 || l.bankOutPkr > 0,
    );
  }, [moneyLines, bucket]);

  if (!accessToken) return <Redirect href="/" />;
  if (extra?.appVariant && !isMobizoneApp) return <Redirect href="/home" />;

    const todayLabel = new Date().toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  const recent = [...db.sales, ...db.purchases]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 5);

  function metricValue(key?: MoreAction["metric"]): string | null {
    if (!key || !dashboard) return null;
    if (key === "sales") return formatPkr(dashboard.todaySalesPkr);
    if (key === "purchase") return formatPkr(dashboard.todayPurchasesPkr);
    if (key === "profit") return formatPkr(dashboard.todayProfitPkr);
    return formatPkr(dashboard.pendingReceivablesPkr);
  }

  return (
    <MzShell>
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: pad, paddingTop: 8, paddingBottom: 20, gap }}
        refreshControl={
          <RefreshControl refreshing={!ready} onRefresh={refresh} tintColor={mz.accent} />
        }
      >
        <MzNavyHeader
          title={branch?.name ?? "Main Shop"}
          subtitle={`Order counter · ${todayLabel}`}
          right={
            <Pressable
              onPress={() => router.push("/mobizone-scan" as never)}
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                backgroundColor: "rgba(15,155,142,0.2)",
                alignItems: "center",
                justifyContent: "center",
                borderWidth: 1.5,
                borderColor: mz.accent,
              }}
            >
              <Ionicons name="scan" size={20} color={mz.accent} />
            </Pressable>
          }
        />

        <View style={{ gap: 8 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Text
              style={{
                color: mz.ink,
                fontSize: 11,
                fontWeight: "800",
                letterSpacing: 1.1,
                flex: 1,
              }}
            >
              ORDER NOW
            </Text>
            <Badge tone={mz.accent}>{ready ? "Live" : "Syncing"}</Badge>
          </View>
          <Separator style={{ backgroundColor: mz.border }} />

          <Pressable
            onPress={() => router.push("/mobizone-sale" as never)}
            style={({ pressed }) => ({
              backgroundColor: mz.accent,
              borderRadius: 16,
              paddingVertical: 18,
              paddingHorizontal: 16,
              minHeight: 84,
              justifyContent: "center",
              opacity: pressed ? 0.92 : 1,
              transform: [{ scale: pressed ? 0.99 : 1 }],
            })}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Ionicons name="cart" size={14} color="rgba(255,255,255,0.9)" />
              <Text style={{ color: "rgba(255,255,255,0.85)", fontSize: 11, fontWeight: "800" }}>
                PRIMARY ORDER
              </Text>
            </View>
            <Text style={{ color: mz.white, fontSize: 24, fontWeight: "900", marginTop: 4 }}>
              New Sale
            </Text>
            <Text style={{ color: "rgba(255,255,255,0.9)", fontSize: 12, marginTop: 3, fontWeight: "600" }}>
              Sell phone · cash / bank / udhaar
            </Text>
            <View
              style={{
                position: "absolute",
                right: 14,
                top: "50%",
                marginTop: -18,
                width: 36,
                height: 36,
                borderRadius: 18,
                backgroundColor: "rgba(255,255,255,0.22)",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Ionicons name="arrow-forward" size={18} color={mz.white} />
            </View>
          </Pressable>

          <Pressable
            onPress={() => router.push("/mobizone-purchase" as never)}
            style={({ pressed }) => ({
              backgroundColor: mz.navyDeep,
              borderRadius: 16,
              paddingVertical: 16,
              paddingHorizontal: 16,
              minHeight: 76,
              justifyContent: "center",
              borderWidth: 1.5,
              borderColor: mz.accent,
              opacity: pressed ? 0.92 : 1,
            })}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Ionicons name="bag-add" size={14} color={mz.accent} />
              <Text style={{ color: mz.accent, fontSize: 11, fontWeight: "800" }}>STOCK ORDER</Text>
            </View>
            <Text style={{ color: mz.white, fontSize: 20, fontWeight: "900", marginTop: 4 }}>
              Purchase
            </Text>
            <Text style={{ color: "rgba(233,238,243,0.75)", fontSize: 12, marginTop: 3, fontWeight: "600" }}>
              Buy phone · IMEI into stock
            </Text>
            <View
              style={{
                position: "absolute",
                right: 14,
                top: "50%",
                marginTop: -18,
                width: 36,
                height: 36,
                borderRadius: 18,
                backgroundColor: "rgba(15,155,142,0.25)",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Ionicons name="arrow-forward" size={18} color={mz.accent} />
            </View>
          </Pressable>

          <Pressable
            onPress={() => router.push("/mobizone-scan" as never)}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
              backgroundColor: mz.card,
              borderRadius: 12,
              padding: 10,
              borderWidth: 1,
              borderColor: mz.border,
            }}
          >
            <View
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                backgroundColor: mz.cardSoft,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Ionicons name="barcode-outline" size={20} color={mz.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: mz.ink, fontWeight: "800", fontSize: 14 }}>Scan IMEI / CNIC</Text>
              <Text style={{ color: mz.muted, fontSize: 11, marginTop: 2 }}>
                Barcode scanner · ID camera · face photo
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={mz.muted} />
          </Pressable>
        </View>

                <View
          style={{
            borderRadius: 20,
            overflow: "hidden",
            borderWidth: 1,
            borderColor: mz.border,
            backgroundColor: mz.navyDeep,
          }}
        >
          <View style={{ padding: 16, gap: 10 }}>
            <Text style={{ color: "rgba(233,238,243,0.7)", fontSize: 11, fontWeight: "800", letterSpacing: 1 }}>
              INVESTMENT · TOTAL POSITION
            </Text>
            <Text style={{ color: mz.white, fontSize: 30, fontWeight: "900", letterSpacing: -0.6 }}>
              {formatPkr(position.investmentPkr)}
            </Text>
            <Text style={{ color: "rgba(233,238,243,0.65)", fontSize: 12, fontWeight: "600" }}>
              Cash (gale) + Bank + Stock (maal)
            </Text>
            <View style={{ flexDirection: "row", gap: 8, marginTop: 4 }}>
              {(
                [
                  { id: "cash" as const, label: "Cash", value: position.cashPkr, color: mz.teal },
                  { id: "bank" as const, label: "Bank", value: position.bankPkr, color: mz.blue },
                  { id: "stock" as const, label: "Stock", value: position.stockValuePkr, color: mz.goldBright },
                ] as const
              ).map((card) => (
                <Pressable
                  key={card.id}
                  onPress={() => {
                    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                    setBucket((b) => (b === card.id ? "all" : card.id));
                  }}
                  style={{
                    flex: 1,
                    backgroundColor: bucket === card.id ? "rgba(15,155,142,0.28)" : "rgba(255,255,255,0.06)",
                    borderRadius: 14,
                    padding: 10,
                    borderWidth: 1,
                    borderColor: bucket === card.id ? mz.accent : "rgba(255,255,255,0.08)",
                  }}
                >
                  <Text style={{ color: "rgba(233,238,243,0.7)", fontSize: 10, fontWeight: "700" }}>{card.label}</Text>
                  <Text style={{ color: card.color, fontWeight: "900", fontSize: 13, marginTop: 4 }}>
                    {formatPkr(card.value)}
                  </Text>
                </Pressable>
              ))}
            </View>
            <Pressable
              onPress={() => router.push("/mobizone-contra" as never)}
              style={{
                marginTop: 4,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                backgroundColor: "rgba(15,155,142,0.18)",
                borderRadius: 12,
                paddingVertical: 10,
                paddingHorizontal: 12,
                borderWidth: 1,
                borderColor: mz.accent,
              }}
            >
              <Text style={{ color: mz.white, fontSize: 12, fontWeight: "800" }}>
                Set gale / bank capital
              </Text>
              <Text style={{ color: mz.accent, fontSize: 12, fontWeight: "900" }}>Invest →</Text>
            </Pressable>
          </View>
          <View style={{ backgroundColor: mz.card, padding: 12, gap: 8 }}>
            <Text style={{ color: mz.ink, fontWeight: "800", fontSize: 12, letterSpacing: 0.4 }}>
              RECEIVE IN / OUT
            </Text>
            {filteredLines.length === 0 ? (
              <Text style={{ color: mz.muted, fontSize: 12 }}>No money moves yet</Text>
            ) : (
              filteredLines.slice(0, 6).map((line) => (
                <View
                  key={line.id}
                  style={{
                    borderBottomWidth: 1,
                    borderBottomColor: mz.border,
                    paddingBottom: 8,
                    gap: 2,
                  }}
                >
                  <Text style={{ color: mz.ink, fontWeight: "700", fontSize: 12 }} numberOfLines={1}>
                    {line.label}
                  </Text>
                  <Text style={{ color: mz.muted, fontSize: 11 }}>
                    {line.cashInPkr > 0 ? `Cash in ${formatPkr(line.cashInPkr)}  ` : ""}
                    {line.cashOutPkr > 0 ? `Cash out ${formatPkr(line.cashOutPkr)}  ` : ""}
                    {line.bankInPkr > 0 ? `Bank in ${formatPkr(line.bankInPkr)}  ` : ""}
                    {line.bankOutPkr > 0 ? `Bank out ${formatPkr(line.bankOutPkr)}` : ""}
                  </Text>
                </View>
              ))
            )}
          </View>
        </View>

        <Text style={{ color: mz.ink, fontWeight: "800", fontSize: 13, letterSpacing: 0.4 }}>
          ALL MODULES
        </Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
          {MORE.map((a) => {
            const value = metricValue(a.metric);
            return (
              <Pressable
                key={a.title}
                onPress={() => router.push(a.href as never)}
                style={{
                  width: tileW,
                  backgroundColor: mz.card,
                  borderRadius: 12,
                  paddingVertical: 10,
                  paddingHorizontal: 10,
                  borderWidth: 1,
                  borderColor: mz.border,
                  minHeight: 64,
                }}
              >
                <Text style={{ color: mz.ink, fontWeight: "800", fontSize: 13 }}>{a.title}</Text>
                <Text style={{ color: mz.muted, fontWeight: "600", fontSize: 11, marginTop: 4 }}>
                  {value ?? a.note}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Text style={{ color: mz.ink, fontWeight: "800", fontSize: 15 }}>Recent orders</Text>
          <Pressable onPress={() => router.push("/mobizone-reports" as never)}>
            <Text style={{ color: mz.accent, fontWeight: "800", fontSize: 12 }}>View all</Text>
          </Pressable>
        </View>

        {recent.length === 0 ? (
          <MzEmpty
            title="No orders yet"
            note="Upar se New Sale ya Purchase dabao"
            actionLabel="New Sale"
            onAction={() => router.push("/mobizone-sale" as never)}
          />
        ) : (
          recent.map((row) => {
            const isSale = "pricePkr" in row;
            const cash = row.payment?.cashPkr || 0;
            const bank = row.payment?.bankPkr || 0;
            const due = row.remainingPkr || 0;
            return (
              <MzCard
                key={row.id}
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  paddingVertical: 13,
                  alignItems: "center",
                }}
              >
                <View style={{ flex: 1, paddingRight: 10 }}>
                  <Text style={{ color: mz.ink, fontWeight: "700" }}>
                    {isSale ? "Sale" : "Buy"} · {row.brand} {row.model}
                  </Text>
                  <Text style={{ color: mz.muted, fontSize: 11, marginTop: 3 }}>
                    Cash {formatPkr(cash)} · Bank {formatPkr(bank)}
                    {due > 0 ? ` · Due ${formatPkr(due)}` : ""}
                  </Text>
                </View>
                <Text style={{ color: isSale ? mz.accent : mz.orange, fontWeight: "800" }}>
                  {formatPkr(isSale ? row.pricePkr : row.purchasePricePkr)}
                </Text>
              </MzCard>
            );
          })
        )}
      </ScrollView>
    </MzShell>
  );
}

