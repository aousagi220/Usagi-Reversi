#!/usr/bin/env python3
import argparse
import getpass
import hashlib
import json
import os
import pathlib
import shutil
import subprocess
import sys
import urllib.error
import urllib.parse
import urllib.request


def request(server_url, token, api_path, method="GET", body=None):
    headers = {
        "Authorization": f"Bearer {token}",
        "ngrok-skip-browser-warning": "true",
    }
    data = None
    if body is not None:
        data = json.dumps(body, separators=(",", ":")).encode("utf-8")
        headers["Content-Type"] = "application/json"

    url = f"{server_url.rstrip('/')}{api_path}"
    api_request = urllib.request.Request(
        url,
        data=data,
        headers=headers,
        method=method,
    )
    try:
        with urllib.request.urlopen(api_request, timeout=120) as response:
            content = response.read()
            content_type = response.headers.get("Content-Type", "")
            if "application/json" in content_type:
                return json.loads(content.decode("utf-8"))
            return content
    except urllib.error.HTTPError as error:
        message = error.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"HTTP {error.code}: {message}") from error


def download_sources(server_url, token, workspace):
    manifest = request(server_url, token, "/api/manifest")

    for index, file_entry in enumerate(manifest["files"], start=1):
        relative_path = file_entry["path"]
        encoded_path = urllib.parse.quote(relative_path, safe="")
        content = request(
            server_url,
            token,
            f"/api/file?path={encoded_path}",
        )
        digest = hashlib.sha256(content).hexdigest()
        if digest != file_entry["sha256"]:
            raise RuntimeError(f"Hash mismatch: {relative_path}")

        destination = workspace / relative_path
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_bytes(content)
        print(f"[{index}/{len(manifest['files'])}] {relative_path}")


def ensure_node():
    node = shutil.which("node")
    if node is None:
        raise RuntimeError(
            "Node.js was not found. Run `!apt-get update -qq && apt-get install -y nodejs` first."
        )

    major_version = int(
        subprocess.check_output([node, "-p", "process.versions.node.split('.')[0]"], text=True).strip()
    )
    if major_version < 18:
        raise RuntimeError(f"Node.js 18 or newer is required. Current version: {major_version}")
    return node


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--server", required=True, help="ngrok HTTPS URL")
    parser.add_argument("--token", default=os.environ.get("REMOTE_TRAINING_TOKEN"))
    parser.add_argument("--workspace", default="/content/reversi-remote-training")
    args = parser.parse_args()

    token = args.token or getpass.getpass("REMOTE_TRAINING_TOKEN: ")
    if len(token) < 24:
        raise RuntimeError("The shared token must contain at least 24 characters")

    node = ensure_node()
    workspace = pathlib.Path(args.workspace)
    workspace.mkdir(parents=True, exist_ok=True)
    job_path = workspace / "remote-job.json"
    result_path = workspace / "remote-result.json"

    print("学習ジョブを取得しています")
    job = request(args.server, token, "/api/job")
    job_path.write_text(json.dumps(job), encoding="utf-8")

    print("学習ソースを取得しています")
    download_sources(args.server, token, workspace)

    print(f"Colabで学習を開始します: jobId={job['jobId']}")
    subprocess.run(
        [
            node,
            str(workspace / "AITraining" / "remoteTrainingRunner.js"),
            str(job_path),
            str(result_path),
        ],
        cwd=workspace,
        check=True,
    )

    print("学習結果をローカルへ返送しています")
    result = json.loads(result_path.read_text(encoding="utf-8"))
    response = request(args.server, token, "/api/result", method="POST", body=result)
    print(json.dumps(response, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(f"ERROR: {error}", file=sys.stderr)
        sys.exit(1)
