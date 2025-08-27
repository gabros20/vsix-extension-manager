#!/bin/bash

# Example usage of vsix-downloader CLI
echo "🚀 VSIX Downloader - Example Usage"
echo "=================================="

echo ""
echo "1. Building the project..."
npm run build

echo ""
echo "2. Testing the CLI with a real extension..."
echo "   Downloading a lightweight extension for demonstration"

# Example with a real, lightweight VS Code extension
node dist/index.js download \
  --url "https://marketplace.visualstudio.com/items?itemName=ms-vscode.hexdump" \
  --version "1.8.2" \
  --output "./example-downloads"

echo ""
echo "3. Checking downloaded file..."
ls -la ./example-downloads/

echo ""
echo "✅ Example complete! Check the ./example-downloads/ directory for the VSIX file."
echo ""
echo "To install globally:"
echo "  npm run build"
echo "  npm link"
echo ""
echo "To publish to npm:"
echo "  npm run build"
echo "  npm publish"
