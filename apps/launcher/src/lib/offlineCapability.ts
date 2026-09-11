export type OfflineCapability = {
  module: string;
  read: boolean;
  create: boolean | "configurable";
  edit: boolean | "draft" | "controlled";
  delete: false;
  sync: boolean;
};

/** Admin/developer matrix — not hardcoded per screen. Financial/stock creates stay controlled. */
export const OFFLINE_CAPABILITY_MATRIX: OfflineCapability[] = [
  { module: "Products", read: true, create: "configurable", edit: "configurable", delete: false, sync: true },
  { module: "Customers", read: true, create: true, edit: true, delete: false, sync: true },
  { module: "Sales", read: true, create: "configurable", edit: "draft", delete: false, sync: true },
  { module: "Inventory", read: true, create: "configurable", edit: "controlled", delete: false, sync: true },
  { module: "Collections", read: true, create: "configurable", edit: "controlled", delete: false, sync: true },
  { module: "Delivery", read: true, create: true, edit: true, delete: false, sync: true },
  { module: "PJP", read: true, create: true, edit: true, delete: false, sync: true },
  { module: "Finance", read: true, create: "configurable", edit: "controlled", delete: false, sync: true },
];
