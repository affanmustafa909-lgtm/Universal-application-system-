import { useMutation } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { createExpense } from "../../api/accounting";
import { usePopsStore } from "../../../stores/popsStore";
import { useSessionStore } from "../../../stores/sessionStore";
import { PageHeader } from "../../ui/PageHeader";
import { fieldInputClass } from "../../lib/themeClasses";
import {
  ICE_CREAM_EXPENSE_LINES,
  createBlankSheet,
  createSampleFilledSheet,
  loadDailySheet,
  saveDailySheet,
  sumExpenses,
  recomputeCups,
  type IceCreamDailySheet,
  type IceCreamExpenseKey,
} from "../../lib/iceCreamDailySheet";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function num(v: string): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export function IceCreamDailySheetPage(): JSX.Element {
  const branch = usePopsStore((s) => s.branch);
  const email = useSessionStore((s) => s.email);
  const [date, setDate] = useState(todayIso);
  const [sheet, setSheet] = useState<IceCreamDailySheet>(() =>
    createBlankSheet({
      businessDate: todayIso(),
      branchCode: "MAIN",
      managerName: "",
    }),
  );
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const branchCode = branch?.code ?? "MAIN";
  const branchName = branch?.name ?? branchCode;

  useEffect(() => {
    const existing = loadDailySheet(branchCode, date);
    if (existing) {
      setSheet({ ...existing, branchCode, branchName });
      return;
    }
    setSheet(
      createSampleFilledSheet({
        businessDate: date,
        branchCode,
        branchName,
        managerName: email?.split("@")[0] ?? "مینجر",
      }),
    );
  }, [branchCode, branchName, date, email]);

  const totalExpense = useMemo(() => sumExpenses(sheet.expenses), [sheet.expenses]);

  function patch(partial: Partial<IceCreamDailySheet>): void {
    setSheet((prev) => ({ ...prev, ...partial }));
  }

  function setExpense(key: IceCreamExpenseKey, amount: number): void {
    setSheet((prev) => ({
      ...prev,
      expenses: { ...prev.expenses, [key]: Math.max(0, amount) },
    }));
  }

  function setCup(field: keyof IceCreamDailySheet["cups"], value: number): void {
    setSheet((prev) => ({
      ...prev,
      cups: recomputeCups({ ...prev.cups, [field]: value }),
    }));
  }

  function onSaveLocal(): void {
    setError(null);
    const next = {
      ...sheet,
      branchCode,
      branchName,
      businessDate: date,
      cups: recomputeCups(sheet.cups),
    };
    saveDailySheet(next);
    setSheet(next);
    setNotice(`روزمرہ شیٹ محفوظ ہو گئی · ${date} · ${branchName}`);
  }

  const syncExpenses = useMutation({
    mutationFn: async () => {
      if (!branchCode) throw new Error("Branch required");
      const lines = ICE_CREAM_EXPENSE_LINES.filter((l) => (sheet.expenses[l.key] ?? 0) > 0);
      for (const line of lines) {
        await createExpense({
          branchCode,
          category: "Other",
          amount: sheet.expenses[line.key],
          expenseDate: date,
          vendor: "Shehryar Ice Cream Daily Sheet",
          description: `${line.labelUr} (${line.labelEn}) · daily sheet ${date}`,
        });
      }
      return lines.length;
    },
    onSuccess: (n) => {
      onSaveLocal();
      setNotice(`${n} خرچے accounting میں بھیجے گئے · شیٹ محفوظ`);
    },
    onError: (err: Error) => setError(err.message),
  });

  const inputClass = `${fieldInputClass} w-full text-sm`;

  return (
    <div className="space-y-4" dir="rtl">
      <PageHeader
        title="شہریار آئسکریم — روزمرہ شیٹ"
        subtitle="پرنٹ فارم جیسا ڈیجیٹل روزانہ ریکارڈ · خرچہ · کپ · دودھ / کریم"
      />

      <details className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-950/40">
        <summary className="cursor-pointer text-sm font-medium text-slate-700 dark:text-slate-200">
          اصل پرنٹ فارم کی تصویر (حوالہ)
        </summary>
        <img
          src="/shehryar/daily-sheet.jpg"
          alt="Shehryar Ice Cream daily sheet"
          className="mt-3 max-h-[28rem] w-full rounded-lg object-contain"
        />
      </details>

      {notice ? (
        <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">
          {notice}
        </p>
      ) : null}
      {error ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
          {error}
        </p>
      ) : null}

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950/40">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3 border-b border-slate-200 pb-3 dark:border-slate-800">
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">شہریار آئسکریم</h2>
            <p className="text-xs text-slate-500">Shehryar Ice Cream · Daily sheet</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <label className="text-xs text-slate-500">
              مورخہ
              <input
                type="date"
                className={`${inputClass} mt-1 min-w-[10rem]`}
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </label>
            <label className="text-xs text-slate-500">
              برانچ
              <input className={`${inputClass} mt-1 min-w-[8rem]`} value={branchName} readOnly />
            </label>
            <label className="text-xs text-slate-500">
              نام مینیجر
              <input
                className={`${inputClass} mt-1 min-w-[10rem]`}
                value={sheet.managerName}
                onChange={(e) => patch({ managerName: e.target.value })}
              />
            </label>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50 text-slate-600 dark:bg-slate-900/80 dark:text-slate-300">
                <th className="border border-slate-200 px-2 py-1.5 dark:border-slate-700">نمبر شمار</th>
                <th className="border border-slate-200 px-2 py-1.5 text-right dark:border-slate-700">نام اشیاء</th>
                <th className="border border-slate-200 px-2 py-1.5 dark:border-slate-700">رقم</th>
              </tr>
            </thead>
            <tbody>
              {ICE_CREAM_EXPENSE_LINES.map((line, idx) => (
                <tr key={line.key}>
                  <td className="border border-slate-200 px-2 py-1 text-center tabular-nums dark:border-slate-700">
                    {idx + 1}
                  </td>
                  <td className="border border-slate-200 px-2 py-1 dark:border-slate-700">
                    <div className="font-medium text-slate-900 dark:text-white">{line.labelUr}</div>
                    <div className="text-[10px] text-slate-400" dir="ltr">
                      {line.labelEn}
                    </div>
                  </td>
                  <td className="border border-slate-200 px-2 py-1 dark:border-slate-700">
                    <input
                      type="number"
                      min={0}
                      className={`${inputClass} text-left tabular-nums`}
                      dir="ltr"
                      value={sheet.expenses[line.key] || ""}
                      onChange={(e) => setExpense(line.key, num(e.target.value))}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <label className="text-xs text-slate-500">
            نقد
            <input
              type="number"
              className={`${inputClass} mt-1 text-left tabular-nums`}
              dir="ltr"
              value={sheet.cashPkr || ""}
              onChange={(e) => patch({ cashPkr: num(e.target.value) })}
            />
          </label>
          <label className="text-xs text-slate-500">
            ٹوٹل سیل
            <input
              type="number"
              className={`${inputClass} mt-1 text-left tabular-nums`}
              dir="ltr"
              value={sheet.totalSalePkr || ""}
              onChange={(e) => patch({ totalSalePkr: num(e.target.value) })}
            />
          </label>
          <label className="text-xs text-slate-500">
            دستخط
            <input
              className={`${inputClass} mt-1`}
              value={sheet.signature}
              onChange={(e) => patch({ signature: e.target.value })}
            />
          </label>
        </div>

        <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
          ٹوٹل خرچہ:{" "}
          <span className="tabular-nums" dir="ltr">
            Rs {totalExpense.toLocaleString()}
          </span>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950/40">
        <h3 className="mb-3 text-sm font-semibold text-slate-900 dark:text-white">کپ انوینٹری</h3>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {(
            [
              ["previous", "سابقہ کپ"],
              ["dailyIn", "ڈیلی آنے والا کپ"],
              ["total", "ٹوٹل کپ"],
              ["sold", "سیل کپ"],
              ["remaining", "بقایا کپ"],
              ["extra", "اضافی کپ"],
              ["short", "کمی کپ"],
            ] as const
          ).map(([field, label]) => (
            <label key={field} className="text-xs text-slate-500">
              {label}
              <input
                type="number"
                min={0}
                readOnly={field === "total" || field === "remaining"}
                className={`${inputClass} mt-1 text-left tabular-nums ${
                  field === "total" || field === "remaining" ? "bg-slate-50 dark:bg-slate-900" : ""
                }`}
                dir="ltr"
                value={sheet.cups[field] || ""}
                onChange={(e) => setCup(field, num(e.target.value))}
              />
            </label>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950/40">
        <h3 className="mb-3 text-sm font-semibold text-slate-900 dark:text-white">دودھ / کریم</h3>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <label className="text-xs text-slate-500">
            ڈیلی ٹوٹل دودھ
            <input
              type="number"
              className={`${inputClass} mt-1 text-left tabular-nums`}
              dir="ltr"
              value={sheet.milkQty || ""}
              onChange={(e) => patch({ milkQty: num(e.target.value) })}
            />
          </label>
          <label className="text-xs text-slate-500">
            دودھ پیسے رقم
            <input
              type="number"
              className={`${inputClass} mt-1 text-left tabular-nums`}
              dir="ltr"
              value={sheet.milkAmountPkr || ""}
              onChange={(e) => patch({ milkAmountPkr: num(e.target.value) })}
            />
          </label>
          <label className="text-xs text-slate-500">
            ڈیلی ٹوٹل کریم
            <input
              type="number"
              className={`${inputClass} mt-1 text-left tabular-nums`}
              dir="ltr"
              value={sheet.creamQty || ""}
              onChange={(e) => patch({ creamQty: num(e.target.value) })}
            />
          </label>
          <label className="text-xs text-slate-500">
            کریم پیسے رقم
            <input
              type="number"
              className={`${inputClass} mt-1 text-left tabular-nums`}
              dir="ltr"
              value={sheet.creamAmountPkr || ""}
              onChange={(e) => patch({ creamAmountPkr: num(e.target.value) })}
            />
          </label>
        </div>
      </div>

      <div className="flex flex-wrap gap-2" dir="ltr">
        <button
          type="button"
          className="rounded-md bg-amber-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-amber-400"
          onClick={onSaveLocal}
        >
          Save sheet
        </button>
        <button
          type="button"
          className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
          disabled={syncExpenses.isPending}
          onClick={() => syncExpenses.mutate()}
        >
          {syncExpenses.isPending ? "Syncing…" : "Save + push expenses to accounting"}
        </button>
        <button
          type="button"
          className="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300"
          onClick={() => {
            const filled = createSampleFilledSheet({
              businessDate: date,
              branchCode,
              branchName,
              managerName: sheet.managerName || "مینجر",
            });
            setSheet(filled);
            saveDailySheet(filled);
            setNotice("Sample paper-form data loaded & saved");
          }}
        >
          Reload sample fill
        </button>
        <button
          type="button"
          className="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300"
          onClick={() => window.print()}
        >
          Print
        </button>
      </div>
    </div>
  );
}
