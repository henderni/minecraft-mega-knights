#!/bin/bash

# Package Mega Knights for distribution
# Creates MegaKnights.mcaddon (zip file with both packs)

set -e

echo "Building add-on package..."

# Ensure TypeScript is compiled
npm run build

ADDON_NAME="MegaKnights"
ADDON_FILE="${ADDON_NAME}.mcaddon"

# Clean up old package
rm -f "$ADDON_FILE"

# Create temporary directory for packing
TEMP_DIR=$(mktemp -d)
trap "rm -rf $TEMP_DIR" EXIT

# Copy behavior pack
mkdir -p "$TEMP_DIR/MegaKnights_BP"
cp -r MegaKnights_BP/* "$TEMP_DIR/MegaKnights_BP/"

# Copy resource pack
mkdir -p "$TEMP_DIR/MegaKnights_RP"
cp -r MegaKnights_RP/* "$TEMP_DIR/MegaKnights_RP/"

# Create the .mcaddon (zip file)
cd "$TEMP_DIR"
zip -r "$OLDPWD/$ADDON_FILE" . -q

echo "✓ Created $ADDON_FILE"
echo ""
echo "Package ready for distribution:"
echo "  - Direct download: Users download and open $ADDON_FILE"
echo "  - Size: $(du -h $OLDPWD/$ADDON_FILE | cut -f1)"
echo ""
echo "Next steps:"
echo "  1. Test the .mcaddon file locally"
echo "  2. Distribute via website/Discord/etc or submit to marketplace"
