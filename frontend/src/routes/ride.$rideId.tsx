import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ChevronLeft,
  MessageCircle,
  Phone,
  Share2,
  CheckCircle2,
  Circle,
  CarFront,
} from "lucide-react";
import { PhoneFrame, Avatar, Pill } from "@/components/app-shell";
import { formatTime } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import * as api from "@/lib/api";
import { useState, useRef, useEffect } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

const TOKEN_KEY = "loop_mapbox_token";

export const Route = createFileRoute("/ride/$rideId")({
  head: () => ({
    meta: [{ title: "Ride details — Loop" }],
  }),
  component: RideDetail,
});

function RideDetail() {
  const { rideId } = Route.useParams();
  const { data: offers = [], isLoading } = useQuery({
    queryKey: ["offers"],
    queryFn: api.fetchRideOffers,
    refetchInterval: 3000,
  });

  if (isLoading) {
    return (
      <PhoneFrame hideNav>
        <div className="flex p-4 text-muted-foreground">Loading ride...</div>
      </PhoneFrame>
    );
  }

  const rawRide = offers.find((r: any) => r.id.toString() === rideId) || offers[0];

  if (!rawRide) {
    return (
      <PhoneFrame hideNav>
        <div className="flex p-4 text-muted-foreground">Ride not found.</div>
      </PhoneFrame>
    );
  }

  const driverInitials = rawRide.driver_username
    ? rawRide.driver_username.substring(0, 2).toUpperCase()
    : "DR";

  const ride = {
    id: rawRide.id.toString(),
    driver: {
      name: rawRide.driver_username,
      initials: driverInitials,
      rating: 5.0,
      major: "Driver",
    },
    origin: "Pickup",
    destination: "Destination",
    departAt: rawRide.departure_time,
    durationMin: 15,
    seatsAvailable: rawRide.available_seats,
    seatsTotal: rawRide.available_seats,
    priceUsd: Number(rawRide.price_per_seat),
    status: rawRide.status || "pending",
  };

  const stages = [
    { id: "pending", label: "Requested" },
    { id: "confirmed", label: "Confirmed" },
    { id: "in_progress", label: "On the way" },
    { id: "completed", label: "Completed" },
  ] as const;
  const activeIdx = stages.findIndex((s) => s.id === ride.status);

  return (
    <PhoneFrame hideNav>
      <header className="flex items-center justify-between">
        <Link
          to="/home"
          className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-surface shadow-soft"
        >
          <ChevronLeft className="h-4 w-4" />
        </Link>
        <Pill tone="primary">Ride · {ride.id.toUpperCase()}</Pill>
        <button className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-surface shadow-soft">
          <Share2 className="h-4 w-4" />
        </button>
      </header>

      {/* hero */}
      <section className="mt-5 overflow-hidden rounded-3xl bg-gradient-aurora p-5 text-primary-foreground shadow-glow noise">
        <div className="flex items-center gap-3">
          <Avatar initials={ride.driver.initials} tone="coral" size="xl" ring />
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-wider opacity-70">
              Your driver
            </p>
            <p className="truncate text-[18px] font-bold tracking-tight">{ride.driver.name}</p>
            <p className="text-[12px] opacity-80">
              {ride.driver.major} · ★ {ride.driver.rating}
            </p>
          </div>
          <span className="relative flex h-3 w-3">
            <span className="absolute inset-0 animate-pulse-ring rounded-full bg-accent" />
            <span className="relative inline-flex h-3 w-3 rounded-full bg-accent" />
          </span>
        </div>

        <div className="mt-4 rounded-2xl bg-white/10 p-3 backdrop-blur-md">
          <ActiveRideMap
            from={[-83.61, 41.66]}
            to={[-83.55, 41.66]}
            driverLocation={ride.status === "in_progress" ? [-83.58, 41.66] : [-83.61, 41.66]}
          />
          <div className="mt-1 flex items-center justify-between text-[12px] opacity-90">
            <span className="truncate">{ride.origin}</span>
            <span className="rounded-full bg-white/20 px-2 py-0.5 font-semibold">
              {ride.durationMin} min
            </span>
            <span className="truncate text-right">{ride.destination}</span>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          {[
            { label: "Departs", value: formatTime(ride.departAt) },
            { label: "Seats", value: `${ride.seatsAvailable}/${ride.seatsTotal}` },
            { label: "Cost", value: `$${ride.priceUsd.toFixed(2)}` },
          ].map((s) => (
            <div key={s.label} className="rounded-xl bg-white/10 p-2.5 backdrop-blur-md">
              <p className="text-[10px] uppercase tracking-wider opacity-70">{s.label}</p>
              <p className="mt-0.5 text-[15px] font-bold tracking-tight">{s.value}</p>
            </div>
          ))}
        </div>
      </section>

      {/* progress timeline */}
      <section className="mt-6 rounded-3xl border border-border bg-surface p-5 shadow-soft">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Status
        </p>
        <ol className="mt-4 space-y-4">
          {stages.map((s, i) => {
            const done = i < activeIdx;
            const active = i === activeIdx;
            return (
              <li key={s.id} className="flex items-center gap-3">
                <span className="relative flex h-7 w-7 shrink-0 items-center justify-center">
                  {done ? (
                    <CheckCircle2 className="h-6 w-6 text-success" />
                  ) : active ? (
                    <CarFront className="h-6 w-6 text-accent animate-float" />
                  ) : (
                    <Circle className="h-5 w-5 text-muted-foreground/40" />
                  )}
                </span>
                <div className="flex-1">
                  <p
                    className={`text-[14px] font-semibold tracking-tight ${
                      active ? "text-foreground" : "text-muted-foreground"
                    }`}
                  >
                    {s.label}
                  </p>
                </div>
                {active && <Pill tone="accent">Now</Pill>}
              </li>
            );
          })}
        </ol>
      </section>

      {/* actions */}
      <section className="mt-6 grid grid-cols-2 gap-3">
        <button className="flex items-center justify-center gap-2 rounded-2xl border border-border bg-surface px-3 py-3.5 text-[13px] font-semibold shadow-soft">
          <MessageCircle className="h-4 w-4 text-primary" /> Message
        </button>
        <button className="flex items-center justify-center gap-2 rounded-2xl border border-border bg-surface px-3 py-3.5 text-[13px] font-semibold shadow-soft">
          <Phone className="h-4 w-4 text-primary" /> Call
        </button>
      </section>

      <button className="mt-3 w-full rounded-2xl bg-primary py-4 text-[14px] font-bold text-primary-foreground shadow-glow transition-transform active:scale-[0.98]">
        Confirm pickup
      </button>
      <button className="mt-2 w-full rounded-2xl bg-transparent py-3 text-[12px] font-semibold text-muted-foreground hover:text-destructive">
        Cancel ride
      </button>

      <div className="mt-10" />
    </PhoneFrame>
  );
}

function ActiveRideMap({
  from,
  to,
  driverLocation,
}: {
  from: [number, number];
  to: [number, number];
  driverLocation: [number, number];
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const driverMarkerRef = useRef<mapboxgl.Marker | null>(null);

  const [token, setToken] = useState<string>(() =>
    typeof window !== "undefined" ? localStorage.getItem(TOKEN_KEY) || "" : "",
  );

  useEffect(() => {
    if (!token || !containerRef.current || mapRef.current) return;
    mapboxgl.accessToken = token;
    try {
      const map = new mapboxgl.Map({
        container: containerRef.current,
        style: "mapbox://styles/mapbox/dark-v11",
        center: driverLocation,
        zoom: 13,
        attributionControl: false,
      });
      mapRef.current = map;

      map.on("load", () => {
        // origin
        const startEl = document.createElement("div");
        startEl.className =
          "h-3 w-3 rounded-full bg-[oklch(0.32_0.14_275)] ring-4 ring-[oklch(0.32_0.14_275)]/25";
        new mapboxgl.Marker(startEl).setLngLat(from).addTo(map);

        // dest
        const endEl = document.createElement("div");
        endEl.className =
          "h-3 w-3 rounded-sm bg-[oklch(0.72_0.18_32)] ring-4 ring-[oklch(0.72_0.18_32)]/25";
        new mapboxgl.Marker(endEl).setLngLat(to).addTo(map);

        // driver
        const driverEl = document.createElement("div");
        driverEl.className =
          "flex h-6 w-6 items-center justify-center rounded-full bg-accent text-accent-foreground shadow-glow animate-pulse";
        driverEl.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 16H9m10 0h3v-3.15a1 1 0 0 0-.84-.99L16 11l-2.7-3.6a2 2 0 0 0-1.6-.8H8a2 2 0 0 0-2 2v2M3 16h3m10 0v-2.15a1 1 0 0 0-.84-.99L12 11H8m-3 5a2 2 0 1 0 4 0 2 2 0 1 0-4 0Zm10 0a2 2 0 1 0 4 0 2 2 0 1 0-4 0Z"/></svg>`;
        driverMarkerRef.current = new mapboxgl.Marker(driverEl)
          .setLngLat(driverLocation)
          .addTo(map);
      });
    } catch (err) {
      console.error(err);
    }

    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [token]);

  useEffect(() => {
    if (driverMarkerRef.current) {
      driverMarkerRef.current.setLngLat(driverLocation);
    }
  }, [driverLocation]);

  if (!token)
    return (
      <div className="h-40 w-full rounded-2xl bg-black/20 flex items-center justify-center text-xs opacity-70">
        Add token in Discover map
      </div>
    );

  return <div ref={containerRef} className="h-40 w-full overflow-hidden rounded-2xl" />;
}
