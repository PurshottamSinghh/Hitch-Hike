import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, Car, Clock, MapPin, Navigation, Radio, Search } from "lucide-react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PhoneFrame } from "@/components/app-shell";
import { BottomNav } from "@/components/bottom-nav";
import { cn } from "@/lib/utils";
import * as api from "@/lib/api";
import {
  MAPBOX_PUBLIC_TOKEN,
  geocodeSearch,
  reverseGeocode,
  type GeocodeResult,
} from "@/lib/mapbox";

export const Route = createFileRoute("/create")({
  head: () => ({
    meta: [{ title: "Find a ride — Hitch-Hike" }],
  }),
  component: Create,
});

const TOLEDO_CENTER: [number, number] = [-83.615, 41.66];

type Mode = "driver" | "rider";

function Create() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: rawProfile } = useQuery({
    queryKey: ["profile"],
    queryFn: api.fetchProfile,
  });
  const role: Mode =
    (rawProfile?.profile?.role as Mode | undefined) === "driver"
      ? "driver"
      : "rider";
  const [mode, setMode] = useState<Mode>(role);
  useEffect(() => {
    setMode(role);
  }, [role]);

  // Live location — both roles see their current position on the map.
  // Riders may override the pickup manually via the pickup search bar below.
  // Drivers keep their saved (profile.current_location) value and must opt-in
  // to replace it with the browser's GPS fix via the "Use my GPS" button.
  const [userLngLat, setUserLngLat] = useState<[number, number] | null>(null);
  const [locationStatus, setLocationStatus] = useState<
    "idle" | "locating" | "ready" | "denied" | "saved"
  >("idle");
  const [pickupLabel, setPickupLabel] = useState<string>("");
  const [customPickup, setCustomPickup] = useState<GeocodeResult | null>(null);

  // 1) Seed from the profile's saved location as soon as it loads.
  //    This is authoritative for drivers (seeded / manually-set locations) and
  //    a reasonable fallback for riders who've already saved a location.
  useEffect(() => {
    const saved = rawProfile?.profile?.current_location as
      | { lng: number; lat: number }
      | null
      | undefined;
    if (!saved || userLngLat) return;
    setUserLngLat([saved.lng, saved.lat]);
    setLocationStatus("saved");
    if (rawProfile?.profile?.home_address) {
      setPickupLabel(rawProfile.profile.home_address);
    }
  }, [rawProfile, userLngLat]);

  const requestLocation = (opts: { persist?: boolean } = {}) => {
    if (!("geolocation" in navigator)) {
      setLocationStatus("denied");
      return;
    }
    setLocationStatus("locating");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lngLat: [number, number] = [pos.coords.longitude, pos.coords.latitude];
        setUserLngLat(lngLat);
        setLocationStatus("ready");
        // Only persist when the user explicitly asked for it (e.g. the "Use my
        // GPS" button). This prevents the browser's (often inaccurate) fix
        // from silently overwriting seeded driver locations or a rider's
        // chosen pickup.
        if (opts.persist) {
          api
            .updateLocation({ lng: lngLat[0], lat: lngLat[1] })
            .then(() => queryClient.invalidateQueries({ queryKey: ["profile"] }))
            .catch(() => null);
        }
      },
      () => setLocationStatus("denied"),
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  };

  // 2) For riders without a saved location, fall back to the browser GPS
  //    (not persisted — pickup can still be manually overridden below).
  useEffect(() => {
    if (userLngLat) return;
    if (role !== "rider") return;
    if (!rawProfile) return;
    if (rawProfile.profile?.current_location) return;
    requestLocation({ persist: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rawProfile, role, userLngLat]);

  // Destination search (rider only; drivers don't build a ride anymore).
  const [destQuery, setDestQuery] = useState("");
  const [destResults, setDestResults] = useState<GeocodeResult[]>([]);
  const [dest, setDest] = useState<GeocodeResult | null>(null);

  // Rider pickup override (search to correct an inaccurate GPS fix).
  const [pickupQuery, setPickupQuery] = useState("");
  const [pickupResults, setPickupResults] = useState<GeocodeResult[]>([]);
  const [editingPickup, setEditingPickup] = useState(false);

  // Reverse-geocode the auto-detected pickup only when the user has NOT
  // already typed a custom pickup address.
  useEffect(() => {
    let cancelled = false;
    if (!userLngLat || customPickup) return;
    reverseGeocode(userLngLat).then((label) => {
      if (!cancelled && label) setPickupLabel(label);
    });
    return () => {
      cancelled = true;
    };
  }, [userLngLat, customPickup]);

  // Debounced geocode for the pickup override field.
  useEffect(() => {
    if (!editingPickup) return;
    if (!pickupQuery.trim()) {
      setPickupResults([]);
      return;
    }
    const handle = setTimeout(() => {
      geocodeSearch(pickupQuery, { proximity: userLngLat || TOLEDO_CENTER })
        .then(setPickupResults)
        .catch(() => setPickupResults([]));
    }, 200);
    return () => clearTimeout(handle);
  }, [pickupQuery, userLngLat, editingPickup]);

  // The effective pickup used for the ride request + map = manual override if
  // set, otherwise the current user coordinates.
  const pickupLngLat: [number, number] | null = customPickup
    ? [customPickup.center[0], customPickup.center[1]]
    : userLngLat;
  const displayPickupLabel = customPickup?.label || pickupLabel;

  useEffect(() => {
    if (!destQuery.trim() || dest?.label === destQuery) {
      setDestResults([]);
      return;
    }
    const handle = setTimeout(() => {
      geocodeSearch(destQuery, { proximity: pickupLngLat || TOLEDO_CENTER })
        .then(setDestResults)
        .catch(() => setDestResults([]));
    }, 200);
    return () => clearTimeout(handle);
  }, [destQuery, pickupLngLat, dest]);

  // Rider timing selection.
  const [timing, setTiming] = useState<"now" | "scheduled">("now");
  const [scheduledAt, setScheduledAt] = useState(() => {
    const d = new Date(Date.now() + 15 * 60 * 1000);
    return d.toISOString().slice(0, 16);
  });

  const canSubmit = mode === "rider" && !!pickupLngLat && !!dest;

  const createRequestMutation = useMutation({
    mutationFn: async () => {
      if (!pickupLngLat || !dest) throw new Error("Missing pickup or destination.");
      const desiredIso =
        timing === "scheduled" && scheduledAt
          ? new Date(scheduledAt).toISOString()
          : new Date().toISOString();
      return api.createRideRequest(
        { lng: pickupLngLat[0], lat: pickupLngLat[1] },
        { lng: dest.center[0], lat: dest.center[1] },
        {
          desiredTimeIso: desiredIso,
          seatsNeeded: 1,
          pickupAddress: displayPickupLabel || "Current location",
          dropoffAddress: dest.label,
        },
      );
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["myActiveRequest"] });
    },
  });

  // Polling for the rider's active request after submission.
  const activeRequestId = createRequestMutation.data?.id ?? null;
  const { data: activeRequest } = useQuery<any>({
    queryKey: ["myActiveRequest"],
    queryFn: api.fetchMyActiveRequest,
    enabled: !!activeRequestId,
    refetchInterval: 3000,
  });

  useEffect(() => {
    if (!activeRequest || !activeRequest.id) return;
    if (activeRequest.status === "accepted" || activeRequest.status === "matched") {
      navigate({ to: `/ride/${activeRequest.id}` });
    }
  }, [activeRequest, navigate]);

  const requestState = resolveRequestState(activeRequest);

  const onSelectDest = (r: GeocodeResult) => {
    setDest(r);
    setDestQuery(r.label);
    setDestResults([]);
  };

  return (
    <PhoneFrame hideNav>
      <BottomNav />

      {/* mode switch (honors stored role, but lets the user peek at the other flow) */}
      <header>
        <p className="text-[13px] font-semibold uppercase tracking-[0.2em] text-accent">
          {mode === "rider" ? "Need a ride" : "Driver standby"}
        </p>
        <div className="mt-2 grid grid-cols-2 gap-1 rounded-2xl border border-border bg-surface p-1 shadow-soft">
          {(["rider", "driver"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={cn(
                "rounded-xl px-3 py-2.5 text-[13px] font-semibold tracking-tight transition-all",
                mode === m
                  ? "bg-gradient-aurora text-primary-foreground shadow-glow"
                  : "text-muted-foreground",
              )}
            >
              {m === "rider" ? "I need a ride" : "I'm driving"}
            </button>
          ))}
        </div>
      </header>

      {/* Live map card — always on top for both roles. */}
      <section className="mt-4 overflow-hidden rounded-3xl border border-border bg-surface shadow-soft">
        <LiveMap
          center={pickupLngLat || TOLEDO_CENTER}
          me={pickupLngLat}
          dest={dest?.center || null}
        />
        <div className="flex items-center justify-between gap-2 px-4 py-3 text-[12px] text-muted-foreground">
          <span className="inline-flex items-start gap-1.5 truncate">
            <Navigation className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
            <span className="truncate">
              {locationStatus === "locating"
                ? "Finding your location…"
                : locationStatus === "denied"
                  ? "Location disabled — using Toledo default"
                  : locationStatus === "saved"
                    ? displayPickupLabel || "Saved location"
                    : displayPickupLabel || "Live location set"}
            </span>
          </span>
          <button
            onClick={() => requestLocation({ persist: mode === "driver" })}
            className="shrink-0 rounded-full border border-border px-2.5 py-1 text-[11px] font-semibold text-foreground hover:bg-muted"
          >
            {mode === "driver" ? "Use my GPS" : "Refresh"}
          </button>
        </div>
      </section>

      {mode === "rider" && (
        <>
          {/* Pickup override — useful when the browser GPS fix is wrong
              (common on desktop / VPN). Tap "Change" to search a real
              address; otherwise we use the detected live location. */}
          <section className="relative mt-4">
            <div className="flex items-center gap-2 rounded-2xl border border-border bg-surface px-3 py-3 shadow-soft">
              <div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary ring-4 ring-primary/20" />
              {editingPickup ? (
                <input
                  autoFocus
                  value={pickupQuery}
                  onChange={(e) => setPickupQuery(e.target.value)}
                  placeholder="Search pickup address…"
                  className="w-full bg-transparent text-[14px] outline-none"
                />
              ) : (
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Pickup
                  </p>
                  <p className="truncate text-[13px] font-medium text-foreground">
                    {displayPickupLabel || "Detecting location…"}
                  </p>
                </div>
              )}
              <button
                onClick={() => {
                  if (editingPickup) {
                    setEditingPickup(false);
                    setPickupQuery("");
                    setPickupResults([]);
                  } else {
                    setEditingPickup(true);
                    setPickupQuery("");
                  }
                }}
                className="shrink-0 rounded-full border border-border px-2.5 py-1 text-[11px] font-semibold text-foreground hover:bg-muted"
              >
                {editingPickup ? "Cancel" : customPickup ? "Change" : "Change"}
              </button>
            </div>
            {editingPickup && pickupResults.length > 0 && (
              <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-2xl border border-border bg-surface shadow-elevated">
                {pickupResults.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => {
                      setCustomPickup(r);
                      setPickupLabel(r.label);
                      setEditingPickup(false);
                      setPickupQuery("");
                      setPickupResults([]);
                    }}
                    className="flex w-full items-start gap-2 border-b border-border px-4 py-3 text-left text-[13px] last:border-b-0 hover:bg-muted"
                  >
                    <MapPin className="mt-0.5 h-4 w-4 text-primary" />
                    <span>
                      <span className="block font-semibold text-foreground">
                        {r.name}
                      </span>
                      <span className="block text-[11px] text-muted-foreground">
                        {r.label}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            )}
            {customPickup && !editingPickup && (
              <button
                onClick={() => {
                  setCustomPickup(null);
                  setPickupLabel("");
                }}
                className="mt-1 text-[11px] font-medium text-muted-foreground underline underline-offset-2 hover:text-foreground"
              >
                Use my live location instead
              </button>
            )}
          </section>

          <section className="relative mt-3">
            <div className="flex items-center gap-2 rounded-2xl border border-border bg-surface px-3 py-3 shadow-soft focus-within:border-primary">
              <Search className="h-4 w-4 text-muted-foreground" />
              <input
                value={destQuery}
                onChange={(e) => {
                  setDestQuery(e.target.value);
                  setDest(null);
                }}
                placeholder="Where to?"
                className="w-full bg-transparent text-[14px] outline-none"
              />
            </div>
            {destResults.length > 0 && !dest && (
              <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-2xl border border-border bg-surface shadow-elevated">
                {destResults.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => onSelectDest(r)}
                    className="flex w-full items-start gap-2 border-b border-border px-4 py-3 text-left text-[13px] last:border-b-0 hover:bg-muted"
                  >
                    <MapPin className="mt-0.5 h-4 w-4 text-primary" />
                    <span>
                      <span className="block font-semibold text-foreground">
                        {r.name}
                      </span>
                      <span className="block text-[11px] text-muted-foreground">
                        {r.label}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            )}
          </section>

          {dest && (
            <section className="mt-4 rounded-2xl border border-border bg-surface p-4 shadow-soft space-y-3">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                When?
              </p>
              <div className="grid grid-cols-2 gap-2">
                {(["now", "scheduled"] as const).map((opt) => (
                  <button
                    key={opt}
                    onClick={() => setTiming(opt)}
                    className={cn(
                      "rounded-xl border px-3 py-2.5 text-[13px] font-semibold transition-all",
                      timing === opt
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border text-foreground hover:border-border-strong",
                    )}
                  >
                    {opt === "now" ? "Leave now" : "Scheduled"}
                  </button>
                ))}
              </div>
              {timing === "scheduled" && (
                <div className="flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <input
                    type="datetime-local"
                    value={scheduledAt}
                    onChange={(e) => setScheduledAt(e.target.value)}
                    className="w-full bg-transparent text-[13px] outline-none"
                  />
                </div>
              )}
            </section>
          )}

          {activeRequestId ? (
            <RequestStatusCard state={requestState} request={activeRequest} />
          ) : (
            <button
              disabled={!canSubmit || createRequestMutation.isPending}
              onClick={() => createRequestMutation.mutate()}
              className={cn(
                "mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full py-4 text-[14px] font-semibold transition-all",
                canSubmit && !createRequestMutation.isPending
                  ? "bg-primary text-primary-foreground shadow-glow hover:scale-[1.01] active:scale-95"
                  : "bg-muted text-muted-foreground",
              )}
            >
              {createRequestMutation.isPending ? "Submitting…" : "Find a ride"}
              {!createRequestMutation.isPending && <ArrowRight className="h-4 w-4" />}
            </button>
          )}
          {createRequestMutation.error && (
            <p className="mt-2 text-[12px] text-destructive">
              {(createRequestMutation.error as Error).message}
            </p>
          )}
        </>
      )}

      {mode === "driver" && (
        <DriverStandby
          notify={rawProfile?.profile?.notify_on_ride_request !== false}
          currentLabel={pickupLabel}
          currentLngLat={userLngLat}
          onToggle={async (next) => {
            await api.updateProfile({ notify_on_ride_request: next });
            await queryClient.invalidateQueries({ queryKey: ["profile"] });
          }}
          onSetManualLocation={async (result) => {
            await api.updateLocation({
              lng: result.center[0],
              lat: result.center[1],
            });
            setUserLngLat([result.center[0], result.center[1]]);
            setPickupLabel(result.label);
            setLocationStatus("saved");
            await queryClient.invalidateQueries({ queryKey: ["profile"] });
          }}
        />
      )}
    </PhoneFrame>
  );
}

function LiveMap({
  center,
  me,
  dest,
}: {
  center: [number, number];
  me: [number, number] | null;
  dest: [number, number] | null;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const meMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const destMarkerRef = useRef<mapboxgl.Marker | null>(null);

  useEffect(() => {
    if (!containerRef.current || !MAPBOX_PUBLIC_TOKEN) return;
    mapboxgl.accessToken = MAPBOX_PUBLIC_TOKEN;
    if (!mapRef.current) {
      mapRef.current = new mapboxgl.Map({
        container: containerRef.current,
        style: "mapbox://styles/mapbox/streets-v12",
        center,
        zoom: 13,
        attributionControl: false,
      });
    }
    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !me) return;
    map.easeTo({ center: me, duration: 400 });
    if (!meMarkerRef.current) {
      const el = document.createElement("div");
      el.className =
        "h-3.5 w-3.5 rounded-full bg-primary ring-4 ring-primary/25 shadow-glow";
      meMarkerRef.current = new mapboxgl.Marker(el).setLngLat(me).addTo(map);
    } else {
      meMarkerRef.current.setLngLat(me);
    }
  }, [me]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!dest) {
      destMarkerRef.current?.remove();
      destMarkerRef.current = null;
      return;
    }
    if (!destMarkerRef.current) {
      const el = document.createElement("div");
      el.className =
        "h-3.5 w-3.5 rounded-sm bg-accent ring-4 ring-accent/25 shadow-glow";
      destMarkerRef.current = new mapboxgl.Marker(el).setLngLat(dest).addTo(map);
    } else {
      destMarkerRef.current.setLngLat(dest);
    }
    if (me) {
      const bounds = new mapboxgl.LngLatBounds().extend(me).extend(dest);
      map.fitBounds(bounds, { padding: 60, duration: 500, maxZoom: 14 });
    } else {
      map.easeTo({ center: dest, duration: 400 });
    }
  }, [dest, me]);

  if (!MAPBOX_PUBLIC_TOKEN) {
    return (
      <div className="flex h-56 w-full items-center justify-center bg-muted text-[12px] text-muted-foreground">
        Set VITE_MAPBOX_PUBLIC_TOKEN to enable the live map.
      </div>
    );
  }

  return <div ref={containerRef} className="h-56 w-full" />;
}

function DriverStandby({
  notify,
  currentLabel,
  currentLngLat,
  onToggle,
  onSetManualLocation,
}: {
  notify: boolean;
  currentLabel: string;
  currentLngLat: [number, number] | null;
  onToggle: (next: boolean) => void | Promise<void>;
  onSetManualLocation: (result: GeocodeResult) => void | Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GeocodeResult[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!editing) return;
    if (!query.trim()) {
      setResults([]);
      return;
    }
    const handle = setTimeout(() => {
      geocodeSearch(query, { proximity: currentLngLat || TOLEDO_CENTER })
        .then(setResults)
        .catch(() => setResults([]));
    }, 200);
    return () => clearTimeout(handle);
  }, [query, editing, currentLngLat]);

  const handlePick = async (r: GeocodeResult) => {
    setSaving(true);
    setError(null);
    try {
      await onSetManualLocation(r);
      setEditing(false);
      setQuery("");
      setResults([]);
    } catch (err) {
      setError((err as Error).message || "Couldn't save that location.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="mt-4 space-y-3">
      <div className="rounded-3xl border border-border bg-gradient-card p-5 shadow-soft">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Car className="h-5 w-5" />
          </span>
          <div>
            <p className="text-[15px] font-bold tracking-tight text-foreground">
              You're on standby
            </p>
            <p className="mt-1 text-[12px] text-muted-foreground">
              Drivers don't create rides anymore. As long as notifications are
              on, any rider within a 5-minute pickup radius of your location can
              ping you — you'll see the request on this screen.
            </p>
          </div>
        </div>
      </div>

      {/* Manual driver location editor */}
      <div className="relative rounded-2xl border border-border bg-surface p-4 shadow-soft">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <MapPin className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-semibold text-foreground">
              My driver location
            </p>
            <p className="truncate text-[12px] text-muted-foreground">
              {currentLabel || "No location set yet"}
            </p>
          </div>
          <button
            onClick={() => {
              setEditing((e) => !e);
              setQuery("");
              setResults([]);
              setError(null);
            }}
            className="shrink-0 rounded-full border border-border px-2.5 py-1 text-[11px] font-semibold text-foreground hover:bg-muted"
          >
            {editing ? "Cancel" : "Change"}
          </button>
        </div>

        {editing && (
          <div className="mt-3 space-y-2">
            <div className="flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2.5 focus-within:border-primary">
              <Search className="h-4 w-4 text-muted-foreground" />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search an address to set as your location…"
                className="w-full bg-transparent text-[13px] outline-none"
              />
            </div>
            {results.length > 0 && (
              <div className="overflow-hidden rounded-xl border border-border bg-surface">
                {results.map((r) => (
                  <button
                    key={r.id}
                    disabled={saving}
                    onClick={() => handlePick(r)}
                    className="flex w-full items-start gap-2 border-b border-border px-3 py-2.5 text-left text-[13px] last:border-b-0 hover:bg-muted disabled:opacity-50"
                  >
                    <MapPin className="mt-0.5 h-4 w-4 text-primary" />
                    <span>
                      <span className="block font-semibold text-foreground">
                        {r.name}
                      </span>
                      <span className="block text-[11px] text-muted-foreground">
                        {r.label}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            )}
            <p className="text-[11px] text-muted-foreground">
              Saving a location here becomes your pinned driver location. The
              app won't overwrite it with browser GPS unless you tap "Use my
              GPS" on the map above.
            </p>
            {error && (
              <p className="text-[11px] font-semibold text-destructive">
                {error}
              </p>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between rounded-2xl border border-border bg-surface p-4 shadow-soft">
        <div>
          <p className="text-[13px] font-semibold text-foreground">
            Notify me when someone needs a ride
          </p>
          <p className="text-[11px] text-muted-foreground">
            Off = your phone stays silent, but you stay in the driver pool for
            class-schedule matches.
          </p>
        </div>
        <button
          onClick={() => onToggle(!notify)}
          className={cn(
            "relative h-6 w-11 rounded-full transition-colors",
            notify ? "bg-primary" : "bg-border",
          )}
        >
          <span
            className={cn(
              "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all",
              notify ? "left-5" : "left-0.5",
            )}
          />
        </button>
      </div>

      <div className="rounded-2xl border border-dashed border-border p-4 text-[12px] text-muted-foreground">
        <p className="flex items-center gap-1.5 font-semibold text-foreground">
          <Radio className="h-3.5 w-3.5 text-primary" /> Listening for rides…
        </p>
        <p className="mt-1">
          Keep this tab open. When a nearby rider requests, a pop-up appears
          anywhere in the app with their pickup, dropoff, and reroute ETA.
        </p>
      </div>
    </section>
  );
}

type RequestState =
  | { kind: "requesting" }
  | { kind: "accepted"; driver: string }
  | { kind: "no_drivers" }
  | { kind: "cancelled" }
  | { kind: "unknown"; status: string };

function resolveRequestState(req: any | undefined): RequestState {
  if (!req || !req.id) return { kind: "requesting" };
  if (req.status === "pending") return { kind: "requesting" };
  if (req.status === "accepted" || req.status === "matched")
    return { kind: "accepted", driver: req.driver_username || "Driver" };
  if (req.status === "no_drivers_available") return { kind: "no_drivers" };
  if (req.status === "cancelled" || req.status === "rejected")
    return { kind: "cancelled" };
  return { kind: "unknown", status: req.status };
}

function RequestStatusCard({
  state,
  request,
}: {
  state: RequestState;
  request: any | undefined;
}) {
  // Best-case pickup ETA: the smallest driver→pickup travel time across
  // every eligible driver the dispatcher fanned this request out to.
  // `pickup_eta_seconds` is a `{ driver_id -> seconds }` dict populated at
  // dispatch time (see rides/views.py::perform_create).
  const eligibleIds: number[] = Array.isArray(request?.eligible_driver_ids)
    ? request.eligible_driver_ids
    : [];
  const etaDict: Record<string, number> | null =
    request && typeof request.pickup_eta_seconds === "object"
      ? (request.pickup_eta_seconds as Record<string, number>)
      : null;
  const pendingEtaSec: number | null = (() => {
    if (!etaDict || eligibleIds.length === 0) return null;
    const vals = eligibleIds
      .map((id) => Number(etaDict[String(id)]))
      .filter((n) => Number.isFinite(n) && n > 0);
    return vals.length > 0 ? Math.min(...vals) : null;
  })();
  // Accepted pickup ETA: the assigned driver's travel time to pickup.
  const acceptedEtaSec: number | null = (() => {
    if (!etaDict || request?.driver == null) return null;
    const raw = Number(etaDict[String(request.driver)]);
    return Number.isFinite(raw) && raw > 0 ? raw : null;
  })();
  const toMin = (sec: number) => Math.max(1, Math.round(sec / 60));

  if (state.kind === "requesting") {
    return (
      <div className="mt-4 overflow-hidden rounded-3xl bg-gradient-aurora p-5 text-primary-foreground shadow-glow">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/15">
            <Radio className="h-5 w-5 animate-pulse" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-semibold uppercase tracking-wider opacity-80">
              Dispatching
            </p>
            <p className="text-[16px] font-bold">Requesting nearby drivers…</p>
          </div>
        </div>
        {pendingEtaSec != null && (
          <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1.5 text-[12px] font-semibold">
            Closest driver ~{toMin(pendingEtaSec)} min away
          </div>
        )}
        <div className="mt-4 flex h-1 overflow-hidden rounded-full bg-white/15">
          <span className="animate-pulse block h-full w-full bg-white/70" />
        </div>
      </div>
    );
  }
  if (state.kind === "accepted") {
    return (
      <div className="mt-4 rounded-2xl border border-success/30 bg-success/10 p-4 text-[13px] font-semibold text-success">
        {state.driver} accepted your ride
        {acceptedEtaSec != null
          ? ` · picking you up in ~${toMin(acceptedEtaSec)} min`
          : ""}
        . Opening active ride…
      </div>
    );
  }
  if (state.kind === "no_drivers") {
    return (
      <div className="mt-4 rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-[13px] font-semibold text-destructive">
        No drivers are within 5 minutes of your pickup right now. Try scheduling
        a ride or check back shortly.
      </div>
    );
  }
  if (state.kind === "cancelled") {
    return (
      <div className="mt-4 rounded-2xl border border-border bg-muted p-4 text-[13px] font-semibold text-muted-foreground">
        Ride cancelled.
      </div>
    );
  }
  return (
    <div className="mt-4 rounded-2xl border border-border bg-muted p-4 text-[13px] font-semibold text-muted-foreground">
      Status: {state.status}
    </div>
  );
}
