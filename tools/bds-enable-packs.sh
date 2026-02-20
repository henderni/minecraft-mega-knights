#!/bin/bash
set -e

# Enables the Mega Knights behavior and resource packs in the BDS world.
# Run this ONCE after the server has started for the first time and created the world.

WORLD_DIR="/data/worlds/MegaKnightsWorld"
CONTAINER="minecraft-mega-knights-bds-1"

echo "Checking if container is running..."
if ! docker ps --format '{{.Names}}' | grep -q "$CONTAINER"; then
  echo "Error: Container '$CONTAINER' is not running."
  echo "Start the server first with: docker compose up -d"
  exit 1
fi

echo "Checking if world directory exists..."
if ! docker compose exec bds test -d "$WORLD_DIR"; then
  echo "Error: World directory not found. Let the server run for ~30 seconds to generate the world, then try again."
  exit 1
fi

echo "Writing world_behavior_packs.json..."
docker compose exec bds bash -c "cat > $WORLD_DIR/world_behavior_packs.json << 'PACK_EOF'
[
  {
    \"pack_id\": \"3f7ba554-46a5-468a-9a8f-042422d53327\",
    \"version\": [1, 0, 0]
  }
]
PACK_EOF"

echo "Writing world_resource_packs.json..."
docker compose exec bds bash -c "cat > $WORLD_DIR/world_resource_packs.json << 'PACK_EOF'
[
  {
    \"pack_id\": \"d70dff91-9d30-46a0-985a-d3e24aacd25a\",
    \"version\": [1, 0, 0]
  }
]
PACK_EOF"

echo ""
echo "Packs enabled! Restart the server to apply:"
echo "  docker compose restart"
