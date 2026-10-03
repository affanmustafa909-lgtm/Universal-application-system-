import {
  createEducationInventoryItem,
  fetchEducationInventoryItems,
} from "../api/education";
import { EducationModulePage } from "../ui/EducationModulePage";

export function EducationInventoryPage(): JSX.Element {
  return (
    <EducationModulePage
      title="Inventory"
      subtitle="Track campus inventory items, stock levels, and reorder points."
      resourceKey="inventory-items"
      fetchList={fetchEducationInventoryItems}
      createFn={createEducationInventoryItem}
      createLabel="Add item"
      formTitle="New inventory item"
      searchKeys={["sku", "name", "categoryCode", "status"]}
      fields={[
        { key: "sku", label: "SKU", required: true },
        { key: "name", label: "Name", required: true },
        { key: "categoryCode", label: "Category", required: true },
        { key: "qtyOnHand", label: "Qty on hand", type: "number", required: true },
        { key: "reorderLevel", label: "Reorder level", type: "number", omitIfEmpty: true },
        { key: "unit", label: "Unit", required: true, placeholder: "pcs / box / …" },
        { key: "status", label: "Status", omitIfEmpty: true, placeholder: "active" },
      ]}
      columns={[
        { key: "sku", label: "SKU" },
        { key: "name", label: "Name" },
        { key: "categoryCode", label: "Category" },
        { key: "qtyOnHand", label: "Qty" },
        { key: "reorderLevel", label: "Reorder" },
        { key: "unit", label: "Unit" },
        { key: "status", label: "Status" },
      ]}
    />
  );
}
