import type { PharmacySale } from "@platform/contracts";
import {
  printReceiptDetailed,
  withPrinterProfile,
  type PrintTicketInput,
} from "../../pops/lib/printTicket";
import { resolvePraFooterForSource } from "../../pops/lib/praPaidPrint";
import { loadBillPrintSettings } from "../../pops/lib/billPrintSettings";
import { resolveReceiptPrinter } from "../../pops/lib/printerRouting";
import { useSessionStore } from "../../stores/sessionStore";

function saleToTicketInput(
  branchName: string,
  branchCode: string,
  sale: PharmacySale,
): Omit<PrintTicketInput, "kind"> {
  const discountPct = sale.subtotal > 0 ? Math.round((sale.discount / sale.subtotal) * 100) : 0;
  const channelLabel =
    sale.saleChannel === "instation"
      ? "Instation"
      : sale.saleChannel === "outstation"
        ? "Outstation"
        : sale.saleChannel === "counter"
          ? "Counter"
          : "Counter";
  const stationParts = [channelLabel];
  if (sale.stationLabel) stationParts.push(sale.stationLabel);
  const notesParts: string[] = [];
  if (sale.patientName) notesParts.push(`Customer: ${sale.patientName}`);
  if (sale.employeeName) notesParts.push(`Employee: ${sale.employeeName}`);
  return {
    branchName,
    branchCode,
    orderRef: sale.invoiceNumber,
    billRef: sale.invoiceNumber,
    modeLabel: sale.paymentMethod || "Paid",
    tableLabel: stationParts.join(" · "),
    waiterName: sale.employeeName?.trim() || useSessionStore.getState().claims?.role?.trim() || "Cashier",
    notes: notesParts.length > 0 ? notesParts.join(" · ") : undefined,
    lines: sale.lines.map((line) => ({
      label: line.batchNumber
        ? `${line.medicineName} · Batch ${line.batchNumber}`
        : line.medicineName,
      qty: line.qty > 0 ? line.qty : 1,
      unitPrice: line.unitPrice,
    })),
    subtotal: sale.subtotal,
    discount: sale.discount,
    service: 0,
    tax: sale.tax,
    total: sale.total,
    servicePct: 0,
    discountPct,
  };
}

/** Print pharmacy invoice with the same POS slip design + PRA Invoice # / QR when enabled. */
export function printPharmacyInvoice(
  branchName: string,
  branchCode: string,
  sale: PharmacySale,
): boolean {
  void (async () => {
    const base = saleToTicketInput(branchName, branchCode, sale);
    const resolved = await resolvePraFooterForSource({
      branchCode,
      sourceType: "pharmacy_sale",
      sourceId: sale.id,
      orderRef: sale.invoiceNumber,
      issueIfMissing: true,
    });
    if (resolved.blockedReal && resolved.notice) {
      window.alert(resolved.notice);
    }
    const userId = useSessionStore.getState().claims?.sub ?? null;
    const profile = resolveReceiptPrinter(branchCode, userId);
    const payload = withPrinterProfile(
      {
        ...base,
        praFiscal: resolved.footer,
        billPrintSettings: loadBillPrintSettings(branchCode),
      },
      profile,
    );
    await printReceiptDetailed(payload);
  })();
  return true;
}
