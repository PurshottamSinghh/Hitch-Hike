import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ChevronLeft, LogOut, Settings, Shield, Star } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { PhoneFrame, Avatar, Pill } from "@/components/app-shell";
import * as api from "@/lib/api";

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [{ title: "Profile — Hitch-Hike" }],
  }),
  component: Profile,
});

function Profile() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: rawProfile, isLoading } = useQuery({
    queryKey: ["profile"],
    queryFn: api.fetchProfile,
  });
  const [isEditing, setIsEditing] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [form, setForm] = useState({
    username: "",
    email: "",
    home_address: "",
    phone_number: "",
    role: "rider" as "rider" | "driver",
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
    address: rawProfile.profile?.home_address || "Not set",
  };

  const saveProfileMutation = useMutation({
    mutationFn: api.updateProfile,
    onSuccess: async (updated) => {
      setError("");
      setSuccess("Profile updated.");
      setIsEditing(false);
      await queryClient.setQueryData(["profile"], updated);
      await queryClient.invalidateQueries({ queryKey: ["profile"] });
    },
    onError: (err: any) => {
      setSuccess("");
      setError(err?.message || "Could not update profile.");
    },
  });

  const handleLogout = () => {
    api.logout();
    navigate({ to: "/" });
  };

  const startEditing = () => {
    setError("");
    setSuccess("");
    setForm({
      username: rawProfile.username || "",
      email: rawProfile.email || "",
      home_address: rawProfile.profile?.home_address || "",
      phone_number: rawProfile.profile?.phone_number || "",
      role: rawProfile.profile?.role === "driver" ? "driver" : "rider",
    });
    setIsEditing(true);
  };

  const saveProfile = () => {
    if (!isCampusEmail(form.email)) {
      setError("Email must end with @utoledo.edu or @rockets.utoledo.edu.");
      return;
    }
    saveProfileMutation.mutate(form);
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
        <button
          onClick={startEditing}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-surface shadow-soft"
        >
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

      {isEditing && (
        <section className="mt-4 rounded-3xl border border-border bg-surface p-4 shadow-soft space-y-3">
          <p className="text-[12px] font-semibold uppercase tracking-wider text-muted-foreground">
            Edit profile
          </p>
          <input
            value={form.username}
            onChange={(e) => setForm((prev) => ({ ...prev, username: e.target.value }))}
            placeholder="Username"
            className="w-full rounded-xl border border-border bg-background px-3 py-2 text-[13px] outline-none focus:border-primary"
          />
          <input
            value={form.email}
            onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
            placeholder="Campus email"
            className="w-full rounded-xl border border-border bg-background px-3 py-2 text-[13px] outline-none focus:border-primary"
          />
          <input
            value={form.home_address}
            onChange={(e) => setForm((prev) => ({ ...prev, home_address: e.target.value }))}
            placeholder="Home address"
            className="w-full rounded-xl border border-border bg-background px-3 py-2 text-[13px] outline-none focus:border-primary"
          />
          <input
            value={form.phone_number}
            onChange={(e) => setForm((prev) => ({ ...prev, phone_number: e.target.value }))}
            placeholder="Phone"
            className="w-full rounded-xl border border-border bg-background px-3 py-2 text-[13px] outline-none focus:border-primary"
          />
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setForm((prev) => ({ ...prev, role: "rider" }))}
              className={`rounded-xl border px-3 py-2 text-[13px] font-semibold ${
                form.role === "rider"
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border"
              }`}
            >
              Rider
            </button>
            <button
              onClick={() => setForm((prev) => ({ ...prev, role: "driver" }))}
              className={`rounded-xl border px-3 py-2 text-[13px] font-semibold ${
                form.role === "driver"
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border"
              }`}
            >
              Driver
            </button>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setIsEditing(false)}
              className="flex-1 rounded-xl border border-border py-2 text-[13px] font-semibold"
            >
              Cancel
            </button>
            <button
              onClick={saveProfile}
              disabled={saveProfileMutation.isPending}
              className="flex-1 rounded-xl bg-primary py-2 text-[13px] font-semibold text-primary-foreground disabled:opacity-70"
            >
              {saveProfileMutation.isPending ? "Saving..." : "Save"}
            </button>
          </div>
        </section>
      )}

      {error && <p className="mt-3 text-[12px] text-destructive">{error}</p>}
      {success && <p className="mt-3 text-[12px] text-success">{success}</p>}

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

function isCampusEmail(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  return normalized.endsWith("@utoledo.edu") || normalized.endsWith("@rockets.utoledo.edu");
}
