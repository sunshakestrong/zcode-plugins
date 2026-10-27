#!/usr/bin/env python3
"""Run this checkout's official validator against Tripo only, not the catalogue.

Copies the real Tripo package and filters the actual local marketplace entry in
scratch. Does not build/publish artifacts or invent CDN URLs/checksums.
"""
import importlib.util
import json
import os
from pathlib import Path
import shutil
import sys
import tempfile

ROOT = Path(__file__).resolve().parents[2]
market = json.loads((ROOT / 'marketplace.json').read_text())
entries = [entry for entry in market['plugins'] if entry.get('name') == 'tripo-3d']
assert len(entries) == 1, 'exactly one Tripo entry required'
assert entries[0]['source'] == './plugins/tripo-3d', 'local source required'
assert not any(key in entries[0] for key in ('downloadUrl', 'sha256', 'sha')), 'candidate must not invent release artifacts'
market['plugins'] = entries
if 'unlistedPlugins' in market:
    market['unlistedPlugins'] = [entry for entry in market['unlistedPlugins'] if entry.get('name') == 'tripo-3d']
spec = importlib.util.spec_from_file_location('tripo_official_validator', ROOT / 'scripts/validate.py')
assert spec is not None and spec.loader is not None
validator = importlib.util.module_from_spec(spec)
spec.loader.exec_module(validator)
scratch = Path(os.environ.get('TMPDIR', Path.home() / '.hermes/cache/scratch'))
scratch.mkdir(parents=True, exist_ok=True)
with tempfile.TemporaryDirectory(prefix='tripo-target-validation-', dir=scratch) as directory:
    stage = Path(directory)
    (stage / 'marketplace.json').write_text(json.dumps(market, ensure_ascii=False))
    shutil.copytree(ROOT / 'plugins/tripo-3d', stage / 'plugins/tripo-3d', symlinks=True)
    asset = ROOT / 'assets/tripo-3d'
    if asset.exists():
        shutil.copytree(asset, stage / 'assets/tripo-3d', symlinks=True)
    setattr(validator, 'ROOT', stage)
    if hasattr(validator, 'PLUGINS_ROOT'):
        setattr(validator, 'PLUGINS_ROOT', (stage / 'plugins').resolve())
    print('Scope: Tripo package + local marketplace entry + Tripo assets ONLY')
    result = getattr(validator, 'main')()
sys.exit(result)
