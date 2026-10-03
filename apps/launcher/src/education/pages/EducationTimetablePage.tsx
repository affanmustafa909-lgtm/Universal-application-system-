import { useMutation, useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { PageHeader } from "../../pops/ui/PageHeader";
import { noticeErrorClass, noticeSuccessClass } from "../../pops/lib/themeClasses";
import {
  createEducationPeriod,
  createEducationRoom,
  createEducationTimetableSlot,
  fetchEducationClasses,
  fetchEducationPeriods,
  fetchEducationRooms,
  fetchEducationSections,
  fetchEducationSubjects,
  fetchEducationTeachers,
  fetchEducationTimetable,
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

const DAYS = [
  { value: "0", label: "Sunday" },
  { value: "1", label: "Monday" },
  { value: "2", label: "Tuesday" },
  { value: "3", label: "Wednesday" },
  { value: "4", label: "Thursday" },
  { value: "5", label: "Friday" },
  { value: "6", label: "Saturday" },
];

export function EducationTimetablePage(): JSX.Element {
  const { branch } = useEducationAccess();
  const invalidate = useInvalidateEducation();
  const [notice, setNotice] = useState<string | null>(null);
  const [conflictError, setConflictError] = useState<string | null>(null);

  const [periodName, setPeriodName] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [roomName, setRoomName] = useState("");
  const [roomCapacity, setRoomCapacity] = useState("");

  const [dayOfWeek, setDayOfWeek] = useState("1");
  const [periodId, setPeriodId] = useState("");
  const [roomId, setRoomId] = useState("");
  const [classId, setClassId] = useState("");
  const [sectionId, setSectionId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [teacherId, setTeacherId] = useState("");

  const periodsQuery = useQuery({
    queryKey: ["education", "periods", branch?.code],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchEducationPeriods(branch!.code),
  });
  const roomsQuery = useQuery({
    queryKey: ["education", "rooms", branch?.code],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchEducationRooms(branch!.code),
  });
  const slotsQuery = useQuery({
    queryKey: ["education", "timetable", branch?.code],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchEducationTimetable(branch!.code),
  });
  const classesQuery = useQuery({
    queryKey: ["education", "classes", branch?.code],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchEducationClasses(branch!.code),
  });
  const sectionsQuery = useQuery({
    queryKey: ["education", "sections", branch?.code, classId],
    enabled: Boolean(branch?.code) && Boolean(classId),
    queryFn: () => fetchEducationSections(branch!.code, classId),
  });
  const subjectsQuery = useQuery({
    queryKey: ["education", "subjects", branch?.code],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchEducationSubjects(branch!.code),
  });
  const teachersQuery = useQuery({
    queryKey: ["education", "teachers", branch?.code],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchEducationTeachers(branch!.code),
  });

  const periodMutation = useMutation({
    mutationFn: () =>
      createEducationPeriod({
        branchCode: branch!.code,
        name: periodName.trim(),
        startTime,
        endTime,
        status: "active",
      }),
    onSuccess: () => {
      invalidate();
      setPeriodName("");
      setStartTime("");
      setEndTime("");
      setNotice("Period created");
    },
  });

  const roomMutation = useMutation({
    mutationFn: () =>
      createEducationRoom({
        branchCode: branch!.code,
        code: roomCode.trim(),
        name: roomName.trim(),
        capacity: roomCapacity ? Number(roomCapacity) : undefined,
        status: "active",
      }),
    onSuccess: () => {
      invalidate();
      setRoomCode("");
      setRoomName("");
      setRoomCapacity("");
      setNotice("Room created");
    },
  });

  const slotMutation = useMutation({
    mutationFn: () =>
      createEducationTimetableSlot({
        branchCode: branch!.code,
        dayOfWeek: Number(dayOfWeek),
        periodId,
        roomId: roomId || undefined,
        classId: classId || undefined,
        sectionId: sectionId || undefined,
        subjectId: subjectId || undefined,
        teacherId: teacherId || undefined,
        status: "active",
      }),
    onSuccess: () => {
      invalidate();
      setConflictError(null);
      setNotice("Timetable slot added");
    },
    onError: (err: Error) => {
      const msg = err.message || "Failed to create slot";
      if (/conflict|overlap|clash|already/i.test(msg)) {
        setConflictError(msg);
      }
    },
  });

  const periodById = useMemo(
    () => new Map((periodsQuery.data ?? []).map((p) => [p.id, p])),
    [periodsQuery.data],
  );
  const roomById = useMemo(
    () => new Map((roomsQuery.data ?? []).map((r) => [r.id, r])),
    [roomsQuery.data],
  );

  const apiDown = slotsQuery.isError || periodsQuery.isError || roomsQuery.isError;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Timetable"
        subtitle="Weekly class schedules, periods, rooms, and slot allocation."
      />
      {notice ? <div className={noticeSuccessClass}>{notice}</div> : null}
      {conflictError ? (
        <div className={noticeErrorClass}>
          Schedule conflict: {conflictError}
        </div>
      ) : null}
      {slotMutation.isError && !conflictError ? (
        <div className={noticeErrorClass}>{(slotMutation.error as Error).message}</div>
      ) : null}
      {apiDown ? (
        <div className={noticeErrorClass}>
          {(slotsQuery.error as Error | null)?.message ||
            (periodsQuery.error as Error | null)?.message ||
            (roomsQuery.error as Error | null)?.message ||
            "Timetable API unavailable"}
        </div>
      ) : null}

      <EducationFormSection title="Add period">
        <EducationField label="Name" required>
          <EducationInput value={periodName} onChange={(e) => setPeriodName(e.target.value)} />
        </EducationField>
        <EducationField label="Start time" required>
          <EducationInput type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
        </EducationField>
        <EducationField label="End time" required>
          <EducationInput type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
        </EducationField>
        <div className="col-span-full">
          <EducationPrimaryButton
            disabled={
              !branch?.code ||
              !periodName.trim() ||
              !startTime ||
              !endTime ||
              periodsQuery.isError ||
              periodMutation.isPending
            }
            title={periodsQuery.isError ? "Periods API unavailable" : undefined}
            onClick={() => {
              setNotice(null);
              periodMutation.mutate();
            }}
          >
            Add period
          </EducationPrimaryButton>
        </div>
      </EducationFormSection>

      <EducationFormSection title="Add room">
        <EducationField label="Code" required>
          <EducationInput value={roomCode} onChange={(e) => setRoomCode(e.target.value)} />
        </EducationField>
        <EducationField label="Name" required>
          <EducationInput value={roomName} onChange={(e) => setRoomName(e.target.value)} />
        </EducationField>
        <EducationField label="Capacity">
          <EducationInput
            type="number"
            value={roomCapacity}
            onChange={(e) => setRoomCapacity(e.target.value)}
          />
        </EducationField>
        <div className="col-span-full">
          <EducationPrimaryButton
            disabled={
              !branch?.code ||
              !roomCode.trim() ||
              !roomName.trim() ||
              roomsQuery.isError ||
              roomMutation.isPending
            }
            title={roomsQuery.isError ? "Rooms API unavailable" : undefined}
            onClick={() => {
              setNotice(null);
              roomMutation.mutate();
            }}
          >
            Add room
          </EducationPrimaryButton>
        </div>
      </EducationFormSection>

      <EducationFormSection title="Add timetable slot">
        <EducationField label="Day" required>
          <EducationSelect value={dayOfWeek} onChange={(e) => setDayOfWeek(e.target.value)}>
            {DAYS.map((d) => (
              <option key={d.value} value={d.value}>
                {d.label}
              </option>
            ))}
          </EducationSelect>
        </EducationField>
        <EducationField label="Period" required>
          <EducationSelect value={periodId} onChange={(e) => setPeriodId(e.target.value)}>
            <option value="">—</option>
            {(periodsQuery.data ?? []).map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.startTime}–{p.endTime})
              </option>
            ))}
          </EducationSelect>
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
        <EducationField label="Class">
          <EducationSelect value={classId} onChange={(e) => setClassId(e.target.value)}>
            <option value="">—</option>
            {(classesQuery.data ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </EducationSelect>
        </EducationField>
        <EducationField label="Section">
          <EducationSelect value={sectionId} onChange={(e) => setSectionId(e.target.value)}>
            <option value="">—</option>
            {(sectionsQuery.data ?? []).map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </EducationSelect>
        </EducationField>
        <EducationField label="Subject">
          <EducationSelect value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
            <option value="">—</option>
            {(subjectsQuery.data ?? []).map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </EducationSelect>
        </EducationField>
        <EducationField label="Teacher">
          <EducationSelect value={teacherId} onChange={(e) => setTeacherId(e.target.value)}>
            <option value="">—</option>
            {(teachersQuery.data ?? []).map((t) => (
              <option key={t.id} value={t.id}>
                {t.firstName} {t.lastName ?? ""}
              </option>
            ))}
          </EducationSelect>
        </EducationField>
        <div className="col-span-full">
          <EducationPrimaryButton
            disabled={!branch?.code || !periodId || slotsQuery.isError || slotMutation.isPending}
            title={slotsQuery.isError ? "Timetable API unavailable" : undefined}
            onClick={() => {
              setNotice(null);
              setConflictError(null);
              slotMutation.mutate();
            }}
          >
            Add slot
          </EducationPrimaryButton>
        </div>
      </EducationFormSection>

      <EducationDataTable
        columns={["Day", "Period", "Room", "Class", "Subject", "Teacher", "Status"]}
        rows={(slotsQuery.data ?? []).map((s) => [
          DAYS.find((d) => d.value === String(s.dayOfWeek))?.label ?? s.dayOfWeek,
          periodById.get(s.periodId)?.name ?? s.periodId.slice(0, 8),
          s.roomId ? roomById.get(s.roomId)?.code ?? s.roomId.slice(0, 8) : "—",
          s.classId?.slice(0, 8) ?? "—",
          s.subjectId?.slice(0, 8) ?? "—",
          s.teacherId?.slice(0, 8) ?? "—",
          s.status,
        ])}
      />
    </div>
  );
}
