#!/usr/bin/env python3
"""Scan stylesheet/themes/*.css and write themes.json."""

import json
from pathlib import Path

ROOT = Path(__file__).parent
themes_dir = ROOT / 'stylesheet' / 'themes'

themes = []
for f in sorted(themes_dir.glob('*.css')):
	name = f.stem
	label = name.replace('-', ' ').replace('_', ' ').title()
	themes.append({"name": name, "label": label})

(ROOT / 'themes.json').write_text(
	json.dumps(themes, indent=2) + '\n'
)

print(f"✓ themes.json — {len(themes)} theme{'s' if len(themes)!=1 else ''}")
