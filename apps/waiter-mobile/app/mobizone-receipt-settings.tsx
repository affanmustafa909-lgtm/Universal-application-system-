import Constants from "expo-constants";
import { Redirect } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, Switch, Text, View } from "react-native";
import { WebView } from "react-native-webview";
import { MzShell } from "../src/mobizone/MzShell";
import {
  DEFAULT_MOBIZONE_RECEIPT_SETTINGS,
  MOBIZONE_RECEIPT_FIELD_LABELS,
  RECEIPT_DESIGN_PRESETS,
  loadMobizoneReceiptSettings,
  saveMobizoneReceiptSettings,
  type MobizoneReceiptDesign,
  type MobizoneReceiptFields,
  type MobizoneReceiptSettings,
} from "../src/mobizone/receiptSettings";
import { buildSaleReceiptHtml } from "../src/mobizone/storeCore";
import { useMz, useMzLayout } from "../src/mobizone/theme";
import {
  MzCard,
  MzField,
  MzInput,
  MzPrimaryButton,
  MzScreenTitle,
  MzSection,
} from "../src/mobizone/ui";
import { useMobizoneDb } from "../src/mobizone/useMobizone";
import { useSessionStore } from "../src/stores/sessionStore";

const extra = Constants.expoConfig?.extra as { appVariant?: string } | undefined;
const isMobizoneApp = extra?.appVariant === "mobizone";

const FIELD_GROUPS: { title: string; keys: (keyof MobizoneReceiptFields)[] }[] = [
  {
    title: "Shop header",
    keys: ["shopName", "shopPhone", "shopAddress", "documentTitle", "timestamp"],
  },
  { title: "Device", keys: ["device", "imei", "warranty"] },
  { title: "Payment", keys: ["salePrice", "cash", "bank", "bankDetails", "remaining", "dueDate"] },
  { title: "Footer", keys: ["footer"] },
];

const COLOR_KEYS: { key: keyof MobizoneReceiptDesign; label: string }[] = [
  { key: "accent", label: "Accent" },
  { key: "text", label: "Text" },
  { key: "muted", label: "Muted" },
  { key: "border", label: "Border" },
  { key: "background", label: "Background" },
];

export default function MobizoneReceiptSettingsScreen(): React.JSX.Element {
  const mz = useMz();
  const { pad, gap } = useMzLayout();
  const accessToken = useSessionStore((s) => s.accessToken);
  const { branchCode, db } = useMobizoneDb();
  const [settings, setSettings] = useState<MobizoneReceiptSettings>(DEFAULT_MOBIZONE_RECEIPT_SETTINGS);

  useEffect(() => {
    setSettings(loadMobizoneReceiptSettings(branchCode));
  }, [branchCode]);

  const sampleSale = useMemo(() => {
    const last = db.sales.find((s) => !s.returnedAt && !s.deletedAt);
    if (last) return last;
    return {
      id: "00000000-0000-4000-8000-000000000001",
      deviceId: "00000000-0000-4000-8000-000000000002",
      customerId: null,
      shopkeeperId: null,
      customerName: "Ali Khan",
      customerPhone: "03001234567",
      customerAddress: "Main Bazaar",
      customerCnic: "35202-1234567-1",
      customerPhotoDataUrl: null,
      cnicFrontDataUrl: null,
      cnicBackDataUrl: null,
      imei: "359999999999999",
      brand: "Samsung",
      model: "A15",
      pricePkr: 45000,
      receivedPkr: 40000,
      remainingPkr: 5000,
      dueDate: "2026-11-01",
      warrantyDays: 30,
      returnedAt: null,
      deletedAt: null,
      payment: {
        cashPkr: 20000,
        bankPkr: 20000,
        bankLabel: "HBL",
        bank: {
          bankAccountId: null,
          bankName: "HBL",
          accountTitle: "Shop",
          accountNumber: null,
          iban: null,
          txnRef: "TXN-123",
          verified: true,
        },
      },
      costPkr: 38000,
      profitPkr: 7000,
      createdAt: new Date().toISOString(),
      note: null,
    };
  }, [db.sales]);

  const previewHtml = useMemo(
    () => buildSaleReceiptHtml(sampleSale as never, branchCode, settings),
    [sampleSale, branchCode, settings],
  );

  if (!accessToken) return <Redirect href="/" />;
  if (extra?.appVariant && !isMobizoneApp) return <Redirect href="/home" />;

  function save(): void {
    saveMobizoneReceiptSettings(branchCode, settings);
    Alert.alert("Saved", "MobiZone phone-shop bill ab yeh design use karega.");
  }

  function applyPreset(name: "teal" | "classic" | "navy"): void {
    const design = { ...RECEIPT_DESIGN_PRESETS[name] };
    setSettings((s) => ({
      ...s,
      design,
      slipTheme: name === "navy" ? "dark" : "classic",
    }));
  }

  return (
    <MzShell>
      <ScrollView contentContainerStyle={{ paddingHorizontal: pad, paddingTop: 8, paddingBottom: 28, gap }}>
        <MzScreenTitle
          title="Bill print settings"
          subtitle="Design · colors · paper · fields — phone-shop receipt"
        />

        <MzCard style={{ backgroundColor: mz.navyDeep, borderColor: mz.accent }}>
          <Text style={{ color: mz.accent, fontWeight: "800" }}>Always on bill</Text>
          <Text style={{ color: "rgba(233,238,243,0.7)", marginTop: 6, fontSize: 13 }}>
            Customer/Seller · Phone · CNIC · Address · IMEI. Preview colors; print stays black/white.
          </Text>
        </MzCard>

        <MzSection title="Shop header">
          <MzField label="Shop name">
            <MzInput
              value={settings.shopName}
              onChangeText={(shopName) => setSettings((s) => ({ ...s, shopName }))}
            />
          </MzField>
          <MzField label="Shop phone">
            <MzInput
              value={settings.shopPhone}
              onChangeText={(shopPhone) => setSettings((s) => ({ ...s, shopPhone }))}
            />
          </MzField>
          <MzField label="WhatsApp number">
            <MzInput
              value={settings.whatsappNumber}
              onChangeText={(whatsappNumber) => setSettings((s) => ({ ...s, whatsappNumber }))}
              placeholder="03xx…"
              keyboardType="phone-pad"
            />
          </MzField>
          <RowSwitch
            label="Default share on WhatsApp"
            value={settings.whatsappDefaultOn}
            onChange={(whatsappDefaultOn) => setSettings((s) => ({ ...s, whatsappDefaultOn }))}
            mz={mz}
          />
          <MzField label="Shop address">
            <MzInput
              value={settings.shopAddress}
              onChangeText={(shopAddress) => setSettings((s) => ({ ...s, shopAddress }))}
            />
          </MzField>
          <MzField label="Document title">
            <MzInput
              value={settings.documentTitle}
              onChangeText={(documentTitle) => setSettings((s) => ({ ...s, documentTitle }))}
            />
          </MzField>
          <MzField label="Footer">
            <MzInput
              value={settings.footerText}
              onChangeText={(footerText) => setSettings((s) => ({ ...s, footerText }))}
            />
          </MzField>
        </MzSection>

        <MzSection title="Paper & size">
          <ChipRow
            options={[
              { id: "80", label: "80mm" },
              { id: "58", label: "58mm" },
            ]}
            value={String(settings.paperWidthMm)}
            onChange={(id) =>
              setSettings((s) => ({ ...s, paperWidthMm: id === "58" ? 58 : 80 }))
            }
            mz={mz}
          />
          <Text style={{ color: mz.muted, fontSize: 12, marginTop: 8 }}>Font scale</Text>
          <ChipRow
            options={[
              { id: "0.85", label: "Small" },
              { id: "1", label: "Normal" },
              { id: "1.15", label: "Large" },
              { id: "1.3", label: "XL" },
            ]}
            value={String(settings.fontScale ?? 1)}
            onChange={(id) => setSettings((s) => ({ ...s, fontScale: Number(id) || 1 }))}
            mz={mz}
          />
          <Text style={{ color: mz.muted, fontSize: 12, marginTop: 8 }}>Density</Text>
          <ChipRow
            options={[
              { id: "compact", label: "Compact" },
              { id: "comfortable", label: "Tall" },
            ]}
            value={settings.density ?? "compact"}
            onChange={(id) =>
              setSettings((s) => ({
                ...s,
                density: id === "comfortable" ? "comfortable" : "compact",
              }))
            }
            mz={mz}
          />
          <Text style={{ color: mz.muted, fontSize: 12, marginTop: 8 }}>Slip look</Text>
          <ChipRow
            options={[
              { id: "classic", label: "White" },
              { id: "dark", label: "Dark" },
            ]}
            value={settings.slipTheme ?? "classic"}
            onChange={(id) => {
              const slipTheme = id === "dark" ? "dark" : "classic";
              setSettings((s) => ({
                ...s,
                slipTheme,
                design:
                  slipTheme === "dark"
                    ? { ...RECEIPT_DESIGN_PRESETS.navy }
                    : { ...RECEIPT_DESIGN_PRESETS.teal },
              }));
            }}
            mz={mz}
          />
        </MzSection>

        <MzSection title="Design colors">
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 8 }}>
            {(["teal", "classic", "navy"] as const).map((name) => (
              <Pressable
                key={name}
                onPress={() => applyPreset(name)}
                style={{
                  backgroundColor: mz.cardSoft,
                  borderColor: mz.border,
                  borderWidth: 1,
                  borderRadius: 10,
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                }}
              >
                <Text style={{ color: mz.text, fontWeight: "700", textTransform: "capitalize" }}>
                  {name}
                </Text>
              </Pressable>
            ))}
          </View>
          {COLOR_KEYS.map(({ key, label }) => (
            <MzField key={key} label={label}>
              <MzInput
                value={settings.design[key]}
                autoCapitalize="none"
                onChangeText={(v) =>
                  setSettings((s) => ({
                    ...s,
                    design: { ...s.design, [key]: v },
                  }))
                }
                placeholder="#0f766e"
              />
            </MzField>
          ))}
        </MzSection>

        {FIELD_GROUPS.map((group) => (
          <MzSection key={group.title} title={group.title}>
            {group.keys.map((key) => (
              <RowSwitch
                key={key}
                label={MOBIZONE_RECEIPT_FIELD_LABELS[key]}
                value={settings.fields[key]}
                onChange={(v) =>
                  setSettings((s) => ({ ...s, fields: { ...s.fields, [key]: v } }))
                }
                mz={mz}
              />
            ))}
          </MzSection>
        ))}

        <MzSection title="Live preview">
          <View
            style={{
              height: 420,
              borderRadius: 12,
              overflow: "hidden",
              borderWidth: 1,
              borderColor: mz.border,
              backgroundColor: settings.design.background,
            }}
          >
            <WebView
              originWhitelist={["*"]}
              source={{ html: previewHtml }}
              style={{ flex: 1, backgroundColor: "transparent" }}
              scrollEnabled
            />
          </View>
        </MzSection>

        <MzPrimaryButton label="Save settings" onPress={save} />
      </ScrollView>
    </MzShell>
  );
}

function RowSwitch({
  label,
  value,
  onChange,
  mz,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
  mz: ReturnType<typeof useMz>;
}): React.JSX.Element {
  return (
    <View
      style={{
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        backgroundColor: mz.cardSoft,
        borderRadius: 12,
        padding: 12,
        borderWidth: 1,
        borderColor: mz.border,
      }}
    >
      <Text style={{ color: mz.text, fontWeight: "600", flex: 1, paddingRight: 8 }}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ true: mz.accent, false: mz.border }}
        thumbColor={mz.ivory}
      />
    </View>
  );
}

function ChipRow({
  options,
  value,
  onChange,
  mz,
}: {
  options: { id: string; label: string }[];
  value: string;
  onChange: (id: string) => void;
  mz: ReturnType<typeof useMz>;
}): React.JSX.Element {
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 6 }}>
      {options.map((opt) => {
        const active = opt.id === value;
        return (
          <Pressable
            key={opt.id}
            onPress={() => onChange(opt.id)}
            style={{
              backgroundColor: active ? mz.accent : mz.cardSoft,
              borderColor: active ? mz.accent : mz.border,
              borderWidth: 1,
              borderRadius: 999,
              paddingHorizontal: 12,
              paddingVertical: 8,
            }}
          >
            <Text style={{ color: active ? "#fff" : mz.text, fontWeight: "700", fontSize: 12 }}>
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
