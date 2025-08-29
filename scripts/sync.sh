#!/bin/bash

# VSIX Extension Manager Git Sync Script
# Usage: ./scripts/sync.sh [commit_message]

set -e

echo "🔄 Syncing with remote..."

# Pull latest changes with rebase
git pull --rebase

# If commit message provided, commit and push
if [ ! -z "$1" ]; then
    echo "📝 Committing changes..."
    git add -A
    git commit -m "$1"
    echo "🚀 Pushing to remote..."
    git push
    echo "✅ Sync complete!"
else
    echo "✅ Pull complete! No changes to commit."
fi
