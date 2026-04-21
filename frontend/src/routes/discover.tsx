import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect, useRef } from "react";
import { List, Map as MapIcon, SlidersHorizontal, X } from "lucide-react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { PhoneFrame, Pill, SectionHeader } from "@/components/app-shell";
import { BottomNav } from "@/components/bottom-nav";
import { RideCard } from "@/components/ride-card";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import * as api from "@/lib/api";

export const Route = createFileRoute("/discover")({
  head: () => ({
    meta: [{ title: "Discover rides — Hitch-Hike" }],
  }),
  component: Discover,
});

const TOKEN_KEY = "loop_mapbox_token";
const DEFAULT_MAPBOX_TOKEN =
  (import.meta.env.VITE_MAPBOX_PUBLIC_TOKEN as string | undefined) ||
  (import.meta.env.VITE_MAPBOX_TOKEN as string | undefined) ||
  "";

function Discover() {
  const [view, setView] = useState<"list" | "map">("list");
  const [filter, setFilter] = useState<"all" | "today" | "best">("all");
  const navigate = useNavigate();

  const { data: offers = [] } = useQuery({ queryKey: ["offers"], queryFn: api.fetchRideOffers });

  const rides = offers.map((r: any) => ({
    id: r.id.toString(),
    driver: {
      name: r.driver_username,
      initials: r.driver_username.substring(0, 2).toUpperCase(),
      rating: 5,
      major: "Driver",
    },
    origin: "Pickup",
    destination: "Destination",
    departAt: r.departure_time,
    durationMin: 15,
    seatsTotal: r.available_seats,
    seatsAvailable: r.available_seats,
    priceUsd: Number(r.price_per_seat),
    matchScore: 95,
    status: r.status,
    routePreview: {
      from: [-83.61, 41.66] as [number, number],
      to: [-83.55, 41.66] as [number, number],
    },
  }));

  const filtered =
    filter === "best" ? [...rides].sort((a, b) => b.matchScore - a.matchScore) : rides;

  return (
    <PhoneFrame>
      <BottomNav />

      <header className="flex items-start justify-between">
        <div>
          <p className="text-[13px] font-semibold uppercase tracking-[0.2em] text-accent">
            Discover
          </p>
          <h1 className="mt-1 text-[28px] font-bold leading-tight tracking-tight text-foreground">
            {filtered.length} rides match
            <br />
            your route today
          </h1>
        </div>
        <button className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-surface shadow-soft">
          <SlidersHorizontal className="h-4 w-4" />
        </button>
      </header>

      {/* view toggle */}
      <div className="mt-5 grid grid-cols-2 gap-1 rounded-2xl border border-border bg-surface p-1 shadow-soft">
        {(
          [
            { id: "list", icon: List, label: "List" },
            { id: "map", icon: MapIcon, label: "Map" },
          ] as const
        ).map((v) => {
          const Icon = v.icon;
          const active = view === v.id;
          return (
            <button
              key={v.id}
              onClick={() => setView(v.id)}
              className={cn(
                "inline-flex items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-[13px] font-semibold transition-all",
                active
                  ? "bg-gradient-aurora text-primary-foreground shadow-glow"
                  : "text-muted-foreground",
              )}
            >
              <Icon className="h-4 w-4" /> {v.label}
            </button>
          );
        })}
      </div>

      {/* filter chips */}
      <div className="mt-4 flex gap-2 overflow-x-auto pb-1 scrollbar-none">
        {(
          [
            { id: "all", label: "All times" },
            { id: "today", label: "Today" },
            { id: "best", label: "★ Best matches" },
          ] as const
        ).map((f) => {
          const active = filter === f.id;
          return (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={cn(
                "shrink-0 rounded-full border px-3.5 py-1.5 text-[12px] font-semibold transition-all",
                active
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-surface text-muted-foreground",
              )}
            >
              {f.label}
            </button>
          );
        })}
      </div>

      {view === "map" ? (
        <MapView rides={filtered} />
      ) : (
        <div className="mt-5 space-y-3">
          {filtered.map((r, i) => (
            <div key={r.id} className="animate-rise" style={{ animationDelay: `${i * 80}ms` }}>
              <RideCard
                ride={r}
                highlight={filter === "best" && i === 0}
                onClick={() => navigate({ to: "/ride/$rideId", params: { rideId: r.id } })}
              />
            </div>
          ))}
        </div>
      )}

      <SectionHeader title="Tip" />
      <div className="rounded-2xl border border-border bg-surface p-4 shadow-soft">
        <p className="text-[13px] text-foreground">
          Set a recurring schedule to auto-match with the same drivers each week.
        </p>
        <Pill tone="accent" className="mt-2">
          Saves ~22 min/week
        </Pill>
      </div>
    </PhoneFrame>
  );
}

function MapView({ rides }: { rides: any[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const [token, setToken] = useState<string>(() =>
    typeof window !== "undefined" ? localStorage.getItem(TOKEN_KEY) || DEFAULT_MAPBOX_TOKEN : "",
  );
  const [tokenInput, setTokenInput] = useState("");

  useEffect(() => {
    if (!token || !containerRef.current || mapRef.current) return;
    mapboxgl.accessToken = token;
    try {
      const map = new mapboxgl.Map({
        container: containerRef.current,
        style: "mapbox://styles/mapbox/light-v11",
        center: [-83.61, 41.66],
        zoom: 11.5,
        attributionControl: false,
      });
      mapRef.current = map;

      map.on("load", () => {
        rides.forEach((r) => {
          const el = document.createElement("div");
          el.className =
            "h-3 w-3 rounded-full bg-[oklch(0.32_0.14_275)] ring-4 ring-[oklch(0.32_0.14_275)]/25";
          new mapboxgl.Marker(el).setLngLat(r.routePreview.from).addTo(map);

          const el2 = document.createElement("div");
          el2.className =
            "h-3 w-3 rounded-sm bg-[oklch(0.72_0.18_32)] ring-4 ring-[oklch(0.72_0.18_32)]/25";
          new mapboxgl.Marker(el2).setLngLat(r.routePreview.to).addTo(map);
        });
      });
    } catch (err) {
      console.error(err);
    }

    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [token]);

  if (!token) {
    return (
      <div className="mt-5 rounded-3xl border border-dashed border-border bg-surface p-6 text-center shadow-soft">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-muted text-primary">
          <MapIcon className="h-5 w-5" />
        </span>
        <h3 className="mt-3 text-[15px] font-bold tracking-tight text-foreground">
          Activate live map
        </h3>
        <p className="mt-1 text-[12px] text-muted-foreground">
          Paste your Mapbox public token (pk.…) — saved locally on this device.
        </p>
        <div className="mt-4 flex gap-2">
          <input
            value={tokenInput}
            onChange={(e) => setTokenInput(e.target.value)}
            placeholder="pk.eyJ..."
            className="flex-1 rounded-xl border border-border bg-background px-3 py-2 text-[12px] outline-none focus:border-primary"
          />
          <button
            onClick={() => {
              if (tokenInput.trim().startsWith("pk.")) {
                localStorage.setItem(TOKEN_KEY, tokenInput.trim());
                setToken(tokenInput.trim());
              }
            }}
            className="rounded-xl bg-primary px-4 py-2 text-[12px] font-semibold text-primary-foreground"
          >
            Activate
          </button>
        </div>
        <p className="mt-3 text-[11px] text-muted-foreground">
          Set `VITE_MAPBOX_PUBLIC_TOKEN` or use mapbox.com → Account → Tokens.
        </p>
      </div>
    );
  }

  return (
    <div className="relative mt-5 overflow-hidden rounded-3xl border border-border shadow-soft">
      <div ref={containerRef} className="h-[420px] w-full" />
      <button
        onClick={() => {
          localStorage.removeItem(TOKEN_KEY);
          setToken("");
        }}
        className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-surface/90 shadow-soft backdrop-blur-md"
        aria-label="Reset map token"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
