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
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as api from "@/lib/api";
import { useEffect, useMemo, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { MAPBOX_PUBLIC_TOKEN, fetchRoute } from "@/lib/mapbox";

export const Route = createFileRoute("/ride/$rideId")({
  head: () => ({
    meta: [{ title: "Active ride — Hitch-Hike" }],
  }),
  component: RideDetail,
});

function RideDetail() {
  const { rideId } = Route.useParams();
  const queryClient = useQueryClient();

  const { data: profile } = useQuery({
    queryKey: ["profile"],
    queryFn: api.fetchProfile,
  });

  const { data: rideRequest } = useQuery<any>({
    queryKey: ["rideRequest", rideId],
    queryFn: () => api.fetchRideRequestById(rideId),
    retry: false,
    refetchInterval: 3000,
  });

  const isPassenger =
    profile?.username != null && rideRequest?.passenger_username === profile.username;
  const isDriver =
    profile?.username != null && rideRequest?.driver_username === profile.username;

  // NOTE: the active ride page used to `watchPosition` and push the driver's
  // browser GPS back to the backend every few seconds. That silently
  // overwrote the manually-pinned driver location that testers set from
  // /create. We intentionally do NOT stream GPS here — the driver's pinned
  // location on the profile is authoritative. If real live tracking is
  // needed later, add an explicit "Share my live location" opt-in toggle.

  const completeMutation = useMutation({
    mutationFn: (requestId: number) => api.completeRideRequest(requestId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["rideRequest", rideId] });
      await queryClient.invalidateQueries({ queryKey: ["myRideRequests"] });
    },
  });
  const cancelMutation = useMutation({
    mutationFn: (requestId: number) => api.cancelRideRequest(requestId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["rideRequest", rideId] });
      await queryClient.invalidateQueries({ queryKey: ["myRideRequests"] });
    },
  });

  if (!rideRequest) {
    return (
      <PhoneFrame hideNav>
        <div className="p-4 text-muted-foreground">Loading ride...</div>
      </PhoneFrame>
    );
  }

  const pickup = extractCoords(rideRequest.pickup_location);
  const dropoff = extractCoords(rideRequest.dropoff_location);
  const driverPos: [number, number] | null = rideRequest.driver_coords
    ? [rideRequest.driver_coords.lng, rideRequest.driver_coords.lat]
    : null;

  const status = rideRequest.status as string;
  const stages = [
    { id: "pending", label: "Requested" },
    { id: "accepted", label: "En route to pickup" },
    { id: "completed", label: "Completed" },
    { id: "cancelled", label: "Cancelled" },
  ] as const;
  const normalized =
    status === "matched"
      ? "accepted"
      : status === "pending_rider_confirm" || status === "no_drivers_available"
        ? "pending"
        : status;
  const activeIdx = stages.findIndex((s) => s.id === normalized);

  const canComplete =
    (isDriver || isPassenger) &&
    ["accepted", "matched"].includes(status);
  const canCancel =
    isPassenger && ["pending", "accepted", "matched"].includes(status);

  const driverName = rideRequest.driver_username || "Awaiting driver";
  const driverInitials = driverName.substring(0, 2).toUpperCase();

  // Reroute ETA = travel time for the assigned driver to reach the rider's
  // pickup point, captured at dispatch time in `pickup_eta_seconds` (a dict
  // of driver_id -> seconds). After `accept`, the assigned driver id lives on
  // `rideRequest.driver`.
  const rerouteSeconds: number | null = (() => {
    const eta = rideRequest.pickup_eta_seconds;
    const driverId = rideRequest.driver;
    if (!eta || driverId == null) return null;
    const raw = typeof eta === "object" ? eta[String(driverId)] : null;
    const num = typeof raw === "number" ? raw : Number(raw);
    return Number.isFinite(num) && num > 0 ? num : null;
  })();
  const rerouteMin =
    rerouteSeconds != null ? Math.max(1, Math.round(rerouteSeconds / 60)) : null;

  // For schedule-sourced rides ("same class, same time" offers) we show
  // both the pickup time AND the time the driver should leave so everyone
  // still makes it to class on time. Leave-by = pickup − driver→pickup ETA.
  const isScheduleRide = rideRequest.dispatch_source === "schedule";
  const leaveByIso: string | null = (() => {
    if (!isScheduleRide || rerouteSeconds == null) return null;
    const pickupMs = new Date(rideRequest.desired_time).getTime();
    if (!Number.isFinite(pickupMs)) return null;
    return new Date(pickupMs - rerouteSeconds * 1000).toISOString();
  })();

  return (
    <PhoneFrame hideNav>
      <header className="flex items-center justify-between">
        <Link
          to="/home"
          className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-surface shadow-soft"
        >
          <ChevronLeft className="h-4 w-4" />
        </Link>
        <Pill tone="primary">Ride · {String(rideRequest.id)}</Pill>
        <button className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-surface shadow-soft">
          <Share2 className="h-4 w-4" />
        </button>
      </header>

      <section className="mt-5 overflow-hidden rounded-3xl bg-gradient-aurora p-5 text-primary-foreground shadow-glow noise">
        <div className="flex items-center gap-3">
          <Avatar initials={driverInitials} tone="coral" size="xl" ring />
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-wider opacity-70">
              {isDriver ? "You're driving" : "Your driver"}
            </p>
            <p className="truncate text-[18px] font-bold tracking-tight">{driverName}</p>
            <p className="text-[12px] opacity-80">
              {rerouteMin != null
                ? isDriver
                  ? `Rerouting ~${rerouteMin} min to pickup`
                  : `Arriving in ~${rerouteMin} min`
                : "Pickup · ★ 5.0"}
            </p>
          </div>
          <span className="relative flex h-3 w-3">
            <span className="absolute inset-0 animate-pulse-ring rounded-full bg-accent" />
            <span className="relative inline-flex h-3 w-3 rounded-full bg-accent" />
          </span>
        </div>

        <div className="mt-4 rounded-2xl bg-white/10 p-3 backdrop-blur-md">
          <ThreePointMap
            driver={driverPos}
            pickup={pickup}
            dropoff={dropoff}
          />
          <div className="mt-2 flex items-center gap-3 text-[10px] font-semibold uppercase tracking-wider opacity-90">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-0.5 w-5 rounded-full bg-[#38bdf8]" />
              Driver → Pickup
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-0.5 w-5 rounded-full bg-[#fb923c]" />
              Pickup → Destination
            </span>
          </div>
          <div className="mt-2 flex items-center justify-between text-[12px] opacity-90">
            <span className="truncate">{rideRequest.pickup_address || "Pickup"}</span>
            <span>→</span>
            <span className="truncate text-right">
              {rideRequest.dropoff_address || "Destination"}
            </span>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          {[
            {
              label: isScheduleRide ? "Pickup" : "Scheduled",
              value: formatTime(rideRequest.desired_time),
            },
            isScheduleRide && leaveByIso
              ? {
                  label: isDriver ? "Leave by" : "Driver leaves",
                  value: formatTime(leaveByIso),
                }
              : rerouteMin != null
                ? {
                    label: isDriver ? "Reroute" : "Pickup ETA",
                    value: `${rerouteMin} min`,
                  }
                : { label: "Seats", value: String(rideRequest.seats_needed || 1) },
            { label: "Status", value: prettyStatus(status) },
          ].map((s) => (
            <div key={s.label} className="rounded-xl bg-white/10 p-2.5 backdrop-blur-md">
              <p className="text-[10px] uppercase tracking-wider opacity-70">{s.label}</p>
              <p className="mt-0.5 text-[13px] font-bold tracking-tight">{s.value}</p>
            </div>
          ))}
        </div>

        {isScheduleRide && rideRequest.notes && (
          <p className="mt-3 rounded-2xl bg-white/10 px-3 py-2 text-[11px] opacity-90 backdrop-blur-md">
            {rideRequest.notes}
          </p>
        )}
      </section>

      <section className="mt-6 rounded-3xl border border-border bg-surface p-5 shadow-soft">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Timeline
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
                <p
                  className={`flex-1 text-[14px] font-semibold tracking-tight ${
                    active ? "text-foreground" : "text-muted-foreground"
                  }`}
                >
                  {s.label}
                </p>
                {active && <Pill tone="accent">Now</Pill>}
              </li>
            );
          })}
        </ol>
      </section>

      <section className="mt-6 grid grid-cols-2 gap-3">
        <button className="flex items-center justify-center gap-2 rounded-2xl border border-border bg-surface px-3 py-3.5 text-[13px] font-semibold shadow-soft">
          <MessageCircle className="h-4 w-4 text-primary" /> Message
        </button>
        <button className="flex items-center justify-center gap-2 rounded-2xl border border-border bg-surface px-3 py-3.5 text-[13px] font-semibold shadow-soft">
          <Phone className="h-4 w-4 text-primary" /> Call
        </button>
      </section>

      <button
        disabled={!canComplete || completeMutation.isPending}
        onClick={() => completeMutation.mutate(rideRequest.id)}
        className="mt-4 w-full rounded-2xl bg-primary py-4 text-[14px] font-bold text-primary-foreground shadow-glow transition-transform active:scale-[0.98] disabled:opacity-60"
      >
        {completeMutation.isPending
          ? "Updating..."
          : canComplete
            ? "Mark ride completed"
            : status === "completed"
              ? "Ride completed"
              : status === "cancelled"
                ? "Ride cancelled"
                : "Action unavailable"}
      </button>
      <button
        disabled={!canCancel || cancelMutation.isPending}
        onClick={() => cancelMutation.mutate(rideRequest.id)}
        className="mt-2 w-full rounded-2xl bg-transparent py-3 text-[12px] font-semibold text-muted-foreground hover:text-destructive disabled:opacity-60"
      >
        {cancelMutation.isPending ? "Cancelling..." : "Cancel ride"}
      </button>
      <div className="h-10" />
    </PhoneFrame>
  );
}

function ThreePointMap({
  driver,
  pickup,
  dropoff,
}: {
  driver: [number, number] | null;
  pickup: [number, number] | null;
  dropoff: [number, number] | null;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const driverMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const pickupMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const dropoffMarkerRef = useRef<mapboxgl.Marker | null>(null);
  // Only draw routes AFTER the map has finished loading and its sources
  // have been added. Without this gate, the leg-drawing effect could fire
  // while the map was still loading, no-op on `getSource`, and the route
  // would silently never appear.
  const [mapReady, setMapReady] = useState(false);

  const routeKey = useMemo(() => {
    const d = driver ? `${driver[0]},${driver[1]}` : "-";
    const p = pickup ? `${pickup[0]},${pickup[1]}` : "-";
    const o = dropoff ? `${dropoff[0]},${dropoff[1]}` : "-";
    return `${d}|${p}|${o}`;
  }, [driver, pickup, dropoff]);

  const center: [number, number] =
    pickup || driver || dropoff || [-83.61, 41.66];

  useEffect(() => {
    if (!MAPBOX_PUBLIC_TOKEN || !containerRef.current) return;
    if (mapRef.current) return;

    mapboxgl.accessToken = MAPBOX_PUBLIC_TOKEN;
    mapRef.current = new mapboxgl.Map({
      container: containerRef.current,
      style: "mapbox://styles/mapbox/dark-v11",
      center,
      zoom: 12,
      attributionControl: false,
    });
    mapRef.current.on("load", () => {
      const m = mapRef.current;
      if (!m) return;
      // Segment 1: driver → pickup ("approach leg") — sky blue, dashed.
      m.addSource("route-pickup", {
        type: "geojson",
        data: {
          type: "Feature",
          properties: {},
          geometry: { type: "LineString", coordinates: [] },
        },
      });
      m.addLayer({
        id: "route-pickup-line",
        type: "line",
        source: "route-pickup",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": "#38bdf8",
          "line-width": 5,
          "line-opacity": 0.95,
          "line-dasharray": [1.5, 1.2],
        },
      });
      // Segment 2: pickup → dropoff ("trip leg") — warm orange, solid.
      m.addSource("route-trip", {
        type: "geojson",
        data: {
          type: "Feature",
          properties: {},
          geometry: { type: "LineString", coordinates: [] },
        },
      });
      m.addLayer({
        id: "route-trip-line",
        type: "line",
        source: "route-trip",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": "#fb923c", "line-width": 5, "line-opacity": 0.95 },
      });
      setMapReady(true);
    });

    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    // Markers (replace each time so we can drop stale ones safely).
    if (driver) {
      if (!driverMarkerRef.current) {
        const el = document.createElement("div");
        el.className =
          "flex h-6 w-6 items-center justify-center rounded-full bg-accent text-accent-foreground shadow-glow animate-pulse text-[10px] font-bold";
        el.textContent = "D";
        driverMarkerRef.current = new mapboxgl.Marker(el).setLngLat(driver).addTo(map);
      } else {
        driverMarkerRef.current.setLngLat(driver);
      }
    } else {
      driverMarkerRef.current?.remove();
      driverMarkerRef.current = null;
    }

    if (pickup) {
      if (!pickupMarkerRef.current) {
        const el = document.createElement("div");
        el.className = "h-3 w-3 rounded-full bg-white ring-4 ring-primary";
        pickupMarkerRef.current = new mapboxgl.Marker(el).setLngLat(pickup).addTo(map);
      } else {
        pickupMarkerRef.current.setLngLat(pickup);
      }
    }

    if (dropoff) {
      if (!dropoffMarkerRef.current) {
        const el = document.createElement("div");
        el.className = "h-3 w-3 rounded-sm bg-white ring-4 ring-accent";
        dropoffMarkerRef.current = new mapboxgl.Marker(el).setLngLat(dropoff).addTo(map);
      } else {
        dropoffMarkerRef.current.setLngLat(dropoff);
      }
    }

    // Draw the two route legs independently so each can have its own colour.
    const drawLeg = (
      sourceId: "route-pickup" | "route-trip",
      legWaypoints: [number, number][],
    ) => {
      fetchRoute(legWaypoints)
        .then((route) => {
          const source = mapRef.current?.getSource(sourceId) as
            | mapboxgl.GeoJSONSource
            | undefined;
          if (!source) return;
          source.setData({
            type: "Feature",
            properties: {},
            geometry: route
              ? route.geometry
              : { type: "LineString", coordinates: legWaypoints },
          });
        })
        .catch(() => null);
    };

    const clearLeg = (sourceId: "route-pickup" | "route-trip") => {
      const source = mapRef.current?.getSource(sourceId) as
        | mapboxgl.GeoJSONSource
        | undefined;
      source?.setData({
        type: "Feature",
        properties: {},
        geometry: { type: "LineString", coordinates: [] },
      });
    };

    if (driver && pickup) drawLeg("route-pickup", [driver, pickup]);
    else clearLeg("route-pickup");

    if (pickup && dropoff) drawLeg("route-trip", [pickup, dropoff]);
    else clearLeg("route-trip");

    const allWaypoints: [number, number][] = [];
    if (driver) allWaypoints.push(driver);
    if (pickup) allWaypoints.push(pickup);
    if (dropoff) allWaypoints.push(dropoff);
    if (allWaypoints.length < 2) return;

    const bounds = new mapboxgl.LngLatBounds();
    allWaypoints.forEach((w) => bounds.extend(w));
    map.fitBounds(bounds, { padding: 50, duration: 600, maxZoom: 14 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeKey, mapReady]);

  if (!MAPBOX_PUBLIC_TOKEN) {
    return (
      <div className="flex h-40 w-full items-center justify-center rounded-2xl bg-black/20 text-[12px] opacity-70">
        Set VITE_MAPBOX_PUBLIC_TOKEN to enable the live map.
      </div>
    );
  }

  return <div ref={containerRef} className="h-48 w-full overflow-hidden rounded-2xl" />;
}

function extractCoords(point: any): [number, number] | null {
  if (!point) return null;
  if (Array.isArray(point.coordinates) && point.coordinates.length >= 2) {
    return [Number(point.coordinates[0]), Number(point.coordinates[1])];
  }
  return null;
}

function prettyStatus(status: string): string {
  switch (status) {
    case "pending":
      return "Dispatching";
    case "accepted":
      return "Accepted";
    case "matched":
      return "Matched";
    case "completed":
      return "Done";
    case "cancelled":
      return "Cancelled";
    case "rejected":
      return "Declined";
    case "no_drivers_available":
      return "No drivers";
    case "pending_rider_confirm":
      return "Awaiting rider";
    default:
      return status;
  }
}
