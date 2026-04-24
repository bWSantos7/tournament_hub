"""Tests for ingestion: dedup fingerprint, youth classifier, persistence logic."""
from django.test import TestCase


class DedupFingerprintTestCase(TestCase):
    def test_same_title_date_city_produces_same_fingerprint(self):
        from apps.ingestion.persistence import _dedup_fingerprint
        fp1 = _dedup_fingerprint('Open São Paulo 2026', '2026-03-15', 'São Paulo', 'SP')
        fp2 = _dedup_fingerprint('Open São Paulo 2026', '2026-03-15', 'São Paulo', 'SP')
        self.assertEqual(fp1, fp2)

    def test_different_cities_produce_different_fingerprints(self):
        from apps.ingestion.persistence import _dedup_fingerprint
        fp1 = _dedup_fingerprint('Open 2026', '2026-03-15', 'São Paulo', 'SP')
        fp2 = _dedup_fingerprint('Open 2026', '2026-03-15', 'Campinas', 'SP')
        self.assertNotEqual(fp1, fp2)

    def test_accents_normalized(self):
        from apps.ingestion.persistence import _dedup_fingerprint
        fp1 = _dedup_fingerprint('Torneio Júnior', '2026-04-01', 'São Paulo', 'SP')
        fp2 = _dedup_fingerprint('Torneio Junior', '2026-04-01', 'Sao Paulo', 'SP')
        self.assertEqual(fp1, fp2)

    def test_fingerprint_is_16_chars(self):
        from apps.ingestion.persistence import _dedup_fingerprint
        fp = _dedup_fingerprint('Test Tournament', '2026-01-01', 'Brasilia', 'DF')
        self.assertEqual(len(fp), 16)

    def test_empty_inputs_dont_crash(self):
        from apps.ingestion.persistence import _dedup_fingerprint
        fp = _dedup_fingerprint('', None, '', '')
        self.assertIsInstance(fp, str)


class YouthClassifierTestCase(TestCase):
    def test_infantojuvenil_keyword(self):
        from apps.ingestion.persistence import _classify_is_youth
        self.assertTrue(_classify_is_youth('CBT', 'Torneio Infantojuvenil SP', []))

    def test_junior_keyword(self):
        from apps.ingestion.persistence import _classify_is_youth
        self.assertTrue(_classify_is_youth('ITF', 'ITF Junior Tournament', []))

    def test_age_category_in_title(self):
        from apps.ingestion.persistence import _classify_is_youth
        cats = [{'source_text': '14 anos Masculino'}]
        self.assertTrue(_classify_is_youth('FPT', 'Open SP', cats))

    def test_adult_open_not_youth(self):
        from apps.ingestion.persistence import _classify_is_youth
        cats = [{'source_text': 'Open Masculino'}, {'source_text': '40+ Masculino'}]
        self.assertFalse(_classify_is_youth('FPT', 'Aberto SP', cats))

    def test_sub_keyword(self):
        from apps.ingestion.persistence import _classify_is_youth
        cats = [{'source_text': 'Sub-16 Feminino'}]
        self.assertTrue(_classify_is_youth('CBT', 'Circuit', cats))
