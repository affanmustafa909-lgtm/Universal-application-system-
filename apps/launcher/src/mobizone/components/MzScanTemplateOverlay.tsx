export type MzScanTemplateKind = "imei" | "photo" | "cnic-front" | "cnic-back" | "condition";

const COPY: Record<
  MzScanTemplateKind,
  { title: string; hint: string; badge: string }
> = {
  imei: {
    title: "IMEI / barcode",
    hint: "Phone box or battery sticker — barcode / QR frame ke andar rakhein",
    badge: "15-digit IMEI",
  },
  photo: {
    title: "Face photo",
    hint: "Chehra oval ke andar — saamne se seedha dekhain",
    badge: "Front camera",
  },
  "cnic-front": {
    title: "CNIC front",
    hint: "CNIC ka front card rectangle mein fit karein — glare avoid",
    badge: "ID front",
  },
  "cnic-back": {
    title: "CNIC back",
    hint: "CNIC ka back (chip / barcode side) frame mein fit karein",
    badge: "ID back",
  },
  condition: {
    title: "Phone condition",
    hint: "Phone outline mein — scratches / screen clearly dikhein",
    badge: "Proof photo",
  },
};

/**
 * Live-camera guide overlay — shape matches what the operator should align.
 */
export function MzScanTemplateOverlay({
  kind,
}: {
  kind: MzScanTemplateKind;
}): JSX.Element {
  const copy = COPY[kind];

  return (
    <div className="mz-scan-overlay" aria-hidden>
      <div className="mz-scan-overlay-dim" />
      <div className={`mz-scan-frame mz-scan-frame--${kind}`}>
        {kind === "imei" ? (
          <div className="mz-scan-imei-inner">
            <div className="mz-scan-imei-bars" />
            <span className="mz-scan-imei-label">* 3 5 8 2 … IMEI *</span>
          </div>
        ) : null}
        {kind === "photo" ? <div className="mz-scan-face-oval" /> : null}
        {kind === "cnic-front" ? (
          <div className="mz-scan-cnic-card">
            <div className="mz-scan-cnic-photo" />
            <div className="mz-scan-cnic-lines">
              <span />
              <span />
              <span />
              <span className="mz-scan-cnic-lines-short" />
            </div>
          </div>
        ) : null}
        {kind === "cnic-back" ? (
          <div className="mz-scan-cnic-card mz-scan-cnic-card--back">
            <div className="mz-scan-cnic-mrz" />
            <div className="mz-scan-cnic-chip" />
          </div>
        ) : null}
        {kind === "condition" ? (
          <div className="mz-scan-phone">
            <div className="mz-scan-phone-notch" />
            <div className="mz-scan-phone-screen" />
          </div>
        ) : null}
        <div className="mz-scan-corner mz-scan-corner--tl" />
        <div className="mz-scan-corner mz-scan-corner--tr" />
        <div className="mz-scan-corner mz-scan-corner--bl" />
        <div className="mz-scan-corner mz-scan-corner--br" />
      </div>
      <div className="mz-scan-overlay-caption">
        <span className="mz-scan-overlay-badge">{copy.badge}</span>
        <p className="mz-scan-overlay-title">{copy.title}</p>
        <p className="mz-scan-overlay-hint">{copy.hint}</p>
      </div>
    </div>
  );
}

export function facingModeForKind(
  kind: MzScanTemplateKind,
): "user" | "environment" {
  return kind === "photo" ? "user" : "environment";
}
