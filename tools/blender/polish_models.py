"""Refine the generated boards only: grid-based rocker, clean deck graphics, and rider pads."""
import bpy
import bmesh
import math

PROJECT = "C:/Users/iantl/OneDrive/Desktop/Game"
scene = bpy.context.scene


def deck_geometry():
    vertices, faces = [], []
    rows, columns = 33, 13
    for level in range(2):
        for i in range(rows):
            u = i/(rows-1)*2-1
            x = u*1.48
            width = .47*math.sqrt(max(.002,1-abs(u)**4))
            for j in range(columns):
                y=(j/(columns-1)*2-1)*width
                vertices.append((x,y,.12+level*.095+.12*abs(u)**3))
    total=rows*columns
    for i in range(rows-1):
        for j in range(columns-1):
            a=i*columns+j
            q=(a,a+columns,a+columns+1,a+1)
            faces.append(tuple(reversed(q)))
            faces.append(tuple(v+total for v in q))
    outline=[i*columns for i in range(rows)]+[(rows-1)*columns+j for j in range(1,columns)]+[i*columns+columns-1 for i in range(rows-2,-1,-1)]+[j for j in range(columns-2,0,-1)]
    for i,a in enumerate(outline):
        b=outline[(i+1)%len(outline)]
        faces.append((a,b,b+total,a+total))
    return vertices,faces


for board_id in ('daybreak','coral','tidal','orchid','sunset','stealth'):
    board=scene.objects['Board_'+board_id]
    shell_index=next(i for i,m in enumerate(board.data.materials) if m.name.startswith(board_id+' glossy shell'))
    bm=bmesh.new();bm.from_mesh(board.data)
    bmesh.ops.delete(bm,geom=[f for f in bm.faces if f.material_index==shell_index],context='FACES')
    loose=[v for v in bm.verts if not v.link_faces]
    if loose:bmesh.ops.delete(bm,geom=loose,context='VERTS')
    vertices,faces=deck_geometry()
    newverts=[bm.verts.new(v) for v in vertices]
    for face in faces:
        f=bm.faces.new([newverts[i] for i in face]);f.material_index=shell_index;f.smooth=True
    bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(board.data);bm.free();board.data.update()
    bpy.ops.object.select_all(action='DESELECT');board.hide_set(False);board.select_set(True);bpy.context.view_layer.objects.active=board
    bpy.ops.export_scene.gltf(filepath=PROJECT+'/public/models/board-'+board_id+'.glb',export_format='GLB',use_selection=True,export_animations=False,export_extras=True)
    board.hide_set(True)
    print('REFINED',board_id)

rig=scene.objects['Surfer_Rig']
for rider_id in ('kai','luna','reef','sol'):
    character=scene.objects['Rider_'+rider_id]
    character.parent=rig
    mat=next(m for m in character.data.materials if m.name.startswith(rider_id+' suit'))
    pads=[]
    for suffix,sign in (('L',-1),('R',1)):
        bpy.ops.mesh.primitive_uv_sphere_add(segments=16,ring_count=10,location=(sign*.47,.155,.77))
        pad=bpy.context.object;pad.name=rider_id+' rounded knee guard '+suffix;pad.scale=(.147,.148,.155)
        bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
        for f in pad.data.polygons:f.use_smooth=True
        pad.data.materials.append(mat)
        group=pad.vertex_groups.new(name='Thigh_'+suffix);group.add(list(range(len(pad.data.vertices))),1,'REPLACE')
        pads.append(pad)
    bpy.ops.object.select_all(action='DESELECT');character.hide_set(False);character.select_set(True)
    for pad in pads:pad.select_set(True)
    bpy.context.view_layer.objects.active=character;bpy.ops.object.join()
    bpy.ops.object.select_all(action='DESELECT');character.select_set(True);rig.select_set(True)
    bpy.context.view_layer.objects.active=rig
    bpy.ops.export_scene.gltf(filepath=PROJECT+'/public/models/rider-'+rider_id+'.glb',export_format='GLB',use_selection=True,export_animations=True,export_animation_mode='ACTIONS',export_skins=True,export_extras=True,export_anim_single_armature=True)
    character.hide_set(True)
    print('POLISHED',rider_id)
scene.objects['Board_daybreak'].hide_set(False);scene.objects['Rider_kai'].hide_set(False)
bpy.ops.wm.save_as_mainfile(filepath=PROJECT+'/artifacts/surfer-glide-studio.blend',copy=True,compress=True)
print('All refinements exported. Existing unrelated scenes preserved.')
