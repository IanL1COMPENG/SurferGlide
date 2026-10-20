import bpy
print("Blender", bpy.app.version_string)
print("Objects", [(obj.name, obj.type) for obj in bpy.context.scene.objects])
print("GLTF animation options", [(p.identifier, getattr(p, 'default', None)) for p in bpy.ops.export_scene.gltf.get_rna_type().properties if 'anim' in p.identifier or p.identifier in ('use_selection','export_format','export_skins','export_extras')])
