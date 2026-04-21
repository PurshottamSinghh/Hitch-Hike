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
import { useState, useRef, useEffect } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

const TOKEN_KEY = "loop_mapbox_token";
const DEFAULT_MAPBOX_TOKEN =
  (import.meta.env.VITE_MAPBOX_PUBLIC_TOKEN as string | undefined) ||
  (import.meta.env.VITE_MAPBOX_TOKEN as string | undefined) ||
  "";

export const Route = createFileRoute("/ride/$rideId")({
  head: () => ({
    meta: [{ title: "Ride details — Hitch-Hike" }],
  }),
  component: RideDetail,
});

function RideDetail() {
  const { rideId } = Route.useParams();
  const queryClient = useQueryClient();
  const { data: offers = [], isLoading } = useQuery({
    queryKey: ["offers"],
    queryFn: api.fetchRideOffers,
    refetchInterval: 3000,
  });
  const { data: profile } = useQuery({
    queryKey: ["profile"],
    queryFn: api.fetchProfile,
  });
  const { data: rideRequest } = useQuery({
    queryKey: ["rideRequest", rideId],
    queryFn: () => api.fetchRideRequestById(rideId),
    retry: false,
  });
  const { data: offerRequests = [] } = useQuery({
    queryKey: ["offerRequests", rideId],
    queryFn: () => api.fetchOfferRequests(rideId),
    retry: false,
  });

  if (isLoading) {
    return (
      <PhoneFrame hideNav>
        <div className="flex p-4 text-muted-foreground">Loading ride...</div>
      </PhoneFrame>
    );
  }

  const rawRideById = offers.find((r: any) => r.id.toString() === rideId);
  const rawRideByAcceptedRequest =
    rideRequest?.ride_offer != null
      ? offers.find((r: any) => r.id.toString() === String(rideRequest.ride_offer))
      : null;
  const rideRequestFromOffer =
    !rideRequest && rawRideById
      ? offerRequests.find((r: any) => {
          const me = profile?.username;
          if (!me) return false;
          return (
            r.passenger_username === me ||
            r.driver_username === me ||
            (profile?.profile?.role === "driver" && r.status === "accepted")
          );
        }) || offerRequests[0]
      : null;
  const rawRide = rawRideById || rawRideByAcceptedRequest || offers[0];

  if (!rawRide) {
    return (
      <PhoneFrame hideNav>
        <div className="flex p-4 text-muted-foreground">Ride not found.</div>
      </PhoneFrame>
    );
  }

  const driverName = rawRide?.driver_username || rideRequest?.driver_username || "Driver";
  const driverInitials = driverName.substring(0, 2).toUpperCase();

  const lifecycleStatus = normalizeRideStatus(rideRequest?.status || rideRequestFromOffer?.status);
  const requestData = rideRequest || rideRequestFromOffer;
  const isAssignedDriver =
    profile?.username != null &&
    (requestData?.driver_username === profile.username || rawRide?.driver_username === profile.username);
  const isPassenger = profile?.username != null && requestData?.passenger_username === profile.username;
  const ride = {
    id: (rawRide?.id ?? rideRequest?.id ?? rideId).toString(),
    driver: {
      name: driverName,
      initials: driverInitials,
      rating: 5.0,
      major: "Driver",
    },
    origin: "Pickup",
    destination: "Destination",
    departAt: rawRide?.departure_time || rideRequest?.desired_time || new Date().toISOString(),
    durationMin: 15,
    seatsAvailable: rawRide?.available_seats ?? rideRequest?.seats_needed ?? 1,
    seatsTotal: rawRide?.available_seats ?? rideRequest?.seats_needed ?? 1,
    priceUsd: Number(rawRide?.price_per_seat ?? 0),
    status: lifecycleStatus,
    requestId: rideRequest?.id ?? rideRequestFromOffer?.id ?? null,
  };
  const canRequestOffer =
    profile?.profile?.role === "rider" &&
    ride.requestId == null &&
    rawRideById != null;

  const stages = [
    { id: "pending", label: "Requested" },
    { id: "confirmed", label: "Confirmed" },
    { id: "completed", label: "Completed" },
    { id: "cancelled", label: "Cancelled" },
  ] as const;
  const activeIdx = stages.findIndex((s) => s.id === ride.status);
  const canComplete =
    ride.requestId != null &&
    (isAssignedDriver || isPassenger) &&
    (ride.status === "confirmed" || ride.status === "pending");
  const canCancel =
    ride.requestId != null && isPassenger && (ride.status === "pending" || ride.status === "confirmed");
  const completeActionLabel = getCompleteActionLabel({
    hasRequest: ride.requestId != null,
    isAssignedDriver,
    isPassenger,
    status: ride.status,
  });

  const completeMutation = useMutation({
    mutationFn: (requestId: number) => api.completeRideRequest(requestId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["rideRequest", rideId] });
      await queryClient.invalidateQueries({ queryKey: ["offerRequests", rideId] });
      await queryClient.invalidateQueries({ queryKey: ["pendingRequests"] });
    },
  });
  const cancelMutation = useMutation({
    mutationFn: (requestId: number) => api.cancelRideRequest(requestId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["rideRequest", rideId] });
      await queryClient.invalidateQueries({ queryKey: ["offerRequests", rideId] });
      await queryClient.invalidateQueries({ queryKey: ["pendingRequests"] });
    },
  });
  const requestOfferMutation = useMutation({
    mutationFn: async () => {
      const pickup = extractCoords(rawRide?.origin) || [-83.61, 41.66];
      const dropoff = extractCoords(rawRide?.destination) || [-83.55, 41.66];
      return api.createRideRequest(
        { lng: pickup[0], lat: pickup[1] },
        { lng: dropoff[0], lat: dropoff[1] },
        {
          desiredTimeIso: rawRide?.departure_time,
          seatsNeeded: 1,
          rideOfferId: Number(rawRide.id),
          notes: "Requested directly from offered rides list.",
        },
      );
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["rideRequest", rideId] });
      await queryClient.invalidateQueries({ queryKey: ["offerRequests", rideId] });
      await queryClient.invalidateQueries({ queryKey: ["pendingRequests"] });
    },
  });

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

      {canRequestOffer && (
        <button
          onClick={() => requestOfferMutation.mutate()}
          disabled={requestOfferMutation.isPending}
          className="mt-3 w-full rounded-2xl bg-primary py-4 text-[14px] font-bold text-primary-foreground shadow-glow transition-transform active:scale-[0.98] disabled:opacity-60"
        >
          {requestOfferMutation.isPending ? "Sending request..." : "Request this ride"}
        </button>
      )}

      <button
        disabled={!canComplete || completeMutation.isPending}
        onClick={() => {
          if (ride.requestId) completeMutation.mutate(ride.requestId);
        }}
        className="mt-3 w-full rounded-2xl bg-primary py-4 text-[14px] font-bold text-primary-foreground shadow-glow transition-transform active:scale-[0.98] disabled:opacity-60"
      >
        {completeMutation.isPending
          ? "Updating..."
          : canComplete
            ? "Mark ride completed"
            : completeActionLabel}
      </button>
      <button
        disabled={!canCancel || cancelMutation.isPending}
        onClick={() => {
          if (ride.requestId) cancelMutation.mutate(ride.requestId);
        }}
        className="mt-2 w-full rounded-2xl bg-transparent py-3 text-[12px] font-semibold text-muted-foreground hover:text-destructive disabled:opacity-60"
      >
        {cancelMutation.isPending ? "Cancelling..." : "Cancel ride"}
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
    typeof window !== "undefined" ? localStorage.getItem(TOKEN_KEY) || DEFAULT_MAPBOX_TOKEN : "",
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
        Set VITE_MAPBOX_PUBLIC_TOKEN to enable live maps
      </div>
    );

  return <div ref={containerRef} className="h-40 w-full overflow-hidden rounded-2xl" />;
}

function normalizeRideStatus(raw?: string) {
  if (!raw) return "pending";
  if (raw === "accepted" || raw === "matched") return "confirmed";
  if (raw === "rejected" || raw === "cancelled") return "cancelled";
  if (raw === "completed") return "completed";
  return "pending";
}

function getCompleteActionLabel(params: {
  hasRequest: boolean;
  isAssignedDriver: boolean;
  isPassenger: boolean;
  status: string;
}) {
  if (!params.hasRequest) return "No rider request yet";
  if (params.status === "completed") return "Ride completed";
  if (params.status === "cancelled") return "Ride cancelled";
  if (params.isPassenger) return "Waiting for driver acceptance";
  if (!params.isAssignedDriver) return "Assigned driver can complete";
  return "Action unavailable";
}

function extractCoords(point: any): [number, number] | null {
  if (!point) return null;
  if (Array.isArray(point.coordinates) && point.coordinates.length >= 2) {
    return [Number(point.coordinates[0]), Number(point.coordinates[1])];
  }
  return null;
}
