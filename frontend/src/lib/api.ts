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
 * Create a RideRequest in the database.
 */
export async function createRideRequest(
  pickup: { lng: number; lat: number },
  dropoff: { lng: number; lat: number },
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
    desired_time: new Date().toISOString(),
    seats_needed: 1,
  };

  return request<any>("/rides/requests/", {
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
