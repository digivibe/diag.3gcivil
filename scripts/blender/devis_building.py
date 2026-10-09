"""
Immeuble de la demande de diagnostic : public/models/devis_building.glb.

  blender -b --factory-startup -P scripts/blender/devis_building.py      (ou : npm run devis:build)
  ... -- --preview <dossier>   rend aussi un aperçu Cycles de chaque clé caméra (contrôle visuel)

Façade haussmannienne simplifiée (5 travées, rez-de-chaussée + 5 étages + combles à lucarnes),
porte cochère à deux vantaux, hall d'entrée avec le tableau sur lequel s'affiche le formulaire,
boîtes aux lettres, trottoir et réverbères. Caméra et vantaux partagent une seule animation
(mode SCENE, "devis_enter") : le site la fait défiler de 0 (rue) à 1 (hall).

Conventions : Blender Z-up, façade sur le plan y = 0 côté rue (-Y), hall vers +Y ; côté Three.js,
façade en z = 0 regardant +Z, hall vers -Z. Les noms de matériaux sont lus par
components/devis/DevisScene.tsx. Chaque vitre porte dans ses UV un identifiant de fenêtre (u, 0 → 1)
et sa hauteur relative (v) : le site allume les fenêtres une à une.
"""

import json
import math
import os
import random
import sys

import bmesh
import bpy
from mathutils import Matrix, Vector

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
OUT = os.path.join(ROOT, "public", "models")
KEYS = os.path.join(HERE, "devis_camera_keys.json")

FACADE_X = 7.0  # demi-largeur de la façade
BAYS = [-5.6, -2.8, 0.0, 2.8, 5.6]  # axes des travées
PIERS = [-6.6, -4.2, -1.4, 1.4, 4.2, 6.6]  # axes des trumeaux (consoles des balcons)
WALL = 0.5  # épaisseur du mur de façade
RDC = 4.4
FLOORS = [(4.4, 3.3), (7.7, 3.2), (10.9, 3.0), (13.9, 3.0), (16.9, 2.9)]  # (niveau, hauteur)
TOP = 19.8
BALCONIES = (1, 4)  # balcons filants aux 2e et 5e étages
DEPTH = 11.0
DOOR = (-1.5, 1.5, 3.6)  # x0, x1, hauteur de la porte cochère
HALL = (-3.8, 3.8)
HALL_H = 4.3

# Couleurs d'aperçu seulement : le site remplace chaque matériau par son shader, d'après son nom.
MATERIALS = {
    "stone": ((0.78, 0.72, 0.62), 0.0),
    "stone_base": ((0.7, 0.65, 0.56), 0.0),
    "window": ((0.05, 0.07, 0.1), 0.0),
    "frame": ((0.12, 0.13, 0.15), 0.0),
    "railing": ((0.05, 0.06, 0.07), 0.0),
    "roof": ((0.33, 0.38, 0.44), 0.0),
    "door": ((0.05, 0.12, 0.11), 0.0),
    "brass": ((0.75, 0.6, 0.3), 0.0),
    "floor": ((0.5, 0.48, 0.45), 0.0),
    "wall_in": ((0.82, 0.8, 0.76), 0.0),
    "board": ((0.04, 0.09, 0.18), 2.0),
    "lamp": ((1.0, 0.82, 0.55), 12.0),
    "pavement": ((0.28, 0.28, 0.3), 0.0),
}
MAT = {}


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def create_materials():
    for name, (color, emission) in MATERIALS.items():
        mat = bpy.data.materials.new(name)
        mat.diffuse_color = (*color, 1.0)
        if hasattr(mat, "use_nodes") and not mat.use_nodes:
            mat.use_nodes = True
        nodes = mat.node_tree.nodes
        bsdf = nodes.get("Principled BSDF") or nodes.new("ShaderNodeBsdfPrincipled")
        bsdf.inputs["Base Color"].default_value = (*color, 1.0)
        if emission:
            bsdf.inputs["Emission Color"].default_value = (*color, 1.0)
            bsdf.inputs["Emission Strength"].default_value = emission
        MAT[name] = mat


class Builder:
    """Accumule des volumes dans un seul maillage : un objet par matériau, donc peu d'appels de rendu."""

    def __init__(self, name, materials, uv=False):
        self.name = name
        self.materials = materials
        self.bm = bmesh.new()
        # UV seulement là où le site les lit (identifiant des vitres) : le GLB reste léger.
        self.uv = self.bm.loops.layers.uv.new("UVMap") if uv else None

    def _faces(self, verts, mat, smooth=False):
        for face in {f for v in verts for f in v.link_faces}:
            face.material_index = mat
            face.smooth = smooth
            yield face

    def box(self, x0, x1, y0, y1, z0, z1, mat=0, window=None):
        x0, x1 = sorted((x0, x1))
        y0, y1 = sorted((y0, y1))
        z0, z1 = sorted((z0, z1))
        verts = bmesh.ops.create_cube(self.bm, size=1.0)["verts"]
        bmesh.ops.scale(self.bm, vec=Vector((x1 - x0, y1 - y0, z1 - z0)), verts=verts)
        bmesh.ops.translate(self.bm, vec=Vector(((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2)), verts=verts)
        for face in self._faces(verts, mat):
            if window is not None and self.uv is not None:
                for loop in face.loops:
                    loop[self.uv].uv = (window, (loop.vert.co.z - z0) / (z1 - z0))

    def prism(self, profile, axis, a0, a1, mat=0):
        """Extrusion d'un profil 2D (plan perpendiculaire à `axis`) entre a0 et a1."""
        others = [i for i in range(3) if i != axis]

        def point(u, v, a):
            p = [0.0, 0.0, 0.0]
            p[axis], p[others[0]], p[others[1]] = a, u, v
            return self.bm.verts.new(p)

        start = [point(u, v, a0) for u, v in profile]
        end = [point(u, v, a1) for u, v in profile]
        faces = [self.bm.faces.new(start), self.bm.faces.new(list(reversed(end)))]
        for i in range(len(profile)):
            j = (i + 1) % len(profile)
            faces.append(self.bm.faces.new((start[i], start[j], end[j], end[i])))
        for face in faces:
            face.material_index = mat

    def cylinder(self, center, radius, depth, mat=0, segments=16, radius_top=None):
        geom = bmesh.ops.create_cone(
            self.bm, cap_ends=True, segments=segments, radius1=radius,
            radius2=radius if radius_top is None else radius_top, depth=depth,
            matrix=Matrix.Translation(Vector(center)),
        )
        list(self._faces(geom["verts"], mat, smooth=True))

    def sphere(self, center, radius, mat=0):
        geom = bmesh.ops.create_uvsphere(self.bm, u_segments=20, v_segments=12, radius=radius,
                                         matrix=Matrix.Translation(Vector(center)))
        list(self._faces(geom["verts"], mat, smooth=True))

    def build(self, collection, location=(0.0, 0.0, 0.0)):
        bmesh.ops.recalc_face_normals(self.bm, faces=self.bm.faces)
        mesh = bpy.data.meshes.new(self.name)
        self.bm.to_mesh(mesh)
        self.bm.free()
        obj = bpy.data.objects.new(self.name, mesh)
        for name in self.materials:
            obj.data.materials.append(MAT[name])
        collection.objects.link(obj)
        obj.location = location
        return obj


def wall(b, x0, x1, y0, y1, z0, z1, openings, mat=0):
    """Mur percé : trumeaux entre les baies, allège et linteau au-dessous / au-dessus de chaque baie."""
    x = x0
    for ox0, ox1, oz0, oz1 in sorted(openings):
        if ox0 > x:
            b.box(x, ox0, y0, y1, z0, z1, mat)
        if oz0 > z0:
            b.box(ox0, ox1, y0, y1, z0, oz0, mat)
        if oz1 < z1:
            b.box(ox0, ox1, y0, y1, oz1, z1, mat)
        x = ox1
    if x < x1:
        b.box(x, x1, y0, y1, z0, z1, mat)


def window(glass, frames, x0, x1, z0, z1, wid, y=0.16):
    """Vitre en retrait (identifiant de fenêtre dans les UV), dormant, meneau et imposte."""
    glass.box(x0, x1, y, y + 0.03, z0, z1, window=wid)
    t = 0.065
    for box in ((x0, x0 + t, z0, z1), (x1 - t, x1, z0, z1), (x0, x1, z0, z0 + t), (x0, x1, z1 - t, z1)):
        frames.box(box[0], box[1], y - 0.04, y + 0.05, box[2], box[3])
    cx = (x0 + x1) / 2
    frames.box(cx - 0.03, cx + 0.03, y - 0.03, y + 0.04, z0, z1)
    zt = z0 + (z1 - z0) * 0.74
    frames.box(x0, x1, y - 0.03, y + 0.04, zt - 0.03, zt + 0.03)


def railing(b, p0, p1, z0, height, spacing=0.12):
    """Garde-corps en fonte entre deux points (alignés sur X ou sur Y) : barreaux, lisse basse, main courante."""
    (x0, y0), (x1, y1) = p0, p1
    length = math.hypot(x1 - x0, y1 - y0)
    n = max(2, int(length / spacing))
    for i in range(n + 1):
        x, y = x0 + (x1 - x0) * i / n, y0 + (y1 - y0) * i / n
        b.box(x - 0.012, x + 0.012, y - 0.012, y + 0.012, z0, z0 + height)
    for z, half, thick in ((z0 + height - 0.01, 0.03, 0.03), (z0 + 0.095, 0.015, 0.015)):
        if x0 == x1:
            b.box(x0 - half, x0 + half, y0, y1, z - thick, z + thick)
        else:
            b.box(x0, x1, y0 - half, y0 + half, z - thick, z + thick)


def new_collection(name):
    col = bpy.data.collections.new(name)
    bpy.context.scene.collection.children.link(col)
    return col


# ───────────────────────────── Façade ─────────────────────────────

def build_facade(col):
    rng = random.Random(7)
    stone = Builder("facade_stone", ["stone"])
    base = Builder("facade_base", ["stone_base"])
    glass = Builder("facade_windows", ["window"], uv=True)
    frames = Builder("facade_frames", ["frame"])
    iron = Builder("facade_railings", ["railing"])
    roof = Builder("facade_roof", ["roof"])
    brass = Builder("facade_brass", ["brass"])

    # Rez-de-chaussée à refends : porte cochère au centre, hautes baies de part et d'autre.
    side_bays = [c for c in BAYS if c != 0.0]
    wall(base, -FACADE_X, FACADE_X, 0.0, WALL, 0.0, RDC,
         [(DOOR[0], DOOR[1], 0.0, DOOR[2])] + [(c - 0.8, c + 0.8, 0.6, 3.4) for c in side_bays])
    for c in side_bays:
        window(glass, frames, c - 0.8, c + 0.8, 0.6, 3.4, rng.random())
        base.box(c - 0.95, c + 0.95, -0.12, 0.0, 0.42, 0.6)
    base.box(DOOR[0] - 0.3, DOOR[0], -0.08, 0.0, 0.0, DOOR[2] + 0.3)
    base.box(DOOR[1], DOOR[1] + 0.3, -0.08, 0.0, 0.0, DOOR[2] + 0.3)
    base.box(DOOR[0] - 0.3, DOOR[1] + 0.3, -0.08, 0.0, DOOR[2], DOOR[2] + 0.3)
    stone.box(-0.28, 0.28, -0.16, 0.0, DOOR[2] - 0.05, DOOR[2] + 0.55)
    brass.box(1.98, 2.36, -0.03, 0.0, 1.4, 1.66)  # plaque du bureau d'études
    stone.box(-FACADE_X - 0.25, FACADE_X + 0.25, -0.22, 0.0, 4.05, 4.25)
    stone.box(-FACADE_X - 0.35, FACADE_X + 0.35, -0.38, 0.0, 4.25, 4.55)

    for k, (zb, h) in enumerate(FLOORS):
        z0, z1 = zb + 0.12, zb + h - 0.62
        wall(stone, -FACADE_X, FACADE_X, 0.0, WALL, zb, zb + h, [(c - 0.65, c + 0.65, z0, z1) for c in BAYS])
        for c in BAYS:
            window(glass, frames, c - 0.65, c + 0.65, z0, z1, rng.random())
            # Chambranle, et à l'étage noble table de couronnement + clef.
            stone.box(c - 0.82, c - 0.65, -0.06, 0.0, z0, z1 + 0.17)
            stone.box(c + 0.65, c + 0.82, -0.06, 0.0, z0, z1 + 0.17)
            stone.box(c - 0.82, c + 0.82, -0.06, 0.0, z1, z1 + 0.17)
            if k == 0:
                stone.box(c - 0.98, c + 0.98, -0.2, 0.0, z1 + 0.17, z1 + 0.3)
                stone.box(c - 0.16, c + 0.16, -0.14, 0.0, z1 - 0.05, z1 + 0.32)
            if k not in BALCONIES:
                railing(iron, (c - 0.62, -0.05), (c + 0.62, -0.05), zb + 0.12, 0.95, spacing=0.15)
        if k in BALCONIES:
            # Balcon filant sur consoles, garde-corps en fonte retourné sur les côtés.
            stone.box(-FACADE_X - 0.1, FACADE_X + 0.1, -0.95, 0.0, zb - 0.2, zb)
            for px in PIERS:
                stone.box(px - 0.13, px + 0.13, -0.75, 0.0, zb - 0.62, zb - 0.2)
            railing(iron, (-FACADE_X - 0.02, -0.88), (FACADE_X + 0.02, -0.88), zb, 1.0, spacing=0.16)
            for sx in (-1, 1):
                railing(iron, (sx * (FACADE_X + 0.02), -0.88), (sx * (FACADE_X + 0.02), -0.05), zb, 1.0, spacing=0.16)
        elif k > 0:
            stone.box(-FACADE_X - 0.1, FACADE_X + 0.1, -0.1, 0.0, zb - 0.12, zb + 0.04)

    # Corniche, chaînes d'angle et murs mitoyens (le volume de l'immeuble).
    stone.box(-FACADE_X - 0.2, FACADE_X + 0.2, -0.3, 0.0, TOP - 0.45, TOP - 0.2)
    stone.box(-FACADE_X - 0.35, FACADE_X + 0.35, -0.55, 0.0, TOP - 0.2, TOP + 0.12)
    for sx in (-1, 1):
        stone.box(sx * (FACADE_X - 0.15), sx * (FACADE_X + 0.25), -0.12, 0.0, RDC + 0.55, TOP - 0.45)
        stone.box(sx * FACADE_X, sx * (FACADE_X + 0.25), 0.0, DEPTH, 0.0, TOP + 0.12)

    # Comble à la Mansart, lucarnes à fronton, souches de cheminée.
    roof.prism([(-0.25, TOP + 0.12), (1.05, TOP + 3.1), (DEPTH, TOP + 3.1), (DEPTH, TOP + 0.12)], 0,
               -FACADE_X - 0.25, FACADE_X + 0.25)
    for c in BAYS:
        stone.box(c - 0.72, c + 0.72, 0.3, 1.8, TOP + 0.4, TOP + 2.1)
        window(glass, frames, c - 0.45, c + 0.45, TOP + 0.55, TOP + 1.85, rng.random(), y=0.26)
        roof.prism([(c - 0.86, TOP + 2.1), (c + 0.86, TOP + 2.1), (c, TOP + 2.75)], 1, 0.15, 1.9)
    for cx in (-4.6, 4.6):
        stone.box(cx - 0.5, cx + 0.5, 4.2, 5.4, TOP + 3.1, TOP + 4.4)
        stone.box(cx - 0.58, cx + 0.58, 4.12, 5.48, TOP + 4.4, TOP + 4.55)
        for k in range(3):
            frames.cylinder((cx - 0.3 + k * 0.3, 4.8, TOP + 4.7), 0.07, 0.3, segments=10)

    for b in (stone, base, glass, frames, iron, roof, brass):
        b.build(col)


def build_door(col, side):
    """Vantail de porte cochère, origine sur l'axe des gonds (rotation autour de Z vers le hall)."""
    b = Builder(f"door_{'left' if side < 0 else 'right'}", ["door", "brass"])
    w = (DOOR[1] - DOOR[0]) / 2

    def leaf(u0, u1, y0, y1, z0, z1, mat=0):
        # u : distance au gond, vers l'axe de la porte (le vantail droit est le miroir du gauche).
        if side < 0:
            b.box(u0, u1, y0, y1, z0, z1, mat)
        else:
            b.box(-u1, -u0, y0, y1, z0, z1, mat)

    leaf(0.0, w, -0.05, 0.05, 0.0, DOOR[2])
    for z0, z1 in ((0.3, 1.45), (1.7, 3.3)):
        leaf(0.18, w - 0.14, -0.09, -0.05, z0, z1)
        leaf(0.18, w - 0.14, 0.05, 0.09, z0, z1)
        leaf(0.26, w - 0.22, -0.11, -0.09, z0 + 0.08, z1 - 0.08)
    leaf(w - 0.2, w - 0.07, -0.19, -0.09, 1.12, 1.24, mat=1)  # bouton
    leaf(0.0, w, -0.07, -0.05, 0.0, 0.2, mat=1)  # plinthe de laiton
    return b.build(col, location=(DOOR[0] if side < 0 else DOOR[1], WALL / 2, 0.0))


# ───────────────────────────── Hall et rue ─────────────────────────────

def build_hall(col):
    floor = Builder("hall_floor", ["floor"])
    walls = Builder("hall_walls", ["wall_in"])
    board = Builder("hall_board", ["board"])
    frames = Builder("hall_frames", ["frame", "brass"])
    lamps = Builder("hall_lamps", ["lamp"])
    door = Builder("hall_door", ["door"])
    x0, x1 = HALL
    back = DEPTH - 0.2

    floor.box(x0, x1, WALL, back, -0.05, 0.0)
    walls.box(x0 - 0.2, x1 + 0.2, WALL, DEPTH, HALL_H, HALL_H + 0.2)
    walls.box(x0 - 0.2, x0, WALL, DEPTH, 0.0, HALL_H)
    walls.box(x1, x1 + 0.2, WALL, DEPTH, 0.0, HALL_H)
    walls.box(x0 - 0.2, x1 + 0.2, back, DEPTH, 0.0, HALL_H)
    for y in (2.6, 5.2, 7.8):
        walls.box(x0, x0 + 0.18, y - 0.22, y + 0.22, 0.0, HALL_H)
        walls.box(x1 - 0.18, x1, y - 0.22, y + 0.22, 0.0, HALL_H)
    walls.box(x0, x0 + 0.12, WALL, back, HALL_H - 0.22, HALL_H)
    walls.box(x1 - 0.12, x1, WALL, back, HALL_H - 0.22, HALL_H)
    walls.box(x0, x1, back - 0.12, back, HALL_H - 0.22, HALL_H)
    frames.box(x0, x0 + 0.03, WALL, back, 0.0, 0.16)
    frames.box(x1 - 0.03, x1, WALL, back, 0.0, 0.16)

    # Tableau du fond : le formulaire s'y affiche.
    board.box(-2.9, 2.9, back - 0.06, back, 0.55, 3.85)
    for bx0, bx1, bz0, bz1 in ((-2.98, -2.9, 0.47, 3.93), (2.9, 2.98, 0.47, 3.93), (-2.98, 2.98, 0.47, 0.55), (-2.98, 2.98, 3.85, 3.93)):
        frames.box(bx0, bx1, back - 0.1, back, bz0, bz1)

    # Porte de la loge (mur gauche) et boîtes aux lettres (mur droit), dans le champ autour du tableau.
    door.box(x0, x0 + 0.06, 8.3, 9.3, 0.0, 2.3)
    frames.box(x0, x0 + 0.09, 8.2, 8.3, 0.0, 2.4)
    frames.box(x0, x0 + 0.09, 9.3, 9.4, 0.0, 2.4)
    frames.box(x0, x0 + 0.09, 8.2, 9.4, 2.3, 2.4)
    frames.box(x0 + 0.06, x0 + 0.12, 9.1, 9.18, 1.0, 1.1, mat=1)
    for row in range(3):
        for col_ in range(5):
            y, z = 8.2 + col_ * 0.3, 1.1 + row * 0.28
            frames.box(x1 - 0.2, x1, y, y + 0.27, z, z + 0.25)
            frames.box(x1 - 0.215, x1 - 0.2, y + 0.06, y + 0.21, z + 0.15, z + 0.18, mat=1)

    # Suspensions (vues pendant la traversée) et appliques encadrant le tableau.
    for y in (3.0, 7.0):
        lamps.sphere((0.0, y, 3.72), 0.2)
        frames.box(-0.012, 0.012, y - 0.012, y + 0.012, 3.9, HALL_H)
    for sx in (-1, 1):
        lamps.sphere((sx * 3.35, back - 0.26, 2.75), 0.12)
        frames.box(sx * 3.35 - 0.025, sx * 3.35 + 0.025, back - 0.2, back, 2.55, 2.63, mat=1)

    floor.build(col)
    for b in (walls, board, frames, lamps, door):
        b.build(col)


def build_street(col):
    pave = Builder("street_pavement", ["pavement"])
    iron = Builder("street_iron", ["railing"])
    lamps = Builder("street_lamps", ["lamp"])
    pave.box(-16.0, 16.0, -4.6, 0.0, -0.15, 0.0)
    pave.box(-16.0, 16.0, -4.75, -4.6, -0.17, 0.02)
    for x in (-9.5, 9.5):
        iron.cylinder((x, -3.9, 0.25), 0.17, 0.5)
        iron.cylinder((x, -3.9, 2.45), 0.07, 3.9, radius_top=0.05)
        lamps.box(x - 0.2, x + 0.2, -4.1, -3.7, 4.4, 4.95)
        iron.cylinder((x, -3.9, 5.1), 0.33, 0.3, radius_top=0.02)
    pave.build(col)
    iron.build(col)
    lamps.build(col)


# ───────────────────────────── Caméra et vantaux ─────────────────────────────

def to_blender(v):
    x, y, z = v
    return Vector((x, -z, y))


def animate(col, doors, keys):
    scene = bpy.context.scene
    scene.name = "devis_enter"
    scene.render.fps = keys["fps"]
    scene.frame_start, scene.frame_end = 0, keys["keys"][-1]["frame"]

    target = bpy.data.objects.new("devis_target", None)
    mount = bpy.data.objects.new("devis_mount", None)
    cam_data = bpy.data.cameras.new("devis_camera")
    cam_data.lens_unit = "FOV"
    cam_data.sensor_fit = "VERTICAL"
    cam_data.angle_y = math.radians(keys["fov"])
    cam_data.clip_start, cam_data.clip_end = 0.05, 300.0
    camera = bpy.data.objects.new("devis_camera", cam_data)
    for obj in (target, mount, camera):
        col.objects.link(obj)
    camera.parent = mount
    scene.camera = camera
    track = mount.constraints.new(type="TRACK_TO")
    track.target = target
    track.track_axis, track.up_axis = "TRACK_NEGATIVE_Z", "UP_Y"
    for key in keys["keys"]:
        mount.location = to_blender(key["position"])
        mount.keyframe_insert("location", frame=key["frame"])
        target.location = to_blender(key["target"])
        target.keyframe_insert("location", frame=key["frame"])

    # Contrainte "viser la cible" cuite en clés (position + quaternion) : le glTF ne connaît pas les contraintes.
    depsgraph = bpy.context.evaluated_depsgraph_get()
    samples = []
    for frame in range(scene.frame_start, scene.frame_end + 1):
        scene.frame_set(frame)
        m = mount.evaluated_get(depsgraph).matrix_world.copy()
        samples.append((frame, m.to_translation(), m.to_quaternion()))
    mount.constraints.clear()
    mount.animation_data_clear()
    mount.rotation_mode = "QUATERNION"
    previous = None
    for frame, location, rotation in samples:
        if previous is not None and previous.dot(rotation) < 0:
            rotation.negate()
        previous = rotation
        mount.location, mount.rotation_quaternion = location, rotation
        mount.keyframe_insert("location", frame=frame)
        mount.keyframe_insert("rotation_quaternion", frame=frame)
    col.objects.unlink(target)

    # Ouverture des vantaux vers le hall, synchronisée avec l'approche de la caméra.
    angle = math.radians(keys["door"]["angle"])
    for door, sign in doors:
        door.rotation_euler = (0.0, 0.0, 0.0)
        door.keyframe_insert("rotation_euler", index=2, frame=keys["door"]["from"])
        door.rotation_euler = (0.0, 0.0, sign * angle)
        door.keyframe_insert("rotation_euler", index=2, frame=keys["door"]["to"])
    scene.frame_set(0)


def export(col, filename):
    bpy.ops.object.select_all(action="DESELECT")
    for obj in col.all_objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = col.all_objects[0]
    path = os.path.join(OUT, filename)
    options = dict(
        filepath=path, export_format="GLB", use_selection=True, export_apply=True, export_yup=True,
        export_materials="EXPORT", export_cameras=True, export_animations=True,
        export_animation_mode="SCENE", export_force_sampling=True, export_frame_range=True,
        export_optimize_animation_size=False, export_extras=False, export_texcoords=True,
    )
    supported = {p.identifier for p in bpy.ops.export_scene.gltf.get_rna_type().properties}
    bpy.ops.export_scene.gltf(**{k: v for k, v in options.items() if k in supported})
    print(f"[devis_building] {filename} : {os.path.getsize(path) // 1024} Ko")


def preview(directory, keys):
    """Aperçus Cycles (CPU) de chaque clé caméra : contrôle visuel du modèle, hors export."""
    os.makedirs(directory, exist_ok=True)
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.device = "CPU"
    scene.cycles.samples = 24
    scene.render.resolution_x, scene.render.resolution_y = 800, 450
    world = bpy.data.worlds.new("preview")
    world.color = (0.02, 0.03, 0.06)
    scene.world = world
    lights = new_collection("PreviewLights")
    sun = bpy.data.objects.new("sun", bpy.data.lights.new("sun", "SUN"))
    sun.data.energy = 2.5
    sun.rotation_euler = (math.radians(55), 0, math.radians(-30))
    lights.objects.link(sun)
    for x, y, z in ((0, 3.0, 3.6), (0, 7.0, 3.6), (0, -6.0, 6.0)):
        lamp = bpy.data.objects.new("lamp", bpy.data.lights.new("lamp", "POINT"))
        lamp.data.energy = 400
        lamp.location = (x, y, z)
        lights.objects.link(lamp)
    for key in keys["keys"]:
        scene.frame_set(key["frame"])
        scene.render.filepath = os.path.join(directory, f"devis_{key['frame']:03d}_{key['name']}.png")
        bpy.ops.render.render(write_still=True)


if __name__ == "__main__":
    args = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    with open(KEYS, encoding="utf-8") as f:
        camera_keys = json.load(f)
    os.makedirs(OUT, exist_ok=True)
    reset()
    create_materials()
    building = new_collection("DevisBuilding")
    build_facade(building)
    left = build_door(building, -1)
    right = build_door(building, 1)
    build_hall(building)
    build_street(building)
    animate(building, [(left, 1), (right, -1)], camera_keys)
    export(building, "devis_building.glb")
    if "--preview" in args:
        preview(args[args.index("--preview") + 1], camera_keys)
