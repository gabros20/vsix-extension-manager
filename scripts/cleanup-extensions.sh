#!/bin/bash

# VS Code Extensions Cleanup Script
# This script cleans up corrupted extensions and ensures proper state

echo "🧹 VS Code Extensions Cleanup"
echo "=============================="

EXTENSIONS_DIR="$HOME/.vscode/extensions"
EXTENSIONS_JSON="$EXTENSIONS_DIR/extensions.json"
OBSOLETE_FILE="$EXTENSIONS_DIR/.obsolete"

echo "📁 Extensions directory: $EXTENSIONS_DIR"

# 1. Check if extensions directory exists
if [ ! -d "$EXTENSIONS_DIR" ]; then
    echo "❌ Extensions directory does not exist"
    exit 1
fi

# 2. Count current state
TOTAL_DIRS=$(find "$EXTENSIONS_DIR" -maxdepth 1 -type d | wc -l | tr -d ' ')
VALID_EXTENSIONS=$(find "$EXTENSIONS_DIR" -maxdepth 2 -name "package.json" | wc -l | tr -d ' ')
echo "📊 Current state: $TOTAL_DIRS directories, $VALID_EXTENSIONS valid extensions"

# 3. Remove corrupted extensions (directories without package.json)
echo "🔍 Checking for corrupted extensions..."
CORRUPTED_COUNT=0
for dir in "$EXTENSIONS_DIR"/*; do
    if [ -d "$dir" ] && [ ! -f "$dir/package.json" ]; then
        echo "  🗑️  Removing corrupted: $(basename "$dir")"
        rm -rf "$dir"
        ((CORRUPTED_COUNT++))
    fi
done

if [ $CORRUPTED_COUNT -eq 0 ]; then
    echo "  ✅ No corrupted extensions found"
else
    echo "  🧹 Removed $CORRUPTED_COUNT corrupted extension(s)"
fi

# 4. Clean up .obsolete file - remove entries for extensions that no longer exist
echo "🔍 Cleaning up .obsolete file..."
if [ -f "$OBSOLETE_FILE" ]; then
    # Create a backup
    cp "$OBSOLETE_FILE" "$OBSOLETE_FILE.backup"
    
    # Get list of currently installed extensions
    CURRENT_EXTENSIONS=$(find "$EXTENSIONS_DIR" -maxdepth 1 -type d -name "*.*" | sed 's/.*\///' | sort)
    
    # Create a new .obsolete file with only existing extensions
    echo "{" > "$OBSOLETE_FILE.tmp"
    FIRST=true
    for ext in $CURRENT_EXTENSIONS; do
        if [ "$FIRST" = true ]; then
            FIRST=false
        else
            echo "," >> "$OBSOLETE_FILE.tmp"
        fi
        echo "  \"$ext\": true" >> "$OBSOLETE_FILE.tmp"
    done
    echo "}" >> "$OBSOLETE_FILE.tmp"
    
    # Replace the old file
    mv "$OBSOLETE_FILE.tmp" "$OBSOLETE_FILE"
    echo "  ✅ Cleaned up .obsolete file"
else
    echo "  📝 Creating new .obsolete file"
    echo "{}" > "$OBSOLETE_FILE"
fi

# 5. Ensure extensions.json is valid
echo "🔍 Validating extensions.json..."
if [ -f "$EXTENSIONS_JSON" ]; then
    # Validate JSON
    if ! python3 -m json.tool "$EXTENSIONS_JSON" > /dev/null 2>&1; then
        echo "  🔧 Fixing corrupted extensions.json"
        echo "[]" > "$EXTENSIONS_JSON"
    else
        echo "  ✅ extensions.json is valid"
    fi
else
    echo "  📝 Creating extensions.json"
    echo "[]" > "$EXTENSIONS_JSON"
fi

# 6. Final state
FINAL_DIRS=$(find "$EXTENSIONS_DIR" -maxdepth 1 -type d | wc -l | tr -d ' ')
FINAL_VALID=$(find "$EXTENSIONS_DIR" -maxdepth 2 -name "package.json" | wc -l | tr -d ' ')

echo ""
echo "📊 Final state: $FINAL_DIRS directories, $FINAL_VALID valid extensions"
echo "✅ Cleanup completed!"
