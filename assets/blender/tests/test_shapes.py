import math
import unittest

import bpy

from lib import shapes


def bounds(mesh: shapes.Mesh) -> tuple[list[float], list[float]]:
    verts = mesh[0]
    return (
        [min(v[i] for v in verts) for i in range(3)],
        [max(v[i] for v in verts) for i in range(3)],
    )


class ShapesTestCase(unittest.TestCase):
    def assertBounds(self, mesh, lo, hi, places: int = 6) -> None:
        got_lo, got_hi = bounds(mesh)
        for i in range(3):
            self.assertAlmostEqual(got_lo[i], lo[i], places=places)
            self.assertAlmostEqual(got_hi[i], hi[i], places=places)

    def assertCounts(self, mesh, verts: int, faces: int) -> None:
        self.assertEqual(len(mesh[0]), verts)
        self.assertEqual(len(mesh[1]), faces)

    def assertIndicesValid(self, mesh) -> None:
        n = len(mesh[0])
        for f in mesh[1]:
            self.assertGreaterEqual(len(f), 3)
            self.assertTrue(all(0 <= i < n for i in f))


class ColourTest(ShapesTestCase):
    def test_srgb_to_linear_ends_and_middle(self) -> None:
        self.assertEqual(shapes.srgb_to_linear(0.0), 0.0)
        self.assertAlmostEqual(shapes.srgb_to_linear(1.0), 1.0)
        self.assertAlmostEqual(shapes.srgb_to_linear(0.5), 0.21404, places=4)

    def test_hex_linear(self) -> None:
        self.assertEqual(shapes.hex_linear("#ffffff"), (1.0, 1.0, 1.0, 1.0))
        self.assertEqual(shapes.hex_linear("000000"), (0.0, 0.0, 0.0, 1.0))

    def test_three_to_blender(self) -> None:
        self.assertEqual(shapes.three_to_blender(1, 2, 3), (1, -3, 2))


class MoveTest(ShapesTestCase):
    def test_merge_offsets_indices(self) -> None:
        a = shapes.box(0, 0, 0, 1, 1, 1)
        m = shapes.merge([a, a])
        self.assertCounts(m, 16, 12)
        self.assertEqual(m[1][6], tuple(i + 8 for i in a[1][0]))

    def test_translate(self) -> None:
        m = shapes.translate(shapes.box(0, 0, 0, 2, 2, 2), 1, 2, 3)
        self.assertBounds(m, [0, 1, 2], [2, 3, 4])

    def test_rotate_y_quarter_turn(self) -> None:
        verts, _ = shapes.rotate_y(([(1.0, 0.0, 0.0)], []), math.pi / 2)
        self.assertAlmostEqual(verts[0][0], 0.0)
        self.assertAlmostEqual(verts[0][2], -1.0)

    def test_array_line(self) -> None:
        m = shapes.array_line(shapes.box(0, 0, 0, 1, 1, 1), 4, (2, 0, 0))
        self.assertCounts(m, 32, 24)
        self.assertBounds(m, [-0.5, -0.5, -0.5], [6.5, 0.5, 0.5])

    def test_array_circle(self) -> None:
        m = shapes.array_circle(shapes.box(0, 0, 2, 0.2, 0.2, 0.2), 4)
        self.assertCounts(m, 32, 24)
        self.assertBounds(m, [-2.1, -0.1, -2.1], [2.1, 0.1, 2.1])


class RevolvedTest(ShapesTestCase):
    def test_lathe_with_poles(self) -> None:
        m = shapes.lathe([(0.0, 0.0), (1.0, 0.0), (1.0, 2.0), (0.0, 2.0)], 8)
        self.assertCounts(m, 2 + 16, 24)  # two fans of triangles plus a wall
        self.assertBounds(m, [-1, 0, -1], [1, 2, 1])
        self.assertIndicesValid(m)

    def test_round_hoop_stands_proud_in_the_middle(self) -> None:
        pts = shapes.round_hoop(1.0, 1.0, 0.0, 1.0, 0.1, 4)
        self.assertEqual(len(pts), 5)
        self.assertAlmostEqual(pts[0][0], 1.0)
        self.assertAlmostEqual(pts[2][0], 1.1)

    def test_cylinder(self) -> None:
        m = shapes.cylinder(1.0, 1.0, 2.0, 8, centre_y=1.0)
        self.assertCounts(m, 18, 24)
        self.assertBounds(m, [-1, 0, -1], [1, 2, 1])
        self.assertGreater(shapes.signed_volume(m), 0)

    def test_disc(self) -> None:
        m = shapes.disc(0.5, 1.0, 12)
        self.assertCounts(m, 13, 12)
        self.assertBounds(m, [-0.5, 1, -0.5], [0.5, 1, 0.5])


class BoxTest(ShapesTestCase):
    def test_box_is_closed_and_outward(self) -> None:
        m = shapes.box(1, 2, 3, 2, 4, 6)
        self.assertCounts(m, 8, 6)
        self.assertBounds(m, [0, 0, 0], [2, 4, 6])
        self.assertAlmostEqual(shapes.signed_volume(m), 48)

    def test_rounded_box_counts_bounds_and_winding(self) -> None:
        steps = 3
        n = 2 * (steps + 1)
        m = shapes.rounded_box((0, 1, 0), (2, 2, 4), 0.25, steps)
        self.assertCounts(m, n**3 - (n - 2) ** 3, 6 * (n - 1) ** 2)
        self.assertBounds(m, [-1, 0, -2], [1, 2, 2])
        self.assertIndicesValid(m)
        # Slightly less than the sharp box, never more.
        vol = shapes.signed_volume(m)
        self.assertLess(vol, 16)
        self.assertGreater(vol, 15)

    def test_rounded_box_corner_is_rounded(self) -> None:
        m = shapes.rounded_box((0, 0, 0), (2, 2, 2), 0.5, 2)
        far = max(math.dist(v, (0, 0, 0)) for v in m[0])
        self.assertAlmostEqual(far, 0.5 * math.sqrt(3) + 0.5, places=6)

    def test_rounded_box_clamps_radius(self) -> None:
        m = shapes.rounded_box((0, 0, 0), (1, 1, 1), 5.0, 2)
        self.assertBounds(m, [-0.5] * 3, [0.5] * 3)


HULL = [(-0.5, 0.0), (0.5, 0.0), (0.7, 0.6), (-0.7, 0.6)]  # (z, y) section


class ProfileTest(ShapesTestCase):
    def test_extrude_along_x(self) -> None:
        m = shapes.extrude(HULL, -2.0, 2.0, axis="x")
        self.assertCounts(m, 8, 4 + 2)
        self.assertBounds(m, [-2, 0, -0.7], [2, 0.6, 0.7])
        self.assertAlmostEqual(shapes.signed_volume(m), 0.72 * 4)

    def test_extrude_either_winding_faces_outward(self) -> None:
        for axis in ("x", "y", "z"):
            for profile in (HULL, HULL[::-1]):
                m = shapes.extrude(profile, 0.0, 1.0, axis=axis)
                self.assertGreater(shapes.signed_volume(m), 0, axis)

    def test_extrude_along_y_and_z(self) -> None:
        y = shapes.extrude(HULL, 1.0, 3.0, axis="y")
        self.assertBounds(y, [-0.7, 1, 0], [0.7, 3, 0.6])
        z = shapes.extrude(HULL, 0.0, 1.0, axis="z")
        self.assertBounds(z, [-0.7, 0, 0], [0.7, 0.6, 1])

    def test_open_extrude_has_no_caps(self) -> None:
        m = shapes.extrude(HULL, 0.0, 1.0, caps=False)
        self.assertCounts(m, 8, 4)

    def test_loft_tapers_between_sections(self) -> None:
        small = [(z * 0.5, y) for z, y in HULL]
        m = shapes.loft([(-1.0, small), (0.0, HULL), (1.0, small)], axis="x")
        self.assertCounts(m, 12, 2 * 4 + 2)
        self.assertBounds(m, [-1, 0, -0.7], [1, 0.6, 0.7])
        self.assertGreater(shapes.signed_volume(m), 0)

    def test_loft_rejects_mismatched_sections(self) -> None:
        with self.assertRaises(ValueError):
            shapes.loft([(0.0, HULL), (1.0, HULL[:3])])
        with self.assertRaises(ValueError):
            shapes.loft([(0.0, HULL)])


class TubeTest(ShapesTestCase):
    def test_straight_tube(self) -> None:
        m = shapes.tube([(0, 0, 0), (0, 2, 0)], 0.1, seg=8)
        self.assertCounts(m, 16, 8 + 2)
        self.assertBounds(m, [-0.1, 0, -0.1], [0.1, 2, 0.1], places=6)
        self.assertGreater(shapes.signed_volume(m), 0)

    def test_bent_rail(self) -> None:
        pts = [(0, 0, 0), (0, 1, 0), (2, 1, 0), (2, 0, 0)]
        m = shapes.tube(pts, 0.05, seg=6, caps=False)
        self.assertCounts(m, 4 * 6, 3 * 6)
        lo, hi = bounds(m)
        self.assertLess(lo[0], 0)
        self.assertGreater(hi[0], 2)
        self.assertAlmostEqual(lo[1], 0.0, places=6)  # end rings stay square
        self.assertIndicesValid(m)

    def test_tube_ring_radius(self) -> None:
        m = shapes.tube([(0, 0, 0), (1, 0, 0), (1, 0, 1)], 0.2, seg=8)
        ring = m[0][:8]
        for v in ring:
            self.assertAlmostEqual(math.hypot(v[1], v[2]), 0.2)

    def test_tube_rejects_one_point(self) -> None:
        with self.assertRaises(ValueError):
            shapes.tube([(0, 0, 0)], 0.1)


class MakeObjectTest(ShapesTestCase):
    def tearDown(self) -> None:
        for coll in (bpy.data.objects, bpy.data.meshes, bpy.data.materials):
            for item in list(coll):
                coll.remove(item)

    def test_converts_to_blender_and_paints(self) -> None:
        mesh = shapes.box(0, 1, 2, 0.5, 0.5, 0.5)
        obj = shapes.make_object("plate", mesh, shapes.linear(1, 0, 0), closed=True)
        self.assertEqual(obj.name, "plate")
        self.assertEqual(len(obj.data.vertices), 8)
        ys = [v.co.y for v in obj.data.vertices]
        zs = [v.co.z for v in obj.data.vertices]
        self.assertAlmostEqual(min(ys), -2.25)  # three z -> Blender -y
        self.assertAlmostEqual(max(zs), 1.25)  # three y -> Blender z
        bsdf = obj.data.materials[0].node_tree.nodes["Principled BSDF"]
        self.assertAlmostEqual(bsdf.inputs["Base Color"].default_value[0], 1.0)
