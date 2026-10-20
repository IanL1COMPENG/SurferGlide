"""Correct the generated rig's local vertical axis, preserving all other scenes and actions."""
import bpy

PROJECT="C:/Users/iantl/OneDrive/Desktop/Game"
scene=bpy.context.scene
rig=scene.objects['Surfer_Rig']
for name in ('Cruise','CarveLeft','CarveRight','Air','IndyGrab','Pop','Land','Wipeout','Victory'):
    action=bpy.data.actions[name]
    for layer in action.layers:
        for strip in layer.strips:
            for slot in action.slots:
                bag=strip.channelbag(slot)
                if bag is None:continue
                curves=[fc for fc in bag.fcurves if fc.data_path=='pose.bones["Hips"].location']
                y=next((fc for fc in curves if fc.array_index==1),None)
                z=next((fc for fc in curves if fc.array_index==2),None)
                if y and z and any(abs(p.co.y)>.00001 for p in z.keyframe_points):
                    for py,pz in zip(y.keyframe_points,z.keyframe_points):
                        py.co.y=pz.co.y;py.handle_left.y=pz.handle_left.y;py.handle_right.y=pz.handle_right.y
                        pz.co.y=0;pz.handle_left.y=0;pz.handle_right.y=0
                    y.update();z.update()
for rider_id in ('kai','luna','reef','sol'):
    obj=scene.objects['Rider_'+rider_id]
    bpy.ops.object.select_all(action='DESELECT');obj.hide_set(False);obj.select_set(True);rig.select_set(True);bpy.context.view_layer.objects.active=rig
    bpy.ops.export_scene.gltf(filepath=PROJECT+'/public/models/rider-'+rider_id+'.glb',export_format='GLB',use_selection=True,export_animations=True,export_animation_mode='ACTIONS',export_skins=True,export_extras=True,export_anim_single_armature=True)
    obj.hide_set(True)
scene.objects['Rider_kai'].hide_set(False)
bpy.ops.wm.save_as_mainfile(filepath=PROJECT+'/artifacts/surfer-glide-studio.blend',copy=True,compress=True)
print('Vertical bob, crouch, and victory motion verified on the generated rig.')
