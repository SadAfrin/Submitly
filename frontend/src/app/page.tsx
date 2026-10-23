"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getMe } from "@/lib/api";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    getMe().then((u) => {
      if (!u) router.replace("/login");
      else router.replace(u.role === "MENTOR" ? "/mentor" : "/student");
    });
  }, [router]);

  return <main className="p-6 text-sm text-muted-foreground">Loading...</main>;
}