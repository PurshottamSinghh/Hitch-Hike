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
    headers["Authorization"] = `Token ${token}`;
  }
  return headers;
}

/**
 * Authentication: Login
 */
export async function login(username, password) {
  const res = await fetch(`${API_BASE}/rides/auth/login/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.non_field_errors?.[0] || "Login failed");
  }

  const data = await res.json();
  localStorage.setItem("token", data.token);
  localStorage.setItem("user", JSON.stringify(data.user));
  return data;
}

/**
 * Authentication: Register
 */
export async function register(userData) {
  const res = await fetch(`${API_BASE}/rides/auth/register/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(userData),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(Object.values(err)[0]?.[0] || "Registration failed");
  }

  const data = await res.json();
  localStorage.setItem("token", data.token);
  localStorage.setItem("user", JSON.stringify(data.user));
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
  const res = await fetch(`${API_BASE}/rides/auth/profile/`, {
    headers: getAuthHeaders(),
  });

  if (!res.ok) throw new Error("Failed to fetch profile");
  return res.json();
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

  const res = await fetch(`${API_BASE}/rides/requests/`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Failed to create ride request (${res.status})`);
  }

  return res.json();
}

/**
 * Fetch ranked driver matches for a given RideRequest.
 *
 * @param {number} rideRequestId - The PK of the RideRequest
 * @returns {Promise<object>} { ride_request_id, matches: [...] }
 */
export async function fetchRankedMatches(rideRequestId) {
  const res = await fetch(`${API_BASE}/matching/rank/${rideRequestId}/`, {
    headers: getAuthHeaders(),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Failed to fetch matches (${res.status})`);
  }

  return res.json();
}

/**
 * Confirm a match between a RideOffer and a RideRequest.
 *
 * @param {number} rideOfferId
 * @param {number} rideRequestId
 * @returns {Promise<object>} The confirmed Ride object
 */
export async function confirmMatch(rideOfferId, rideRequestId) {
  const res = await fetch(`${API_BASE}/matching/confirm/`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({
      ride_offer_id: rideOfferId,
      ride_request_id: rideRequestId,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Failed to confirm match (${res.status})`);
  }

  return res.json();
}

/**
 * Fetch all active RideOffers (for displaying on map without matching).
 *
 * @returns {Promise<object[]>} List of RideOffer objects
 */
export async function fetchRideOffers() {
  const res = await fetch(`${API_BASE}/rides/offers/`, {
    headers: getAuthHeaders(),
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch offers (${res.status})`);
  }

  return res.json();
}

/**
 * Fetch all pending RideRequests.
 *
 * @returns {Promise<object[]>}
 */
export async function fetchPendingRequests() {
  const res = await fetch(`${API_BASE}/rides/requests/?status=pending`, {
    headers: getAuthHeaders(),
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch pending requests (${res.status})`);
  }

  const data = await res.json();
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
  const res = await fetch(`${API_BASE}/rides/requests/${requestId}/${action}/`, {
    method: "POST",
    headers: getAuthHeaders(),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Failed to ${action} request (${res.status})`);
  }

  return res.json();
}

/**
 * Complete a ride request.
 *
 * @param {number} requestId
 * @returns {Promise<object>}
 */
export async function completeRideRequest(requestId) {
  const res = await fetch(`${API_BASE}/rides/requests/${requestId}/complete/`, {
    method: "POST",
    headers: getAuthHeaders(),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Failed to complete ride (${res.status})`);
  }

  return res.json();
}

/**
 * Fetch a single RideRequest by ID.
 *
 * @param {number} id
 * @returns {Promise<object>}
 */
export async function fetchRideRequestById(id) {
  const res = await fetch(`${API_BASE}/rides/requests/${id}/`, {
    headers: getAuthHeaders(),
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch ride request (${res.status})`);
  }

  return res.json();
}
