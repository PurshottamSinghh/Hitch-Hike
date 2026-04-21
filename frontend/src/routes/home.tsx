import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Sun, Leaf, DollarSign, ChevronRight, Bell, Sparkles } from "lucide-react";
import { PhoneFrame, Avatar, Pill, SectionHeader } from "@/components/app-shell";
import { BottomNav } from "@/components/bottom-nav";
import { RideCard, RoutePreviewSVG, StatusPill } from "@/components/ride-card";
import { useRouter } from "@tanstack/react-router";
import { formatTime, formatRelativeTime } from "@/lib/utils";
import * as api from "@/lib/api";

export const Route = createFileRoute("/home")({
  head: () => ({
    meta: [
      { title: "Home — Hitch-Hike" },
      {
        name: "description",
        content: "Your daily carpool dashboard for the University of Toledo.",
      },
    ],
  }),
  component: Home,
});

function Home() {
  const router = useRouter();
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  const { data: rawProfile, isLoading: isProfileLoading } = useQuery({
    queryKey: ["profile"],
    queryFn: api.fetchProfile,
  });
  const { data: offers = [] } = useQuery({ queryKey: ["offers"], queryFn: api.fetchRideOffers });
  const { data: myRideRequests = [] } = useQuery({
    queryKey: ["myRideRequests"],
    queryFn: api.fetchMyRideRequests,
    refetchInterval: 3000,
  });

  if (isProfileLoading || !rawProfile) {
    return (
      <PhoneFrame>
        <div className="flex p-4 text-muted-foreground">Loading...</div>
      </PhoneFrame>
    );
  }

  const currentUser = {
    firstName: rawProfile.username,
    initials: rawProfile.username.substring(0, 2).toUpperCase(),
    co2SavedKg: rawProfile.stats?.points ? Math.floor(rawProfile.stats.points / 10) : 0,
    moneySavedUsd: rawProfile.stats?.points ? Math.floor(rawProfile.stats.points / 5) : 0,
    streak: rawProfile.stats?.streak_days || 0,
  };

  const upcomingRide = offers.length > 0 ? offers[0] : null;
  const suggestedRides = offers.slice(1, 3);
  const riderActiveRequest =
    myRideRequests.find(
      (r: any) =>
        r.passenger_username === rawProfile.username &&
        ["pending", "accepted", "matched"].includes(r.status),
    ) || null;
  const driverActiveRequest =
    myRideRequests.find(
      (r: any) =>
        r.driver_username === rawProfile.username &&
        ["accepted", "matched"].includes(r.status),
    ) || null;

  return (
    <PhoneFrame>
      <BottomNav />

      {/* Header */}
      <header className="flex items-center justify-between">
        <div>
          <p className="inline-flex items-center gap-1.5 text-[12px] font-medium text-muted-foreground">
            <Sun className="h-3.5 w-3.5 text-accent" />
            {greeting}, {currentUser.firstName}
          </p>
          <h1 className="mt-1 text-[26px] font-bold leading-tight tracking-tight text-foreground">
            Let's make today
            <br />
            <span className="bg-gradient-aurora bg-clip-text text-transparent">effortless.</span>
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <button className="relative flex h-10 w-10 items-center justify-center rounded-full border border-border bg-surface shadow-soft">
            <Bell className="h-4 w-4 text-foreground" />
            <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-accent ring-2 ring-surface" />
          </button>
          <Link
            to="/profile"
            className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-surface shadow-soft"
          >
            <Avatar initials={currentUser.initials} tone="indigo" size="md" />
          </Link>
        </div>
      </header>

      {rawProfile?.profile?.role !== "driver" && riderActiveRequest && (
        <section className="mt-4 rounded-2xl border border-primary/30 bg-primary/10 p-4 shadow-soft">
          <p className="text-[12px] font-semibold text-primary">
            {riderActiveRequest.status === "pending"
              ? "Request sent. Waiting for a driver."
              : "Your request was accepted. Be ready for pickup."}
          </p>
          <button
            onClick={() =>
              router.navigate({
                to: `/ride/${riderActiveRequest.id}`,
              })
            }
            className="mt-2 text-[12px] font-semibold text-foreground underline"
          >
            View ride status
          </button>
        </section>
      )}

      {rawProfile?.profile?.role === "driver" && driverActiveRequest && (
        <section className="mt-4 rounded-2xl border border-accent/30 bg-accent/10 p-4 shadow-soft">
          <p className="text-[12px] font-semibold text-foreground">
            Rider request accepted. Coordinate pickup and complete the ride when done.
          </p>
          <button
            onClick={() =>
              router.navigate({
                to: `/ride/${driverActiveRequest.id}`,
              })
            }
            className="mt-2 text-[12px] font-semibold text-foreground underline"
          >
            Open active ride
          </button>
        </section>
      )}

      {/* Upcoming ride hero */}
      <section className="mt-6">
        <SectionHeader
          title="Your next ride"
          action={<StatusPill status={upcomingRide ? "pending" : "completed"} />}
        />
        {upcomingRide ? (
          <Link
            to="/ride/$rideId"
            params={{ rideId: upcomingRide.id.toString() }}
            className="block animate-rise"
          >
            <div className="relative overflow-hidden rounded-3xl bg-gradient-aurora p-5 text-primary-foreground shadow-glow noise">
              <div className="flex items-center gap-3">
                <Avatar
                  initials={upcomingRide.driver_username.substring(0, 2).toUpperCase()}
                  tone="coral"
                  size="lg"
                  ring
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-semibold tracking-tight">
                    {upcomingRide.driver_username}
                  </p>
                  <p className="text-[12px] opacity-80">DRIVER · ★ 5.0</p>
                </div>
                <div className="text-right">
                  <p className="text-[11px] uppercase tracking-wider opacity-70">Departs</p>
                  <p className="text-[18px] font-bold tracking-tight">
                    {formatTime(upcomingRide.departure_time)}
                  </p>
                </div>
              </div>

              <div className="mt-4 rounded-2xl bg-white/10 p-3 backdrop-blur-md">
                <RoutePreviewSVG variant="coral" />
                <div className="mt-1 flex items-center justify-between text-[12px] opacity-90">
                  <span className="truncate">Pickup</span>
                  <span>→</span>
                  <span className="truncate text-right">Destination</span>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 text-[12px] opacity-80">
                  <Sparkles className="h-3.5 w-3.5" />
                  {formatRelativeTime(upcomingRide.departure_time)} · {upcomingRide.price_per_seat}{" "}
                  USD
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-white/20 px-3 py-1 text-[12px] font-semibold">
                  Open <ChevronRight className="h-3.5 w-3.5" />
                </span>
              </div>
            </div>
          </Link>
        ) : (
          <div className="rounded-3xl border border-border bg-surface p-5 shadow-soft text-center text-sm text-muted-foreground">
            No upcoming rides.
          </div>
        )}
      </section>

      {/* Stats */}
      <section className="mt-6 grid grid-cols-3 gap-3">
        {[
          { icon: Leaf, tone: "success", label: "CO₂ saved", value: `${currentUser.co2SavedKg}kg` },
          {
            icon: DollarSign,
            tone: "accent",
            label: "Saved",
            value: `$${currentUser.moneySavedUsd}`,
          },
          { icon: Sparkles, tone: "primary", label: "Streak", value: `${currentUser.streak}d` },
        ].map((s, i) => {
          const Icon = s.icon;
          const toneMap: Record<string, string> = {
            success: "text-success bg-success/10",
            accent: "text-accent bg-accent/12",
            primary: "text-primary bg-primary/10",
          };
          return (
            <div
              key={s.label}
              className="animate-rise rounded-2xl border border-border bg-surface p-3 shadow-soft"
              style={{ animationDelay: `${i * 80}ms` }}
            >
              <span
                className={`flex h-8 w-8 items-center justify-center rounded-xl ${toneMap[s.tone]}`}
              >
                <Icon className="h-4 w-4" />
              </span>
              <p className="mt-2 text-[18px] font-bold tracking-tight text-foreground">{s.value}</p>
              <p className="text-[11px] text-muted-foreground">{s.label}</p>
            </div>
          );
        })}
      </section>

      {/* Suggested matches */}
      <section className="mt-7">
        <SectionHeader
          title="Suggested for you"
          subtitle="Smart-matched to your schedule"
          action={
            <Link to="/discover" className="text-[12px] font-semibold text-primary">
              See all
            </Link>
          }
        />
        <div className="space-y-3">
          {suggestedRides.map((r: any, i) => (
            <div key={r.id} className="animate-rise" style={{ animationDelay: `${i * 100}ms` }}>
              <RideCard
                ride={{
                  id: r.id.toString(),
                  driver: {
                    name: r.driver_username,
                    initials: r.driver_username.substring(0, 2).toUpperCase(),
                    rating: 5,
                    major: "Driver",
                  },
                  origin: "Campus",
                  destination: "Home",
                  departAt: r.departure_time,
                  durationMin: 15,
                  seatsTotal: r.available_seats,
                  seatsAvailable: r.available_seats,
                  priceUsd: Number(r.price_per_seat),
                  matchScore: 90,
                  status: "pending",
                  routePreview: { from: [0, 0], to: [0, 0] },
                }}
                highlight={i === 0}
              />
            </div>
          ))}
        </div>
      </section>

      {/* Group teaser */}
      <section className="mt-7">
        <SectionHeader title="Your circle" />
        <Link
          to="/groups"
          className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-4 shadow-soft transition-all hover:-translate-y-0.5 hover:shadow-elevated"
        >
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-muted text-2xl">
            ☕
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[14px] font-semibold tracking-tight text-foreground">
              Westgate Wake-Ups
            </p>
            <p className="text-[12px] text-muted-foreground">4 members · 38 rides shared</p>
          </div>
          <Pill tone="success">Active</Pill>
        </Link>
      </section>

    </PhoneFrame>
  );
}
