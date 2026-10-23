"""Export an allowlisted public tree and portable release, without workspace history."""
import argparse
import json
import re
import shutil
from pathlib import Path
from zipfile import ZipFile, ZIP_STORED, ZIP_DEFLATED

root = Path(__file__).resolve().parent
files = ["README.md", "LICENSE", ".gitignore", "package.json", "runtime.mjs",
         "launch.ps1", "START-CODEX.cmd", "START-ZCODE.cmd", "RESTORE-CODEX.cmd",
         "RESTORE-ZCODE.cmd", "build-themes.mjs", "test-runtime.mjs",
         "themes/codex.css", "themes/zcode.css", "package-release.py"]
parser = argparse.ArgumentParser()
parser.add_argument("--pi-source", type=Path, default=root / "pi")
parser.add_argument("--out", type=Path, required=True)
args = parser.parse_args()
output = args.out.resolve()
if output.exists():
    raise SystemExit("Output already exists; choose a fresh directory.")
version = json.loads((root / "package.json").read_text("utf-8"))["version"]
pi_files = ["manifest.json", "main.js", "themes/terminal.css"]
for file in files:
    text = (root / file).read_text("utf-8")
    if re.search(r"C:\\Users\\[A-Za-z0-9][^\\\r\n]*\\|sk-[A-Za-z0-9]{20,}|gh[pousr]_[A-Za-z0-9]{20,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----", text):
        raise SystemExit(f"Publication scan failed: {file}")
for file in pi_files:
    if not (args.pi_source / file).is_file():
        raise SystemExit(f"Missing Pi source: {file}")
source = output / "source"
source.mkdir(parents=True)
for file in files:
    dest = source / file
    dest.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(root / file, dest)
for file in pi_files:
    dest = source / "pi" / file
    dest.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(args.pi_source / file, dest)
plugin = output / "terminal-clarity-1.0.0.piplug"
with ZipFile(plugin, "w", ZIP_STORED) as archive:
    for file in pi_files:
        archive.write(source / "pi" / file, file)
release = output / f"agent-terminal-clarity-{version}.zip"
with ZipFile(release, "w", ZIP_DEFLATED) as archive:
    for file in source.rglob("*"):
        if file.is_file():
            archive.write(file, f"agent-terminal-clarity-{version}/" + file.relative_to(source).as_posix())
    archive.write(plugin, f"agent-terminal-clarity-{version}/" + plugin.name)
print(json.dumps({"source": str(source), "zip": str(release), "pi": str(plugin)}, ensure_ascii=False))
