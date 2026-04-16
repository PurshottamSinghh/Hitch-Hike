"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import DriverDashboard from "@/components/DriverDashboard";

export default function DriverPage() {
  const router = useRouter();

  useEffect(() => {
    const user = localStorage.getItem("user");
    if (!user) {
      router.push("/login");
      return;
    }
    const parsed = JSON.parse(user);
    if (parsed.profile?.role !== "driver") {
      router.push(`/app/${parsed.profile?.role || "rider"}`);
    }
  }, [router]);

  return (
    <div className="min-h-screen bg-[#0d1117]">
      <DriverDashboard />
    </div>
  );
}
