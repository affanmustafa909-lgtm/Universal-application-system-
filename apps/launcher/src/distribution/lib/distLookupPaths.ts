/** Remap shared pharmacy lookup paths to Dist edition routes. */
const MODULE_PATH: Record<string, string> = {
  medicine: "/pops/distribution/medicines",
  company: "/pops/distribution/companies",
  warehouse: "/pops/distribution/warehouses",
  tradeCustomer: "/pops/distribution/trade-customers",
  territory: "/pops/distribution/geo",
  city: "/pops/distribution/geo",
  area: "/pops/distribution/geo",
  route: "/pops/distribution/route-plan",
  visit: "/pops/distribution/visits",
  pjp: "/pops/distribution/pjp",
  target: "/pops/distribution/targets",
  assignment: "/pops/distribution/assignments",
  distOrder: "/pops/distribution/orders",
  distInvoice: "/pops/distribution/invoices",
  delivery: "/pops/distribution/deliveries",
  collection: "/pops/distribution/collections",
  purchaseOrder: "/pops/distribution/purchase-orders",
  grn: "/pops/distribution/purchase-orders",
  purchaseReturn: "/pops/distribution/purchase-returns",
  journal: "/pops/distribution/finance/gl",
  expense: "/pops/accounting/expenses",
  account: "/pops/accounting/accounts",
  priceList: "/pops/distribution/pricing",
  scheme: "/pops/distribution/pricing",
};

export function distPathForLookup(module: string, fallbackPath?: string | null): string {
  if (MODULE_PATH[module]) return MODULE_PATH[module]!;
  const path = typeof fallbackPath === "string" ? fallbackPath : "";
  if (path) return path.replace("/pops/pharmacy/", "/pops/distribution/");
  return "/pops/distribution";
}

export function distLookupModuleLabel(module: string): string {
  const map: Record<string, string> = {
    medicine: "Medicine",
    company: "Company",
    warehouse: "Warehouse",
    tradeCustomer: "Customer",
    territory: "Territory",
    city: "City",
    area: "Area",
    route: "Route",
    visit: "Visit",
    pjp: "PJP",
    target: "Target",
    assignment: "Assignment",
    distOrder: "Order",
    distInvoice: "Invoice",
    delivery: "Delivery",
    collection: "Collection",
    purchaseOrder: "PO",
    grn: "GRN",
    purchaseReturn: "PRN",
    priceList: "Price list",
    scheme: "Scheme",
    patient: "Patient",
    doctor: "Doctor",
    saleInvoice: "Retail invoice",
    saleReturn: "Sale return",
    prescription: "Rx",
  };
  return map[module] ?? module;
}
