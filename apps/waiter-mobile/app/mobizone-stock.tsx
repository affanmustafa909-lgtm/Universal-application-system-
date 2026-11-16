import Constants from "expo-constants";
import { Redirect, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { MzShell } from "../src/mobizone/MzShell";
import { formatPkr } from "../src/mobizone/storeCore";
import { useMz, useMzLayout } from "../src/mobizone/theme";
import {
  MzBadge,
  MzCard,
  MzChip,
  MzEmpty,
  MzInput,
  MzScreenTitle,
  MzSection,
} from "../src/mobizone/ui";
import { useMobizoneDb } from "../src/mobizone/useMobizone";
import { useSessionStore } from "../src/stores/sessionStore";

const extra = Constants.expoConfig?.extra as { appVariant?: string } | undefined;
const isMobizoneApp = extra?.appVariant === "mobizone";

type CondFilter = "all" | "new" | "used";

export default function MobizoneStockScreen(): React.JSX.Element {
  const mz = useMz();
  const { pad, gap } = useMzLayout();
  const router = useRouter();
  const accessToken = useSessionStore((s) => s.accessToken);
  const { db } = useMobizoneDb();
  const [q, setQ] = useState("");
  const [cond, setCond] = useState<CondFilter>("all");

  const stock = useMemo(() => {
    const rows = db.devices.filter((d) => d.status === "in_stock");
    const needle = q.trim().toLowerCase();
    return rows.filter((d) => {
      if (cond === "new" && d.condition !== "new") return false;
      if (cond === "used" && d.condition !== "used") return false;
      if (!needle) return true;
      return (
        d.brand.toLowerCase().includes(needle) ||
        d.model.toLowerCase().includes(needle) ||
        d.imei.toLowerCase().includes(needle) ||
        (d.imei2 ?? "").toLowerCase().includes(needle)
      );
    });
  }, [db.devices, q, cond]);

  const allInStock = useMemo(
    () => db.devices.filter((d) => d.status === "in_stock"),
    [db.devices],
  );
  const newCount = allInStock.filter((d) => d.condition === "new").length;
  const usedCount = allInStock.length - newCount;

  if (!accessToken) return <Redirect href="/" />;
  if (extra?.appVariant && !isMobizoneApp) return <Redirect href="/home" />;

  return (
    <MzShell>
      <ScrollView contentContainerStyle={{ paddingHorizontal: pad, paddingTop: 8, paddingBottom: 20, gap }}>
        <MzScreenTitle
          title="Stock"
          subtitle={`${allInStock.length} in stock · New ${newCount} · Used ${usedCount}`}
          right={
            <Pressable
              onPress={() => router.push("/mobizone-purchase" as never)}
              style={{
                backgroundColor: mz.accent,
                borderRadius: 10,
                paddingHorizontal: 12,
                paddingVertical: 10,
              }}
            >
              <Text style={{ color: mz.onGold, fontWeight: "800", fontSize: 12 }}>+ Add</Text>
            </Pressable>
          }
        />

        <MzSection title="Find phone">
          <MzInput
            value={q}
            onChangeText={setQ}
            placeholder="Enter or scan IMEI, brand, model"
            autoCapitalize="none"
            autoCorrect={false}
            style={{ flex: undefined }}
          />
          <View style={{ flexDirection: "row", gap: 8 }}>
            <MzChip label="All" active={cond === "all"} onPress={() => setCond("all")} />
            <MzChip label="New" active={cond === "new"} onPress={() => setCond("new")} />
            <MzChip label="Used" active={cond === "used"} onPress={() => setCond("used")} />
          </View>
          <Text style={{ color: mz.muted, fontSize: 11, lineHeight: 15 }}>
            Type or USB/Bluetooth scan IMEI. Camera scan is on Buy / Sell when needed.
          </Text>
        </MzSection>

        <View style={{ flexDirection: "row", gap: 8 }}>
          <StatPill label="In stock" value={String(allInStock.length)} />
          <StatPill label="New" value={String(newCount)} />
          <StatPill label="Used" value={String(usedCount)} />
        </View>

        {stock.length === 0 ? (
          <MzEmpty title="No stock yet" note="Purchase se phone add karein" />
        ) : (
          stock.map((d) => (
            <MzCard
              key={d.id}
              style={{ flexDirection: "row", gap: 12, alignItems: "center", padding: 14 }}
            >
              <View
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: 14,
                  backgroundColor: mz.navyDeep,
                  borderWidth: 1,
                  borderColor: mz.accent,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text style={{ color: mz.accent, fontWeight: "800", fontSize: 10 }}>PHONE</Text>
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Text style={{ color: mz.ink, fontWeight: "800", flexShrink: 1 }}>
                    {d.brand} {d.model}
                  </Text>
                  <MzBadge
                    label={d.condition}
                    tone={d.condition === "new" ? "teal" : "orange"}
                  />
                </View>
                <Text style={{ color: mz.muted, fontSize: 12, marginTop: 4 }}>
                  IMEI {d.imei}
                  {d.imei2 ? ` / ${d.imei2}` : ""}
                  {d.colour ? ` · ${d.colour}` : ""}
                  {d.storage ? ` · ${d.storage}` : ""}
                </Text>
                <Text style={{ color: mz.muted, fontSize: 11, marginTop: 2 }}>
                  Cost {formatPkr(d.purchasePricePkr)}
                </Text>
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <Text style={{ color: mz.accent, fontWeight: "800" }}>
                  {formatPkr(d.salePricePkr ?? d.purchasePricePkr)}
                </Text>
                <Text style={{ color: mz.muted, fontSize: 10, marginTop: 2 }}>sale</Text>
              </View>
            </MzCard>
          ))
        )}
      </ScrollView>
    </MzShell>
  );
}

function StatPill({ label, value }: { label: string; value: string }): React.JSX.Element {
  const mz = useMz();
  return (
    <View
      style={{
        flex: 1,
        minWidth: 0,
        backgroundColor: mz.card,
        borderRadius: 10,
        paddingVertical: 8,
        paddingHorizontal: 6,
        borderWidth: 1,
        borderColor: mz.border,
        alignItems: "center",
      }}
    >
      <Text style={{ color: mz.muted, fontSize: 10, fontWeight: "700" }}>{label}</Text>
      <Text style={{ color: mz.ink, fontWeight: "800", fontSize: 15, marginTop: 2 }}>
        {value}
      </Text>
    </View>
  );
}
