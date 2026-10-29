import unittest

from lib import gates


class GatesTest(unittest.TestCase):
    def test_bounds_gate(self) -> None:
        emin, emax = [0.0, 0.0, 0.0], [10.0, 20.0, 30.0]
        self.assertTrue(gates.bounds_gate(emin, emax, emin, emax, 0.03)["ok"])
        near = gates.bounds_gate(emin, [10.2, 20.0, 30.0], emin, emax, 0.03)
        self.assertTrue(near["ok"])
        far = gates.bounds_gate(emin, [10.5, 20.0, 30.0], emin, emax, 0.03)
        self.assertFalse(far["ok"])
        self.assertIn("x extent 10.5 vs 10", far["detail"])
        self.assertNotIn("y extent", far["detail"])
        self.assertNotIn("y centre", far["detail"])

    def test_slots_gate(self) -> None:
        self.assertTrue(gates.slots_gate({"hull", "pipe"}, ["hull", "pipe"])["ok"])
        r = gates.slots_gate({"hull"}, ["hull", "pipe"])
        self.assertFalse(r["ok"])
        self.assertIn("missing: pipe", r["detail"])
        r = gates.slots_gate({"hull", "pipe", "x"}, ["hull", "pipe"])
        self.assertFalse(r["ok"])
        self.assertIn("extra: x", r["detail"])

    def test_budget_gate(self) -> None:
        self.assertTrue(gates.budget_gate("tris", 100, 100)["ok"])
        self.assertFalse(gates.budget_gate("tris", 101, 100)["ok"])


if __name__ == "__main__":
    unittest.main()
