"""Start the user's installed Blender MCP addon in an isolated authoring session."""
import bpy

if "blender_mcp" not in bpy.context.preferences.addons:
    bpy.ops.preferences.addon_enable(module="blender_mcp")
bpy.context.scene.blendermcp_port = 9876
bpy.ops.blendermcp.start_server()
print("Surfer Glide: Blender MCP authoring session ready on localhost:9876")
