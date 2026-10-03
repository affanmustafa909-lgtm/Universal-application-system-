import { useMutation, useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { PageHeader } from "../../pops/ui/PageHeader";
import { noticeErrorClass, noticeSuccessClass } from "../../pops/lib/themeClasses";
import {
  createEducationBuilding,
  createEducationRoom,
  fetchEducationBuildings,
  fetchEducationRooms,
} from "../api/education";
import { useEducationAccess, useInvalidateEducation } from "../hooks/useEducation";
import {
  EducationDataTable,
  EducationField,
  EducationFormSection,
  EducationInput,
  EducationPrimaryButton,
  EducationSelect,
} from "../ui/EducationUi";

export function EducationFacilitiesPage(): JSX.Element {
  const { branch } = useEducationAccess();
  const invalidate = useInvalidateEducation();
  const [notice, setNotice] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [bCode, setBCode] = useState("");
  const [bName, setBName] = useState("");
  const [floors, setFloors] = useState("");
  const [rCode, setRCode] = useState("");
  const [rName, setRName] = useState("");
  const [buildingId, setBuildingId] = useState("");
  const [roomTypeCode, setRoomTypeCode] = useState("");
  const [floor, setFloor] = useState("");
  const [capacity, setCapacity] = useState("");

  const buildingsQuery = useQuery({
    queryKey: ["education", "buildings", branch?.code],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchEducationBuildings(branch!.code),
  });
  const roomsQuery = useQuery({
    queryKey: ["education", "rooms", branch?.code],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchEducationRooms(branch!.code),
  });

  const buildingMutation = useMutation({
    mutationFn: () =>
      createEducationBuilding({
        branchCode: branch!.code,
        code: bCode.trim(),
        name: bName.trim(),
        floors: floors ? Number(floors) : undefined,
        status: "active",
      }),
    onSuccess: () => {
      invalidate();
      setNotice("Building created");
      setBCode("");
      setBName("");
      setFloors("");
    },
  });

  const roomMutation = useMutation({
    mutationFn: () =>
      createEducationRoom({
        branchCode: branch!.code,
        code: rCode.trim(),
        name: rName.trim(),
        buildingId: buildingId || undefined,
        roomTypeCode: roomTypeCode.trim() || undefined,
        floor: floor ? Number(floor) : undefined,
        capacity: capacity ? Number(capacity) : undefined,
        status: "active",
      }),
    onSuccess: () => {
      invalidate();
      setNotice("Room created");
      setRCode("");
      setRName("");
      setRoomTypeCode("");
      setFloor("");
      setCapacity("");
    },
  });

  const filteredBuildings = useMemo(() => {
    const list = buildingsQuery.data ?? [];
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (b) =>
        String(b.name ?? "").toLowerCase().includes(q) ||
        String(b.code ?? "").toLowerCase().includes(q),
    );
  }, [buildingsQuery.data, search]);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Facilities / Buildings"
        subtitle="Manage campus buildings and rooms for timetable and facilities planning."
      />
      {notice ? <div className={noticeSuccessClass}>{notice}</div> : null}
      {buildingsQuery.isError ? (
        <div className={noticeErrorClass}>{(buildingsQuery.error as Error).message}</div>
      ) : null}
      {roomsQuery.isError ? (
        <div className={noticeErrorClass}>{(roomsQuery.error as Error).message}</div>
      ) : null}
      {buildingMutation.isError ? (
        <div className={noticeErrorClass}>{(buildingMutation.error as Error).message}</div>
      ) : null}
      {roomMutation.isError ? (
        <div className={noticeErrorClass}>{(roomMutation.error as Error).message}</div>
      ) : null}

      <EducationFormSection title="New building">
        <EducationField label="Code" required>
          <EducationInput value={bCode} onChange={(e) => setBCode(e.target.value)} />
        </EducationField>
        <EducationField label="Name" required>
          <EducationInput value={bName} onChange={(e) => setBName(e.target.value)} />
        </EducationField>
        <EducationField label="Floors">
          <EducationInput type="number" value={floors} onChange={(e) => setFloors(e.target.value)} />
        </EducationField>
        <div className="col-span-full">
          <EducationPrimaryButton
            disabled={
              !branch?.code ||
              !bCode.trim() ||
              !bName.trim() ||
              buildingsQuery.isError ||
              buildingMutation.isPending
            }
            onClick={() => {
              setNotice(null);
              buildingMutation.mutate();
            }}
          >
            Create building
          </EducationPrimaryButton>
        </div>
      </EducationFormSection>

      <EducationFormSection title="New room">
        <EducationField label="Code" required>
          <EducationInput value={rCode} onChange={(e) => setRCode(e.target.value)} />
        </EducationField>
        <EducationField label="Name" required>
          <EducationInput value={rName} onChange={(e) => setRName(e.target.value)} />
        </EducationField>
        <EducationField label="Building">
          <EducationSelect value={buildingId} onChange={(e) => setBuildingId(e.target.value)}>
            <option value="">—</option>
            {(buildingsQuery.data ?? []).map((b) => (
              <option key={String(b.id)} value={String(b.id)}>
                {String(b.name ?? b.code)}
              </option>
            ))}
          </EducationSelect>
        </EducationField>
        <EducationField label="Room type">
          <EducationInput value={roomTypeCode} onChange={(e) => setRoomTypeCode(e.target.value)} />
        </EducationField>
        <EducationField label="Floor">
          <EducationInput type="number" value={floor} onChange={(e) => setFloor(e.target.value)} />
        </EducationField>
        <EducationField label="Capacity">
          <EducationInput
            type="number"
            value={capacity}
            onChange={(e) => setCapacity(e.target.value)}
          />
        </EducationField>
        <div className="col-span-full">
          <EducationPrimaryButton
            disabled={
              !branch?.code ||
              !rCode.trim() ||
              !rName.trim() ||
              roomsQuery.isError ||
              roomMutation.isPending
            }
            onClick={() => {
              setNotice(null);
              roomMutation.mutate();
            }}
          >
            Create room
          </EducationPrimaryButton>
        </div>
      </EducationFormSection>

      <EducationInput
        className="max-w-xs"
        placeholder="Search buildings…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Buildings</h3>
      <EducationDataTable
        columns={["Code", "Name", "Floors", "Status"]}
        rows={filteredBuildings.map((b) => [
          String(b.code ?? "—"),
          String(b.name ?? "—"),
          b.floors != null ? String(b.floors) : "—",
          String(b.status ?? "—"),
        ])}
      />
      <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Rooms</h3>
      <EducationDataTable
        columns={["Code", "Name", "Building", "Type", "Floor", "Capacity", "Status"]}
        rows={(roomsQuery.data ?? []).map((r) => [
          r.code,
          r.name,
          r.buildingId?.slice(0, 8) ?? "—",
          r.roomTypeCode ?? "—",
          r.floor ?? "—",
          r.capacity ?? "—",
          r.status,
        ])}
      />
    </div>
  );
}
