import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  createPharmacyPriceList,
  createPharmacyScheme,
  fetchPharmacyPriceLists,
  fetchPharmacySchemes,
} from "../../pharmacy/api/pharmacy-erp";
import {
  listMedicinesPaged,
  listPriceListItems,
  updateScheme,
  upsertPriceListItems,
} from "../../pharmacy/api/pharmacy-masters";
import { formatPkr, useInvalidatePharmacy, usePharmacyAccess } from "../../pharmacy/hooks/usePharmacy";
import {
  DistButton,
  DistDataTable,
  DistInput,
  DistPageShell,
  DistPanel,
  DistSelect,
  DistStatusBadge,
} from "../ui/DistUi";

type PriceList = { id: string; code?: string; name: string; priceLevel?: string; status: string };
type Scheme = {
  id: string;
  code?: string;
  name: string;
  buyQty?: number;
  freeQty?: number;
  startDate?: string | null;
  endDate?: string | null;
  status: string;
};

export function DistributionPricingPage(): JSX.Element {
  const { branch } = usePharmacyAccess();
  const invalidate = useInvalidatePharmacy([["pharmacy", "price-lists"], ["pharmacy", "schemes"]]);
  const [error, setError] = useState<string | null>(null);
  const [listName, setListName] = useState("");
  const [selectedListId, setSelectedListId] = useState<string>("");
  const [lineMedicineId, setLineMedicineId] = useState("");
  const [linePrice, setLinePrice] = useState("");
  const [lineMinQty, setLineMinQty] = useState("1");

  const [schemeForm, setSchemeForm] = useState({
    name: "",
    buyQty: "10",
    freeQty: "1",
    startDate: "",
    endDate: "",
  });
  const [editingScheme, setEditingScheme] = useState<Scheme | null>(null);

  const lists = useQuery({ queryKey: ["pharmacy", "price-lists"], queryFn: fetchPharmacyPriceLists });
  const schemes = useQuery({ queryKey: ["pharmacy", "schemes"], queryFn: fetchPharmacySchemes });
  const items = useQuery({
    queryKey: ["pharmacy", "price-list-items", selectedListId],
    enabled: Boolean(selectedListId),
    queryFn: () => listPriceListItems(selectedListId),
  });
  const medicines = useQuery({
    queryKey: ["pharmacy", "meds-for-pricing", branch?.code],
    enabled: Boolean(branch?.code),
    queryFn: () => listMedicinesPaged({ branchCode: branch!.code, page: 1, pageSize: 100, status: "active" }),
    staleTime: 60_000,
  });

  const createList = useMutation({
    mutationFn: () => createPharmacyPriceList({ name: listName, priceLevel: "wholesale", items: [] }),
    onSuccess: () => {
      invalidate();
      setListName("");
      setError(null);
      void lists.refetch();
    },
    onError: (e: Error) => setError(e.message),
  });

  const addLine = useMutation({
    mutationFn: () =>
      upsertPriceListItems(selectedListId, [
        {
          medicineId: lineMedicineId,
          unitPricePkr: Number(linePrice) || 0,
          minQty: Number(lineMinQty) || 1,
        },
      ]),
    onSuccess: () => {
      setLineMedicineId("");
      setLinePrice("");
      setLineMinQty("1");
      setError(null);
      void items.refetch();
    },
    onError: (e: Error) => setError(e.message),
  });

  const saveScheme = useMutation({
    mutationFn: async () => {
      const body = {
        name: schemeForm.name.trim(),
        schemeType: "buy_x_get_y",
        buyQty: Number(schemeForm.buyQty) || 0,
        freeQty: Number(schemeForm.freeQty) || 0,
        startDate: schemeForm.startDate || null,
        endDate: schemeForm.endDate || null,
      };
      if (editingScheme) return updateScheme(editingScheme.id, body);
      return createPharmacyScheme(body);
    },
    onSuccess: () => {
      invalidate();
      setEditingScheme(null);
      setSchemeForm({ name: "", buyQty: "10", freeQty: "1", startDate: "", endDate: "" });
      setError(null);
      void schemes.refetch();
    },
    onError: (e: Error) => setError(e.message),
  });

  const medName = (id: string) => {
    const m = medicines.data?.items.find((x) => x.id === id);
    return m ? `${m.sku} — ${m.name}` : id;
  };

  return (
    <DistPageShell
      title="Pricing & schemes"
      subtitle="Price lists with line items and Buy X Get Y schemes with date windows."
      breadcrumb={[
        { label: "Distribution", to: "/pops/distribution/ps" },
        { label: "Masters", to: "/pops/distribution/masters" },
        { label: "Pricing" },
      ]}
      error={error}
    >
      <DistPanel title="Price lists">
        <form
          className="mb-3 flex flex-wrap gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            createList.mutate();
          }}
        >
          <DistInput
            className="min-w-[14rem]"
            placeholder="New list name"
            value={listName}
            onChange={(e) => setListName(e.target.value)}
            required
          />
          <DistButton type="submit" disabled={createList.isPending}>
            Create list
          </DistButton>
        </form>
        <DistDataTable
          loading={lists.isLoading}
          rowKey={(r) => r.id}
          empty="No price lists"
          rows={(lists.data ?? []) as PriceList[]}
          columns={[
            { key: "code", header: "Code", render: (r) => r.code ?? "—" },
            { key: "name", header: "Name" },
            { key: "priceLevel", header: "Level", render: (r) => r.priceLevel ?? "—" },
            { key: "status", header: "Status", render: (r) => <DistStatusBadge status={r.status} /> },
            {
              key: "actions",
              header: "",
              render: (r) => (
                <DistButton
                  variant="ghost"
                  className="px-2 py-1 text-xs"
                  onClick={() => setSelectedListId(r.id)}
                >
                  Items
                </DistButton>
              ),
            },
          ]}
        />
      </DistPanel>

      {selectedListId ? (
        <DistPanel
          title="List items"
          subtitle={(lists.data as PriceList[] | undefined)?.find((l) => l.id === selectedListId)?.name}
          action={
            <DistButton variant="ghost" onClick={() => setSelectedListId("")}>
              Close
            </DistButton>
          }
        >
          <form
            className="mb-3 flex flex-wrap items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              addLine.mutate();
            }}
          >
            <label className="text-xs text-slate-500">
              Medicine
              <DistSelect
                className="mt-1 min-w-[16rem]"
                value={lineMedicineId}
                onChange={(e) => setLineMedicineId(e.target.value)}
                required
              >
                <option value="">Select…</option>
                {(medicines.data?.items ?? []).map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.sku} — {m.name}
                  </option>
                ))}
              </DistSelect>
            </label>
            <label className="text-xs text-slate-500">
              Price
              <DistInput
                className="mt-1"
                type="number"
                value={linePrice}
                onChange={(e) => setLinePrice(e.target.value)}
                required
              />
            </label>
            <label className="text-xs text-slate-500">
              Min qty
              <DistInput
                className="mt-1"
                type="number"
                value={lineMinQty}
                onChange={(e) => setLineMinQty(e.target.value)}
              />
            </label>
            <DistButton type="submit" disabled={addLine.isPending || !branch}>
              Add / update line
            </DistButton>
          </form>
          <DistDataTable
            loading={items.isLoading}
            rowKey={(r) => r.id}
            empty="No lines"
            rows={items.data ?? []}
            columns={[
              { key: "medicineId", header: "Medicine", render: (r) => medName(r.medicineId) },
              { key: "unitPricePkr", header: "Price", render: (r) => formatPkr(r.unitPricePkr) },
              { key: "minQty", header: "Min qty" },
            ]}
          />
        </DistPanel>
      ) : null}

      <DistPanel title={editingScheme ? "Edit scheme" : "Add scheme"}>
        <form
          className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5"
          onSubmit={(e) => {
            e.preventDefault();
            saveScheme.mutate();
          }}
        >
          <DistInput
            placeholder="Scheme name"
            value={schemeForm.name}
            onChange={(e) => setSchemeForm({ ...schemeForm, name: e.target.value })}
            required
          />
          <DistInput
            type="number"
            placeholder="Buy qty"
            value={schemeForm.buyQty}
            onChange={(e) => setSchemeForm({ ...schemeForm, buyQty: e.target.value })}
          />
          <DistInput
            type="number"
            placeholder="Free qty"
            value={schemeForm.freeQty}
            onChange={(e) => setSchemeForm({ ...schemeForm, freeQty: e.target.value })}
          />
          <label className="text-xs text-slate-500">
            Start
            <DistInput
              className="mt-1"
              type="date"
              value={schemeForm.startDate}
              onChange={(e) => setSchemeForm({ ...schemeForm, startDate: e.target.value })}
            />
          </label>
          <label className="text-xs text-slate-500">
            End
            <DistInput
              className="mt-1"
              type="date"
              value={schemeForm.endDate}
              onChange={(e) => setSchemeForm({ ...schemeForm, endDate: e.target.value })}
            />
          </label>
          <div className="flex gap-2">
            <DistButton type="submit" disabled={saveScheme.isPending}>
              {editingScheme ? "Update scheme" : "Add scheme"}
            </DistButton>
            {editingScheme ? (
              <DistButton
                type="button"
                variant="ghost"
                onClick={() => {
                  setEditingScheme(null);
                  setSchemeForm({ name: "", buyQty: "10", freeQty: "1", startDate: "", endDate: "" });
                }}
              >
                Cancel
              </DistButton>
            ) : null}
          </div>
        </form>
        <div className="mt-3">
          <DistDataTable
            loading={schemes.isLoading}
            rowKey={(r) => r.id}
            empty="No schemes"
            rows={(schemes.data ?? []) as Scheme[]}
            columns={[
              { key: "code", header: "Code", render: (r) => r.code ?? "—" },
              { key: "name", header: "Scheme" },
              { key: "buyQty", header: "Buy" },
              { key: "freeQty", header: "Free" },
              { key: "startDate", header: "Start", render: (r) => r.startDate ?? "—" },
              { key: "endDate", header: "End", render: (r) => r.endDate ?? "—" },
              { key: "status", header: "Status", render: (r) => <DistStatusBadge status={r.status} /> },
              {
                key: "actions",
                header: "",
                render: (r) => (
                  <DistButton
                    variant="ghost"
                    className="px-2 py-1 text-xs"
                    onClick={() => {
                      setEditingScheme(r);
                      setSchemeForm({
                        name: r.name,
                        buyQty: String(r.buyQty ?? 0),
                        freeQty: String(r.freeQty ?? 0),
                        startDate: r.startDate ?? "",
                        endDate: r.endDate ?? "",
                      });
                    }}
                  >
                    Edit
                  </DistButton>
                ),
              },
            ]}
          />
        </div>
      </DistPanel>
    </DistPageShell>
  );
}
