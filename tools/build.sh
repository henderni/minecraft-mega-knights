#!/bin/bash
set -e

# Compile TypeScript
echo "Compiling TypeScript..."
npx tsc

echo "Build complete! Scripts output to MegaKnights_BP/scripts/"

# If BDS_DIR is set, deploy to server
if [ -n "$BDS_DIR" ]; then
  echo "Deploying to Bedrock Dedicated Server at $BDS_DIR..."

  BP_DEST="$BDS_DIR/behavior_packs/MegaKnights_BP"
  RP_DEST="$BDS_DIR/resource_packs/MegaKnights_RP"

  rsync -av --delete MegaKnights_BP/ "$BP_DEST/"
  rsync -av --delete MegaKnights_RP/ "$RP_DEST/"

  echo "Deployed. Restart the server to reload packs."
else
  echo "Set BDS_DIR to auto-deploy to your Bedrock Dedicated Server."
  echo "Example: export BDS_DIR=/path/to/macOS-Bedrock-Server/server"
fi
