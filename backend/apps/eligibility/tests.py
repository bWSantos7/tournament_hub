"""Tests for eligibility location utilities."""
from django.test import TestCase
from unittest.mock import patch


class HaversineTestCase(TestCase):
    def test_same_point_is_zero(self):
        from apps.eligibility.location import haversine_km
        self.assertAlmostEqual(haversine_km(-23.5, -46.6, -23.5, -46.6), 0.0, places=2)

    def test_sp_to_campinas_approx_100km(self):
        from apps.eligibility.location import haversine_km
        # São Paulo to Campinas is roughly 95–100 km
        dist = haversine_km(-23.5505, -46.6333, -22.9056, -47.0608)
        self.assertGreater(dist, 80)
        self.assertLess(dist, 120)

    def test_sp_to_rio_approx_350km(self):
        from apps.eligibility.location import haversine_km
        dist = haversine_km(-23.5505, -46.6333, -22.9068, -43.1729)
        self.assertGreater(dist, 300)
        self.assertLess(dist, 400)


class WithinProfileRadiusTestCase(TestCase):
    def _make_profile(self, city='São Paulo', state='SP', radius=100, lat=None, lng=None):
        from unittest.mock import MagicMock
        p = MagicMock()
        p.home_city = city
        p.home_state = state
        p.travel_radius_km = radius
        p.home_lat = lat
        p.home_lng = lng
        return p

    def _make_edition(self, city='São Paulo', state='SP', lat=None, lng=None):
        from unittest.mock import MagicMock
        venue = MagicMock()
        venue.city = city
        venue.state = state
        venue.address = ''
        venue.latitude = lat
        venue.longitude = lng
        ed = MagicMock()
        ed.venue = venue
        return ed

    def test_same_city_returns_true(self):
        from apps.eligibility.location import within_profile_radius
        p = self._make_profile()
        ed = self._make_edition()
        self.assertTrue(within_profile_radius(p, ed))

    def test_uses_precomputed_coords(self):
        from apps.eligibility.location import within_profile_radius
        # SP coords → Campinas coords (~97 km), radius 200 → inside
        p = self._make_profile(city='São Paulo', state='SP', radius=200, lat=-23.5505, lng=-46.6333)
        ed = self._make_edition(city='Campinas', state='SP', lat=-22.9056, lng=-47.0608)
        self.assertTrue(within_profile_radius(p, ed))

    def test_uses_precomputed_coords_outside_radius(self):
        from apps.eligibility.location import within_profile_radius
        # SP → Rio (~360 km), radius 100 → outside
        p = self._make_profile(city='São Paulo', state='SP', radius=100, lat=-23.5505, lng=-46.6333)
        ed = self._make_edition(city='Rio de Janeiro', state='RJ', lat=-22.9068, lng=-43.1729)
        self.assertFalse(within_profile_radius(p, ed))

    def test_no_home_city_returns_true(self):
        from apps.eligibility.location import within_profile_radius
        p = self._make_profile(city='', state='')
        ed = self._make_edition()
        self.assertTrue(within_profile_radius(p, ed))

    def test_no_venue_returns_false(self):
        from apps.eligibility.location import within_profile_radius
        from unittest.mock import MagicMock
        p = self._make_profile()
        ed = MagicMock()
        ed.venue = None
        self.assertFalse(within_profile_radius(p, ed))
