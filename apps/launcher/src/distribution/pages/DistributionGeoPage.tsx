import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { pharmacyInputClass, useInvalidatePharmacy } from "../../pharmacy/hooks/usePharmacy";
import {
  createPharmacyArea,
  createPharmacyCity,
  createPharmacyDistrict,
  createPharmacyDivision,
  createPharmacyGeoTerritory,
  createPharmacyProvince,
  createPharmacyRoute,
  createPharmacyTerritory,
  fetchPharmacyAreas,
  fetchPharmacyCities,
  fetchPharmacyDistricts,
  fetchPharmacyDivisions,
  fetchPharmacyGeoTerritories,
  fetchPharmacyProvinces,
  fetchPharmacyRoutes,
  fetchPharmacyTerritories,
} from "../../pharmacy/api/pharmacy-erp";
import { DistStatusBadge } from "../ui/DistUi";

type Level =
  | "province"
  | "division"
  | "district"
  | "city"
  | "area"
  | "territory"
  | "route"
  | "legacy";

const STEPS: { id: Level; label: string }[] = [
  { id: "province", label: "Province" },
  { id: "division", label: "Division" },
  { id: "district", label: "District" },
  { id: "city", label: "City" },
  { id: "area", label: "Area" },
  { id: "territory", label: "Territory" },
  { id: "route", label: "Route" },
  { id: "legacy", label: "Legacy" },
];

type Row = { id: string; code: string; name: string; status?: string; [k: string]: unknown };

export function DistributionGeoPage(): JSX.Element {
  const invalidate = useInvalidatePharmacy([
    ["pharmacy", "provinces"],
    ["pharmacy", "divisions"],
    ["pharmacy", "districts"],
    ["pharmacy", "cities"],
    ["pharmacy", "areas"],
    ["pharmacy", "geo-territories"],
    ["pharmacy", "routes"],
    ["pharmacy", "territories"],
  ]);
  const [level, setLevel] = useState<Level>("province");
  const [error, setError] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [extra, setExtra] = useState("");
  const [outstation, setOutstation] = useState(false);

  const [selProvince, setSelProvince] = useState<Row | null>(null);
  const [selDivision, setSelDivision] = useState<Row | null>(null);
  const [selDistrict, setSelDistrict] = useState<Row | null>(null);
  const [selCity, setSelCity] = useState<Row | null>(null);
  const [selArea, setSelArea] = useState<Row | null>(null);
  const [selTerritory, setSelTerritory] = useState<Row | null>(null);

  const provinces = useQuery({
    queryKey: ["pharmacy", "provinces"],
    queryFn: fetchPharmacyProvinces,
    enabled: level === "province" || level === "division",
    staleTime: 120_000,
  });
  const divisions = useQuery({
    queryKey: ["pharmacy", "divisions"],
    queryFn: fetchPharmacyDivisions,
    enabled: level === "division" || level === "district",
    staleTime: 120_000,
  });
  const districts = useQuery({
    queryKey: ["pharmacy", "districts"],
    queryFn: fetchPharmacyDistricts,
    enabled: level === "district" || level === "city",
    staleTime: 120_000,
  });
  const cities = useQuery({
    queryKey: ["pharmacy", "cities"],
    queryFn: fetchPharmacyCities,
    enabled: level === "city" || level === "area",
    staleTime: 120_000,
  });
  const areas = useQuery({
    queryKey: ["pharmacy", "areas"],
    queryFn: fetchPharmacyAreas,
    enabled: level === "area" || level === "territory" || level === "route",
    staleTime: 120_000,
  });
  const geoTerritories = useQuery({
    queryKey: ["pharmacy", "geo-territories"],
    queryFn: fetchPharmacyGeoTerritories,
    enabled: level === "territory" || level === "route",
    staleTime: 120_000,
  });
  const routes = useQuery({
    queryKey: ["pharmacy", "routes"],
    queryFn: fetchPharmacyRoutes,
    enabled: level === "route",
    staleTime: 120_000,
  });
  const legacy = useQuery({
    queryKey: ["pharmacy", "territories"],
    queryFn: fetchPharmacyTerritories,
    enabled: level === "legacy",
    staleTime: 120_000,
  });

  useEffect(() => {
    setCode("");
    setName("");
    setExtra("");
    setOutstation(false);
    setError(null);
  }, [level]);

  const list: Row[] = useMemo(() => {
    if (level === "province") return (provinces.data ?? []) as Row[];
    if (level === "division")
      return ((divisions.data ?? []) as Row[]).filter((r) => !selProvince || r.provinceId === selProvince.id);
    if (level === "district")
      return ((districts.data ?? []) as Row[]).filter((r) => !selDivision || r.divisionId === selDivision.id);
    if (level === "city")
      return ((cities.data ?? []) as Row[]).filter((r) => !selDistrict || r.districtId === selDistrict.id);
    if (level === "area")
      return ((areas.data ?? []) as Row[]).filter((r) => !selCity || r.cityId === selCity.id);
    if (level === "territory")
      return ((geoTerritories.data ?? []) as Row[]).filter((r) => !selArea || r.areaId === selArea.id);
    if (level === "route")
      return ((routes.data ?? []) as Row[]).filter((r) => !selArea || r.areaId === selArea.id);
    return (legacy.data ?? []) as Row[];
  }, [
    level,
    provinces.data,
    divisions.data,
    districts.data,
    cities.data,
    areas.data,
    geoTerritories.data,
    routes.data,
    legacy.data,
    selProvince,
    selDivision,
    selDistrict,
    selCity,
    selArea,
  ]);

  const parentHint = useMemo(() => {
    if (level === "division") return selProvince ? `Under ${selProvince.name}` : "Pick a province first (or add freely)";
    if (level === "district") return selDivision ? `Under ${selDivision.name}` : "Pick a division first";
    if (level === "city") return selDistrict ? `Under ${selDistrict.name}` : "District optional — tap one above";
    if (level === "area") return selCity ? `Under ${selCity.name}` : "Pick a city first";
    if (level === "territory" || level === "route") return selArea ? `Under ${selArea.name}` : "Pick an area first";
    if (level === "legacy") return "Old sales region (optional link on cities)";
    return "Tap a card to drill down";
  }, [level, selProvince, selDivision, selDistrict, selCity, selArea]);

  function tapRow(row: Row) {
    if (level === "province") {
      setSelProvince(row);
      setLevel("division");
    } else if (level === "division") {
      setSelDivision(row);
      setLevel("district");
    } else if (level === "district") {
      setSelDistrict(row);
      setLevel("city");
    } else if (level === "city") {
      setSelCity(row);
      setLevel("area");
    } else if (level === "area") {
      setSelArea(row);
      setLevel("territory");
    } else if (level === "territory") {
      setSelTerritory(row);
      setLevel("route");
    }
  }

  async function onAdd(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      if (level === "province") await createPharmacyProvince({ code, name });
      else if (level === "division") {
        if (!selProvince) throw new Error("Tap a province first");
        await createPharmacyDivision({ provinceId: selProvince.id, code, name });
      } else if (level === "district") {
        if (!selDivision) throw new Error("Tap a division first");
        await createPharmacyDistrict({ divisionId: selDivision.id, code, name });
      } else if (level === "city") {
        await createPharmacyCity({
          code,
          name,
          districtId: selDistrict?.id,
        });
      } else if (level === "area") {
        if (!selCity) throw new Error("Tap a city first");
        await createPharmacyArea({ cityId: selCity.id, code, name, isOutstation: outstation });
      } else if (level === "territory") {
        if (!selArea) throw new Error("Tap an area first");
        await createPharmacyGeoTerritory({ areaId: selArea.id, code, name });
      } else if (level === "route") {
        if (!selArea) throw new Error("Tap an area first");
        await createPharmacyRoute({
          areaId: selArea.id,
          geoTerritoryId: selTerritory?.id,
          code,
          name,
          sequenceNo: Number(extra) || 0,
          pjpDayOfWeek: null,
        });
      } else {
        await createPharmacyTerritory({ code, name, region: extra || undefined });
      }
      invalidate();
      setCode("");
      setName("");
      setExtra("");
      setOutstation(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    }
  }

  const needsParent =
    (level === "division" && !selProvince) ||
    (level === "district" && !selDivision) ||
    (level === "area" && !selCity) ||
    ((level === "territory" || level === "route") && !selArea);

  return (
    <div className="flex min-h-[calc(100vh-8rem)] flex-col gap-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-white">Geography masters</h1>
          <p className="text-sm text-slate-500">Tap to drill Province → Route. Add from the bar below.</p>
        </div>
        <div className="flex flex-wrap gap-1.5 text-xs text-slate-600 dark:text-slate-300">
          {selProvince ? <span className="rounded-md bg-slate-100 px-2 py-1 dark:bg-slate-800">{selProvince.name}</span> : null}
          {selDivision ? <span className="rounded-md bg-slate-100 px-2 py-1 dark:bg-slate-800">{selDivision.name}</span> : null}
          {selDistrict ? <span className="rounded-md bg-slate-100 px-2 py-1 dark:bg-slate-800">{selDistrict.name}</span> : null}
          {selCity ? <span className="rounded-md bg-slate-100 px-2 py-1 dark:bg-slate-800">{selCity.name}</span> : null}
          {selArea ? <span className="rounded-md bg-slate-100 px-2 py-1 dark:bg-slate-800">{selArea.name}</span> : null}
        </div>
      </div>

      <div className="flex gap-1 overflow-x-auto rounded-xl border border-slate-200 bg-white p-1 dark:border-slate-800 dark:bg-slate-950/50">
        {STEPS.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setLevel(s.id)}
            className={`shrink-0 rounded-lg px-3 py-2 text-sm font-medium transition ${
              level === s.id
                ? "bg-cyan-600 text-white"
                : "text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-900"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      <p className="text-xs text-slate-500">{parentHint}</p>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <div className="min-h-0 flex-1 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50/60 p-3 dark:border-slate-800 dark:bg-slate-950/30">
        {list.length === 0 ? (
          <div className="flex h-40 items-center justify-center text-sm text-slate-500">
            Nothing here yet — use Add below.
          </div>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {list.map((row) => (
              <button
                key={row.id}
                type="button"
                onClick={() => tapRow(row)}
                className="rounded-xl border border-slate-200 bg-white p-3 text-left transition hover:border-cyan-500 hover:shadow-sm dark:border-slate-700 dark:bg-slate-900"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-semibold text-slate-900 dark:text-white">{row.name}</div>
                    <div className="mt-0.5 font-mono text-xs text-slate-500">{row.code}</div>
                  </div>
                  {row.status ? <DistStatusBadge status={String(row.status)} /> : null}
                </div>
                {level !== "route" && level !== "legacy" ? (
                  <div className="mt-2 text-[11px] text-cyan-700 dark:text-cyan-400">Tap to open next →</div>
                ) : null}
              </button>
            ))}
          </div>
        )}
      </div>

      <form
        onSubmit={onAdd}
        className="sticky bottom-0 z-10 flex flex-wrap items-end gap-2 rounded-xl border border-slate-200 bg-white p-3 shadow-lg dark:border-slate-700 dark:bg-slate-900"
      >
        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 w-full sm:w-auto sm:mr-2">
          Add {STEPS.find((s) => s.id === level)?.label}
        </div>
        <input
          className={`${pharmacyInputClass} max-w-[8rem]`}
          placeholder="Code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          required
        />
        <input
          className={`${pharmacyInputClass} min-w-[10rem] flex-1`}
          placeholder="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        {level === "area" ? (
          <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
            <input type="checkbox" checked={outstation} onChange={(e) => setOutstation(e.target.checked)} />
            Outstation
          </label>
        ) : null}
        {level === "route" ? (
          <input
            className={`${pharmacyInputClass} max-w-[6rem]`}
            type="number"
            min={0}
            placeholder="Seq"
            value={extra}
            onChange={(e) => setExtra(e.target.value)}
          />
        ) : null}
        {level === "legacy" ? (
          <input
            className={`${pharmacyInputClass} max-w-[10rem]`}
            placeholder="Region"
            value={extra}
            onChange={(e) => setExtra(e.target.value)}
          />
        ) : null}
        <button
          type="submit"
          disabled={needsParent && level !== "city" && level !== "province" && level !== "legacy"}
          className="rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-40"
        >
          Add
        </button>
      </form>
    </div>
  );
}
