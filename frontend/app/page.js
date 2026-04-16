"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function RootPage() {
  const router = useRouter();

  useEffect(() => {
    const user = localStorage.getItem("user");
    if (!user) {
      router.push("/login");
    } else {
      try {
        const parsed = JSON.parse(user);
        const role = parsed.profile?.role || "rider";
        router.push(`/app/${role}`);
      } catch (err) {
        localStorage.removeItem("user");
        router.push("/login");
      }
    }
  }, [router]);

  return (
    <div className="min-h-screen bg-[#0d1117] flex items-center justify-center">
      <div className="w-12 h-12 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" />
    </div>
  );
}
