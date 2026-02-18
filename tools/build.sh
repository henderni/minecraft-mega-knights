#!/bin/bash
set -e

# --- Version bump (patch) ---
# Increments the patch version in both manifest.json files so Minecraft
# recognizes updated packs. Minecraft caches by UUID+version — without
# a bump, clients may get stale content.
bump_version() {
  local file="$1"
  if [ ! -f "$file" ]; then return; fi

  # Extract current version array [major, minor, patch]
  local patch
  patch=$(python3 -c "
import json, sys
with open('$file') as f:
    m = json.load(f)
v = m['header']['version']
print(v[2])
")

  local new_patch=$((patch + 1))

  # Update header.version and all module versions
  python3 -c "
import json
with open('$file') as f:
    m = json.load(f)
m['header']['version'][2] = $new_patch
for mod in m.get('modules', []):
    mod['version'][2] = $new_patch
with open('$file', 'w') as f:
    json.dump(m, f, indent=2)
    f.write('\n')
"
  echo "  $file → version patch bumped to $new_patch"
}

echo "Bumping manifest versions..."
bump_version "MegaKnights_BP/manifest.json"
bump_version "MegaKnights_RP/manifest.json"

# --- Compile TypeScript ---
echo "Compiling TypeScript..."
npx tsc

echo "Build complete! Scripts output to MegaKnights_BP/scripts/"

# --- Deploy to BDS (optional) ---
if [ -n "$BDS_DIR" ]; then
  echo "Deploying to Bedrock Dedicated Server at $BDS_DIR..."

  BP_DEST="$BDS_DIR/development_behavior_packs/MegaKnights_BP"
  RP_DEST="$BDS_DIR/development_resource_packs/MegaKnights_RP"

  rsync -av --delete MegaKnights_BP/ "$BP_DEST/"
  rsync -av --delete MegaKnights_RP/ "$RP_DEST/"

  echo "Deployed. Restart the server to reload packs."
else
  echo "Set BDS_DIR to auto-deploy to your Bedrock Dedicated Server."
  echo "Example: export BDS_DIR=/path/to/macOS-Bedrock-Server/server"
fi
