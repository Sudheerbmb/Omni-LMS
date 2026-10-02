"""
Model Context Protocol (MCP) FastAPI Router
Implements the JSON-RPC 2.0 MCP spec and REST gateways for Omni-LMS.
"""
from typing import Any, Dict
from fastapi import APIRouter, HTTPException, Request, status
from pydantic import BaseModel

from app.mcp.service import (
    MCP_PROTOCOL_VERSION,
    SERVER_NAME,
    SERVER_VERSION,
    MCP_TOOLS,
    MCP_RESOURCES,
    execute_mcp_tool
)

router = APIRouter(prefix="/api/v1/mcp", tags=["mcp"])

class JsonRpcRequest(BaseModel):
    jsonrpc: str = "2.0"
    id: Any = None
    method: str
    params: Dict[str, Any] = {}

class DirectToolExecuteRequest(BaseModel):
    name: str
    arguments: Dict[str, Any] = {}

@router.post("")
async def handle_json_rpc(req: JsonRpcRequest):
    """
    Standard MCP JSON-RPC 2.0 Handler.
    Supports:
      - 'initialize'
      - 'tools/list'
      - 'tools/call'
      - 'resources/list'
      - 'ping'
    """
    method = req.method
    params = req.params or {}

    if method == "initialize":
        return {
            "jsonrpc": "2.0",
            "id": req.id,
            "result": {
                "protocolVersion": MCP_PROTOCOL_VERSION,
                "serverInfo": {
                    "name": SERVER_NAME,
                    "version": SERVER_VERSION
                },
                "capabilities": {
                    "tools": {"listChanged": True},
                    "resources": {"subscribe": False, "listChanged": True}
                }
            }
        }

    elif method == "tools/list":
        return {
            "jsonrpc": "2.0",
            "id": req.id,
            "result": {
                "tools": MCP_TOOLS
            }
        }

    elif method == "tools/call":
        name = params.get("name")
        arguments = params.get("arguments", {})
        if not name:
            raise HTTPException(status_code=400, detail="Missing tool name in params")
        result = await execute_mcp_tool(name, arguments)
        return {
            "jsonrpc": "2.0",
            "id": req.id,
            "result": result
        }

    elif method == "resources/list":
        return {
            "jsonrpc": "2.0",
            "id": req.id,
            "result": {
                "resources": MCP_RESOURCES
            }
        }

    elif method == "ping":
        return {
            "jsonrpc": "2.0",
            "id": req.id,
            "result": {"status": "pong"}
        }

    else:
        return {
            "jsonrpc": "2.0",
            "id": req.id,
            "error": {
                "code": -32601,
                "message": f"Method '{method}' not found"
            }
        }

@router.get("/tools")
async def list_tools_rest():
    """
    REST gateway returning registered MCP tools.
    """
    return {
        "server": SERVER_NAME,
        "protocolVersion": MCP_PROTOCOL_VERSION,
        "tools": MCP_TOOLS
    }

@router.post("/execute")
async def execute_tool_rest(body: DirectToolExecuteRequest):
    """
    REST gateway for executing MCP tools directly from web UI.
    """
    return await execute_mcp_tool(body.name, body.arguments)
