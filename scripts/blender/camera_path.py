"""
Génère la trajectoire caméra du site (public/models/camera_paths.glb) avec Blender.

Même principe que les sites WebGL primés (ICG Gallery…) : la caméra est animée
dans un logiciel 3D, exportée en glTF, puis le site "scrubbe" l'animation avec le scroll.

  build  : construit la maquette du bâtiment + le rig caméra à partir des JSON,
           enregistre scripts/blender/camera_path.blend (éditable), puis exporte.
           blender -b -P scripts/blender/camera_path.py -- build

  export : ré-exporte depuis un .blend retouché à la main dans Blender.
           blender -b scripts/blender/camera_path.blend -P scripts/blender/camera_path.py -- export

Rig : un Empty "camera_mount" (positions clés) suit un Empty "camera_target" via une
contrainte Track To ; la caméra "camera_main" est enfant du mount. À l'export,
la contrainte est "bakée" image par image dans une action nommée "camera_path".
"""

import json
import math
import os
import sys

import bpy
from mathutils import Vector

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
KEYS_PATH = os.path.join(HERE, "camera_keys.json")
BUILDING_PATH = os.path.join(ROOT, "components", "experience", "building.json")
BLEND_PATH = os.path.join(HERE, "camera_path.blend")
GLB_PATH = os.path.join(ROOT, "public", "models", "camera_paths.glb")

MOUNT, TARGET, CAMERA, ACTION = "camera_mount", "camera_target", "camera_main", "camera_path"


def to_blender(v):
    """Three.js (Y-up) -> Blender (Z-up). L'export glTF (+Y up) fait l'inverse."""
    x, y, z = v
    return Vector((x, -z, y))


def load_json(path):
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def collection(name):
    col = bpy.data.collections.get(name) or bpy.data.collections.new(name)
    if col.name not in bpy.context.scene.collection.children:
        bpy.context.scene.collection.children.link(col)
    return col


def add_box(col, name, center, size, color):
    """Boîte alignée sur les axes ; center/size en coordonnées Three.js."""
    cx, cy, cz = to_blender(center)
    sx, sy, sz = size[0] / 2, size[2] / 2, size[1] / 2
    verts = [(cx + dx * sx, cy + dy * sy, cz + dz * sz) for dz in (-1, 1) for dy in (-1, 1) for dx in (-1, 1)]
    faces = [(0, 1, 3, 2), (4, 6, 7, 5), (0, 4, 5, 1), (2, 3, 7, 6), (0, 2, 6, 4), (1, 5, 7, 3)]
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(verts, [], faces)
    obj = bpy.data.objects.new(name, mesh)
    obj.color = color
    col.objects.link(obj)
    return obj


def build_proxy(b):
    """Maquette simplifiée : sert uniquement de repère pour régler les plans caméra."""
    col = collection("Proxy_Building")
    concrete, accent = (0.62, 0.64, 0.68, 1), (0.25, 0.75, 1.0, 1)
    h, n = b["storeyHeight"], b["storeys"]
    xs, zs = b["columnsX"], b["columnsZ"]
    ov, t = b["slabOverhang"], b["slabThickness"]
    w = (xs[-1] - xs[0]) + 2 * ov
    d = (zs[-1] - zs[0]) + 2 * ov
    raft = b["raft"]
    add_box(col, "raft", (0, -raft["thickness"] / 2, 0),
            (xs[-1] - xs[0] + 2 * raft["margin"], raft["thickness"], zs[-1] - zs[0] + 2 * raft["margin"]), concrete)
    for level in range(1, n + 1):
        add_box(col, f"slab_{level}", (0, level * h - t / 2, 0), (w, t, d), concrete)
        bal = b["balcony"]
        add_box(col, f"balcony_{level}", ((bal["fromX"] + bal["toX"]) / 2, level * h - t / 2, zs[-1] + ov + bal["depth"] / 2),
                (bal["toX"] - bal["fromX"], t, bal["depth"]), concrete)
    for x in xs:
        for z in zs:
            add_box(col, f"column_{x}_{z}", (x, n * h / 2, z), (b["columnSize"], n * h, b["columnSize"]), concrete)
    core = b["core"]
    add_box(col, "core", (core["x"], n * h / 2, core["z"]), (core["width"], n * h, core["depth"]), accent)


def build_rig(keys):
    col = collection("Camera_Rig")
    scene = bpy.context.scene
    scene.render.fps = keys["fps"]
    scene.frame_start, scene.frame_end = 0, keys["frames"]
    scene.render.resolution_x, scene.render.resolution_y = 1920, 1080

    target = bpy.data.objects.new(TARGET, None)
    target.empty_display_type, target.empty_display_size = "SPHERE", 0.5
    mount = bpy.data.objects.new(MOUNT, None)
    mount.empty_display_type, mount.empty_display_size = "ARROWS", 1.0
    cam_data = bpy.data.cameras.new(CAMERA)
    cam_data.lens_unit = "FOV"
    cam_data.sensor_fit = "VERTICAL"
    cam_data.angle_y = math.radians(keys["fov"])
    cam_data.clip_start, cam_data.clip_end = 0.1, 500
    camera = bpy.data.objects.new(CAMERA, cam_data)
    for obj in (target, mount, camera):
        col.objects.link(obj)
    camera.parent = mount
    scene.camera = camera

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
        marker = scene.timeline_markers.new(key["name"], frame=frame)
        marker.camera = camera


def bake_and_export():
    scene = bpy.context.scene
    mount, camera = bpy.data.objects[MOUNT], bpy.data.objects[CAMERA]
    depsgraph = bpy.context.evaluated_depsgraph_get()

    samples = []
    for frame in range(scene.frame_start, scene.frame_end + 1):
        scene.frame_set(frame)
        matrix = mount.evaluated_get(depsgraph).matrix_world.copy()
        samples.append((frame, matrix.to_translation(), matrix.to_quaternion()))

    mount.constraints.clear()
    mount.animation_data_clear()
    mount.rotation_mode = "QUATERNION"
    previous = None
    for frame, location, rotation in samples:
        if previous is not None and previous.dot(rotation) < 0:
            rotation.negate()  # évite les retournements d'interpolation
        previous = rotation
        mount.location, mount.rotation_quaternion = location, rotation
        mount.keyframe_insert("location", frame=frame)
        mount.keyframe_insert("rotation_quaternion", frame=frame)
    mount.animation_data.action.name = ACTION

    bpy.ops.object.select_all(action="DESELECT")
    for obj in (mount, camera):
        obj.select_set(True)
    bpy.context.view_layer.objects.active = mount

    os.makedirs(os.path.dirname(GLB_PATH), exist_ok=True)
    options = dict(
        filepath=GLB_PATH, export_format="GLB", use_selection=True, export_cameras=True,
        export_animations=True, export_animation_mode="ACTIONS", export_force_sampling=True,
        export_frame_range=True, export_optimize_animation_size=False, export_materials="NONE",
        export_yup=True, export_apply=False, export_extras=False,
    )
    supported = {p.identifier for p in bpy.ops.export_scene.gltf.get_rna_type().properties}
    bpy.ops.export_scene.gltf(**{k: v for k, v in options.items() if k in supported})
    print(f"[camera_path] {len(samples)} images exportées -> {GLB_PATH}")


def main():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    mode = argv[0] if argv else "build"
    if mode == "build":
        bpy.ops.wm.read_factory_settings(use_empty=True)
        build_proxy(load_json(BUILDING_PATH))
        build_rig(load_json(KEYS_PATH))
        bpy.ops.wm.save_as_mainfile(filepath=BLEND_PATH)
        print(f"[camera_path] rig éditable -> {BLEND_PATH}")
    bake_and_export()  # le .blend n'est pas ré-enregistré : il garde le rig éditable


if __name__ == "__main__":
    main()
