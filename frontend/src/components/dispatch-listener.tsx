import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { DispatchModal } from "@/components/dispatch-modal";
import {
  ProactiveMatchModal,
  type ProactiveMatchView,
} from "@/components/proactive-match-modal";
import {
  RiderConfirmModal,
  type RiderConfirmView,
} from "@/components/rider-confirm-modal";
import * as api from "@/lib/api";
import { getAuth } from "@/lib/auth-storage";

/**
 * Global "I'm a driver and someone needs me" listener.
 *
 * Mounted once inside the root layout. It polls the backend every 3s for:
 *   - `GET /rides/requests/my_dispatch/` — manual ride requests where this
 *     driver is in the 5-minute eligible list.
 *   - `GET /rides/proactive_matches/` — schedule-based suggestions (same
 *     weekday, same building, start-time within ±15 min). Drivers receive
 *     a pop-up for every "open" match; accepting turns it into a concrete
 *     RideRequest pending rider confirmation.
 *   - `GET /rides/requests/my_active_request/` (rider only) — surfaces
 *     driver-initiated offers (status ``pending_rider_confirm``) as a
 *     confirmation pop-up on the rider's side.
 *
 * Modals are mutually exclusive — the in-flight dispatch always wins, so a
 * driver mid-accept never sees a competing schedule suggestion.
 */
export function DispatchListener() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [dismissedId, setDismissedId] = useState<number | null>(null);
  const [dismissedMatchIds, setDismissedMatchIds] = useState<Set<number>>(
    () => new Set(),
  );
  const [pendingMatchId, setPendingMatchId] = useState<number | null>(null);
  const lastSeenRef = useRef<number | null>(null);

  const hasToken = !!getAuth("token");

  const { data: profile } = useQuery({
    queryKey: ["profile"],
    queryFn: api.fetchProfile,
    enabled: hasToken,
    staleTime: 60_000,
  });

  const isDriver = profile?.profile?.role === "driver";
  const isRider = profile?.profile?.role === "rider";
  const notifyEnabled = profile?.profile?.notify_on_ride_request !== false;

  const { data: dispatch } = useQuery<any>({
    queryKey: ["myDispatch"],
    queryFn: api.fetchMyDispatch,
    enabled: hasToken && isDriver && notifyEnabled,
    refetchInterval: 3000,
  });

  const { data: proactiveMatches } = useQuery<any[]>({
    queryKey: ["proactiveMatches"],
    queryFn: api.fetchProactiveMatches,
    enabled: hasToken && isDriver && notifyEnabled,
    refetchInterval: 5000,
  });

  // Rider side: poll their newest RideRequest so driver-initiated offers
  // (status "pending_rider_confirm") surface as a confirmation pop-up even
  // if the rider isn't currently on /create.
  const { data: myActiveRequest } = useQuery<any>({
    queryKey: ["myActiveRequest"],
    queryFn: api.fetchMyActiveRequest,
    enabled: hasToken && isRider,
    refetchInterval: 3000,
  });
  const [dismissedRiderConfirmIds, setDismissedRiderConfirmIds] = useState<
    Set<number>
  >(() => new Set());

  useEffect(() => {
    const incomingId = dispatch && dispatch.id ? dispatch.id : null;
    if (incomingId && incomingId !== lastSeenRef.current) {
      setDismissedId(null);
      lastSeenRef.current = incomingId;
    }
  }, [dispatch]);

  const hasDispatch = dispatch && dispatch.id;
  const showDispatchModal =
    hasDispatch && dispatch.id !== dismissedId && dispatch.status === "pending";

  // First "open" match that hasn't been dismissed this session and where the
  // logged-in user is the DRIVER side of the pair (rider-facing notifications
  // are handled separately by the rider's active-request polling).
  const activeMatch =
    !showDispatchModal &&
    Array.isArray(proactiveMatches) &&
    proactiveMatches.length > 0
      ? proactiveMatches.find(
          (m) =>
            m &&
            m.status === "open" &&
            m.driver_username === profile?.username &&
            !dismissedMatchIds.has(m.id),
        )
      : null;

  const matchView: ProactiveMatchView | null = activeMatch
    ? toMatchView(activeMatch)
    : null;

  const riderConfirmReq =
    isRider &&
    myActiveRequest &&
    myActiveRequest.id &&
    myActiveRequest.status === "pending_rider_confirm" &&
    !dismissedRiderConfirmIds.has(myActiveRequest.id)
      ? myActiveRequest
      : null;
  const riderConfirmView: RiderConfirmView | null = riderConfirmReq
    ? toRiderConfirmView(riderConfirmReq)
    : null;

  const offerMutation = {
    loading: pendingMatchId != null,
    run: async (matchId: number) => {
      setPendingMatchId(matchId);
      try {
        const result: any = await api.offerProactiveMatch(matchId);
        await queryClient.invalidateQueries({ queryKey: ["proactiveMatches"] });
        const rideRequestId = result?.ride_request?.id;
        if (rideRequestId) {
          navigate({ to: `/ride/${rideRequestId}` });
        }
      } finally {
        setPendingMatchId(null);
      }
    },
  };

  if (showDispatchModal) {
    const riderName: string = dispatch.passenger_username || "Rider";
    const rerouteSeconds: number | null =
      typeof dispatch.pickup_eta_seconds === "number"
        ? dispatch.pickup_eta_seconds
        : null;
    return (
      <DispatchModal
        isOpen={true}
        request={{
          id: dispatch.id,
          username: riderName,
          initials: riderName.substring(0, 2).toUpperCase(),
          pickupString:
            dispatch.pickup_address || formatLngLat(dispatch.pickup_location),
          dropoffString:
            dispatch.dropoff_address || formatLngLat(dispatch.dropoff_location),
          desiredTime: dispatch.desired_time,
          seatsNeeded: dispatch.seats_needed || 1,
          rerouteSeconds,
          rating: 5.0,
        }}
        onAccept={async (id) => {
          try {
            await api.updateRequestStatus(id, "accept");
          } finally {
            await queryClient.invalidateQueries({ queryKey: ["myDispatch"] });
            await queryClient.invalidateQueries({ queryKey: ["myRideRequests"] });
            navigate({ to: `/ride/${id}` });
          }
        }}
        onReject={async (id) => {
          try {
            await api.updateRequestStatus(id, "reject");
          } finally {
            await queryClient.invalidateQueries({ queryKey: ["myDispatch"] });
            setDismissedId(id);
          }
        }}
        onClose={() => setDismissedId(dispatch.id)}
      />
    );
  }

  if (matchView) {
    return (
      <ProactiveMatchModal
        isOpen={true}
        match={matchView}
        busy={offerMutation.loading}
        onOffer={(id) => void offerMutation.run(id)}
        onDecline={async (id) => {
          try {
            await api.declineProactiveMatch(id);
          } finally {
            await queryClient.invalidateQueries({
              queryKey: ["proactiveMatches"],
            });
            setDismissedMatchIds((prev) => new Set(prev).add(id));
          }
        }}
        onClose={() => {
          if (matchView.id != null)
            setDismissedMatchIds((prev) => new Set(prev).add(matchView.id));
        }}
      />
    );
  }

  if (riderConfirmView) {
    return (
      <RiderConfirmModal
        isOpen={true}
        request={riderConfirmView}
        onAccept={async (id) => {
          try {
            await api.updateRequestStatus(id, "accept");
          } finally {
            await queryClient.invalidateQueries({
              queryKey: ["myActiveRequest"],
            });
            await queryClient.invalidateQueries({
              queryKey: ["myRideRequests"],
            });
            navigate({ to: `/ride/${id}` });
          }
        }}
        onDecline={async (id) => {
          try {
            await api.updateRequestStatus(id, "reject");
          } finally {
            await queryClient.invalidateQueries({
              queryKey: ["myActiveRequest"],
            });
            setDismissedRiderConfirmIds((prev) => new Set(prev).add(id));
          }
        }}
        onClose={() => {
          if (riderConfirmView.id != null)
            setDismissedRiderConfirmIds((prev) =>
              new Set(prev).add(riderConfirmView.id),
            );
        }}
      />
    );
  }

  return null;
}

function formatLngLat(point: any): string {
  if (!point) return "Location";
  if (Array.isArray(point.coordinates) && point.coordinates.length >= 2) {
    const [lng, lat] = point.coordinates;
    return `${Number(lat).toFixed(3)}, ${Number(lng).toFixed(3)}`;
  }
  return "Location";
}

const DAY_LABELS: Record<string, string> = {
  mon: "Monday",
  tue: "Tuesday",
  wed: "Wednesday",
  thu: "Thursday",
  fri: "Friday",
};

function toRiderConfirmView(raw: any): RiderConfirmView {
  const driverName: string = raw.driver_username || "Driver";
  return {
    id: raw.id,
    driverName,
    driverInitials: driverName.substring(0, 2).toUpperCase(),
    pickupString: raw.pickup_address || formatLngLat(raw.pickup_location),
    dropoffString: raw.dropoff_address || formatLngLat(raw.dropoff_location),
    desiredTime: raw.desired_time,
    seatsNeeded: raw.seats_needed || 1,
    note: raw.notes || undefined,
  };
}

function toMatchView(raw: any): ProactiveMatchView {
  const riderName: string = raw.rider_username || "Rider";
  const rs = raw.rider_schedule_detail || {};
  const ds = raw.driver_schedule_detail || {};
  const buildingSlug = raw.building || rs.building || ds.building || "";
  const buildingLabel = buildingSlug
    ? String(buildingSlug)
        .split("_")
        .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : ""))
        .join(" ")
    : "Campus";
  return {
    id: raw.id,
    riderName,
    riderInitials: riderName.substring(0, 2).toUpperCase(),
    buildingLabel,
    dayLabel: DAY_LABELS[raw.day_of_week] || raw.day_of_week || "",
    riderStart: (rs.start_time || "").slice(0, 5),
    driverStart: (ds.start_time || "").slice(0, 5),
  };
}
