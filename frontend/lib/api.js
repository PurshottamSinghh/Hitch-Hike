/**
 * Hitch-Hike API Client
 *
 * Centralizes all frontend ↔ Django REST API communication.
 * In local dev, Next.js rewrites /api/** to http://localhost:8000/api/**
 * so we can avoid CORS entirely.
 */

const API_BASE = "/api";

/**
 * Helper to get Token from localStorage and format headers.
 */
function getAuthHeaders() {
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
  const headers = { "Content-Type": "application/json" };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  return headers;
}

/**
 * Unified Request Helper
 * Automatically handles Auth headers and 401 (Unauthorized) recovery.
 */
async function request(endpoint, options = {}) {
  const headers = getAuthHeaders();
  const mergedOptions = {
    ...options,
    headers: {
      ...headers,
      ...options.headers,
    },
  };

  const res = await fetch(`${API_BASE}${endpoint}`, mergedOptions);

  if (res.status === 401) {
    console.warn("🔒 Session expired or invalid. Redirecting to login...");
    logout();
    return;
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || err.error || `Request failed (${res.status})`);
  }

  return res.json();
}

/**
 * Authentication: Login
 */
export async function login(username, password) {
  const data = await request("/rides/auth/login/", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });

  if (data && data.tokens) {
    localStorage.setItem("token", data.tokens.access);
    localStorage.setItem("user", JSON.stringify(data.user));
  }
  return data;
}

/**
 * Authentication: Register
 */
export async function register(userData) {
  const data = await request("/rides/auth/register/", {
    method: "POST",
    body: JSON.stringify(userData),
  });

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
  window.location.href = "/login";
}

/**
 * Fetch Current User Profile
 */
export async function fetchProfile() {
  return request("/rides/auth/profile/");
}

/**
 * Create a RideRequest in the database.
 *
 * @param {{ lng: number, lat: number }} pickup - User's GPS-acquired location
 * @param {{ lng: number, lat: number }} dropoff - Destination coordinates
 * @returns {Promise<object>} The created RideRequest object (includes .id)
 */
export async function createRideRequest(pickup, dropoff) {
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

  return request("/rides/requests/", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

/**
 * Fetch ranked driver matches for a given RideRequest.
 *
 * @param {number} rideRequestId - The PK of the RideRequest
 * @returns {Promise<object>} { ride_request_id, matches: [...] }
 */
export async function fetchRankedMatches(rideRequestId) {
  return request(`/matching/rank/${rideRequestId}/`);
}

/**
 * Confirm a match between a RideOffer and a RideRequest.
 *
 * @param {number} rideOfferId
 * @param {number} rideRequestId
 * @returns {Promise<object>} The confirmed Ride object
 */
export async function confirmMatch(rideOfferId, rideRequestId) {
  return request("/matching/confirm/", {
    method: "POST",
    body: JSON.stringify({
      ride_offer_id: rideOfferId,
      ride_request_id: rideRequestId,
    }),
  });
}

/**
 * Fetch all active RideOffers (for displaying on map without matching).
 *
 * @returns {Promise<object[]>} List of RideOffer objects
 */
export async function fetchRideOffers() {
  return request("/rides/offers/");
}

/**
 * Fetch all pending RideRequests.
 *
 * @returns {Promise<object[]>}
 */
export async function fetchPendingRequests() {
  const data = await request("/rides/requests/?status=pending");
  return data.results || data;
}

/**
 * Accept or Reject a ride request.
 *
 * @param {number} requestId
 * @param {'accept' | 'reject'} action
 * @returns {Promise<object>}
 */
export async function updateRequestStatus(requestId, action) {
  return request(`/rides/requests/${requestId}/${action}/`, {
    method: "POST",
  });
}

/**
 * Complete a ride request.
 *
 * @param {number} requestId
 * @returns {Promise<object>}
 */
export async function completeRideRequest(requestId) {
  return request(`/rides/requests/${requestId}/complete/`, {
    method: "POST",
  });
}

/**
 * Fetch a single RideRequest by ID.
 *
 * @param {number} id
 * @returns {Promise<object>}
 */
export async function fetchRideRequestById(id) {
  return request(`/rides/requests/${id}/`);
}
