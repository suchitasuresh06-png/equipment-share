"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getSession } from "@/lib/session";

export default function RootGate() {
  const router = useRouter();

  useEffect(() => {
    const session = getSession();
    if (!session) {
      router.replace("/start");
    } else if (session.role === "seller") {
      router.replace("/sell");
    } else {
      router.replace("/rent");
    }
  }, [router]);

  return <div className="loading-state">Loading Equipment Share...</div>;
}
