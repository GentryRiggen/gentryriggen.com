import unittest

from lib import history, scoring

SPEC = {
    "scoreVariant": "funnel",
    "views": [{"name": "side"}, {"name": "front"}],
    "variants": [{"name": "funnel"}],
}


class ManifestValidationTest(unittest.TestCase):
    def test_unknown_view_names_the_view(self) -> None:
        entries = [{"file": "a.png", "view": "top"}]
        with self.assertRaises(scoring.SpecError) as ctx:
            scoring.validate_manifest("funnel", entries, SPEC)
        self.assertIn("'top'", str(ctx.exception))

    def test_unknown_score_variant_names_the_variant(self) -> None:
        spec = dict(SPEC, scoreVariant="nope")
        with self.assertRaises(scoring.SpecError) as ctx:
            scoring.validate_manifest("funnel", [], spec)
        self.assertIn("'nope'", str(ctx.exception))

    def test_valid_and_null_views_pass(self) -> None:
        entries = [{"file": "a.png", "view": "side"}, {"file": "b.png", "view": None}]
        scoring.validate_manifest("funnel", entries, SPEC)


class CropValidationTest(unittest.TestCase):
    def test_in_bounds_and_none_pass(self) -> None:
        scoring.validate_crop(None, 100, 80, "a.png")
        scoring.validate_crop([10, 10, 90, 70], 100, 80, "a.png")

    def test_out_of_bounds_raises(self) -> None:
        for crop in ([10, 10, 91, 70], [0, 0, 100, 81], [-1, 0, 5, 5], [0, 0, 0, 5]):
            with self.assertRaises(scoring.SpecError, msg=str(crop)):
                scoring.validate_crop(crop, 100, 80, "a.png")


class HistoryLineTest(unittest.TestCase):
    def test_first_line_has_no_gap(self) -> None:
        line = history.build_history_line(
            {"round": 1, "total": 0.5}, "2026-10-28T10:00:00+00:00", 2.34, None
        )
        self.assertIsNone(line["sinceLastSeconds"])
        self.assertEqual(line["runSeconds"], 2.3)
        self.assertEqual(line["blockers"], [])
        self.assertEqual(line["round"], 1)

    def test_gap_and_blockers(self) -> None:
        line = history.build_history_line(
            {"round": 2},
            "2026-10-28T10:01:30+00:00",
            3.0,
            "2026-10-28T10:00:00+00:00",
            ["glb path wrong"],
        )
        self.assertEqual(line["sinceLastSeconds"], 90.0)
        self.assertEqual(line["blockers"], ["glb path wrong"])
        self.assertEqual(line["timestamp"], "2026-10-28T10:01:30+00:00")


if __name__ == "__main__":
    unittest.main()
