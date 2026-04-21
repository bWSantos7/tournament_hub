"""
Eligibility engine.

Evaluates whether a PlayerProfile is compatible with a tournament category,
producing (compatible | incompatible | unknown) + reasons.

Rules implemented (faithful to the source regulations):

1. CBT / FPT age by civil year: sporting_age = current_year - birth_year
   (never uses month/day). Source: CBT Regulamento Infantojuvenil.

2. FPT classes (1..5): a player in class N may also enter class N-1
   (one class above, strict harder direction). A 5th-class player may
   play 4th class. A 5th-class player may NOT play 3rd class.
   A 1st-class player may NOT descend to 2nd class.

3. Seniors (35+, 40+, 45+, 50+, ...): unidirectional descending. A 45-year-old
   may enter 35+ but not 50+.

4. Youth exact match: 12F, 14M, 16F, 18M — must match sporting_age exactly.

5. Gender match on category scope (M / F / X mixed / * any).

6. When the category has no normalized taxonomy or no rule found, status is
   'unknown' with reason 'no_rule_available'.
"""
from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional

from apps.players.models import PlayerCategory, PlayerProfile
from apps.tournaments.models import TournamentCategory, TournamentEdition


STATUS_COMPATIBLE = 'compatible'
STATUS_INCOMPATIBLE = 'incompatible'
STATUS_UNKNOWN = 'unknown'

REASON_AGE_OUT = 'age_out_of_range'
REASON_GENDER_MISMATCH = 'gender_mismatch'
REASON_CLASS_TOO_LOW = 'class_too_low'
REASON_CLASS_TOO_HIGH = 'class_too_high'
REASON_NO_BIRTH_YEAR = 'no_birth_year'
REASON_NO_GENDER = 'no_gender'
REASON_NO_CLASS = 'no_class'
REASON_NO_RULE = 'no_rule_available'
REASON_NOT_NORMALIZED = 'category_not_normalized'
REASON_MATCH = 'matches_profile'


@dataclass
class EligibilityResult:
    status: str
    reasons: list = field(default_factory=list)
    rule_version_id: Optional[int] = None
    category_code: Optional[str] = None
    category_label: Optional[str] = None

    def to_dict(self):
        return {
            'status': self.status,
            'reasons': self.reasons,
            'rule_version_id': self.rule_version_id,
            'category_code': self.category_code,
            'category_label': self.category_label,
        }


class EligibilityEngine:
    """Evaluate a player profile against tournament categories."""

    def __init__(self, profile: PlayerProfile):
        self.profile = profile
        self._current_year = datetime.now().year

    @property
    def sporting_age(self) -> Optional[int]:
        if self.profile.birth_year:
            return self._current_year - self.profile.birth_year
        return None

    # ---------- Category evaluation ----------

    def evaluate_category(self, tc: TournamentCategory) -> EligibilityResult:
        """Evaluate a single TournamentCategory against the player."""
        norm: Optional[PlayerCategory] = tc.normalized_category
        if norm is None:
            return EligibilityResult(
                status=STATUS_UNKNOWN,
                reasons=[REASON_NOT_NORMALIZED],
                category_code=tc.source_category_text,
                category_label=tc.source_category_text,
            )

        return self.evaluate_player_category(
            norm,
            source_text=tc.source_category_text,
        )

    def evaluate_player_category(
        self, cat: PlayerCategory, source_text: Optional[str] = None
    ) -> EligibilityResult:
        reasons = []

        # --- gender check ---
        gender_ok = self._check_gender(cat, reasons)

        # --- taxonomy-specific logic ---
        taxonomy_status = self._check_taxonomy(cat, reasons)

        # Combine
        if taxonomy_status == STATUS_UNKNOWN:
            status = STATUS_UNKNOWN
        elif not gender_ok:
            status = STATUS_INCOMPATIBLE
        elif taxonomy_status == STATUS_COMPATIBLE:
            status = STATUS_COMPATIBLE
            reasons.append(REASON_MATCH)
        else:
            status = STATUS_INCOMPATIBLE

        return EligibilityResult(
            status=status,
            reasons=list(set(reasons)),
            category_code=cat.code,
            category_label=cat.label_ptbr,
        )

    # ---------- Helpers ----------

    def _check_gender(self, cat: PlayerCategory, reasons: list) -> bool:
        gs = cat.gender_scope
        if gs in ('*', 'X'):
            return True
        if not self.profile.gender:
            reasons.append(REASON_NO_GENDER)
            return True  # unknown gender treated as soft-pass
        return gs == self.profile.gender

    def _check_taxonomy(self, cat: PlayerCategory, reasons: list) -> str:
        t = cat.taxonomy

        if t == PlayerCategory.TAXONOMY_FPT_CLASS:
            return self._check_fpt_class(cat, reasons)

        if t in (PlayerCategory.TAXONOMY_FPT_AGE, PlayerCategory.TAXONOMY_CBT_AGE,
                 PlayerCategory.TAXONOMY_KIDS):
            return self._check_exact_age(cat, reasons)

        if t == PlayerCategory.TAXONOMY_SENIORS:
            return self._check_seniors(cat, reasons)

        if t == PlayerCategory.TAXONOMY_OPEN:
            return STATUS_COMPATIBLE

        reasons.append(REASON_NO_RULE)
        return STATUS_UNKNOWN

    def _check_fpt_class(self, cat: PlayerCategory, reasons: list) -> str:
        player_class_str = (self.profile.tennis_class or '').upper().strip()
        if not player_class_str:
            reasons.append(REASON_NO_CLASS)
            return STATUS_UNKNOWN
        try:
            player_class = int(player_class_str)
        except ValueError:
            # PR (principiante), PRO — not comparable numerically
            if player_class_str == 'PR':
                # principiante may play only 5th class
                if cat.class_level == 5:
                    return STATUS_COMPATIBLE
                reasons.append(REASON_CLASS_TOO_HIGH)
                return STATUS_INCOMPATIBLE
            return STATUS_UNKNOWN

        if cat.class_level is None:
            reasons.append(REASON_NO_RULE)
            return STATUS_UNKNOWN

        # Rule: may play own class OR one class above (class_level - 1)
        # lower class_level = higher technical level.
        if cat.class_level == player_class:
            return STATUS_COMPATIBLE
        if cat.class_level == player_class - 1:
            return STATUS_COMPATIBLE
        if cat.class_level < player_class - 1:
            reasons.append(REASON_CLASS_TOO_HIGH)
            return STATUS_INCOMPATIBLE
        # cat.class_level > player_class: descending forbidden
        reasons.append(REASON_CLASS_TOO_LOW)
        return STATUS_INCOMPATIBLE

    def _check_exact_age(self, cat: PlayerCategory, reasons: list) -> str:
        age = self.sporting_age
        if age is None:
            reasons.append(REASON_NO_BIRTH_YEAR)
            return STATUS_UNKNOWN
        min_age = cat.min_age
        max_age = cat.max_age
        if min_age is not None and max_age is not None:
            if min_age <= age <= max_age:
                return STATUS_COMPATIBLE
            reasons.append(REASON_AGE_OUT)
            return STATUS_INCOMPATIBLE
        if min_age is not None and age >= min_age:
            return STATUS_COMPATIBLE
        if max_age is not None and age <= max_age:
            return STATUS_COMPATIBLE
        reasons.append(REASON_NO_RULE)
        return STATUS_UNKNOWN

    def _check_seniors(self, cat: PlayerCategory, reasons: list) -> str:
        """Seniors: player age must be >= category min_age (descending allowed)."""
        age = self.sporting_age
        if age is None:
            reasons.append(REASON_NO_BIRTH_YEAR)
            return STATUS_UNKNOWN
        if cat.min_age is None:
            reasons.append(REASON_NO_RULE)
            return STATUS_UNKNOWN
        if age >= cat.min_age:
            return STATUS_COMPATIBLE
        reasons.append(REASON_AGE_OUT)
        return STATUS_INCOMPATIBLE

    # ---------- Edition summary ----------

    def evaluate_edition(self, edition: TournamentEdition) -> dict:
        results = []
        compatible_count = 0
        incompatible_count = 0
        unknown_count = 0
        for tc in edition.categories.select_related('normalized_category').all():
            r = self.evaluate_category(tc)
            results.append({
                'tournament_category_id': tc.id,
                'source_text': tc.source_category_text,
                'result': r.to_dict(),
                'price_brl': str(tc.price_brl) if tc.price_brl is not None else None,
            })
            if r.status == STATUS_COMPATIBLE:
                compatible_count += 1
            elif r.status == STATUS_INCOMPATIBLE:
                incompatible_count += 1
            else:
                unknown_count += 1
        return {
            'edition_id': edition.id,
            'profile_id': self.profile.id,
            'sporting_age': self.sporting_age,
            'total_count': len(results),
            'compatible_count': compatible_count,
            'incompatible_count': incompatible_count,
            'unknown_count': unknown_count,
            'categories': results,
        }
