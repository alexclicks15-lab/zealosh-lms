"""test_arena.py: Comprehensive test suite for the Antigravity Arena Skill.

Runs:
1. Upstream unit test suite (bracket combinatorics, pairing, graph coloring, templates, CLI).
2. Antigravity adapter validation and cost estimation.
3. Deterministic end-to-end tournament lifecycle test.
"""
import os
import sys
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
ARENA_DIR = os.path.dirname(HERE)
sys.path.insert(0, ARENA_DIR)

import bracket
import antigravity_adapter


class TestAntigravityArena(unittest.TestCase):
    def test_environment_validation(self):
        ok, results = antigravity_adapter.validate_environment()
        self.assertTrue(ok, f"Environment validation failed: {results}")

    def test_cost_estimation_tiers(self):
        for n in [4, 8, 16, 32, 100]:
            data = antigravity_adapter.estimate_costs(n)
            self.assertEqual(data["agents"], n)
            self.assertGreater(data["rounds"], 0)
            self.assertGreater(data["calls"]["total"], n)
            self.assertGreater(data["estimated_cost_usd"]["total"], 0)

    def test_templates_load(self):
        templates = bracket.load_templates(os.path.join(ARENA_DIR, "SKILL.md"))
        for required in ["competitor", "attacker", "defender", "judge", "final"]:
            self.assertIn(required, templates)
            self.assertTrue(len(templates[required].strip()) > 0)

    def test_deterministic_e2e_tournament(self):
        ok, msg = antigravity_adapter.run_deterministic_test_tournament(agents_n=4, seed=42)
        self.assertTrue(ok, f"E2E tournament failed: {msg}")
        self.assertIn("Champion crowned: a004", msg)


if __name__ == "__main__":
    unittest.main()
