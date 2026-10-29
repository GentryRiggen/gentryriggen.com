import unittest

import numpy as np

from lib import ao


class AoSettingsTest(unittest.TestCase):
    def test_defaults_when_spec_has_no_block(self) -> None:
        cfg = ao.settings({})
        self.assertEqual(cfg["strength"], ao.DEFAULTS["strength"])
        self.assertEqual(cfg["slots"], {})

    def test_slot_override_and_off(self) -> None:
        cfg = ao.settings({"ao": {"strength": 0.5, "slots": {"glass": 0}}})
        self.assertEqual(ao.strength_for(cfg, "body"), 0.5)
        self.assertEqual(ao.strength_for(cfg, "glass"), 0.0)

    def test_soften_blends_toward_white(self) -> None:
        raw = np.array([0.0, 0.5, 1.0])
        np.testing.assert_allclose(ao.soften(raw, 1.0), raw)
        np.testing.assert_allclose(ao.soften(raw, 0.0), [1, 1, 1])
        np.testing.assert_allclose(ao.soften(raw, 0.5), [0.5, 0.75, 1.0])


if __name__ == "__main__":
    unittest.main()
