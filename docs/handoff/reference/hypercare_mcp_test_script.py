import argparse
import base64
import hashlib
import hmac
import json
import os
import sys
import time
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parent
ENV_FILES = [
    ROOT / "mcp-server" / ".env.local",
    ROOT / "mcp-server" / ".env",
    ROOT / "mcp-server" / ".env.example",
]


def parse_env_file(path: Path) -> dict[str, str]:
    values: dict[str, str] = {}
    if not path.exists():
        return values

    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        if key:
            values[key] = value
    return values


def load_config_value(name: str, default: str | None = None) -> str | None:
    if os.environ.get(name):
        return os.environ[name]

    for env_file in ENV_FILES:
        value = parse_env_file(env_file).get(name)
        if value:
            return value

    return default


DEFAULT_MCP_URL = "https://localhost:8000/hypercare-mcp"
MCP_URL = load_config_value("MCP_URL", DEFAULT_MCP_URL)
MCP_JWT_SECRET = load_config_value("MCP_JWT_SECRET", "placeholder-secret-change-me")

SAP_CREDENTIALS = {
    "ashost": load_config_value("SAP_ASHOST", "127.0.0.1"),
    "sysnr": load_config_value("SAP_SYSNR", "00"),
    "client": load_config_value("SAP_CLIENT", "100"),
    "user": load_config_value("SAP_USER", "PLACEHOLDER_USER"),
    "passwd": load_config_value("SAP_PASSWD", "PLACEHOLDER_PASSWD"),
    "lang": load_config_value("SAP_LANG", "EN"),
}


def b64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def sign_jwt(payload: dict[str, Any], secret: str) -> str:
    header = {"alg": "HS256", "typ": "JWT"}
    encoded_header = b64url(json.dumps(header, separators=(",", ":")).encode("utf-8"))
    encoded_payload = b64url(json.dumps(payload, separators=(",", ":")).encode("utf-8"))
    signing_input = f"{encoded_header}.{encoded_payload}".encode("ascii")
    signature = hmac.new(secret.encode("utf-8"), signing_input, hashlib.sha256).digest()
    return f"{encoded_header}.{encoded_payload}.{b64url(signature)}"


def build_jwt() -> str:
    sap_payload = SAP_CREDENTIALS.copy()
    http_base_url = load_config_value("SAP_HTTP_BASE_URL")
    if http_base_url:
        sap_payload["http"] = {
            "baseUrl": http_base_url,
            "client": load_config_value("SAP_HTTP_CLIENT", sap_payload["client"]),
            "user": load_config_value("SAP_HTTP_USER", sap_payload["user"]),
            "passwd": load_config_value("SAP_HTTP_PASSWD", sap_payload["passwd"]),
        }
    payload = {"sap": sap_payload, "exp": 9999999999}
    return sign_jwt(payload, MCP_JWT_SECRET)


def parse_mcp_response(raw: bytes, content_type: str) -> Any:
    text = raw.decode("utf-8", errors="replace")
    if "text/event-stream" not in content_type:
        return json.loads(text)

    events: list[Any] = []
    current_data: list[str] = []
    for line in text.splitlines():
        if line.startswith("data:"):
            current_data.append(line[len("data:"):].strip())
        elif not line.strip() and current_data:
            events.append(json.loads("\n".join(current_data)))
            current_data = []

    if current_data:
        events.append(json.loads("\n".join(current_data)))

    if not events:
        raise RuntimeError("MCP returned SSE without data events")
    return events[-1]


def call_tool(mcp_url: str, token: str, name: str, arguments: dict[str, Any]) -> Any:
    payload = {
        "jsonrpc": "2.0",
        "id": str(uuid.uuid4()),
        "method": "tools/call",
        "params": {"name": name, "arguments": arguments},
    }
    request = Request(
        mcp_url,
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
            "Accept": "application/json, text/event-stream",
        },
        method="POST",
    )

    try:
        with urlopen(request, timeout=180) as response:
            return parse_mcp_response(response.read(), response.headers.get("Content-Type", ""))
    except HTTPError as error:
        body = error.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"HTTP {error.code}: {body}") from error
    except URLError as error:
        raise RuntimeError(f"Request failed: {error}") from error


def iso_window(days: int) -> tuple[str, str]:
    to_dt = datetime.now(timezone.utc)
    from_dt = to_dt - timedelta(days=days)
    return (
        from_dt.strftime("%Y-%m-%dT%H:%M:%S.000Z"),
        to_dt.strftime("%Y-%m-%dT%H:%M:%S.000Z"),
    )


def test_connection_check(token: str, url: str) -> dict:
    print("\n=== Testing: sap_connection_check ===")
    return call_tool(url, token, "sap_connection_check", {})


def test_wrapper_catalog(token: str, url: str) -> dict:
    print("\n=== Testing: sap_wrapper_catalog ===")
    return call_tool(url, token, "sap_wrapper_catalog", {})


def test_wrapper_probe(token: str, url: str) -> dict:
    print("\n=== Testing: sap_wrapper_probe ===")
    return call_tool(url, token, "sap_wrapper_probe", {
        "functionName": "ZHC_GET_DATA_QUALITY_KPIS"
    })


def test_kpi_catalog(token: str, url: str) -> dict:
    print("\n=== Testing: sap_kpi_catalog ===")
    return call_tool(url, token, "sap_kpi_catalog", {})


def test_kpi_read(token: str, url: str) -> dict:
    print("\n=== Testing: sap_kpi_read ===")
    from_iso, to_iso = iso_window(7)
    return call_tool(url, token, "sap_kpi_read", {
        "kpiIds": ["active_user_count", "failed_login_attempts"],
        "from": from_iso,
        "to": to_iso,
        "sapFlavor": "shared"
    })


def test_table_read(token: str, url: str) -> dict:
    print("\n=== Testing: sap_table_read ===")
    return call_tool(url, token, "sap_table_read", {
        "table": "PA0001",
        "fields": ["PERNR", "GSBER", "BTRTL"],
        "rowCount": 5,
        "delimiter": "|"
    })


def test_function_call(token: str, url: str) -> dict:
    print("\n=== Testing: sap_function_call ===")
    return call_tool(url, token, "sap_function_call", {
        "functionName": "RFC_SYSTEM_INFO",
        "parameters": {}
    })


def test_sod_table_probe(token: str, url: str) -> dict:
    print("\n=== Testing: sap_sod_table_probe ===")
    return call_tool(url, token, "sap_sod_table_probe", {})


def test_sod_table_batch_read(token: str, url: str) -> dict:
    print("\n=== Testing: sap_sod_table_batch_read ===")
    return call_tool(url, token, "sap_sod_table_batch_read", {
        "table": "USR02",
        "fields": ["BNAME", "USTYP"],
        "rowCount": 10,
        "rowSkips": 0
    })


def test_lock_entries(token: str, url: str) -> dict:
    print("\n=== Testing: sap_lock_entries ===")
    return call_tool(url, token, "sap_lock_entries", {
        "functionName": "ENQUEUE_READ"
    })


def test_job_log_read(token: str, url: str) -> dict:
    print("\n=== Testing: sap_job_log_read ===")
    return call_tool(url, token, "sap_job_log_read", {
        "jobName": "SAP_REORG_JOBS",
        "jobCount": "1"
    })


def test_idoc_detail(token: str, url: str) -> dict:
    print("\n=== Testing: sap_idoc_detail ===")
    return call_tool(url, token, "sap_idoc_detail", {
        "docNum": "0000000000000001"
    })


def test_metadata_introspect(token: str, url: str) -> dict:
    print("\n=== Testing: sap_metadata_introspect ===")
    return call_tool(url, token, "sap_metadata_introspect", {
        "objectType": "table",
        "objectName": "USR02"
    })


def test_health_snapshot(token: str, url: str) -> dict:
    print("\n=== Testing: sap_health_snapshot ===")
    return call_tool(url, token, "sap_health_snapshot", {})


def test_repository_discovery(token: str, url: str) -> dict:
    print("\n=== Testing: sap_repository_discovery ===")
    return call_tool(url, token, "sap_repository_discovery", {
        "mode": "packages",
        "pattern": "Z*"
    })


ALL_TOOLS = {
    "sap_connection_check": test_connection_check,
    "sap_wrapper_catalog": test_wrapper_catalog,
    "sap_wrapper_probe": test_wrapper_probe,
    "sap_kpi_catalog": test_kpi_catalog,
    "sap_kpi_read": test_kpi_read,
    "sap_table_read": test_table_read,
    "sap_function_call": test_function_call,
    "sap_sod_table_probe": test_sod_table_probe,
    "sap_sod_table_batch_read": test_sod_table_batch_read,
    "sap_lock_entries": test_lock_entries,
    "sap_job_log_read": test_job_log_read,
    "sap_idoc_detail": test_idoc_detail,
    "sap_metadata_introspect": test_metadata_introspect,
    "sap_health_snapshot": test_health_snapshot,
    "sap_repository_discovery": test_repository_discovery,
}


def main() -> int:
    global MCP_JWT_SECRET
    
    parser = argparse.ArgumentParser(description="Test Hypercare MCP tools")
    parser.add_argument("--url", default=MCP_URL, help="MCP endpoint URL")
    parser.add_argument("--secret", default=MCP_JWT_SECRET, help="JWT secret")
    parser.add_argument("--tool", help="Test specific tool only")
    parser.add_argument("--output", help="Save results to JSON file")
    args = parser.parse_args()

    MCP_JWT_SECRET = args.secret

    token = build_jwt()
    print(f"Testing MCP at: {args.url}")
    print(f"SAP System: {SAP_CREDENTIALS['ashost']}:{SAP_CREDENTIALS['sysnr']}")
    print(f"Client: {SAP_CREDENTIALS['client']}, User: {SAP_CREDENTIALS['user']}")

    results = {}
    tools_to_test = {args.tool: ALL_TOOLS[args.tool]} if args.tool else ALL_TOOLS

    # with open("test_results.json", "w", encoding="utf-8") as file:
    #     pass
    args.output = "test_results.json"

    for tool_name, test_func in tools_to_test.items():
        try:
            result = test_func(token, args.url)
            results[tool_name] = {"status": "success", "data": result}
            print(f"[OK] {tool_name}: SUCCESS")
            print(json.dumps(result, indent=2)[:500])
            # with open("test_results.json", "w", encoding="utf-8") as file:
            #     file.write(json.dumps(result, indent=2))
        except Exception as exc:
            results[tool_name] = {"status": "error", "error": str(exc)}
            print(f"[FAIL] {tool_name}: FAILED - {exc}")

    if args.output:
        with open(args.output, "w") as f:
            json.dump(results, f, indent=2)
        print(f"\nResults saved to: {args.output}")

    success_count = sum(1 for r in results.values() if r["status"] == "success")
    print(f"\n=== Summary: {success_count}/{len(results)} tools succeeded ===")

    return 0 if success_count == len(results) else 1


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except KeyboardInterrupt:
        print("\nInterrupted by user")
        raise SystemExit(130)
    except Exception as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        raise SystemExit(1)
