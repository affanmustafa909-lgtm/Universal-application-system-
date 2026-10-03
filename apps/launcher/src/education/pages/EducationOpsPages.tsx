import { useMutation, useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { PageHeader } from "../../pops/ui/PageHeader";
import { noticeErrorClass, noticeSuccessClass } from "../../pops/lib/themeClasses";
import {
  createEducationBook,
  createEducationBookIssue,
  createEducationRoute,
  createEducationRouteStop,
  createEducationTransportAssignment,
  createEducationVehicle,
  fetchEducationBookIssues,
  fetchEducationBooks,
  fetchEducationRoutes,
  fetchEducationRouteStops,
  fetchEducationStudents,
  fetchEducationTransportAssignments,
  fetchEducationVehicles,
  updateEducationBookIssue,
} from "../api/education";
import { formatPkr, useEducationAccess, useInvalidateEducation } from "../hooks/useEducation";
import {
  EducationDataTable,
  EducationField,
  EducationFormSection,
  EducationInput,
  EducationPrimaryButton,
  EducationSecondaryButton,
  EducationSelect,
} from "../ui/EducationUi";

export function EducationLibraryPage(): JSX.Element {
  const { branch } = useEducationAccess();
  const invalidate = useInvalidateEducation();
  const [notice, setNotice] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [isbn, setIsbn] = useState("");
  const [copiesTotal, setCopiesTotal] = useState("1");
  const [bookId, setBookId] = useState("");
  const [borrowerType, setBorrowerType] = useState<"student" | "staff" | "teacher">("student");
  const [borrowerId, setBorrowerId] = useState("");
  const [dueAt, setDueAt] = useState("");

  const booksQuery = useQuery({
    queryKey: ["education", "books", branch?.code],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchEducationBooks(branch!.code),
  });
  const issuesQuery = useQuery({
    queryKey: ["education", "book-issues", branch?.code],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchEducationBookIssues(branch!.code),
  });
  const studentsQuery = useQuery({
    queryKey: ["education", "students", branch?.code],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchEducationStudents(branch!.code),
  });

  const createBookMutation = useMutation({
    mutationFn: () =>
      createEducationBook({
        branchCode: branch!.code,
        title: title.trim(),
        author: author.trim() || undefined,
        isbn: isbn.trim() || undefined,
        copiesTotal: Number(copiesTotal) || 1,
        copiesAvailable: Number(copiesTotal) || 1,
        status: "available",
      }),
    onSuccess: () => {
      invalidate();
      setTitle("");
      setAuthor("");
      setIsbn("");
      setNotice("Book added");
    },
  });

  const issueMutation = useMutation({
    mutationFn: () =>
      createEducationBookIssue({
        branchCode: branch!.code,
        bookId,
        borrowerType,
        borrowerId,
        issuedAt: new Date().toISOString(),
        dueAt: dueAt || undefined,
        status: "issued",
      }),
    onSuccess: () => {
      invalidate();
      setBorrowerId("");
      setNotice("Book issued");
    },
  });

  const returnMutation = useMutation({
    mutationFn: (id: string) =>
      updateEducationBookIssue(id, {
        status: "returned",
        returnedAt: new Date().toISOString(),
      }),
    onSuccess: () => {
      invalidate(["book-issues", "books"]);
      setNotice("Book returned");
    },
  });

  const filtered = useMemo(() => {
    const list = booksQuery.data ?? [];
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (b) =>
        b.title.toLowerCase().includes(q) ||
        (b.author ?? "").toLowerCase().includes(q) ||
        (b.isbn ?? "").toLowerCase().includes(q),
    );
  }, [booksQuery.data, search]);

  return (
    <div className="space-y-5">
      <PageHeader title="Library" subtitle="Books catalog with issue and return." />
      {notice ? <div className={noticeSuccessClass}>{notice}</div> : null}
      {booksQuery.isError ? (
        <div className={noticeErrorClass}>{(booksQuery.error as Error).message}</div>
      ) : null}
      {createBookMutation.isError ? (
        <div className={noticeErrorClass}>{(createBookMutation.error as Error).message}</div>
      ) : null}
      {issueMutation.isError ? (
        <div className={noticeErrorClass}>{(issueMutation.error as Error).message}</div>
      ) : null}

      <EducationFormSection title="Add book">
        <EducationField label="Title" required>
          <EducationInput value={title} onChange={(e) => setTitle(e.target.value)} />
        </EducationField>
        <EducationField label="Author">
          <EducationInput value={author} onChange={(e) => setAuthor(e.target.value)} />
        </EducationField>
        <EducationField label="ISBN">
          <EducationInput value={isbn} onChange={(e) => setIsbn(e.target.value)} />
        </EducationField>
        <EducationField label="Copies">
          <EducationInput type="number" value={copiesTotal} onChange={(e) => setCopiesTotal(e.target.value)} />
        </EducationField>
        <div className="col-span-full">
          <EducationPrimaryButton
            disabled={
              !branch?.code || !title.trim() || booksQuery.isError || createBookMutation.isPending
            }
            title={booksQuery.isError ? "Books API unavailable" : undefined}
            onClick={() => {
              setNotice(null);
              createBookMutation.mutate();
            }}
          >
            Add book
          </EducationPrimaryButton>
        </div>
      </EducationFormSection>

      <EducationFormSection title="Issue book">
        <EducationField label="Book" required>
          <EducationSelect value={bookId} onChange={(e) => setBookId(e.target.value)}>
            <option value="">—</option>
            {(booksQuery.data ?? []).map((b) => (
              <option key={b.id} value={b.id}>
                {b.title} ({b.copiesAvailable} avail)
              </option>
            ))}
          </EducationSelect>
        </EducationField>
        <EducationField label="Borrower type">
          <EducationSelect
            value={borrowerType}
            onChange={(e) => setBorrowerType(e.target.value as typeof borrowerType)}
          >
            <option value="student">Student</option>
            <option value="staff">Staff</option>
            <option value="teacher">Teacher</option>
          </EducationSelect>
        </EducationField>
        <EducationField label="Borrower" required>
          {borrowerType === "student" ? (
            <EducationSelect value={borrowerId} onChange={(e) => setBorrowerId(e.target.value)}>
              <option value="">—</option>
              {(studentsQuery.data ?? []).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.firstName} {s.lastName ?? ""}
                </option>
              ))}
            </EducationSelect>
          ) : (
            <EducationInput
              value={borrowerId}
              onChange={(e) => setBorrowerId(e.target.value)}
              placeholder="Person UUID"
            />
          )}
        </EducationField>
        <EducationField label="Due date">
          <EducationInput type="date" value={dueAt} onChange={(e) => setDueAt(e.target.value)} />
        </EducationField>
        <div className="col-span-full">
          <EducationPrimaryButton
            disabled={!bookId || !borrowerId || issueMutation.isPending}
            onClick={() => {
              setNotice(null);
              issueMutation.mutate();
            }}
          >
            Issue
          </EducationPrimaryButton>
        </div>
      </EducationFormSection>

      <EducationInput
        className="max-w-xs"
        placeholder="Search books…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      <EducationDataTable
        columns={["Title", "Author", "ISBN", "Available", "Total", "Status"]}
        rows={filtered.map((b) => [
          b.title,
          b.author ?? "—",
          b.isbn ?? "—",
          b.copiesAvailable,
          b.copiesTotal,
          b.status,
        ])}
      />

      <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Issues</h3>
      <EducationDataTable
        columns={["Book", "Borrower", "Issued", "Due", "Status", "Actions"]}
        rows={(issuesQuery.data ?? []).map((i) => [
          i.bookId.slice(0, 8),
          `${i.borrowerType}:${i.borrowerId.slice(0, 8)}`,
          i.issuedAt.slice(0, 10),
          i.dueAt?.slice(0, 10) ?? "—",
          i.status,
          i.status === "issued" ? (
            <EducationSecondaryButton
              key={i.id}
              disabled={returnMutation.isPending}
              onClick={() => returnMutation.mutate(i.id)}
            >
              Return
            </EducationSecondaryButton>
          ) : (
            "—"
          ),
        ])}
      />
    </div>
  );
}

export function EducationTransportPage(): JSX.Element {
  const { branch } = useEducationAccess();
  const invalidate = useInvalidateEducation();
  const [notice, setNotice] = useState<string | null>(null);

  const [vCode, setVCode] = useState("");
  const [registration, setRegistration] = useState("");
  const [driverName, setDriverName] = useState("");
  const [capacity, setCapacity] = useState("");

  const [routeName, setRouteName] = useState("");
  const [routeCode, setRouteCode] = useState("");
  const [vehicleId, setVehicleId] = useState("");
  const [feePkr, setFeePkr] = useState("");

  const [stopRouteId, setStopRouteId] = useState("");
  const [stopName, setStopName] = useState("");

  const [assignRouteId, setAssignRouteId] = useState("");
  const [assignStudentId, setAssignStudentId] = useState("");
  const [assignStopId, setAssignStopId] = useState("");

  const vehiclesQuery = useQuery({
    queryKey: ["education", "vehicles", branch?.code],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchEducationVehicles(branch!.code),
  });
  const routesQuery = useQuery({
    queryKey: ["education", "routes", branch?.code],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchEducationRoutes(branch!.code),
  });
  const stopsQuery = useQuery({
    queryKey: ["education", "route-stops", branch?.code, stopRouteId || assignRouteId],
    enabled: Boolean(branch?.code) && Boolean(stopRouteId || assignRouteId),
    queryFn: () => fetchEducationRouteStops(branch!.code, stopRouteId || assignRouteId),
  });
  const assignmentsQuery = useQuery({
    queryKey: ["education", "transport-assignments", branch?.code],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchEducationTransportAssignments(branch!.code),
  });
  const studentsQuery = useQuery({
    queryKey: ["education", "students", branch?.code],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchEducationStudents(branch!.code),
  });

  const vehicleMutation = useMutation({
    mutationFn: () =>
      createEducationVehicle({
        branchCode: branch!.code,
        code: vCode.trim(),
        registration: registration.trim(),
        driverName: driverName.trim() || undefined,
        capacity: capacity ? Number(capacity) : undefined,
        status: "active",
      }),
    onSuccess: () => {
      invalidate();
      setVCode("");
      setRegistration("");
      setDriverName("");
      setNotice("Vehicle added");
    },
  });

  const routeMutation = useMutation({
    mutationFn: () =>
      createEducationRoute({
        branchCode: branch!.code,
        name: routeName.trim(),
        code: routeCode.trim(),
        vehicleId: vehicleId || undefined,
        feePkr: feePkr ? Number(feePkr) : undefined,
        status: "active",
      }),
    onSuccess: () => {
      invalidate();
      setRouteName("");
      setRouteCode("");
      setFeePkr("");
      setNotice("Route created");
    },
  });

  const stopMutation = useMutation({
    mutationFn: () =>
      createEducationRouteStop({
        routeId: stopRouteId,
        name: stopName.trim(),
      }),
    onSuccess: () => {
      invalidate(["route-stops"]);
      setStopName("");
      setNotice("Stop added");
    },
  });

  const assignMutation = useMutation({
    mutationFn: () =>
      createEducationTransportAssignment({
        branchCode: branch!.code,
        routeId: assignRouteId,
        studentId: assignStudentId,
        stopId: assignStopId || undefined,
        status: "active",
      }),
    onSuccess: () => {
      invalidate();
      setAssignStudentId("");
      setNotice("Student assigned to route");
    },
  });

  return (
    <div className="space-y-5">
      <PageHeader
        title="Transport"
        subtitle="Vehicles, routes, stops, and student transport assignments."
      />
      {notice ? <div className={noticeSuccessClass}>{notice}</div> : null}
      {vehiclesQuery.isError ? (
        <div className={noticeErrorClass}>{(vehiclesQuery.error as Error).message}</div>
      ) : null}
      {vehicleMutation.isError ? (
        <div className={noticeErrorClass}>{(vehicleMutation.error as Error).message}</div>
      ) : null}
      {routeMutation.isError ? (
        <div className={noticeErrorClass}>{(routeMutation.error as Error).message}</div>
      ) : null}
      {assignMutation.isError ? (
        <div className={noticeErrorClass}>{(assignMutation.error as Error).message}</div>
      ) : null}

      <EducationFormSection title="Add vehicle">
        <EducationField label="Code" required>
          <EducationInput value={vCode} onChange={(e) => setVCode(e.target.value)} />
        </EducationField>
        <EducationField label="Registration" required>
          <EducationInput value={registration} onChange={(e) => setRegistration(e.target.value)} />
        </EducationField>
        <EducationField label="Driver">
          <EducationInput value={driverName} onChange={(e) => setDriverName(e.target.value)} />
        </EducationField>
        <EducationField label="Capacity">
          <EducationInput type="number" value={capacity} onChange={(e) => setCapacity(e.target.value)} />
        </EducationField>
        <div className="col-span-full">
          <EducationPrimaryButton
            disabled={
              !branch?.code ||
              !vCode.trim() ||
              !registration.trim() ||
              vehiclesQuery.isError ||
              vehicleMutation.isPending
            }
            title={vehiclesQuery.isError ? "Vehicles API unavailable" : undefined}
            onClick={() => {
              setNotice(null);
              vehicleMutation.mutate();
            }}
          >
            Add vehicle
          </EducationPrimaryButton>
        </div>
      </EducationFormSection>

      <EducationFormSection title="Add route">
        <EducationField label="Name" required>
          <EducationInput value={routeName} onChange={(e) => setRouteName(e.target.value)} />
        </EducationField>
        <EducationField label="Code" required>
          <EducationInput value={routeCode} onChange={(e) => setRouteCode(e.target.value)} />
        </EducationField>
        <EducationField label="Vehicle">
          <EducationSelect value={vehicleId} onChange={(e) => setVehicleId(e.target.value)}>
            <option value="">—</option>
            {(vehiclesQuery.data ?? []).map((v) => (
              <option key={v.id} value={v.id}>
                {v.code} — {v.registration}
              </option>
            ))}
          </EducationSelect>
        </EducationField>
        <EducationField label="Fee (PKR)">
          <EducationInput type="number" value={feePkr} onChange={(e) => setFeePkr(e.target.value)} />
        </EducationField>
        <div className="col-span-full">
          <EducationPrimaryButton
            disabled={!routeName.trim() || !routeCode.trim() || routeMutation.isPending}
            onClick={() => {
              setNotice(null);
              routeMutation.mutate();
            }}
          >
            Create route
          </EducationPrimaryButton>
        </div>
      </EducationFormSection>

      <EducationFormSection title="Add route stop">
        <EducationField label="Route" required>
          <EducationSelect value={stopRouteId} onChange={(e) => setStopRouteId(e.target.value)}>
            <option value="">—</option>
            {(routesQuery.data ?? []).map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </EducationSelect>
        </EducationField>
        <EducationField label="Stop name" required>
          <EducationInput value={stopName} onChange={(e) => setStopName(e.target.value)} />
        </EducationField>
        <div className="col-span-full">
          <EducationPrimaryButton
            disabled={!stopRouteId || !stopName.trim() || stopMutation.isPending}
            onClick={() => {
              setNotice(null);
              stopMutation.mutate();
            }}
          >
            Add stop
          </EducationPrimaryButton>
        </div>
      </EducationFormSection>

      <EducationFormSection title="Assign student">
        <EducationField label="Route" required>
          <EducationSelect value={assignRouteId} onChange={(e) => setAssignRouteId(e.target.value)}>
            <option value="">—</option>
            {(routesQuery.data ?? []).map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </EducationSelect>
        </EducationField>
        <EducationField label="Stop">
          <EducationSelect value={assignStopId} onChange={(e) => setAssignStopId(e.target.value)}>
            <option value="">—</option>
            {(stopsQuery.data ?? []).map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </EducationSelect>
        </EducationField>
        <EducationField label="Student" required>
          <EducationSelect
            value={assignStudentId}
            onChange={(e) => setAssignStudentId(e.target.value)}
          >
            <option value="">—</option>
            {(studentsQuery.data ?? []).map((s) => (
              <option key={s.id} value={s.id}>
                {s.firstName} {s.lastName ?? ""}
              </option>
            ))}
          </EducationSelect>
        </EducationField>
        <div className="col-span-full">
          <EducationPrimaryButton
            disabled={!assignRouteId || !assignStudentId || assignMutation.isPending}
            onClick={() => {
              setNotice(null);
              assignMutation.mutate();
            }}
          >
            Assign
          </EducationPrimaryButton>
        </div>
      </EducationFormSection>

      <EducationDataTable
        columns={["Code", "Registration", "Driver", "Capacity", "Status"]}
        rows={(vehiclesQuery.data ?? []).map((v) => [
          v.code,
          v.registration,
          v.driverName ?? "—",
          v.capacity ?? "—",
          v.status,
        ])}
      />
      <EducationDataTable
        columns={["Code", "Route", "Fee", "Vehicle", "Status"]}
        rows={(routesQuery.data ?? []).map((r) => [
          r.code,
          r.name,
          formatPkr(r.feePkr),
          r.vehicleId?.slice(0, 8) ?? "—",
          r.status,
        ])}
      />
      <EducationDataTable
        columns={["Route", "Student", "Stop", "Status"]}
        rows={(assignmentsQuery.data ?? []).map((a) => [
          a.routeId.slice(0, 8),
          a.studentId.slice(0, 8),
          a.stopId?.slice(0, 8) ?? "—",
          a.status,
        ])}
      />
    </div>
  );
}
