import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchPharmacyEmployeesPicker } from "../api/pharmacy-erp";
import {
  CHANNEL_HINTS,
  CHANNEL_LABELS,
  PHARMACY_POS_CHANNELS,
  type PharmacyPosChannel,
  type PharmacyPosSaleContext,
} from "../lib/posSaleContext";
import { modalBackdropClass } from "../../pops/lib/themeClasses";

type Step = "channel" | "employee";

type Props = {
  value: PharmacyPosSaleContext;
  onComplete: (ctx: PharmacyPosSaleContext) => void;
  onClose: () => void;
};

export function PharmacyPosContextModal({ value, onComplete, onClose }: Props): JSX.Element {
  const [step, setStep] = useState<Step>("channel");
  const [draft, setDraft] = useState<PharmacyPosSaleContext>(value);
  const scrollRef = useRef<HTMLDivElement>(null);

  const employeesQuery = useQuery({
    queryKey: ["pharmacy", "employees-picker"],
    queryFn: fetchPharmacyEmployeesPicker,
    enabled: step === "employee",
  });

  useEffect(() => {
    function onKey(e: KeyboardEvent): void {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }, [step]);

  function pickChannel(channel: PharmacyPosChannel): void {
    const next: PharmacyPosSaleContext = {
      channel,
      areaId: null,
      areaName: null,
      routeId: null,
      stationLabel: "Counter",
      employeeId: null,
      employeeName: null,
    };
    setDraft(next);
    setStep("employee");
  }

  function pickEmployee(emp: { id: string; name: string; employeeCode?: string }): void {
    const next: PharmacyPosSaleContext = {
      ...draft,
      employeeId: emp.id,
      employeeName: emp.name,
    };
    setDraft(next);
    onComplete(next);
  }

  const title = step === "channel" ? "Select sale channel" : "Select employee";
  const subtitle =
    step === "channel"
      ? "Choose Counter, then assign an employee before continuing."
      : "Assign the employee responsible for this bill.";

  return (
    <div className={modalBackdropClass} onClick={onClose} role="presentation">
      <div
        data-ui="floor-modal"
        className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-xl border shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pharmacy-pos-context-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="floor-modal-header flex items-start justify-between gap-3 px-4 py-3">
          <div>
            <h2 id="pharmacy-pos-context-title" className="floor-modal-title">
              {title}
            </h2>
            <p className="floor-modal-subtitle">{subtitle}</p>
          </div>
          <button type="button" onClick={onClose} className="floor-modal-close shrink-0" aria-label="Close">
            Close
          </button>
        </div>

        <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto p-4">
          {step === "employee" ? (
            <button type="button" className="floor-modal-back" onClick={() => setStep("channel")}>
              ← Back
            </button>
          ) : null}

          {step === "channel" ? (
            <div className="grid gap-2 sm:grid-cols-2">
              {PHARMACY_POS_CHANNELS.map((id) => {
                const selected = draft.channel === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => pickChannel(id)}
                    className={`floor-modal-section-card text-left ${
                      selected ? "border-amber-500/40 bg-amber-500/10" : ""
                    }`}
                  >
                    <div className="floor-modal-section-title">{CHANNEL_LABELS[id]}</div>
                    <div className="floor-modal-section-meta">{CHANNEL_HINTS[id]}</div>
                  </button>
                );
              })}
            </div>
          ) : employeesQuery.isLoading ? (
            <p className="floor-modal-body-text">Loading…</p>
          ) : (employeesQuery.data ?? []).length === 0 ? (
            <p className="floor-modal-body-text">No employees found. Add staff under HR.</p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {(employeesQuery.data ?? []).map((emp) => (
                <button
                  key={emp.id}
                  type="button"
                  onClick={() => pickEmployee(emp)}
                  className={`floor-modal-section-card text-left ${
                    draft.employeeId === emp.id ? "border-amber-500/40 bg-amber-500/10" : ""
                  }`}
                >
                  <div className="floor-modal-section-title">{emp.name}</div>
                  <div className="floor-modal-section-meta">{emp.employeeCode}</div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
