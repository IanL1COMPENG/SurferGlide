"""Original Surfer Glide character rigs and wakeboards, authored through Blender MCP.

Coordinates: X across the board, Y towards the boat, Z up. glTF exports Y-up.
"""
import bpy
import math
from mathutils import Vector

PROJECT = "C:/Users/iantl/OneDrive/Desktop/Game"
scene = bpy.data.scenes.new("Surfer Glide Asset Studio")
bpy.context.window.scene = scene
# Do not remove, purge, or overwrite any pre-existing scenes or datablocks.
scene.world = bpy.data.worlds.new("Surfer Studio World")
scene.world.color = (0.3, 0.4, 0.5)
scene.render.engine = 'CYCLES'
scene.cycles.samples = 24
scene.render.resolution_x = 512
scene.render.resolution_y = 512
scene.render.resolution_percentage = 100
scene.render.film_transparent = True
scene.view_settings.view_transform = 'Standard'
scene.render.image_settings.file_format = 'PNG'
scene.render.image_settings.color_mode = 'RGBA'
scene.render.fps = 30
scene.frame_start = 1
scene.frame_end = 60


def material(name, color, metallic=0.0, roughness=0.5, emission=0):
    m = bpy.data.materials.new(name)
    m.diffuse_color = (*color, 1)
    m.use_nodes = True
    bsdf = m.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = (*color, 1)
    bsdf.inputs['Metallic'].default_value = metallic
    bsdf.inputs['Roughness'].default_value = roughness
    if emission:
        bsdf.inputs['Emission Color'].default_value = (*color, 1)
        bsdf.inputs['Emission Strength'].default_value = emission
    return m


CREAM = material("Warm Ivory", (1.0, 0.95, 0.78), roughness=0.55)
NAVY = material("Deep Ocean", (0.025, 0.075, 0.16), roughness=0.55)
SOLE = material("Soft Rubber", (0.04, 0.13, 0.19), roughness=0.7)
GOLD = material("Champagne Gold", (1.0, 0.64, 0.16), metallic=0.65, roughness=0.26)
EYES = material("Expression Ink", (0.018, 0.028, 0.07), roughness=0.3)
WHITE = material("Eye Sparkle", (1, 1, 1), roughness=0.4)
PINK = material("Rosy Cheeks", (1.0, 0.35, 0.35), roughness=0.75)


def smooth(obj):
    for face in obj.data.polygons:
        face.use_smooth = True


def assign(obj, mat, bone=None):
    obj.data.materials.append(mat)
    if bone:
        group = obj.vertex_groups.new(name=bone)
        group.add(list(range(len(obj.data.vertices))), 1.0, 'REPLACE')
    return obj


def ball(name, loc, scale, mat, bone=None, segments=16):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments, ring_count=10, location=loc)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    smooth(obj)
    return assign(obj, mat, bone)


def cube(name, loc, scale, mat, bevel=0.05, bone=None):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if bevel:
        mod = obj.modifiers.new('Soft toy edges', 'BEVEL')
        mod.width = bevel
        mod.segments = 3
        bpy.ops.object.modifier_apply(modifier=mod.name)
    smooth(obj)
    return assign(obj, mat, bone)


def link(name, a, b, radius, mat, bone=None, end_radius=None):
    delta = Vector(b) - Vector(a)
    bpy.ops.mesh.primitive_cone_add(vertices=12, radius1=radius, radius2=end_radius or radius, depth=delta.length, location=(Vector(a)+Vector(b))/2)
    obj = bpy.context.object
    obj.name = name
    obj.rotation_euler = delta.to_track_quat('Z', 'Y').to_euler()
    smooth(obj)
    return assign(obj, mat, bone)


def torus(name, loc, major, minor, mat, scale=(1, 1, 1), bone=None):
    bpy.ops.mesh.primitive_torus_add(major_segments=24, minor_segments=8, location=loc, major_radius=major, minor_radius=minor)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    smooth(obj)
    return assign(obj, mat, bone)


def join_parts(objects, name):
    bpy.ops.object.select_all(action='DESELECT')
    for obj in objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    bpy.ops.object.join()
    result = bpy.context.object
    result.name = name
    bpy.context.scene.cursor.location = (0, 0, 0)
    bpy.ops.object.origin_set(type='ORIGIN_CURSOR')
    return result


def export(name, objects, animated=False):
    bpy.ops.object.select_all(action='DESELECT')
    for obj in objects:
        obj.hide_set(False)
        obj.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    bpy.ops.export_scene.gltf(filepath=PROJECT + '/public/models/' + name + '.glb', export_format='GLB', use_selection=True, export_animations=animated, export_animation_mode='ACTIONS', export_skins=animated, export_extras=True, export_apply=False, export_anim_single_armature=True)
    print('EXPORTED', name)


# A continuous, bevelled board mesh with a proper outline and lifted rocker tips.
boards = [
    ('daybreak', (0.64, 0.95, 0.15), (0.02, 0.23, 0.30), 'bolt'),
    ('coral', (1.0, 0.20, 0.28), (1.0, 0.76, 0.21), 'flame'),
    ('tidal', (0.08, 0.68, 1.0), (0.05, 0.15, 0.65), 'wave'),
    ('orchid', (0.55, 0.15, 1.0), (0.12, 0.92, 1.0), 'cosmic'),
    ('sunset', (1.0, 0.60, 0.05), (1.0, 0.95, 0.53), 'gold'),
    ('stealth', (0.035, 0.065, 0.15), (0.31, 1.0, 0.33), 'electric'),
]
board_objects = {}
for board_id, color, accent, style in boards:
    start = set(scene.objects)
    shell = material(board_id + ' glossy shell', color, metallic=0.35 if style in ('gold', 'electric') else 0.13, roughness=0.25)
    trim = material(board_id + ' rails', accent, metallic=0.25, roughness=0.3, emission=0.3 if style in ('electric', 'cosmic') else 0)
    vertices, faces = [], []
    count = 64
    for level in (0, 1):
        for i in range(count):
            angle = i * math.tau / count
            x = math.copysign(abs(math.cos(angle)) ** 0.55, math.cos(angle)) * (1.48 if style != 'electric' else 1.55)
            y = math.copysign(abs(math.sin(angle)) ** 0.9, math.sin(angle)) * 0.47
            rocker = 0.12 * (abs(x)/1.48) ** 3
            vertices.append((x, y, 0.12 + level * 0.095 + rocker))
    faces.append(tuple(reversed(range(count))))
    faces.append(tuple(range(count, count*2)))
    for i in range(count):
        j = (i+1) % count
        faces.append((i, j, j+count, i+count))
    data = bpy.data.meshes.new(board_id+' continuous deck')
    data.from_pydata(vertices, [], faces)
    data.update()
    deck = bpy.data.objects.new('Board_'+board_id, data)
    scene.collection.objects.link(deck)
    assign(deck, shell)
    bpy.context.view_layer.objects.active = deck
    deck.select_set(True)
    bevel = deck.modifiers.new('Rounded rails', 'BEVEL'); bevel.width = 0.035; bevel.segments = 3
    bpy.ops.object.modifier_apply(modifier=bevel.name)
    smooth(deck)
    for x in (-1.0, 1.0):
        band = cube('Signature deck stripe', (x, 0, 0.25), (0.13, 0.84, 0.02), trim, 0.009)
        band.rotation_euler.z = -0.28
    # Tapered center graphic, with different motifs for each board.
    for sign in (-1, 1):
        for k in range(3 if style in ('electric','flame') else 2):
            x = sign * (0.79 + k*0.14)
            graphic = cube('Deck accent', (x, (k%2-0.5)*0.18, 0.272 + max(0,abs(x)-0.9)*0.09), (0.055, 0.52-k*0.05, 0.012), trim, 0.008)
            graphic.rotation_euler.z = sign * (0.55 if style == 'flame' else -0.3)
    badge = torus('SG medallion', (0, 0, 0.239), 0.17, 0.025, trim, (1, 1, 0.35))
    cube('Badge slash', (0, 0, 0.25), (0.045, 0.22, 0.018), CREAM, 0.01).rotation_euler.z = -0.4
    for x in (-0.48, 0.48):
        cube('Binding pad', (x, 0, 0.245), (0.35, 0.44, 0.055), SOLE, 0.07)
        torus('Binding rim', (x, 0, 0.28), 0.17, 0.025, trim, (0.85, 1.1, 0.5))
        for y in (-0.3, 0.3):
            cube('Hydro fin', (x*1.8, y, 0.08), (0.27, 0.038, 0.16), trim, 0.025)
    if style in ('electric', 'cosmic'):
        for y in (-0.44, 0.44):
            cube('Luminous edge', (0, y, 0.20), (2.25, 0.022, 0.025), trim, 0.01)
    if style == 'gold':
        for x in (-1.22, 1.22):
            crown = ball('Gold jewel', (x,0,0.33), (0.10,0.10,0.04), GOLD, segments=12)
    objects = [o for o in scene.objects if o not in start]
    joined = join_parts(objects, 'Board_'+board_id)
    joined['cosmetic_id'] = board_id
    joined['effect'] = style
    board_objects[board_id] = joined
    export('board-'+board_id, [joined])
    joined.hide_set(True)
    joined.hide_render = True

# One shared animation skeleton, exported with four distinct weighted meshes.
bpy.ops.object.armature_add(enter_editmode=True, location=(0,0,0))
rig = bpy.context.object
rig.name = 'Surfer_Rig'
rig.data.name = 'Surfer_Deformation_Skeleton'
rig.data.edit_bones.remove(rig.data.edit_bones[0])
bone_specs = {
    'Hips': ((0,0,1.12),(0,0,1.39), None),
    'Spine': ((0,0,1.39),(0,0,1.94),'Hips'),
    'Head': ((0,0,1.94),(0,0,2.53),'Spine'),
    'Thigh_L': ((-.21,0,1.16),(-.47,.12,.76),'Hips'),
    'Shin_L': ((-.47,.12,.76),(-.48,0,.35),'Thigh_L'),
    'Foot_L': ((-.48,0,.35),(-.48,.32,.29),'Shin_L'),
    'Thigh_R': ((.21,0,1.16),(.47,.12,.76),'Hips'),
    'Shin_R': ((.47,.12,.76),(.48,0,.35),'Thigh_R'),
    'Foot_R': ((.48,0,.35),(.48,.32,.29),'Shin_R'),
    'UpperArm_L': ((-.32,0,1.80),(-.56,.35,1.48),'Spine'),
    'Forearm_L': ((-.56,.35,1.48),(-.27,.75,1.43),'UpperArm_L'),
    'UpperArm_R': ((.32,0,1.80),(.56,.35,1.48),'Spine'),
    'Forearm_R': ((.56,.35,1.48),(.27,.75,1.43),'UpperArm_R'),
}
for name, (head, tail, parent) in bone_specs.items():
    bone = rig.data.edit_bones.new(name)
    bone.head = head; bone.tail = tail
    if parent: bone.parent = rig.data.edit_bones[parent]
bpy.ops.object.mode_set(mode='OBJECT')
rig.show_in_front = True

riders = [
    ('kai', (1.0,.24,.09), (.18,.075,.035), (.73,.41,.20), 'quiff'),
    ('luna', (.60,.20,1.0), (.10,.035,.22), (.89,.56,.36), 'buns'),
    ('reef', (.05,.82,.61), (.035,.08,.085), (.40,.21,.12), 'locs'),
    ('sol', (1.0,.70,.04), (.66,.30,.045), (.97,.67,.39), 'cap'),
]
rider_objects = {}
for rider_id, color, hair_color, skin_color, style in riders:
    start = set(scene.objects)
    jersey = material(rider_id+' suit', color, roughness=.58)
    hair = material(rider_id+' sculpted hair', hair_color, roughness=.8)
    skin = material(rider_id+' skin', skin_color, roughness=.75)
    accent = material(rider_id+' energy trim', (.24,.94,1) if style=='buns' else (1,.88,.44), roughness=.45)
    shorts = material(rider_id+' shorts', (.035,.11,.23) if style!='locs' else (.12,.08,.27), roughness=.7)
    ball('Core shorts',(0,0,1.17),(.34,.23,.23),shorts,'Hips')
    ball('Sculpted vest',(0,0,1.59),(.38,.235,.40),jersey,'Spine')
    cube('Vest center panel',(0,.218,1.58),(.13,.055,.59),CREAM,.035,'Spine')
    cube('Sport zipper',(0,.255,1.60),(.025,.014,.51),NAVY,.006,'Spine')
    for side in (-1,1):
        cube('Padded life jacket panel',(side*.24,-.17,1.57),(.19,.11,.51),jersey,.07,'Spine')
        cube('Vest buckle',(side*.14,.23,1.47),(.15,.07,.065),NAVY,.015,'Spine')
        cube('Reflective shoulder patch',(side*.25,-.21,1.78),(.13,.025,.08),CREAM,.015,'Spine')
    # Large expressive face, ears, nose, eyebrows, eyes, and cheek highlights.
    link('Neck',(0,0,1.91),(0,0,2.03),.115,skin,'Head')
    ball('Head',(0,.025,2.23),(.42,.34,.43),skin,'Head',segments=24)
    for side in (-1,1):
        ball('Ear',(side*.40,.015,2.23),(.09,.07,.125),skin,'Head')
        ball('Eye white',(side*.145,.326,2.285),(.10,.035,.13),WHITE,'Head')
        ball('Eye pupil',(side*.145,.36,2.28),(.053,.018,.078),EYES,'Head')
        ball('Eye glint',(side*.13,.376,2.31),(.019,.008,.025),WHITE,'Head',segments=10)
        brow = cube('Eyebrow',(side*.15,.32,2.455),(.18,.037,.042),hair,.015,'Head')
        brow.rotation_euler.y = side*.12
        ball('Cheek',(side*.25,.307,2.155),(.068,.018,.038),PINK,'Head')
    ball('Button nose',(0,.366,2.20),(.079,.063,.065),skin,'Head')
    smile = torus('Smile',(0,.33,2.09),.082,.014,EYES,(1,.35,.58),'Head')
    smile.rotation_euler.x = math.pi/2
    # The back of each character has an SG wave badge, visible while riding.
    badge = torus('Back wave badge',(0,-.24,1.63),.13,.024,CREAM,(1,1,.7),'Spine')
    badge.rotation_euler.x = math.pi/2
    cube('Wave badge slash',(0,-.269,1.63),(.045,.015,.18),accent,.01,'Spine').rotation_euler.y = -.5
    # Hair silhouettes are modelled individually, not recolored copies.
    ball('Hair cap',(0,-.035,2.49),(.423,.33,.22),hair,'Head')
    if style == 'quiff':
        for i in range(5):
            tuft = ball('Swept quiff',(-.23+i*.105,.12,2.60+math.sin(i*.6)*.06),(.14,.24,.13),hair,'Head')
            tuft.rotation_euler.y = -.35
    if style == 'buns':
        for side in (-1,1):
            ball('Space bun',(side*.36,-.09,2.56),(.20,.20,.20),hair,'Head')
            torus('Bun neon band',(side*.34,-.09,2.54),.16,.028,accent,bone='Head')
        for i in range(5):
            fringe = ball('Fringe',(-.26+i*.13,.22,2.48),(.10,.11,.15),hair,'Head')
    if style == 'locs':
        for i in range(9):
            angle=i*math.tau/9
            a=(math.cos(angle)*.29,math.sin(angle)*.25,2.55)
            b=(math.cos(angle)*.36,math.sin(angle)*.29,2.36 if i%2 else 2.41)
            link('Rounded loc',a,b,.085,hair,'Head'); ball('Loc tip',b,(.085,.085,.085),hair,'Head')
        band = torus('Surf headband',(0,0,2.46),.35,.042,accent,(1,.85,1),'Head')
    if style == 'cap':
        cap = ball('Sunshine cap',(0,-.005,2.56),(.45,.35,.19),jersey,'Head')
        cube('Cap brim',(0,.37,2.53),(.69,.47,.055),CREAM,.13,'Head')
        ball('Cap button',(0,0,2.74),(.055,.055,.035),accent,'Head')
    for suffix, sign in (('L',-1),('R',1)):
        hip=(sign*.21,0,1.16); knee=(sign*.47,.12,.76); ankle=(sign*.48,0,.35)
        link('Board shorts leg',hip,(sign*.34,.07,.95),.17,shorts,'Thigh_'+suffix,end_radius=.15)
        link('Thigh',hip,knee,.125,skin,'Thigh_'+suffix,end_radius=.13)
        ball('Knee',knee,(.13,.13,.13),skin,'Thigh_'+suffix)
        link('Calf',knee,ankle,.105,skin,'Shin_'+suffix,end_radius=.08)
        cube('Wake boot',(sign*.48,.045,.30),(.31,.44,.26),NAVY,.08,'Foot_'+suffix)
        cube('Boot sole',(sign*.48,.065,.20),(.34,.47,.065),CREAM,.04,'Foot_'+suffix)
        for y in (-.025,.14): cube('Boot strap',(sign*.48,y,.40),(.34,.07,.045),accent,.02,'Foot_'+suffix)
        shoulder=(sign*.32,0,1.80); elbow=(sign*.56,.35,1.48); hand=(sign*.27,.75,1.43)
        ball('Shoulder pad',shoulder,(.17,.17,.18),jersey,'UpperArm_'+suffix)
        link('Upper arm',shoulder,elbow,.105,skin,'UpperArm_'+suffix,end_radius=.095)
        ball('Elbow',elbow,(.10,.10,.10),skin,'UpperArm_'+suffix)
        link('Forearm',elbow,hand,.09,skin,'Forearm_'+suffix,end_radius=.075)
        ball('Gloved hand',hand,(.10,.10,.11),NAVY,'Forearm_'+suffix)
        wrist = torus('Wrist cuff',(sign*.32,.69,1.44),.082,.025,accent,bone='Forearm_'+suffix)
        wrist.rotation_euler.x = math.pi/2
    parts=[obj for obj in scene.objects if obj not in start and obj.type=='MESH']
    character=join_parts(parts,'Rider_'+rider_id)
    modifier=character.modifiers.new('Surfer skeleton','ARMATURE'); modifier.object=rig
    character['cosmetic_id']=rider_id
    character['style']=style
    rider_objects[rider_id]=character
    character.hide_set(True); character.hide_render=True

# Skeletal animation clips: shared names are the browser/runtime contract.
rig.animation_data_create()
clips = ['Cruise','CarveLeft','CarveRight','Air','IndyGrab','Pop','Land','Wipeout','Victory']
for clip in clips:
    action = bpy.data.actions.new(clip)
    action.use_fake_user=True
    rig.animation_data.action=action
    length = 60 if clip in ('Cruise','Victory') else 30
    for frame in (1, int(length*.25), int(length*.5), int(length*.75), length):
        t=(frame-1)/(length-1)
        wave=math.sin(t*math.tau)
        envelope=math.sin(t*math.pi)
        for bone in rig.pose.bones:
            bone.rotation_mode='XYZ'; bone.rotation_euler=(0,0,0); bone.location=(0,0,0)
        hips=rig.pose.bones['Hips']; spine=rig.pose.bones['Spine']
        if clip=='Cruise':
            hips.location.y=wave*.025; spine.rotation_euler.x=wave*.025
            rig.pose.bones['Head'].rotation_euler.z=wave*.025
        if clip in ('CarveLeft','CarveRight'):
            sign=1 if clip=='CarveLeft' else -1
            spine.rotation_euler.z=sign*.17; hips.rotation_euler.z=sign*.08
            rig.pose.bones['Head'].rotation_euler.z=-sign*.12
            rig.pose.bones['UpperArm_L'].rotation_euler.y=sign*.12
            rig.pose.bones['UpperArm_R'].rotation_euler.y=sign*.12
            hips.location.y=wave*.018
        if clip=='Air':
            rig.pose.bones['Thigh_L'].rotation_euler.x=-.25
            rig.pose.bones['Thigh_R'].rotation_euler.x=-.25
            rig.pose.bones['Shin_L'].rotation_euler.x=.30
            rig.pose.bones['Shin_R'].rotation_euler.x=.30
            spine.rotation_euler.x=.06
        if clip=='IndyGrab':
            spine.rotation_euler.x=.24
            rig.pose.bones['UpperArm_R'].rotation_euler.x=-1.2
            rig.pose.bones['UpperArm_R'].rotation_euler.y=.45
            rig.pose.bones['Forearm_R'].rotation_euler.x=-.5
            rig.pose.bones['Thigh_R'].rotation_euler.x=-.45
            rig.pose.bones['Shin_R'].rotation_euler.x=.55
            rig.pose.bones['Head'].rotation_euler.x=.15
        if clip in ('Pop','Land'):
            hips.location.y=-envelope*.13
            spine.rotation_euler.x=envelope*.20
            for suffix in ('L','R'):
                rig.pose.bones['Thigh_'+suffix].rotation_euler.x=-envelope*.20
                rig.pose.bones['Shin_'+suffix].rotation_euler.x=envelope*.25
        if clip=='Wipeout':
            for suffix, sign in (('L',-1),('R',1)):
                rig.pose.bones['UpperArm_'+suffix].rotation_euler.z=sign*(.7+wave*.4)
                rig.pose.bones['Forearm_'+suffix].rotation_euler.x=wave*.5
            spine.rotation_euler.x=wave*.2
        if clip=='Victory':
            hips.location.y=abs(wave)*.12
            for suffix, sign in (('L',-1),('R',1)):
                rig.pose.bones['UpperArm_'+suffix].rotation_euler.x=1.7+wave*.15
                rig.pose.bones['UpperArm_'+suffix].rotation_euler.z=sign*.8
                rig.pose.bones['Forearm_'+suffix].rotation_euler.x=.45
            rig.pose.bones['Head'].rotation_euler.z=wave*.13
        for bone in rig.pose.bones:
            bone.keyframe_insert(data_path='rotation_euler',frame=frame,group=bone.name)
            if bone.name=='Hips': bone.keyframe_insert(data_path='location',frame=frame,group=bone.name)
rig.animation_data.action=bpy.data.actions['Cruise']
scene.frame_set(1)
for rider_id, character in rider_objects.items():
    character.hide_set(False)
    export('rider-'+rider_id,[rig,character],animated=True)
    character.hide_set(True); character.hide_render=True

# Make the source library pleasant to open: a lit studio with Kai and Daybreak.
board_objects['daybreak'].hide_set(False); board_objects['daybreak'].hide_render=False
rider_objects['kai'].hide_set(False); rider_objects['kai'].hide_render=False
bpy.ops.object.camera_add(location=(4.5,6.5,3.8))
camera=bpy.context.object; camera.name='Asset Studio Camera'; scene.camera=camera
camera.rotation_euler=(Vector((0,0,1.4))-camera.location).to_track_quat('-Z','Y').to_euler()
camera.data.type='ORTHO'; camera.data.ortho_scale=3.7
for name, loc, power, size in [('Key softbox',(3,4,6),650,5),('Rim softbox',(-3,-2,4),850,4),('Fill softbox',(-4,3,3),400,5)]:
    bpy.ops.object.light_add(type='AREA',location=loc)
    light=bpy.context.object; light.name=name; light.data.energy=power; light.data.shape='DISK'; light.data.size=size
    light.rotation_euler=(Vector((0,0,1.1))-light.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.object.select_all(action='DESELECT')
rider_objects['kai'].select_set(True)
bpy.context.view_layer.objects.active=rider_objects['kai']
# Keep a local studio copy, including the preserved original scene. It is not published.
bpy.ops.wm.save_as_mainfile(filepath=PROJECT+'/artifacts/surfer-glide-studio.blend',copy=True,compress=True)
print('DONE: six boards, four skinned riders, thirteen bones, nine animation clips. Local studio copy saved; existing scenes preserved.')
