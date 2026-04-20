import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ChevronLeft, LogOut, Settings, Shield, Star } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { PhoneFrame, Avatar, Pill } from "@/components/app-shell";
import * as api from "@/lib/api";

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [{ title: "Profile — Loop" }],
  }),
  component: Profile,
});

function Profile() {
  const navigate = useNavigate();
  const { data: rawProfile, isLoading } = useQuery({
    queryKey: ["profile"],
    queryFn: api.fetchProfile,
  });

  if (isLoading || !rawProfile) {
    return (
      <PhoneFrame hideNav>
        <div className="p-4">Loading...</div>
      </PhoneFrame>
    );
  }

  const currentUser = {
    name: rawProfile.username,
    initials: rawProfile.username.substring(0, 2).toUpperCase(),
    major: "Student",
    year: "University of Toledo",
    rating: 5.0,
    ridesGiven: rawProfile.stats?.rides_given || 0,
    ridesTaken: rawProfile.stats?.rides_taken || 0,
    email: rawProfile.email || `${rawProfile.username}@utoledo.edu`,
    address: "Campus",
  };

  const handleLogout = () => {
    api.logout();
    navigate({ to: "/" });
  };

  return (
    <PhoneFrame hideNav>
      <header className="flex items-center justify-between">
        <Link
          to="/home"
          className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-surface shadow-soft"
        >
          <ChevronLeft className="h-4 w-4" />
        </Link>
        <button className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-surface shadow-soft">
          <Settings className="h-4 w-4" />
        </button>
      </header>

      <section className="mt-6 text-center">
        <Avatar initials={currentUser.initials} tone="indigo" size="xl" />
        <h1 className="mt-3 text-[24px] font-bold tracking-tight text-foreground">
          {currentUser.name}
        </h1>
        <p className="text-[13px] text-muted-foreground">
          {currentUser.major} · {currentUser.year}
        </p>
        <div className="mt-3 flex justify-center gap-2">
          <Pill tone="success">
            <Shield className="h-3 w-3" /> @utoledo verified
          </Pill>
          <Pill tone="accent">
            <Star className="h-3 w-3" /> {currentUser.rating}
          </Pill>
        </div>
      </section>

      <section className="mt-6 grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-border bg-surface p-4 shadow-soft">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Rides given</p>
          <p className="mt-1 text-[24px] font-bold tracking-tight text-foreground">
            {currentUser.ridesGiven}
          </p>
        </div>
        <div className="rounded-2xl border border-border bg-surface p-4 shadow-soft">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Rides taken</p>
          <p className="mt-1 text-[24px] font-bold tracking-tight text-foreground">
            {currentUser.ridesTaken}
          </p>
        </div>
      </section>

      <section className="mt-6 overflow-hidden rounded-3xl border border-border bg-surface shadow-soft">
        {[
          { label: "Email", value: currentUser.email },
          { label: "Home", value: currentUser.address },
          { label: "Role", value: rawProfile.profile?.role || "Driver & Rider" },
        ].map((row, i, arr) => (
          <div
            key={row.label}
            className={`flex items-center justify-between px-4 py-3.5 ${i !== arr.length - 1 ? "border-b border-border" : ""}`}
          >
            <span className="text-[12px] text-muted-foreground">{row.label}</span>
            <span className="max-w-[60%] truncate text-[13px] font-semibold text-foreground">
              {row.value}
            </span>
          </div>
        ))}
      </section>

      <button
        onClick={handleLogout}
        className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl border border-border bg-surface py-3.5 text-[13px] font-semibold text-muted-foreground shadow-soft"
      >
        <LogOut className="h-4 w-4" /> Sign out
      </button>
      <div className="h-10" />
    </PhoneFrame>
  );
}
