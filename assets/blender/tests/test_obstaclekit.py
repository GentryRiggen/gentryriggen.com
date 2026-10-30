import unittest

from lib import obstaclekit


class SkinTest(unittest.TestCase):
    def rings(self):
        square = [(-1, -1), (1, -1), (1, 1), (-1, 1)]
        return [(0.0, square), (2.0, [(x * 0.5, z * 0.5) for x, z in square])]

    def test_counts_with_caps(self) -> None:
        verts, faces = obstaclekit.skin(self.rings(), cap_top=True, cap_bottom=True)
        self.assertEqual(len(verts), 8 + 2)
        self.assertEqual(len(faces), 4 + 4 + 4)

    def test_side_faces_point_away_from_the_axis(self) -> None:
        verts, faces = obstaclekit.skin(self.rings())
        for f in faces:
            pts = [verts[i] for i in f]
            nx = nz = 0.0
            for p, q in zip(pts, pts[1:] + pts[:1]):
                nx += (p[1] - q[1]) * (p[2] + q[2])
                nz += (p[0] - q[0]) * (p[1] + q[1])
            mx = sum(p[0] for p in pts) / 4
            mz = sum(p[2] for p in pts) / 4
            self.assertGreater(nx * mx + nz * mz, 0)

    def test_top_cap_faces_up(self) -> None:
        verts, faces = obstaclekit.skin(self.rings(), cap_top=True)
        for f in faces[-4:]:
            a, b, c = (verts[i] for i in f)
            ny = (b[2] - a[2]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[2] - a[2])
            self.assertGreater(ny, 0)


if __name__ == "__main__":
    unittest.main()
