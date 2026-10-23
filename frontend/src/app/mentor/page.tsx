"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { api, ApiError, getMe, logout, type User } from "@/lib/api";

type Status = "PENDING" | "APPROVED" | "REJECTED";
type Filter = "ALL" | Status;

type Row = {
  id: number;
  projectName: string;
  frontendRepoUrl: string | null;
  backendRepoUrl: string | null;
  frontendLiveUrl: string | null;
  backendLiveUrl: string | null;
  description: string;
  status: Status;
  createdAt: string;
  student: { id: number; name: string; email: string } | null;
};

type ListResponse = {
  items: Row[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

type Stats = { pending: number; approved: number; rejected: number; total: number };

const PAGE_SIZE = 10;
const FILTERS: { value: Filter; label: string }[] = [
  { value: "ALL", label: "All" },
  { value: "PENDING", label: "Pending" },
  { value: "APPROVED", label: "Approved" },
  { value: "REJECTED", label: "Rejected" },
];

const STATUS_STYLE: Record<Status, string> = {
  PENDING: "bg-yellow-100 text-yellow-800",
  APPROVED: "bg-green-100 text-green-800",
  REJECTED: "bg-red-100 text-red-800",
};

// "2026-10-21 08:12:55.19+00" -> Date
function formatDate(s: string) {
  const d = new Date(s.replace(" ", "T").replace(/\+00$/, "Z"));
  return isNaN(d.getTime()) ? s : d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function LinkItem({ url, label }: { url: string | null; label: string }) {
  if (!url) return <span className="text-muted-foreground">{label}: N/A</span>;
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className="underline">
      {label}
    </a>
  );
}

function LinksList({ row }: { row: Row }) {
  return (
    <div className="flex flex-col items-start gap-1 text-xs">
      <LinkItem url={row.frontendRepoUrl} label="Frontend repo" />
      <LinkItem url={row.backendRepoUrl} label="Backend repo" />
      <LinkItem url={row.frontendLiveUrl} label="Frontend live" />
      <LinkItem url={row.backendLiveUrl} label="Backend live" />
    </div>
  );
}

function ActionButtons({
  row,
  busy,
  onSet,
  className = "",
}: {
  row: Row;
  busy: boolean;
  onSet: (id: number, status: "APPROVED" | "REJECTED") => void;
  className?: string;
}) {
  return (
    <div className={className}>
      <Button size="sm" disabled={busy || row.status === "APPROVED"} onClick={() => onSet(row.id, "APPROVED")}>
        Approve
      </Button>
      <Button
        size="sm"
        variant="destructive"
        disabled={busy || row.status === "REJECTED"}
        onClick={() => onSet(row.id, "REJECTED")}
      >
        Reject
      </Button>
    </div>
  );
}

export default function MentorPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [filter, setFilter] = useState<Filter>("ALL");
  const [page, setPage] = useState(1);
  const [reloadKey, setReloadKey] = useState(0);
  const [data, setData] = useState<ListResponse | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  // frontend guard (UX). asol guard backend er requireRole("MENTOR")
  useEffect(() => {
    getMe().then((u) => {
      if (!u) router.replace("/login");
      else if (u.role !== "MENTOR") router.replace("/student");
      else setUser(u);
    });
  }, [router]);

  // data fetch: filter, page ba reloadKey bodlale abar
  useEffect(() => {
    if (!user) return;
    let cancelled = false; // dhire asha purono response jate notun data overwrite na kore

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const qs = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
        if (filter !== "ALL") qs.set("status", filter);

        const [list, st] = await Promise.all([
          api<ListResponse>(`/mentor/submissions?${qs}`),
          api<Stats>("/mentor/stats"),
        ]);
        if (cancelled) return;

        // last page er shesh item sore gele ager page e jao
        if (list.items.length === 0 && page > 1) {
          setPage(page - 1);
          return;
        }
        setData(list);
        setStats(st);
      } catch (err) {
        if (cancelled) return;
        if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
          router.replace("/login");
          return;
        }
        setError(err instanceof ApiError ? err.message : "Cannot reach the server");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [user, filter, page, reloadKey, router]);

  async function setStatus(id: number, status: "APPROVED" | "REJECTED") {
    setBusyId(id);
    try {
      await api(`/mentor/submissions/${id}/status`, { method: "PATCH", body: { status } });
      toast.success(status === "APPROVED" ? "Approved" : "Rejected");
      setReloadKey((k) => k + 1);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not update");
    } finally {
      setBusyId(null);
    }
  }

  async function onLogout() {
    await logout().catch(() => { });
    router.replace("/login");
  }

  function changeFilter(f: Filter) {
    setFilter(f);
    setPage(1);
  }

  if (!user) {
    return (
      <main className="mx-auto w-full max-w-6xl p-4">
        <Skeleton className="h-10 w-48" />
      </main>
    );
  }

  const cards: { label: string; value: number | undefined }[] = [
    { label: "Total", value: stats?.total },
    { label: "Pending", value: stats?.pending },
    { label: "Approved", value: stats?.approved },
    { label: "Rejected", value: stats?.rejected },
  ];

  return (
    <main className="mx-auto w-full max-w-6xl space-y-6 p-4">
      <header className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Review dashboard</h1>
          <p className="text-sm text-muted-foreground">Signed in as {user.name}</p>
        </div>
        <Button variant="outline" onClick={onLogout}>Log out</Button>
      </header>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {cards.map((c) => (
          <Card key={c.label}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{c.label}</CardTitle>
            </CardHeader>
            <CardContent>
              {c.value === undefined ? (
                <Skeleton className="h-8 w-12" />
              ) : (
                <p className="text-3xl font-semibold">{c.value}</p>
              )}
            </CardContent>
          </Card>
        ))}
      </section>

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <Button
            key={f.value}
            size="sm"
            variant={filter === f.value ? "default" : "outline"}
            onClick={() => changeFilter(f.value)}
          >
            {f.label}
          </Button>
        ))}
      </div>

      {error ? (
        <Card>
          <CardContent className="flex items-center justify-between gap-3 p-4">
            <p className="text-sm text-red-600">{error}</p>
            <Button size="sm" onClick={() => setReloadKey((k) => k + 1)}>Retry</Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* mobile: card list */}
          <div className="space-y-3 md:hidden">
            {loading && !data ? (
              Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-44 w-full" />)
            ) : data && data.items.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">No submissions found.</p>
            ) : (
              data?.items.map((r) => (
                <Card key={r.id} className={loading ? "opacity-50" : ""}>
                  <CardHeader className="flex flex-row items-start justify-between gap-2 pb-2">
                    <div className="min-w-0">
                      <CardTitle className="text-base">{r.projectName}</CardTitle>
                      <p className="truncate text-xs text-muted-foreground">
                        {r.student?.name ?? "Unknown"} · {r.student?.email}
                      </p>
                    </div>
                    <Badge className={STATUS_STYLE[r.status]}>{r.status}</Badge>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-sm">{r.description}</p>
                    <LinksList row={r} />
                    <p className="text-xs text-muted-foreground">Submitted {formatDate(r.createdAt)}</p>
                    <ActionButtons
                      row={r}
                      busy={busyId === r.id}
                      onSet={setStatus}
                      className="grid grid-cols-2 gap-2"
                    />
                  </CardContent>
                </Card>
              ))
            )}
          </div>

          {/* desktop: table */}
          <Card className="hidden md:block">
            <CardContent className="p-0">
              <Table className="min-w-[860px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Student</TableHead>
                    <TableHead>Project</TableHead>
                    <TableHead>Links</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Submitted</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading && !data ? (
                    Array.from({ length: 4 }).map((_, i) => (
                      <TableRow key={i}>
                        <TableCell colSpan={6}><Skeleton className="h-8 w-full" /></TableCell>
                      </TableRow>
                    ))
                  ) : data && data.items.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                        No submissions found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    data?.items.map((r) => (
                      <TableRow key={r.id} className={loading ? "opacity-50" : ""}>
                        <TableCell>
                          <p className="font-medium">{r.student?.name ?? "Unknown"}</p>
                          <p className="text-xs text-muted-foreground">{r.student?.email}</p>
                        </TableCell>
                        <TableCell className="max-w-xs">
                          <p className="font-medium">{r.projectName}</p>
                          <p className="line-clamp-2 text-xs text-muted-foreground">{r.description}</p>
                        </TableCell>
                        <TableCell><LinksList row={r} /></TableCell>
                        <TableCell>
                          <Badge className={STATUS_STYLE[r.status]}>{r.status}</Badge>
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-sm">{formatDate(r.createdAt)}</TableCell>
                        <TableCell>
                          <ActionButtons
                            row={r}
                            busy={busyId === r.id}
                            onSet={setStatus}
                            className="flex justify-end gap-2"
                          />
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}

      {data && data.total > 0 && (
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            Page {data.page} of {data.totalPages} ({data.total} total)
          </p>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" disabled={page <= 1 || loading} onClick={() => setPage(page - 1)}>
              Previous
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={page >= data.totalPages || loading}
              onClick={() => setPage(page + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </main>
  );
}