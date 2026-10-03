import { useMutation, useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { PageHeader } from "../../pops/ui/PageHeader";
import { noticeErrorClass, noticeSuccessClass } from "../../pops/lib/themeClasses";
import {
  createEducationHostel,
  createEducationHostelAllocation,
  createEducationHostelBed,
  createEducationHostelRoom,
  fetchEducationHostelAllocations,
  fetchEducationHostelBeds,
  fetchEducationHostelRooms,
  fetchEducationHostels,
  fetchEducationStudents,
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

export function EducationHostelPage(): JSX.Element {
  const { branch } = useEducationAccess();
  const invalidate = useInvalidateEducation();
  const [notice, setNotice] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [genderPolicy, setGenderPolicy] = useState("");
  const [hostelId, setHostelId] = useState("");
  const [roomNumber, setRoomNumber] = useState("");
  const [capacity, setCapacity] = useState("2");
  const [hostelRoomId, setHostelRoomId] = useState("");
  const [bedCode, setBedCode] = useState("");
  const [bedId, setBedId] = useState("");
  const [studentId, setStudentId] = useState("");
  const [checkInDate, setCheckInDate] = useState("");

  const hostelsQuery = useQuery({
    queryKey: ["education", "hostels", branch?.code],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchEducationHostels(branch!.code),
  });
  const roomsQuery = useQuery({
    queryKey: ["education", "hostel-rooms", branch?.code],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchEducationHostelRooms(branch!.code),
  });
  const bedsQuery = useQuery({
    queryKey: ["education", "hostel-beds", branch?.code],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchEducationHostelBeds(branch!.code),
  });
  const allocationsQuery = useQuery({
    queryKey: ["education", "hostel-allocations", branch?.code],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchEducationHostelAllocations(branch!.code),
  });
  const studentsQuery = useQuery({
    queryKey: ["education", "students", branch?.code],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchEducationStudents(branch!.code),
  });

  const hostelMutation = useMutation({
    mutationFn: () =>
      createEducationHostel({
        branchCode: branch!.code,
        name: name.trim(),
        code: code.trim(),
        genderPolicy: genderPolicy.trim() || undefined,
        status: "active",
      }),
    onSuccess: () => {
      invalidate();
      setNotice("Hostel created");
      setName("");
      setCode("");
      setGenderPolicy("");
    },
  });

  const roomMutation = useMutation({
    mutationFn: () =>
      createEducationHostelRoom({
        hostelId,
        roomNumber: roomNumber.trim(),
        capacity: Number(capacity || 1),
        status: "active",
      }),
    onSuccess: () => {
      invalidate();
      setNotice("Hostel room created");
      setRoomNumber("");
    },
  });

  const bedMutation = useMutation({
    mutationFn: () =>
      createEducationHostelBed({
        hostelRoomId,
        bedCode: bedCode.trim(),
        status: "available",
      }),
    onSuccess: () => {
      invalidate();
      setNotice("Bed created");
      setBedCode("");
    },
  });

  const allocationMutation = useMutation({
    mutationFn: () =>
      createEducationHostelAllocation({
        bedId,
        studentId,
        checkInDate,
        status: "active",
      }),
    onSuccess: () => {
      invalidate();
      setNotice("Student allocated");
    },
  });

  const filtered = useMemo(() => {
    const list = hostelsQuery.data ?? [];
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (h) => h.name.toLowerCase().includes(q) || h.code.toLowerCase().includes(q),
    );
  }, [hostelsQuery.data, search]);

  return (
    <div className="space-y-5">
      <PageHeader title="Hostel" subtitle="Hostels, rooms, beds, and student allocations." />
      {notice ? <div className={noticeSuccessClass}>{notice}</div> : null}
      {hostelsQuery.isError ? (
        <div className={noticeErrorClass}>{(hostelsQuery.error as Error).message}</div>
      ) : null}
      {hostelMutation.isError ? (
        <div className={noticeErrorClass}>{(hostelMutation.error as Error).message}</div>
      ) : null}
      {roomMutation.isError ? (
        <div className={noticeErrorClass}>{(roomMutation.error as Error).message}</div>
      ) : null}
      {bedMutation.isError ? (
        <div className={noticeErrorClass}>{(bedMutation.error as Error).message}</div>
      ) : null}
      {allocationMutation.isError ? (
        <div className={noticeErrorClass}>{(allocationMutation.error as Error).message}</div>
      ) : null}

      <EducationFormSection title="New hostel">
        <EducationField label="Name" required>
          <EducationInput value={name} onChange={(e) => setName(e.target.value)} />
        </EducationField>
        <EducationField label="Code" required>
          <EducationInput value={code} onChange={(e) => setCode(e.target.value)} />
        </EducationField>
        <EducationField label="Gender policy">
          <EducationInput value={genderPolicy} onChange={(e) => setGenderPolicy(e.target.value)} />
        </EducationField>
        <div className="col-span-full">
          <EducationPrimaryButton
            disabled={
              !branch?.code ||
              !name.trim() ||
              !code.trim() ||
              hostelsQuery.isError ||
              hostelMutation.isPending
            }
            onClick={() => {
              setNotice(null);
              hostelMutation.mutate();
            }}
          >
            Create hostel
          </EducationPrimaryButton>
        </div>
      </EducationFormSection>

      <EducationFormSection title="Add room">
        <EducationField label="Hostel" required>
          <EducationSelect value={hostelId} onChange={(e) => setHostelId(e.target.value)}>
            <option value="">—</option>
            {(hostelsQuery.data ?? []).map((h) => (
              <option key={h.id} value={h.id}>
                {h.name}
              </option>
            ))}
          </EducationSelect>
        </EducationField>
        <EducationField label="Room number" required>
          <EducationInput value={roomNumber} onChange={(e) => setRoomNumber(e.target.value)} />
        </EducationField>
        <EducationField label="Capacity" required>
          <EducationInput type="number" value={capacity} onChange={(e) => setCapacity(e.target.value)} />
        </EducationField>
        <div className="col-span-full">
          <EducationPrimaryButton
            disabled={!hostelId || !roomNumber.trim() || roomMutation.isPending}
            onClick={() => {
              setNotice(null);
              roomMutation.mutate();
            }}
          >
            Add room
          </EducationPrimaryButton>
        </div>
      </EducationFormSection>

      <EducationFormSection title="Add bed">
        <EducationField label="Room" required>
          <EducationSelect value={hostelRoomId} onChange={(e) => setHostelRoomId(e.target.value)}>
            <option value="">—</option>
            {(roomsQuery.data ?? []).map((r) => (
              <option key={r.id} value={r.id}>
                {r.roomNumber} (cap {r.capacity})
              </option>
            ))}
          </EducationSelect>
        </EducationField>
        <EducationField label="Bed code" required>
          <EducationInput value={bedCode} onChange={(e) => setBedCode(e.target.value)} />
        </EducationField>
        <div className="col-span-full">
          <EducationPrimaryButton
            disabled={!hostelRoomId || !bedCode.trim() || bedMutation.isPending}
            onClick={() => {
              setNotice(null);
              bedMutation.mutate();
            }}
          >
            Add bed
          </EducationPrimaryButton>
        </div>
      </EducationFormSection>

      <EducationFormSection title="Allocate student">
        <EducationField label="Bed" required>
          <EducationSelect value={bedId} onChange={(e) => setBedId(e.target.value)}>
            <option value="">—</option>
            {(bedsQuery.data ?? [])
              .filter((b) => b.status === "available")
              .map((b) => (
                <option key={b.id} value={b.id}>
                  {b.bedCode}
                </option>
              ))}
          </EducationSelect>
        </EducationField>
        <EducationField label="Student" required>
          <EducationSelect value={studentId} onChange={(e) => setStudentId(e.target.value)}>
            <option value="">—</option>
            {(studentsQuery.data ?? []).map((s) => (
              <option key={s.id} value={s.id}>
                {s.firstName} {s.lastName ?? ""}
              </option>
            ))}
          </EducationSelect>
        </EducationField>
        <EducationField label="Check-in date" required>
          <EducationInput
            type="date"
            value={checkInDate}
            onChange={(e) => setCheckInDate(e.target.value)}
          />
        </EducationField>
        <div className="col-span-full">
          <EducationPrimaryButton
            disabled={!bedId || !studentId || !checkInDate || allocationMutation.isPending}
            onClick={() => {
              setNotice(null);
              allocationMutation.mutate();
            }}
          >
            Allocate
          </EducationPrimaryButton>
        </div>
      </EducationFormSection>

      <EducationInput
        className="max-w-xs"
        placeholder="Search hostels…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Hostels</h3>
      <EducationDataTable
        columns={["Code", "Name", "Gender policy", "Status"]}
        rows={filtered.map((h) => [h.code, h.name, h.genderPolicy ?? "—", h.status])}
      />
      <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Rooms</h3>
      <EducationDataTable
        columns={["Room", "Capacity", "Status"]}
        rows={(roomsQuery.data ?? []).map((r) => [r.roomNumber, r.capacity, r.status])}
      />
      <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Allocations</h3>
      <EducationDataTable
        columns={["Bed", "Student", "Check-in", "Status"]}
        rows={(allocationsQuery.data ?? []).map((a) => [
          a.bedId.slice(0, 8),
          a.studentId.slice(0, 8),
          a.checkInDate,
          a.status,
        ])}
      />
    </div>
  );
}
