import { useMutation, useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { PageHeader } from "../../pops/ui/PageHeader";
import { noticeErrorClass, noticeSuccessClass } from "../../pops/lib/themeClasses";
import {
  createEducationEquipment,
  createEducationLab,
  fetchEducationEquipment,
  fetchEducationLabs,
  fetchEducationRooms,
} from "../api/education";
import { formatPkr, useEducationAccess, useInvalidateEducation } from "../hooks/useEducation";
import {
  EducationDataTable,
  EducationField,
  EducationFormSection,
  EducationInput,
  EducationPrimaryButton,
  EducationSelect,
} from "../ui/EducationUi";

export function EducationLabsPage(): JSX.Element {
  const { branch } = useEducationAccess();
  const invalidate = useInvalidateEducation();
  const [notice, setNotice] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [labName, setLabName] = useState("");
  const [labCode, setLabCode] = useState("");
  const [roomId, setRoomId] = useState("");
  const [labId, setLabId] = useState("");
  const [eqNumber, setEqNumber] = useState("");
  const [eqName, setEqName] = useState("");
  const [categoryCode, setCategoryCode] = useState("");
  const [serialNumber, setSerialNumber] = useState("");
  const [conditionCode, setConditionCode] = useState("");
  const [purchaseCost, setPurchaseCost] = useState("");

  const labsQuery = useQuery({
    queryKey: ["education", "labs", branch?.code],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchEducationLabs(branch!.code),
  });
  const equipmentQuery = useQuery({
    queryKey: ["education", "equipment", branch?.code],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchEducationEquipment(branch!.code),
  });
  const roomsQuery = useQuery({
    queryKey: ["education", "rooms", branch?.code],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchEducationRooms(branch!.code),
  });

  const labMutation = useMutation({
    mutationFn: () =>
      createEducationLab({
        branchCode: branch!.code,
        name: labName.trim(),
        code: labCode.trim(),
        roomId: roomId || undefined,
        status: "active",
      }),
    onSuccess: () => {
      invalidate();
      setNotice("Lab created");
      setLabName("");
      setLabCode("");
    },
  });

  const equipmentMutation = useMutation({
    mutationFn: () =>
      createEducationEquipment({
        branchCode: branch!.code,
        labId: labId || undefined,
        equipmentNumber: eqNumber.trim(),
        name: eqName.trim(),
        categoryCode: categoryCode.trim(),
        serialNumber: serialNumber.trim() || undefined,
        conditionCode: conditionCode.trim() || undefined,
        purchaseCostPkr: purchaseCost ? Number(purchaseCost) : undefined,
        status: "available",
      }),
    onSuccess: () => {
      invalidate();
      setNotice("Equipment added");
      setEqNumber("");
      setEqName("");
      setCategoryCode("");
      setSerialNumber("");
      setConditionCode("");
      setPurchaseCost("");
    },
  });

  const filteredLabs = useMemo(() => {
    const list = labsQuery.data ?? [];
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (l) =>
        String(l.name ?? "").toLowerCase().includes(q) ||
        String(l.code ?? "").toLowerCase().includes(q),
    );
  }, [labsQuery.data, search]);

  return (
    <div className="space-y-5">
      <PageHeader title="Labs & Equipment" subtitle="Register labs and track lab equipment assets." />
      {notice ? <div className={noticeSuccessClass}>{notice}</div> : null}
      {labsQuery.isError ? (
        <div className={noticeErrorClass}>{(labsQuery.error as Error).message}</div>
      ) : null}
      {equipmentQuery.isError ? (
        <div className={noticeErrorClass}>{(equipmentQuery.error as Error).message}</div>
      ) : null}
      {labMutation.isError ? (
        <div className={noticeErrorClass}>{(labMutation.error as Error).message}</div>
      ) : null}
      {equipmentMutation.isError ? (
        <div className={noticeErrorClass}>{(equipmentMutation.error as Error).message}</div>
      ) : null}

      <EducationFormSection title="New lab">
        <EducationField label="Name" required>
          <EducationInput value={labName} onChange={(e) => setLabName(e.target.value)} />
        </EducationField>
        <EducationField label="Code" required>
          <EducationInput value={labCode} onChange={(e) => setLabCode(e.target.value)} />
        </EducationField>
        <EducationField label="Room">
          <EducationSelect value={roomId} onChange={(e) => setRoomId(e.target.value)}>
            <option value="">—</option>
            {(roomsQuery.data ?? []).map((r) => (
              <option key={r.id} value={r.id}>
                {r.code} — {r.name}
              </option>
            ))}
          </EducationSelect>
        </EducationField>
        <div className="col-span-full">
          <EducationPrimaryButton
            disabled={
              !branch?.code ||
              !labName.trim() ||
              !labCode.trim() ||
              labsQuery.isError ||
              labMutation.isPending
            }
            onClick={() => {
              setNotice(null);
              labMutation.mutate();
            }}
          >
            Create lab
          </EducationPrimaryButton>
        </div>
      </EducationFormSection>

      <EducationFormSection title="New equipment">
        <EducationField label="Lab">
          <EducationSelect value={labId} onChange={(e) => setLabId(e.target.value)}>
            <option value="">—</option>
            {(labsQuery.data ?? []).map((l) => (
              <option key={String(l.id)} value={String(l.id)}>
                {String(l.name ?? l.code)}
              </option>
            ))}
          </EducationSelect>
        </EducationField>
        <EducationField label="Equipment number" required>
          <EducationInput value={eqNumber} onChange={(e) => setEqNumber(e.target.value)} />
        </EducationField>
        <EducationField label="Name" required>
          <EducationInput value={eqName} onChange={(e) => setEqName(e.target.value)} />
        </EducationField>
        <EducationField label="Category" required>
          <EducationInput value={categoryCode} onChange={(e) => setCategoryCode(e.target.value)} />
        </EducationField>
        <EducationField label="Serial number">
          <EducationInput value={serialNumber} onChange={(e) => setSerialNumber(e.target.value)} />
        </EducationField>
        <EducationField label="Condition">
          <EducationInput value={conditionCode} onChange={(e) => setConditionCode(e.target.value)} />
        </EducationField>
        <EducationField label="Purchase cost (PKR)">
          <EducationInput
            type="number"
            value={purchaseCost}
            onChange={(e) => setPurchaseCost(e.target.value)}
          />
        </EducationField>
        <div className="col-span-full">
          <EducationPrimaryButton
            disabled={
              !branch?.code ||
              !eqNumber.trim() ||
              !eqName.trim() ||
              !categoryCode.trim() ||
              equipmentQuery.isError ||
              equipmentMutation.isPending
            }
            onClick={() => {
              setNotice(null);
              equipmentMutation.mutate();
            }}
          >
            Add equipment
          </EducationPrimaryButton>
        </div>
      </EducationFormSection>

      <EducationInput
        className="max-w-xs"
        placeholder="Search labs…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Labs</h3>
      <EducationDataTable
        columns={["Code", "Name", "Room", "Status"]}
        rows={filteredLabs.map((l) => [
          String(l.code ?? "—"),
          String(l.name ?? "—"),
          l.roomId ? String(l.roomId).slice(0, 8) : "—",
          String(l.status ?? "—"),
        ])}
      />
      <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Equipment</h3>
      <EducationDataTable
        columns={["Number", "Name", "Category", "Condition", "Cost", "Status"]}
        rows={(equipmentQuery.data ?? []).map((e) => [
          String(e.equipmentNumber ?? "—"),
          String(e.name ?? "—"),
          String(e.categoryCode ?? "—"),
          String(e.conditionCode ?? "—"),
          e.purchaseCostPkr != null ? formatPkr(Number(e.purchaseCostPkr)) : "—",
          String(e.status ?? "—"),
        ])}
      />
    </div>
  );
}
