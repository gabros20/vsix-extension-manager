#!/bin/bash
# Helper script for Docker-based isolated testing

set -e

echo "🐳 Building Docker test environment..."
docker build -f Dockerfile.test -t vsix-test:latest .

echo ""
echo "✅ Docker image built successfully!"
echo ""
echo "📋 Available test commands:"
echo ""
echo "1. Interactive shell (test manually):"
echo "   docker run -it --rm vsix-test:latest"
echo ""
echo "2. Run specific test:"
echo "   docker run --rm vsix-test:latest node dist/index.js --help"
echo ""
echo "3. Test real installation (isolated):"
echo "   docker run -it --rm vsix-test:latest bash -c 'node dist/index.js add ms-python.python --editor vscode'"
echo ""
echo "4. Test all commands:"
echo "   docker run --rm vsix-test:latest bash /app/docker-tests.sh"
echo ""

# Ask if user wants to run interactive shell
read -p "🚀 Launch interactive test shell? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "🔧 Starting interactive test environment..."
    echo "   Inside container, run: node dist/index.js <command>"
    echo "   Nothing you do will affect your host system!"
    echo ""
    docker run -it --rm vsix-test:latest
fi
