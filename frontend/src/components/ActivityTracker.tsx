"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { recordActivity } from "@/utils/audit";

export default function ActivityTracker() {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname || pathname === "/login" || pathname === "/signup") return;
    const key = `activity:${pathname}`;
    const lastRecorded = Number(sessionStorage.getItem(key) || 0);
    if (Date.now() - lastRecorded < 60_000) return;

    sessionStorage.setItem(key, String(Date.now()));
    recordActivity("page_view", `Visited ${pathname}.`, {
      entityType: "route",
      entityId: pathname,
    });
  }, [pathname]);

  return null;
}
