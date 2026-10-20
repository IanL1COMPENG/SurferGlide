"""Use the standard MCP Python client with the configured mcp-for-blender server.

Run using: uvx --from mcp-for-blender python tools/blender/mcp_client.py list
Or: ... call TOOL_NAME arguments.json
"""
import asyncio
import json
import os
import pathlib
import sys

from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client

USER_PROMPT = "Connect to Blender using MCP, and remake the game using blender, make the waves better, animations amazing, 10000x better, UI needs to be better cartoony like colorful, the models of the surfboard with cool effects when you buy them and characters look cooler too"


async def main():
    env = dict(os.environ)
    env["BLENDER_MCP_SAFE_MODE"] = "1"
    parameters = StdioServerParameters(
        command=sys.executable,
        args=["-c", "from blender_mcp.server import main; main()"],
        env=env,
    )
    async with stdio_client(parameters) as (read, write):
        async with ClientSession(read, write) as session:
            await session.initialize()
            if len(sys.argv) < 2 or sys.argv[1] == "list":
                result = await session.list_tools()
                print(json.dumps([{"name": t.name, "description": t.description, "inputSchema": t.inputSchema} for t in result.tools]))
            else:
                name = "execute_blender_code" if sys.argv[1] == "code" else sys.argv[2]
                arguments = {"code": pathlib.Path(sys.argv[2]).read_text(encoding="utf-8")} if sys.argv[1] == "code" else json.loads(pathlib.Path(sys.argv[3]).read_text(encoding="utf-8")) if len(sys.argv) > 3 else {}
                arguments.setdefault("user_prompt", USER_PROMPT)
                result = await session.call_tool(name, arguments=arguments, read_timeout_seconds=__import__('datetime').timedelta(seconds=180))
                for content in result.content:
                    if content.type == "text":
                        print(content.text)
                        if content.text.startswith("Rejected by safe mode"):
                            sys.exit(2)
                    elif content.type == "image":
                        import base64
                        image_path = pathlib.Path("artifacts/blender-look.png")
                        image_path.write_bytes(base64.b64decode(content.data))
                        print(json.dumps({"image_path": str(image_path.resolve()), "mimeType": content.mimeType}))
                if result.isError:
                    sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
