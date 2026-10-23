"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { api, ApiError, getMe, logout, type User } from "@/lib/api";

type Submission = {
  id: number;
  projectName: string;
  frontendRepoUrl: string | null;
  backendRepoUrl: string | null;
  frontendLiveUrl: string | null;
  backendLiveUrl: string | null;
  description: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  createdAt: string;
};

type FormState = {
  projectName: string;
  frontendRepoUrl: string;
  backendRepoUrl: string;
  frontendLiveUrl: string;
  backendLiveUrl: string;
  description: string;
};

const EMPTY: FormState = {
  projectName: "",
  frontendRepoUrl: "",
  backendRepoUrl: "",
  frontendLiveUrl: "",
  backendLiveUrl: "",
  description: "",
};

const FIELDS: { name: keyof FormState; label: string; placeholder: string }[] = [
  { name: "projectName", label: "Project name", placeholder: "My Portfolio" },
  { name: "frontendRepoUrl", label: "Frontend repo URL", placeholder: "https://github.com/user/repo or N/A" },
  { name: "backendRepoUrl", label: "Backend repo URL", placeholder: "https://github.com/user/repo or N/A" },
  { name: "frontendLiveUrl", label: "Frontend live link", placeholder: "https://app.vercel.app or N/A" },
  { name: "backendLiveUrl", label: "Backend live link", placeholder: "https://api.onrender.com or N/A" },
];

const STATUS_STYLE: Record<Submission["status"], string> = {
  PENDING: "bg-yellow-100 text-yellow-800",
  APPROVED: "bg-green-100 text-green-800",
  REJECTED: "bg-red-100 text-red-800",
};

function LinkOrNA({ url, label }: { url: string | null; label: string }) {
  return (
    <p className="text-sm">
      <span className="text-muted-foreground">{label}: </span>
      {url ? (
        <a href={url} target="_blank" rel="noopener noreferrer" className="underline break-all">
          {url}
        </a>
      ) : (
        <span className="text-muted-foreground">N/A</span>
      )}
    </p>
  );
}

export default function StudentPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [items, setItems] = useState<Submission[]>([]);
  const [loadingList, setLoadingList] = useState(true);

  const loadList = useCallback(async () => {
    try {
      const data = await api<{ items: Submission[] }>("/submissions/mine");
      setItems(data.items);
    } catch {
      toast.error("Could not load your submissions");
    } finally {
      setLoadingList(false);
    }
  }, []);

  // frontend guard (UX). asol guard backend er requireRole
  useEffect(() => {
    getMe().then((u) => {
      if (!u) router.replace("/login");
      else if (u.role !== "STUDENT") router.replace("/mentor");
      else {
        setUser(u);
        loadList();
      }
    });
  }, [router, loadList]);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setErrors({});
    try {
      await api("/submissions", { method: "POST", body: form });
      toast.success("Project submitted");
      setForm(EMPTY);
      loadList();
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.errors?.length) {
          setErrors(Object.fromEntries(err.errors.map((x) => [x.field, x.message])));
        } else {
          toast.error(err.message); // 409 duplicate, 429 rate limit
        }
      } else {
        toast.error("Cannot reach the server");
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function onLogout() {
    await logout().catch(() => {});
    router.replace("/login");
  }

  if (!user) {
    return (
      <main className="mx-auto w-full max-w-5xl p-4">
        <Skeleton className="h-10 w-48" />
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-5xl space-y-6 p-4">
      <header className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Hi, {user.name}</h1>
          <p className="text-sm text-muted-foreground">Submit your projects for mentor review.</p>
        </div>
        <Button variant="outline" onClick={onLogout}>Log out</Button>
      </header>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Submit a project</CardTitle>
            <CardDescription>
              Provide at least one repository and one live link. Write N/A (or leave empty) if you don&apos;t have a frontend or backend.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={onSubmit} className="space-y-4">
              {FIELDS.map((f) => (
                <div key={f.name} className="space-y-2">
                  <Label htmlFor={f.name}>{f.label}</Label>
                  <Input
                    id={f.name}
                    placeholder={f.placeholder}
                    value={form[f.name]}
                    onChange={(e) => setForm({ ...form, [f.name]: e.target.value })}
                  />
                  {errors[f.name] && <p className="text-sm text-red-600">{errors[f.name]}</p>}
                </div>
              ))}
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  rows={4}
                  placeholder="What does it do? Which technologies did you use?"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                />
                {errors.description && <p className="text-sm text-red-600">{errors.description}</p>}
              </div>
              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? "Submitting..." : "Submit project"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">My submissions</h2>
          {loadingList ? (
            <>
              <Skeleton className="h-28 w-full" />
              <Skeleton className="h-28 w-full" />
            </>
          ) : items.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing submitted yet.</p>
          ) : (
            items.map((s) => (
              <Card key={s.id}>
                <CardHeader className="flex flex-row items-start justify-between gap-2">
                  <CardTitle className="text-base">{s.projectName}</CardTitle>
                  <Badge className={STATUS_STYLE[s.status]}>{s.status}</Badge>
                </CardHeader>
                <CardContent className="space-y-1">
                  <LinkOrNA url={s.frontendRepoUrl} label="Frontend repo" />
                  <LinkOrNA url={s.backendRepoUrl} label="Backend repo" />
                  <LinkOrNA url={s.frontendLiveUrl} label="Frontend live" />
                  <LinkOrNA url={s.backendLiveUrl} label="Backend live" />
                  <p className="pt-2 text-sm">{s.description}</p>
                </CardContent>
              </Card>
            ))
          )}
        </section>
      </div>
    </main>
  );
}