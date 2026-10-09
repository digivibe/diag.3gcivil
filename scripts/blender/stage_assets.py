"""
Modélise et exporte les assets 3D des sections Prestations / Réalisations (GLB dans public/models/).

  blender -b --factory-startup -P scripts/blender/stage_assets.py      (ou : npm run assets:build)

  drone.glb         drone d'inspection (biseaux, hélices bipales vrillées, nacelle caméra, patins)
  heb.glb           linteau HEB 300 : congés âme/semelles, raidisseurs, platines, tiges d'ancrage + écrous
  dossier.glb       dossier d'archive : coins arrondis, onglet, chants biseautés (matériau "dossier_edge")
  stage_camera.glb  trajectoire caméra de la scène des prestations (même principe que camera_paths.glb)

Conventions : Blender est Z-up ; l'export glTF (+Y up) convertit. L'avant du drone et la face photo
du dossier regardent vers -Y (Blender), c'est-à-dire +Z côté Three.js. Les noms d'objets et de
matériaux sont lus par le site (components/prestations/*, components/archive/*).
"""

import json
import math
import os

import bmesh
import bpy
from mathutils import Matrix, Vector

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
OUT = os.path.join(ROOT, "public", "models")
STAGE_KEYS = os.path.join(HERE, "stage_camera_keys.json")


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def material(name, color, roughness=0.5, metallic=0.0):
    mat = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    mat.diffuse_color = (*color, 1.0)
    mat.roughness = roughness
    mat.metallic = metallic
    return mat


def mesh_object(name, bm, mats, collection):
    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()
    for poly in mesh.polygons:
        poly.use_smooth = True
    obj = bpy.data.objects.new(name, mesh)
    for mat in mats:
        obj.data.materials.append(mat)
    collection.objects.link(obj)
    return obj


def add_bevel(obj, width, segments=3, angle=40, material_index=-1):
    mod = obj.modifiers.new("Bevel", "BEVEL")
    mod.width = width
    mod.segments = segments
    mod.limit_method = "ANGLE"
    mod.angle_limit = math.radians(angle)
    mod.harden_normals = True
    mod.material = material_index
    return mod


def cube(name, size, location, mats, collection, rotation=(0, 0, 0)):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.scale(bm, vec=Vector(size), verts=bm.verts)
    obj = mesh_object(name, bm, mats, collection)
    obj.location = location
    obj.rotation_euler = rotation
    return obj


def cylinder(name, radius, depth, location, mats, collection, segments=24, rotation=(0, 0, 0)):
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=segments, radius1=radius, radius2=radius, depth=depth)
    obj = mesh_object(name, bm, mats, collection)
    obj.location = location
    obj.rotation_euler = rotation
    return obj


def sphere(name, radius, location, mats, collection, scale=(1, 1, 1)):
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=24, v_segments=14, radius=radius)
    bmesh.ops.scale(bm, vec=Vector(scale), verts=bm.verts)
    obj = mesh_object(name, bm, mats, collection)
    obj.location = location
    return obj


def new_collection(name):
    col = bpy.data.collections.new(name)
    bpy.context.scene.collection.children.link(col)
    return col


def export(collection, filename, animations=False):
    bpy.ops.object.select_all(action="DESELECT")
    for obj in collection.all_objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = collection.all_objects[0]
    path = os.path.join(OUT, filename)
    options = dict(
        filepath=path, export_format="GLB", use_selection=True, export_apply=True, export_yup=True,
        export_materials="EXPORT", export_cameras=animations, export_animations=animations,
        export_animation_mode="ACTIONS", export_force_sampling=True, export_frame_range=True,
        export_optimize_animation_size=False, export_extras=False,
    )
    supported = {p.identifier for p in bpy.ops.export_scene.gltf.get_rna_type().properties}
    bpy.ops.export_scene.gltf(**{k: v for k, v in options.items() if k in supported})
    print(f"[stage_assets] {filename} : {os.path.getsize(path) // 1024} Ko")


# ───────────────────────────── Drone ─────────────────────────────

def build_drone():
    col = new_collection("Drone")
    body = material("drone_body", (0.07, 0.08, 0.1), 0.35, 0.3)
    shell = material("drone_shell", (0.8, 0.82, 0.85), 0.3)
    prop = material("drone_prop", (0.6, 0.85, 1.0), 0.2)
    led = material("drone_led", (1.0, 0.42, 0.12), 0.4)
    lens = material("drone_lens", (0.3, 0.8, 1.0), 0.1)

    hull = cube("drone_hull", (0.32, 0.32, 0.085), (0, 0, 0), [body], col)
    add_bevel(hull, 0.028, segments=4)
    canopy = sphere("drone_canopy", 0.12, (0, 0.012, 0.04), [shell], col, scale=(1.0, 1.18, 0.34))
    canopy.data.polygons.foreach_set("use_smooth", [True] * len(canopy.data.polygons))
    for i, (sx, sy) in enumerate([(1, -1), (-1, -1), (1, 1), (-1, 1)]):
        angle = math.atan2(sy, sx)
        arm = cylinder(f"drone_arm_{i}", 0.013, 0.2, (sx * 0.085, sy * 0.085, 0.0), [body], col, segments=12,
                       rotation=(0, math.pi / 2, angle))
        motor = cylinder(f"drone_motor_{i}", 0.032, 0.05, (sx * 0.15, sy * 0.15, 0.02), [body], col, segments=24)
        add_bevel(motor, 0.006, segments=2)
        # Hélice bipale, origine sur l'axe moteur (le site la fait tourner autour de son axe).
        bm = bmesh.new()
        for blade in (0, math.pi):
            geom = bmesh.ops.create_cube(bm, size=1.0)
            verts = geom["verts"]
            bmesh.ops.scale(bm, vec=Vector((0.13, 0.024, 0.004)), verts=verts)
            bmesh.ops.translate(bm, vec=Vector((0.068, 0, 0)), verts=verts)
            bmesh.ops.rotate(bm, cent=Vector((0.068, 0, 0)), matrix=Matrix.Rotation(math.radians(9), 3, "X"), verts=verts)
            bmesh.ops.rotate(bm, cent=Vector((0, 0, 0)), matrix=Matrix.Rotation(blade, 3, "Z"), verts=verts)
        hub = bmesh.ops.create_cone(bm, cap_ends=True, segments=12, radius1=0.012, radius2=0.012, depth=0.012)
        prop_obj = mesh_object(f"prop_{i}", bm, [prop], col)
        prop_obj.location = (sx * 0.15, sy * 0.15, 0.052)
        if i in (0, 1):
            sphere(f"drone_led_{i}", 0.011, (sx * 0.17, sy * 0.17, -0.005), [led], col)
    # Nacelle caméra à l'avant (-Y), objectif tourné vers l'avant.
    sphere("drone_gimbal", 0.036, (0, -0.135, -0.065), [body], col)
    cylinder("drone_lens", 0.016, 0.02, (0, -0.168, -0.065), [lens], col, segments=20, rotation=(math.pi / 2, 0, 0))
    for sx in (-1, 1):
        cylinder(f"drone_skid_{sx}", 0.008, 0.26, (sx * 0.1, 0, -0.125), [body], col, segments=10,
                 rotation=(math.pi / 2, 0, 0))
        for sy in (-1, 1):
            leg = cylinder(f"drone_leg_{sx}_{sy}", 0.007, 0.09, (sx * 0.085, sy * 0.07, -0.085), [body], col,
                           segments=10, rotation=(0, sx * math.radians(18), 0))
            leg.name = f"drone_leg_{'l' if sx < 0 else 'r'}{'f' if sy < 0 else 'b'}"
    export(col, "drone.glb")


# ───────────────────────────── HEB 300 ─────────────────────────────

def heb_profile(h=0.3, b=0.3, tw=0.016, tf=0.026, r=0.027, steps=6):
    """Contour (largeur, hauteur) d'un HEB avec congés de raccordement âme/semelles."""
    hw, hh = b / 2, h / 2
    pts = [(-hw, -hh), (hw, -hh), (hw, -hh + tf)]

    def fillet(cx, cy, a0, a1):
        return [(cx + r * math.cos(a0 + (a1 - a0) * k / steps), cy + r * math.sin(a0 + (a1 - a0) * k / steps))
                for k in range(steps + 1)]

    pts += fillet(tw / 2 + r, -hh + tf + r, -math.pi / 2, -math.pi)
    pts += fillet(tw / 2 + r, hh - tf - r, math.pi, math.pi / 2)
    pts += [(hw, hh - tf), (hw, hh), (-hw, hh), (-hw, hh - tf)]
    pts += fillet(-tw / 2 - r, hh - tf - r, math.pi / 2, 0)
    pts += fillet(-tw / 2 - r, -hh + tf + r, 0, -math.pi / 2)
    pts += [(-hw, -hh + tf)]
    return pts


def build_heb(length=3.2):
    col = new_collection("HEB")
    steel = material("steel", (0.32, 0.35, 0.39), 0.4, 0.8)
    anchor = material("anchor", (0.55, 0.58, 0.62), 0.3, 0.9)

    bm = bmesh.new()
    verts = [bm.verts.new((-length / 2, u, v)) for u, v in heb_profile()]
    face = bm.faces.new(verts)
    extruded = bmesh.ops.extrude_face_region(bm, geom=[face])
    bmesh.ops.translate(bm, vec=Vector((length, 0, 0)),
                        verts=[g for g in extruded["geom"] if isinstance(g, bmesh.types.BMVert)])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    beam = mesh_object("heb_beam", bm, [steel], col)
    add_bevel(beam, 0.003, segments=1, angle=60)

    for sx in (-1, 1):
        x = sx * 1.45
        # Raidisseurs d'about entre semelles, de part et d'autre de l'âme.
        for side in (-1, 1):
            cube(f"heb_stiffener_{sx}_{side}", (0.012, 0.13, 0.24), (x, side * 0.074, 0), [steel], col)
        plate = cube(f"heb_plate_{sx}", (0.34, 0.36, 0.025), (x, 0, -0.1625), [steel], col)
        add_bevel(plate, 0.004, segments=2)
        for dx in (-0.11, 0.11):
            for dy in (-0.13, 0.13):
                cylinder(f"heb_rod_{sx}_{dx}_{dy}", 0.011, 0.2, (x + dx, dy, -0.24), [anchor], col, segments=12)
                cylinder(f"heb_washer_{sx}_{dx}_{dy}", 0.025, 0.004, (x + dx, dy, -0.148), [anchor], col, segments=20)
                nut = cylinder(f"heb_nut_{sx}_{dx}_{dy}", 0.021, 0.016, (x + dx, dy, -0.138), [anchor], col, segments=6)
                add_bevel(nut, 0.002, segments=1)
    export(col, "heb.glb")


# ───────────────────────────── Dossier ─────────────────────────────

def build_dossier(width=3.2, height=2.2, depth=0.05):
    col = new_collection("Dossier")
    body = material("dossier_body", (0.12, 0.13, 0.16), 0.6)
    edge = material("dossier_edge", (0.37, 0.83, 1.0), 0.3)
    board = cube("dossier_board", (width + 0.08, depth, height + 0.08), (0, depth * 0.6, 0), [body, edge], col)
    add_bevel(board, 0.035, segments=4, angle=30, material_index=1)
    tab = cube("dossier_tab", (0.78, depth, 0.2), (-width / 2 + 0.55, depth * 0.6, height / 2 + 0.11), [body, edge], col)
    add_bevel(tab, 0.03, segments=3, angle=30, material_index=1)
    export(col, "dossier.glb")


# ───────────────────────────── Caméra de la scène des prestations ─────────────────────────────

def to_blender(v):
    x, y, z = v
    return Vector((x, -z, y))


def build_stage_camera():
    with open(STAGE_KEYS, encoding="utf-8") as f:
        keys = json.load(f)
    col = new_collection("StageCamera")
    scene = bpy.context.scene
    scene.render.fps = keys["fps"]
    scene.frame_start, scene.frame_end = 0, keys["frames"]
    scene.render.resolution_x, scene.render.resolution_y = 1000, 1000

    target = bpy.data.objects.new("stage_target", None)
    mount = bpy.data.objects.new("stage_mount", None)
    cam_data = bpy.data.cameras.new("stage_camera")
    cam_data.lens_unit = "FOV"
    cam_data.sensor_fit = "VERTICAL"
    cam_data.angle_y = math.radians(keys["fov"])
    camera = bpy.data.objects.new("stage_camera", cam_data)
    for obj in (target, mount, camera):
        col.objects.link(obj)
    camera.parent = mount
    track = mount.constraints.new(type="TRACK_TO")
    track.target = target
    track.track_axis, track.up_axis = "TRACK_NEGATIVE_Z", "UP_Y"

    count = len(keys["keys"])
    for i, key in enumerate(keys["keys"]):
        frame = round(i * keys["frames"] / (count - 1))
        mount.location = to_blender(key["position"])
        mount.keyframe_insert("location", frame=frame)
        target.location = to_blender(key["target"])
        target.keyframe_insert("location", frame=frame)

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
    mount.animation_data.action.name = "stage_path"
    col.objects.unlink(target)
    export(col, "stage_camera.glb", animations=True)


if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    for build in (build_drone, build_heb, build_dossier, build_stage_camera):
        reset()
        build()
