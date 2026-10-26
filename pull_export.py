#!/usr/bin/env python3
"""Fetch a read-only Personal Workflow snapshot into data/YYYY-MM-DD.json.

The script uses only Python's standard library. Tokens are read from arguments
or environment variables and are never written to the snapshot.
"""

import argparse
import datetime
import json
import os
import pathlib
import sys
import urllib.error
import urllib.request
from typing import Optional

ENTITIES = (
    "projects",
    "tasks",
    "domains",
    "learningLogs",
    "knowledgeNotes",
    "ideas",
    "events",
)


def fetch(url: str, token: str, sites_access_token: Optional[str], timeout: int = 30) -> dict:
    headers = {
        "Authorization": f"Bearer {token}",
        "Accept": "application/json",
    }
    if sites_access_token:
        headers["OAI-Sites-Authorization"] = f"Bearer {sites_access_token}"

    request = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(request, timeout=timeout) as response:
        payload = json.load(response)
    if not isinstance(payload, dict):
        raise ValueError("响应必须是 JSON 对象")
    return payload


def validate_snapshot(data: dict) -> None:
    missing = [key for key in ENTITIES if key not in data]
    if missing:
        raise ValueError(f"响应缺少字段: {missing}")

    invalid = [key for key in ENTITIES if not isinstance(data[key], list)]
    if invalid:
        raise ValueError(f"以下字段不是数组: {invalid}")

    if not isinstance(data.get("exportedAt"), str):
        raise ValueError("响应缺少 exportedAt 时间戳")


def main() -> None:
    default_out = pathlib.Path(__file__).resolve().parent / "data"
    parser = argparse.ArgumentParser(description="拉取 Personal Workflow 数据快照")
    parser.add_argument("--url", default=os.environ.get("EXPORT_URL"), help="导出接口地址")
    parser.add_argument("--token", default=os.environ.get("EXPORT_TOKEN"), help="导出 token")
    parser.add_argument(
        "--sites-access-token",
        default=os.environ.get("SITES_ACCESS_TOKEN"),
        help="私人 Sites 的服务访问 token（也可用 SITES_ACCESS_TOKEN）",
    )
    parser.add_argument("--out", default=str(default_out), help="输出目录，默认 data/")
    parser.add_argument("--force", action="store_true", help="覆盖同一天的已有文件")
    args = parser.parse_args()

    if not args.url or not args.token:
        sys.exit("缺少 --url 或 --token（也可用环境变量 EXPORT_URL / EXPORT_TOKEN）")

    try:
        data = fetch(args.url, args.token, args.sites_access_token)
        validate_snapshot(data)
    except urllib.error.HTTPError as error:
        detail = error.read().decode("utf-8", "replace")[:300]
        sys.exit(f"HTTP {error.code}: {detail}")
    except urllib.error.URLError as error:
        sys.exit(f"连接失败: {error.reason}")
    except (json.JSONDecodeError, ValueError) as error:
        sys.exit(f"响应无效: {error}")

    out_dir = pathlib.Path(args.out)
    out_dir.mkdir(parents=True, exist_ok=True)
    path = out_dir / f"{datetime.date.today().isoformat()}.json"
    if path.exists() and not args.force:
        sys.exit(f"{path} 已存在；加 --force 覆盖")

    path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    counts = ", ".join(f"{key}={len(data[key])}" for key in ENTITIES)
    print(f"已写入 {path}")
    print(f"条目数: {counts}")


if __name__ == "__main__":
    main()
