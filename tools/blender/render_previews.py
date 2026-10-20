"""Render the selected game assets to transparent UI thumbnails without modifying other scenes."""
import bpy
from mathutils import Vector

PROJECT = "C:/Users/iantl/OneDrive/Desktop/Game"
scene = bpy.context.scene
scene.render.engine = 'CYCLES'
scene.cycles.samples = 16
scene.view_settings.exposure = -.6
scene.world.use_nodes = True
scene.world.node_tree.nodes['Background'].inputs['Color'].default_value = (.75,.88,1,1)
scene.world.node_tree.nodes['Background'].inputs['Strength'].default_value = .7
scene.display.shading.light = 'STUDIO'
scene.display.shading.color_type = 'MATERIAL'
scene.display.shading.show_shadows = True
scene.display.shading.show_cavity = False
scene.display.shading.cavity_type = 'BOTH'
scene.display.shading.curvature_ridge_factor = 1.15
scene.display.shading.curvature_valley_factor = 1.0
scene.render.film_transparent = True
scene.render.resolution_percentage = 100
scene.camera.data.type = 'ORTHO'
rig = scene.objects.get('Surfer_Rig')
rig.animation_data.action = bpy.data.actions['Cruise']
scene.frame_set(1)
boards = [obj for obj in scene.objects if obj.name.startswith('Board_')]
riders = [obj for obj in scene.objects if obj.name.startswith('Rider_')]
for obj in boards + riders:
    obj.hide_render = True
    obj.hide_set(False)
for board in boards:
    board.hide_render = False
    scene.camera.location = (3.7, 4.4, 3.3)
    scene.camera.rotation_euler = (Vector((0, 0, .15)) - scene.camera.location).to_track_quat('-Z', 'Y').to_euler()
    scene.camera.data.ortho_scale = 3.55
    scene.render.resolution_x = 512
    scene.render.resolution_y = 320
    scene.render.filepath = PROJECT + '/public/previews/' + board.name.lower().replace('_', '-') + '.png'
    bpy.ops.render.render(write_still=True)
    board.hide_render = True
    print('PREVIEW', board.name)
board = scene.objects['Board_daybreak']
board.hide_render = False
for rider in riders:
    rider.hide_render = False
    scene.camera.location = (4.5, 7, 3.5)
    scene.camera.rotation_euler = (Vector((0, 0, 1.37)) - scene.camera.location).to_track_quat('-Z', 'Y').to_euler()
    scene.camera.data.ortho_scale = 3.3
    scene.render.resolution_x = 400
    scene.render.resolution_y = 480
    scene.render.filepath = PROJECT + '/public/previews/' + rider.name.lower().replace('_', '-') + '.png'
    bpy.ops.render.render(write_still=True)
    rider.hide_render = True
    print('PREVIEW', rider.name)
scene.objects['Rider_kai'].hide_render = False
scene.render.engine = 'CYCLES'
print('Ten transparent Blender thumbnails complete.')
