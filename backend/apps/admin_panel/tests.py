"""Tests for admin panel endpoints."""
from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

User = get_user_model()


class AdminPanelAuthTestCase(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.admin = User.objects.create_user(
            email='admin@example.com', password='pass', role='admin', is_staff=True
        )
        self.regular = User.objects.create_user(
            email='user@example.com', password='pass', role='player'
        )

    def test_dashboard_requires_admin(self):
        self.client.force_authenticate(user=self.regular)
        res = self.client.get('/api/admin-panel/dashboard/')
        self.assertEqual(res.status_code, 403)

    def test_dashboard_accessible_by_admin(self):
        self.client.force_authenticate(user=self.admin)
        res = self.client.get('/api/admin-panel/dashboard/')
        self.assertEqual(res.status_code, 200)
        self.assertIn('counts', res.data)

    def test_sources_list_requires_admin(self):
        self.client.force_authenticate(user=self.regular)
        res = self.client.get('/api/admin-panel/sources/')
        self.assertEqual(res.status_code, 403)

    def test_sources_list_accessible_by_admin(self):
        self.client.force_authenticate(user=self.admin)
        res = self.client.get('/api/admin-panel/sources/')
        self.assertEqual(res.status_code, 200)
        self.assertIsInstance(res.data, list)

    def test_user_list_search(self):
        self.client.force_authenticate(user=self.admin)
        res = self.client.get('/api/admin-panel/users/?q=user')
        self.assertEqual(res.status_code, 200)
        emails = [u['email'] for u in res.data]
        self.assertIn('user@example.com', emails)

    def test_cannot_delete_own_account(self):
        self.client.force_authenticate(user=self.admin)
        res = self.client.delete(f'/api/admin-panel/users/{self.admin.id}/')
        self.assertEqual(res.status_code, 400)

    def test_review_queue_returns_sections(self):
        self.client.force_authenticate(user=self.admin)
        res = self.client.get('/api/admin-panel/review-queue/')
        self.assertEqual(res.status_code, 200)
        self.assertIn('low_confidence', res.data)
        self.assertIn('missing_official_url', res.data)
        self.assertIn('recently_changed', res.data)
