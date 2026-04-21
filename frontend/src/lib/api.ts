/**
 * Hitch-Hike API Client
 *
 * Centralizes all frontend ↔ Django REST API communication.
 */

const API_BASE = "/api";

/**
 * Helper to get Token from localStorage and format headers.
 */
function getAuthHeaders(): Record<string, string> {
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  return headers;
}

/**
 * Unified Request Helper
 * Automatically handles Auth headers and 401 (Unauthorized) recovery.
 */
function summarizeHttpError(status: number, bodyText: string): string {
  if (
    bodyText &&
    bodyText.length > 0 &&
    bodyText.length < 400 &&
    !bodyText.trim().startsWith("<")
  ) {
    return bodyText.trim();
  }
  const djangoTitle = bodyText.match(/Exception Value:\s*([\s\S]*?)(?:\n\n|<\/)/);
  const integrity = bodyText.match(/IntegrityError[^\n]*/);
  if (integrity) return `Server error (${status}): ${integrity[0].slice(0, 200)}`;
  if (djangoTitle?.[1]) return `Server error (${status}): ${djangoTitle[1].trim().slice(0, 200)}`;
  if (status === 502 || status === 503)
    return `Cannot reach API (HTTP ${status}). Is Django running on port 8000?`;
  return `Request failed (HTTP ${status}). Check the Django terminal / docker logs for details.`;
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const headers = getAuthHeaders();
  const mergedOptions = {
    ...options,
    headers: {
      ...headers,
      ...options.headers,
    },
  };

  let res: Response;
  try {
    res = await fetch(`${API_BASE}${endpoint}`, mergedOptions);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(
      `Network error (${msg}). Start the backend (e.g. docker-compose up or runserver on port 8000).`,
    );
  }

  if (res.status === 401) {
    console.warn("🔒 Session expired or invalid. Redirecting to login...");
    logout();
    return Promise.reject("Unauthorized");
  }

  if (!res.ok) {
    const text = await res.text();
    let err: any = {};
    try {
      err = text ? JSON.parse(text) : {};
    } catch {
      // HTML error page or plain text
    }

    const firstFieldError =
      err && typeof err === "object"
        ? Object.values(err).find((value) => Array.isArray(value) && value.length > 0)
        : null;
    let fieldMessage =
      Array.isArray(firstFieldError) && typeof firstFieldError[0] === "string"
        ? firstFieldError[0]
        : null;
    if (!fieldMessage && Array.isArray(err?.non_field_errors) && err.non_field_errors[0]) {
      fieldMessage = String(err.non_field_errors[0]);
    }
    if (!fieldMessage && typeof err?.detail === "string") {
      fieldMessage = err.detail;
    }

    throw new Error(
      fieldMessage ||
        err.error ||
        summarizeHttpError(res.status, text) ||
        `Request failed (${res.status})`,
    );
  }

  // Handle empty responses
  if (res.status === 204) {
    return {} as T;
  }

  return res.json();
}

/** DRF pagination: `{ results: [...] }` or a bare array. */
function unwrapList<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data;
  if (
    data &&
    typeof data === "object" &&
    "results" in data &&
    Array.isArray((data as { results: unknown }).results)
  ) {
    return (data as { results: T[] }).results;
  }
  return [];
}

/**
 * Authentication: Login
 */
export async function login(username: string, password: string) {
  const data = await request<{ tokens: { access: string; refresh: string }; user: any }>(
    "/rides/auth/login/",
    {
      method: "POST",
      body: JSON.stringify({ username, password }),
    },
  );

  if (data && data.tokens) {
    localStorage.setItem("token", data.tokens.access);
    localStorage.setItem("user", JSON.stringify(data.user));
  }
  return data;
}

/**
 * Redirect browser to backend Microsoft OAuth start endpoint.
 */
export function beginMicrosoftAuth(nextPath = "/") {
  const safeNext = nextPath.startsWith("/") ? nextPath : "/";
  const target = `${API_BASE}/rides/auth/microsoft/start/?next=${encodeURIComponent(safeNext)}`;
  window.location.href = target;
}

/**
 * Hydrate local auth from URL hash after OAuth callback.
 */
export async function finishMicrosoftAuthFromUrl() {
  const hash = window.location.hash.startsWith("#")
    ? window.location.hash.slice(1)
    : window.location.hash;
  if (!hash) return { handled: false as const };

  const params = new URLSearchParams(hash);
  const access = params.get("access");
  const refresh = params.get("refresh");
  const oauthError = params.get("oauth_error");

  if (!access && !oauthError) return { handled: false as const };

  // Clean URL as early as possible.
  window.history.replaceState({}, document.title, window.location.pathname + window.location.search);

  if (oauthError) {
    return { handled: true as const, success: false as const, error: oauthError };
  }

  if (!access) {
    return { handled: true as const, success: false as const, error: "Missing access token." };
  }

  localStorage.setItem("token", access);
  if (refresh) localStorage.setItem("refresh_token", refresh);

  try {
    const user = await fetchProfile();
    localStorage.setItem("user", JSON.stringify(user));
    return { handled: true as const, success: true as const };
  } catch (err: any) {
    logout();
    return {
      handled: true as const,
      success: false as const,
      error: err?.message || "SSO login failed after callback.",
    };
  }
}

/**
 * Authentication: Register
 */
export async function register(userData: {
  username: string;
  email?: string;
  password?: string;
  role?: string;
  home_address?: string;
}) {
  const data = await request<{ tokens: { access: string; refresh: string }; user: any }>(
    "/rides/auth/register/",
    {
      method: "POST",
      body: JSON.stringify(userData),
    },
  );

  if (data && data.tokens) {
    localStorage.setItem("token", data.tokens.access);
    localStorage.setItem("user", JSON.stringify(data.user));
  }
  return data;
}

/**
 * Authentication: Logout
 */
export function logout() {
  localStorage.removeItem("token");
  localStorage.removeItem("refresh_token");
  localStorage.removeItem("user");
  window.location.href = "/";
}

/**
 * Fetch Current User Profile
 */
export async function fetchProfile() {
  return request<any>("/rides/auth/profile/");
}

/**
 * Update current user profile fields.
 */
export async function updateProfile(payload: {
  username?: string;
  email?: string;
  role?: "driver" | "rider";
  home_address?: string;
  phone_number?: string;
}) {
  const data = await request<any>("/rides/auth/profile/", {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
  localStorage.setItem("user", JSON.stringify(data));
  return data;
}

/**
 * Create a RideRequest in the database.
 */
export async function createRideRequest(
  pickup: { lng: number; lat: number },
  dropoff: { lng: number; lat: number },
  options?: {
    desiredTimeIso?: string;
    seatsNeeded?: number;
    rideOfferId?: number;
    notes?: string;
  },
) {
  const body = {
    pickup_location: {
      type: "Point",
      coordinates: [pickup.lng, pickup.lat],
    },
    dropoff_location: {
      type: "Point",
      coordinates: [dropoff.lng, dropoff.lat],
    },
    desired_time: options?.desiredTimeIso || new Date().toISOString(),
    seats_needed: options?.seatsNeeded || 1,
    ride_offer: options?.rideOfferId,
    notes: options?.notes || "",
  };

  return request<any>("/rides/requests/", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

/**
 * Create a RideOffer in the database.
 */
export async function createRideOffer(payload: {
  origin: { lng: number; lat: number };
  destination: { lng: number; lat: number };
  departureTimeIso: string;
  availableSeats: number;
  pricePerSeat?: number;
  notes?: string;
}) {
  const body = {
    origin: {
      type: "Point",
      coordinates: [payload.origin.lng, payload.origin.lat],
    },
    destination: {
      type: "Point",
      coordinates: [payload.destination.lng, payload.destination.lat],
    },
    departure_time: payload.departureTimeIso,
    available_seats: payload.availableSeats,
    price_per_seat: payload.pricePerSeat ?? 3.5,
    notes: payload.notes ?? "",
  };

  return request<any>("/rides/offers/", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

/**
 * Fetch ranked driver matches for a given RideRequest.
 */
export async function fetchRankedMatches(rideRequestId: number) {
  return request<any>(`/matching/rank/${rideRequestId}/`);
}

/**
 * Confirm a match between a RideOffer and a RideRequest.
 */
export async function confirmMatch(rideOfferId: number, rideRequestId: number) {
  return request<any>("/matching/confirm/", {
    method: "POST",
    body: JSON.stringify({
      ride_offer_id: rideOfferId,
      ride_request_id: rideRequestId,
    }),
  });
}

/**
 * Fetch all active RideOffers (for displaying on map without matching).
 */
export async function fetchRideOffers() {
  const data = await request<unknown>("/rides/offers/");
  return unwrapList(data);
}

/**
 * Fetch all pending RideRequests.
 */
export async function fetchPendingRequests() {
  const data = await request<any>("/rides/requests/?status=pending");
  return data.results || data;
}

export async function fetchOfferRequests(offerId: number | string) {
  const data = await request<unknown>(`/rides/offers/${offerId}/requests/`);
  return unwrapList<any>(data);
}

export async function fetchMyRideRequests() {
  const data = await request<any>("/rides/requests/");
  return data.results || data;
}

/**
 * Accept or Reject a ride request.
 */
export async function updateRequestStatus(requestId: number, action: "accept" | "reject") {
  return request<any>(`/rides/requests/${requestId}/${action}/`, {
    method: "POST",
  });
}

/**
 * Complete a ride request.
 */
export async function completeRideRequest(requestId: number) {
  return request<any>(`/rides/requests/${requestId}/complete/`, {
    method: "POST",
  });
}

export async function cancelRideRequest(requestId: number) {
  return request<any>(`/rides/requests/${requestId}/cancel/`, {
    method: "POST",
  });
}

/**
 * Fetch a single RideRequest by ID.
 */
export async function fetchRideRequestById(id: number | string) {
  return request<any>(`/rides/requests/${id}/`);
}

/**
 * Fetch Gamification Leaderboard
 */
export async function fetchLeaderboard() {
  const data = await request<unknown>("/gamification/leaderboard/");
  return unwrapList(data);
}

/**
 * Fetch Groups (Gamification)
 */
export async function fetchGroups() {
  const data = await request<unknown>("/gamification/groups/");
  return unwrapList(data);
}

export type ClassSchedule = {
  id: number;
  course_name: string;
  course_code: string;
  day_of_week: "mon" | "tue" | "wed" | "thu" | "fri";
  start_time: string;
  end_time: string;
  location: string;
};

export async function fetchClassSchedules() {
  const data = await request<unknown>("/rides/schedules/");
  return unwrapList<ClassSchedule>(data);
}

export async function createClassSchedule(payload: {
  course_name: string;
  course_code?: string;
  day_of_week: "mon" | "tue" | "wed" | "thu" | "fri";
  start_time: string;
  end_time: string;
  location?: string;
}) {
  return request<ClassSchedule>("/rides/schedules/", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function deleteClassSchedule(id: number) {
  return request<void>(`/rides/schedules/${id}/`, {
    method: "DELETE",
  });
}
