import { useMemo, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { loadBranch } from "../lib/auth";
import {
  DEFAULT_RECEIPT_SETTINGS,
  RECEIPT_DESIGN_PRESETS,
  buildSampleReceiptHtml,
  loadReceiptSettings,
  saveReceiptSettings,
  type MobizoneReceiptDesign,
  type MobizoneReceiptSettings,
} from "../lib/receiptSettings";

const COLOR_KEYS: { key: keyof MobizoneReceiptDesign; label: string }[] = [
  { key: "accent", label: "Accent" },
  { key: "text", label: "Text" },
  { key: "muted", label: "Muted" },
  { key: "border", label: "Border" },
  { key: "background", label: "Background" },
];

export function ReceiptSettingsPage(): React.JSX.Element {
  const branch = loadBranch()!;
  const [settings, setSettings] = useState<MobizoneReceiptSettings>(() =>
    loadReceiptSettings(branch.code),
  );
  const [msg, setMsg] = useState<string | null>(null);

  const preview = useMemo(() => buildSampleReceiptHtml(settings), [settings]);

  function onSave(e: FormEvent): void {
    e.preventDefault();
    saveReceiptSettings(branch.code, settings);
    setMsg("Receipt design saved on this device.");
  }

  return (
    <main>
      <p className="brand">Bill design</p>
      <p className="tag">Colors, paper, footer — preview updates live.</p>
      <form className="card" onSubmit={onSave}>
        <div className="field">
          <label>Shop name</label>
          <input
            value={settings.shopName}
            onChange={(e) => setSettings((s) => ({ ...s, shopName: e.target.value }))}
          />
        </div>
        <div className="field">
          <label>Shop phone</label>
          <input
            value={settings.shopPhone}
            onChange={(e) => setSettings((s) => ({ ...s, shopPhone: e.target.value }))}
          />
        </div>
        <div className="field">
          <label>Footer</label>
          <input
            value={settings.footerText}
            onChange={(e) => setSettings((s) => ({ ...s, footerText: e.target.value }))}
          />
        </div>
        <div className="field">
          <label>Paper</label>
          <select
            value={settings.paperWidthMm}
            onChange={(e) =>
              setSettings((s) => ({
                ...s,
                paperWidthMm: e.target.value === "58" ? 58 : 80,
              }))
            }
          >
            <option value={80}>80mm</option>
            <option value={58}>58mm</option>
          </select>
        </div>

        <p style={{ marginTop: 16, marginBottom: 0, fontWeight: 800 }}>Presets</p>
        <div className="nav-row">
          {(["teal", "classic", "navy"] as const).map((name) => (
            <button
              key={name}
              type="button"
              className="chip"
              onClick={() =>
                setSettings((s) => ({
                  ...s,
                  design: { ...RECEIPT_DESIGN_PRESETS[name] },
                  slipTheme: name === "navy" ? "dark" : "classic",
                }))
              }
            >
              {name}
            </button>
          ))}
        </div>

        {COLOR_KEYS.map(({ key, label }) => (
          <div className="field" key={key}>
            <label>{label}</label>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                type="color"
                value={settings.design[key]}
                onChange={(e) =>
                  setSettings((s) => ({
                    ...s,
                    design: { ...s.design, [key]: e.target.value },
                  }))
                }
                style={{ width: 52, padding: 4 }}
              />
              <input
                value={settings.design[key]}
                onChange={(e) =>
                  setSettings((s) => ({
                    ...s,
                    design: { ...s.design, [key]: e.target.value },
                  }))
                }
              />
            </div>
          </div>
        ))}

        {msg ? <p className="muted">{msg}</p> : null}
        <button className="btn btn-primary" type="submit">
          Save design
        </button>
        <button
          className="btn btn-ghost"
          type="button"
          onClick={() => setSettings({ ...DEFAULT_RECEIPT_SETTINGS, design: { ...DEFAULT_RECEIPT_SETTINGS.design }, fields: { ...DEFAULT_RECEIPT_SETTINGS.fields } })}
        >
          Reset defaults
        </button>
        <Link className="btn btn-ghost" to="/home">
          Back
        </Link>
      </form>

      <div className="card">
        <p style={{ margin: 0, fontWeight: 800 }}>Live preview</p>
        <div className="preview" style={{ background: settings.design.background }}>
          <iframe title="Receipt preview" srcDoc={preview} />
        </div>
      </div>
    </main>
  );
}
