"""
Comprehensive test suite for the Ride Matching & Coordination app.

This module covers:
  • **Unit Tests** — Testing the ``MatchingEngine`` class directly
    (confirm_match status transitions, ACID double-booking prevention,
    ranking algorithm).
  • **String / Interface Tests** — Testing the REST API endpoints via
    DRF's ``APITestCase`` (valid confirm, invalid payloads, ranking
    endpoint).

All Mapbox API calls are mocked with ``unittest.mock.patch`` so the
tests run locally without network access or API-key consumption.

Run with:
    python manage.py test matching --settings=hitchhike.test_settings
"""

from datetime import timedelta
from unittest.mock import patch

from django.test import TestCase
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from matching.models import Ride
from matching.services import MatchingEngine, MatchingError
from users.models import User
from rides.models import RideOffer, RideRequest


# ═══════════════════════════════════════════════════════════════════════════
#  Shared helpers
# ═══════════════════════════════════════════════════════════════════════════

def _mock_matrix_response(durations):
    """
    Build a fake Mapbox Matrix API response dict.

    Parameters
    ----------
    durations : list[list[float]]
        The N×N matrix of travel times in seconds.
    """
    return {
        "code": "Ok",
        "durations": durations,
    }


# 2×2 matrix: origin → destination = 600 s (10 min)
ORIGINAL_MATRIX = _mock_matrix_response([
    [0.0, 600.0],
    [600.0, 0.0],
])

# 4×4 matrix: origin → pickup → dropoff → destination
# origin→pickup = 200, pickup→dropoff = 300, dropoff→dest = 250
# Total detoured = 200 + 300 + 250 = 750 s  →  extra = 750 − 600 = 150 s
DETOUR_MATRIX = _mock_matrix_response([
    [0.0,   200.0, 400.0, 750.0],
    [200.0, 0.0,   300.0, 550.0],
    [400.0, 300.0, 0.0,   250.0],
    [750.0, 550.0, 250.0, 0.0],
])

# Pre-computed score result matching ORIGINAL_MATRIX + DETOUR_MATRIX
# extra_seconds = (200 + 300 + 250) − 600 = 150
MOCK_DETOUR_SCORE = {
    "original_duration": 600.0,
    "detoured_duration": 750.0,
    "extra_seconds": 150.0,
}


class _BaseTestMixin:
    """
    Shared ``setUp`` that creates dummy User, RideOffer, and RideRequest
    records so every test class starts from a consistent, isolated state.

    Note: PointField values are stored as plain strings in the test DB
    (SQLite) because GDAL is not installed locally. The ``_compute_detour``
    method is mocked in tests that need coordinate access.
    """

    def _create_test_data(self):
        """Populate the in-memory test database with sample data."""

        # --- Users -------------------------------------------------------
        self.driver = User.objects.create_user(
            username="driver_alice",
            password="testpass123",
            first_name="Alice",
            last_name="Smith",
        )
        self.rider = User.objects.create_user(
            username="rider_bob",
            password="testpass123",
            first_name="Bob",
            last_name="Jones",
        )

        # --- RideOffer (driver has 2 available seats) --------------------
        now = timezone.now() + timedelta(hours=1)
        self.ride_offer = RideOffer.objects.create(
            driver=self.driver,
            origin="POINT(-81.6944 41.4993)",       # Cleveland
            destination="POINT(-81.6785 41.5085)",   # CSU campus
            departure_time=now,
            available_seats=2,
            is_active=True,
        )

        # --- RideOffer with only 1 seat (for edge-case tests) ------------
        self.ride_offer_one_seat = RideOffer.objects.create(
            driver=self.driver,
            origin="POINT(-81.7000 41.5000)",
            destination="POINT(-81.6800 41.5100)",
            departure_time=now,
            available_seats=1,
            is_active=True,
        )

        # --- RideRequests ------------------------------------------------
        self.ride_request = RideRequest.objects.create(
            passenger=self.rider,
            pickup_location="POINT(-81.6900 41.5010)",
            dropoff_location="POINT(-81.6800 41.5060)",
            desired_time=now,
            status="pending",
        )
        self.ride_request_2 = RideRequest.objects.create(
            passenger=self.rider,
            pickup_location="POINT(-81.6910 41.5020)",
            dropoff_location="POINT(-81.6810 41.5070)",
            desired_time=now,
            status="pending",
        )


# ═══════════════════════════════════════════════════════════════════════════
#  UNIT TESTS — Testing the MatchingEngine class directly
# ═══════════════════════════════════════════════════════════════════════════

class TestConfirmMatchStatusTransition(_BaseTestMixin, TestCase):
    """
    Unit Test 1: Prove that ``confirm_match`` transitions a Ride's status
    from ``'pending'`` to ``'confirmed'``.
    """

    def setUp(self):
        self._create_test_data()

    @patch.object(MatchingEngine, "_compute_detour", return_value=MOCK_DETOUR_SCORE)
    def test_status_changes_to_confirmed(self, mock_detour):
        """
        After calling ``confirm_match``, the resulting Ride object
        must have ``status == 'confirmed'``.
        """
        engine = MatchingEngine()

        # Act
        ride = engine.confirm_match(
            ride_offer_id=self.ride_offer.pk,
            ride_request_id=self.ride_request.pk,
        )

        # Assert — status transitioned
        self.assertEqual(ride.status, "confirmed")

        # Assert — Ride is persisted in the database with correct status
        ride_from_db = Ride.objects.get(pk=ride.pk)
        self.assertEqual(ride_from_db.status, "confirmed")

    @patch.object(MatchingEngine, "_compute_detour", return_value=MOCK_DETOUR_SCORE)
    def test_seat_count_decremented(self, mock_detour):
        """
        After confirming a match, the RideOffer's ``available_seats``
        must decrease by 1.
        """
        engine = MatchingEngine()
        original_seats = self.ride_offer.available_seats

        engine.confirm_match(
            ride_offer_id=self.ride_offer.pk,
            ride_request_id=self.ride_request.pk,
        )

        self.ride_offer.refresh_from_db()
        self.assertEqual(
            self.ride_offer.available_seats,
            original_seats - 1,
        )

    @patch.object(MatchingEngine, "_compute_detour", return_value=MOCK_DETOUR_SCORE)
    def test_ride_request_status_set_to_matched(self, mock_detour):
        """
        The confirmed RideRequest's status must be set to ``'matched'``.
        """
        engine = MatchingEngine()

        engine.confirm_match(
            ride_offer_id=self.ride_offer.pk,
            ride_request_id=self.ride_request.pk,
        )

        self.ride_request.refresh_from_db()
        self.assertEqual(self.ride_request.status, "matched")

    @patch.object(MatchingEngine, "_compute_detour", return_value=MOCK_DETOUR_SCORE)
    def test_detour_time_is_recorded(self, mock_detour):
        """
        The Ride's ``total_detour_time`` should reflect the computed
        detour from the mocked data (150 seconds).
        """
        engine = MatchingEngine()

        ride = engine.confirm_match(
            ride_offer_id=self.ride_offer.pk,
            ride_request_id=self.ride_request.pk,
        )

        # extra_seconds = (200 + 300 + 250) − 600 = 150
        self.assertEqual(ride.total_detour_time, 150)


class TestConfirmMatchACIDCompliance(_BaseTestMixin, TestCase):
    """
    Unit Test 2: Prove ACID compliance — ``confirm_match`` must prevent
    double-booking by raising ``MatchingError`` when seats are exhausted
    or a RideRequest has already been matched.
    """

    def setUp(self):
        self._create_test_data()

    @patch.object(MatchingEngine, "_compute_detour", return_value=MOCK_DETOUR_SCORE)
    def test_double_booking_prevented_no_seats(self, mock_detour):
        """
        If all seats on a RideOffer are taken, a subsequent
        ``confirm_match`` call MUST raise ``MatchingError``.
        This proves the ``select_for_update()`` + seat check works.
        """
        engine = MatchingEngine()

        # First confirmation — should succeed (uses the 1-seat offer)
        engine.confirm_match(
            ride_offer_id=self.ride_offer_one_seat.pk,
            ride_request_id=self.ride_request.pk,
        )

        # Verify offer is now full
        self.ride_offer_one_seat.refresh_from_db()
        self.assertEqual(self.ride_offer_one_seat.available_seats, 0)
        self.assertFalse(self.ride_offer_one_seat.is_active)

        # Second confirmation — should FAIL (no seats left)
        with self.assertRaises(MatchingError) as ctx:
            engine.confirm_match(
                ride_offer_id=self.ride_offer_one_seat.pk,
                ride_request_id=self.ride_request_2.pk,
            )

        self.assertIn("no available seats", str(ctx.exception))

    @patch.object(MatchingEngine, "_compute_detour", return_value=MOCK_DETOUR_SCORE)
    def test_double_booking_prevented_already_matched_request(self, mock_detour):
        """
        If a RideRequest has already been matched, attempting to match
        it again MUST raise ``MatchingError``.
        """
        engine = MatchingEngine()

        # First confirmation — sets ride_request.status to "matched"
        engine.confirm_match(
            ride_offer_id=self.ride_offer.pk,
            ride_request_id=self.ride_request.pk,
        )

        # Second confirmation with the SAME request — should FAIL
        with self.assertRaises(MatchingError) as ctx:
            engine.confirm_match(
                ride_offer_id=self.ride_offer.pk,
                ride_request_id=self.ride_request.pk,
            )

        self.assertIn("already matched", str(ctx.exception))

    @patch.object(MatchingEngine, "_compute_detour", return_value=MOCK_DETOUR_SCORE)
    def test_nonexistent_offer_raises_error(self, mock_detour):
        """
        Confirming with a non-existent RideOffer ID must raise
        ``MatchingError``.
        """
        engine = MatchingEngine()

        with self.assertRaises(MatchingError) as ctx:
            engine.confirm_match(
                ride_offer_id=99999,
                ride_request_id=self.ride_request.pk,
            )

        self.assertIn("does not exist", str(ctx.exception))

    @patch.object(MatchingEngine, "_compute_detour", return_value=MOCK_DETOUR_SCORE)
    def test_nonexistent_request_raises_error(self, mock_detour):
        """
        Confirming with a non-existent RideRequest ID must raise
        ``MatchingError``.
        """
        engine = MatchingEngine()

        with self.assertRaises(MatchingError) as ctx:
            engine.confirm_match(
                ride_offer_id=self.ride_offer.pk,
                ride_request_id=99999,
            )

        self.assertIn("does not exist", str(ctx.exception))


class TestRankBestMatches(_BaseTestMixin, TestCase):
    """
    Unit Test 3: Verify that ``rank_best_matches`` returns correctly
    ordered results and handles edge cases.
    """

    def setUp(self):
        self._create_test_data()

    @patch.object(MatchingEngine, "_compute_detour", return_value=MOCK_DETOUR_SCORE)
    def test_returns_ranked_results(self, mock_detour):
        """
        The ranking method must return a list sorted by ``extra_seconds``
        in ascending order.
        """
        engine = MatchingEngine()

        results = engine.rank_best_matches(self.ride_request.pk)

        self.assertIsInstance(results, list)
        self.assertGreater(len(results), 0)

        # Verify sorted ascending by extra_seconds
        extras = [r["extra_seconds"] for r in results]
        self.assertEqual(extras, sorted(extras))

    @patch.object(MatchingEngine, "_compute_detour", return_value=MOCK_DETOUR_SCORE)
    def test_result_fields_present(self, mock_detour):
        """
        Each result dict must contain all expected keys.
        """
        engine = MatchingEngine()

        results = engine.rank_best_matches(self.ride_request.pk)

        expected_keys = {
            "ride_offer_id",
            "driver_name",
            "departure_time",
            "available_seats",
            "original_duration",
            "detoured_duration",
            "extra_seconds",
        }
        for result in results:
            self.assertEqual(set(result.keys()), expected_keys)

    def test_nonexistent_request_raises_error(self):
        """
        Ranking for a non-existent RideRequest must raise MatchingError.
        """
        engine = MatchingEngine()

        with self.assertRaises(MatchingError):
            engine.rank_best_matches(ride_request_id=99999)

    @patch.object(MatchingEngine, "_compute_detour", return_value=MOCK_DETOUR_SCORE)
    def test_already_matched_request_raises_error(self, mock_detour):
        """
        Ranking for a RideRequest that is already matched must raise
        MatchingError.
        """
        self.ride_request.status = "matched"
        self.ride_request.save()

        engine = MatchingEngine()

        with self.assertRaises(MatchingError) as ctx:
            engine.rank_best_matches(self.ride_request.pk)

        self.assertIn("already been matched", str(ctx.exception))


# ═══════════════════════════════════════════════════════════════════════════
#  STRING / INTERFACE TESTS — Testing the REST API endpoints
# ═══════════════════════════════════════════════════════════════════════════

class TestConfirmMatchEndpoint(_BaseTestMixin, APITestCase):
    """
    Interface Test 1: Exercise the ``POST /api/matching/confirm/``
    endpoint with valid and invalid payloads.
    """

    def setUp(self):
        self._create_test_data()

    @patch.object(MatchingEngine, "_compute_detour", return_value=MOCK_DETOUR_SCORE)
    def test_valid_confirm_returns_201(self, mock_detour):
        """
        A valid JSON payload with existing ``ride_offer_id`` and
        ``ride_request_id`` must return HTTP 201 CREATED and include
        the confirmed Ride in the response body.
        """
        url = reverse("matching:confirm-match")
        payload = {
            "ride_offer_id": self.ride_offer.pk,
            "ride_request_id": self.ride_request.pk,
        }

        response = self.client.post(url, data=payload, format="json")

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["status"], "confirmed")
        self.assertIn("id", response.data)
        self.assertIn("ride_offer_detail", response.data)

    def test_missing_ride_request_id_returns_400(self):
        """
        A payload missing ``ride_request_id`` must return HTTP 400
        BAD REQUEST because the serializer validation will fail.
        """
        url = reverse("matching:confirm-match")
        payload = {
            "ride_offer_id": self.ride_offer.pk,
            # ride_request_id intentionally omitted
        }

        response = self.client.post(url, data=payload, format="json")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_missing_ride_offer_id_returns_400(self):
        """
        A payload missing ``ride_offer_id`` must return HTTP 400
        BAD REQUEST.
        """
        url = reverse("matching:confirm-match")
        payload = {
            "ride_request_id": self.ride_request.pk,
            # ride_offer_id intentionally omitted
        }

        response = self.client.post(url, data=payload, format="json")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_empty_payload_returns_400(self):
        """
        An empty JSON body must return HTTP 400 BAD REQUEST.
        """
        url = reverse("matching:confirm-match")

        response = self.client.post(url, data={}, format="json")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    @patch.object(MatchingEngine, "_compute_detour", return_value=MOCK_DETOUR_SCORE)
    def test_nonexistent_offer_returns_400(self, mock_detour):
        """
        A valid JSON structure but with a non-existent offer ID must
        return HTTP 400 BAD REQUEST (MatchingError is caught by the view).
        """
        url = reverse("matching:confirm-match")
        payload = {
            "ride_offer_id": 99999,
            "ride_request_id": self.ride_request.pk,
        }

        response = self.client.post(url, data=payload, format="json")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("error", response.data)

    @patch.object(MatchingEngine, "_compute_detour", return_value=MOCK_DETOUR_SCORE)
    def test_double_confirm_returns_400(self, mock_detour):
        """
        Attempting to confirm the same RideRequest twice must return
        HTTP 400 on the second attempt (ACID compliance at the API level).
        """
        url = reverse("matching:confirm-match")
        payload = {
            "ride_offer_id": self.ride_offer.pk,
            "ride_request_id": self.ride_request.pk,
        }

        # First request — succeeds
        response_1 = self.client.post(url, data=payload, format="json")
        self.assertEqual(response_1.status_code, status.HTTP_201_CREATED)

        # Second request — same ride_request, should fail
        response_2 = self.client.post(url, data=payload, format="json")
        self.assertEqual(response_2.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("error", response_2.data)


class TestRankMatchesEndpoint(_BaseTestMixin, APITestCase):
    """
    Interface Test 2: Exercise the ``GET /api/matching/rank/<id>/``
    endpoint.
    """

    def setUp(self):
        self._create_test_data()

    @patch.object(MatchingEngine, "_compute_detour", return_value=MOCK_DETOUR_SCORE)
    def test_valid_rank_returns_200(self, mock_detour):
        """
        A valid GET request with an existing RideRequest ID must return
        HTTP 200 OK and a ``matches`` list.
        """
        url = reverse(
            "matching:rank-matches",
            kwargs={"ride_request_id": self.ride_request.pk},
        )

        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("matches", response.data)
        self.assertIn("ride_request_id", response.data)
        self.assertEqual(
            response.data["ride_request_id"],
            self.ride_request.pk,
        )

    def test_nonexistent_request_returns_400(self):
        """
        Ranking for a non-existent RideRequest ID must return
        HTTP 400 BAD REQUEST.
        """
        url = reverse(
            "matching:rank-matches",
            kwargs={"ride_request_id": 99999},
        )

        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("error", response.data)

    @patch.object(MatchingEngine, "_compute_detour", return_value=MOCK_DETOUR_SCORE)
    def test_matches_contain_expected_fields(self, mock_detour):
        """
        Each match in the response must contain the expected fields.
        """
        url = reverse(
            "matching:rank-matches",
            kwargs={"ride_request_id": self.ride_request.pk},
        )

        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)

        expected_keys = {
            "ride_offer_id",
            "driver_name",
            "departure_time",
            "available_seats",
            "original_duration",
            "detoured_duration",
            "extra_seconds",
        }
        for match in response.data["matches"]:
            self.assertTrue(expected_keys.issubset(set(match.keys())))


class TestRideEndpoints(_BaseTestMixin, APITestCase):
    """
    Interface Test 3: Exercise the Ride list & detail endpoints.
    """

    def setUp(self):
        self._create_test_data()

    @patch.object(MatchingEngine, "_compute_detour", return_value=MOCK_DETOUR_SCORE)
    def test_ride_list_returns_200(self, mock_detour):
        """
        GET /api/matching/rides/ must return HTTP 200.
        """
        # Create a ride first
        engine = MatchingEngine()
        engine.confirm_match(self.ride_offer.pk, self.ride_request.pk)

        url = reverse("matching:ride-list")
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIsInstance(response.data, list)
        self.assertEqual(len(response.data), 1)

    @patch.object(MatchingEngine, "_compute_detour", return_value=MOCK_DETOUR_SCORE)
    def test_ride_detail_returns_200(self, mock_detour):
        """
        GET /api/matching/rides/<pk>/ must return HTTP 200 with the
        correct ride data.
        """
        engine = MatchingEngine()
        ride = engine.confirm_match(self.ride_offer.pk, self.ride_request.pk)

        url = reverse("matching:ride-detail", kwargs={"pk": ride.pk})
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["id"], ride.pk)
        self.assertEqual(response.data["status"], "confirmed")

    def test_ride_detail_not_found_returns_404(self):
        """
        GET /api/matching/rides/<nonexistent_pk>/ must return HTTP 404.
        """
        url = reverse("matching:ride-detail", kwargs={"pk": 99999})
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
