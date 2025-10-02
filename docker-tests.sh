#!/bin/bash
# Automated test suite to run inside Docker container

echo "🧪 Running automated tests in isolated Docker environment"
echo "=========================================================="
echo ""

# Test counter
TOTAL=0
PASSED=0
FAILED=0

# Test helper function
run_test() {
    local test_name="$1"
    local command="$2"
    
    TOTAL=$((TOTAL + 1))
    echo "Test $TOTAL: $test_name"
    echo "  Command: $command"
    
    if eval "$command" > /dev/null 2>&1; then
        echo "  ✅ PASS"
        PASSED=$((PASSED + 1))
    else
        echo "  ❌ FAIL"
        FAILED=$((FAILED + 1))
    fi
    echo ""
}

# Test 1: Help output
run_test "Help output" "node dist/index.js --help"

# Test 2: Version
run_test "Version" "node dist/index.js --version"

# Test 3: Info command
run_test "Info command" "node dist/index.js info ms-python.python --json --quiet"

# Test 4: List command
run_test "List command" "node dist/index.js list --editor vscode --json --quiet"

# Test 5: Doctor command
run_test "Doctor command" "node dist/index.js doctor --json --quiet"

# Test 6: Download-only mode
run_test "Download-only mode" "node dist/index.js add ms-python.python --download-only --output /tmp/test --quiet"

# Test 7: Real installation
echo "Test $((TOTAL + 1)): Real installation (ms-python.python)"
echo "  Command: node dist/index.js add ms-python.python --editor vscode --yes --quiet"
TOTAL=$((TOTAL + 1))

if node dist/index.js add ms-python.python --editor vscode --yes --quiet; then
    echo "  ✅ PASS - Extension installed"
    PASSED=$((PASSED + 1))
    
    # Verify installation
    if code --list-extensions | grep -q "ms-python.python"; then
        echo "  ✅ Verified - Extension appears in VS Code"
    else
        echo "  ⚠️  Warning - Extension not visible in VS Code list"
    fi
else
    echo "  ❌ FAIL"
    FAILED=$((FAILED + 1))
fi
echo ""

# Test 8: List after installation
run_test "List after installation" "node dist/index.js list --editor vscode --json --quiet"

# Test 9: Info on installed extension
run_test "Info on installed extension" "node dist/index.js info ms-python.python --json --quiet"

# Test 10: Update command (dry-run)
run_test "Update dry-run" "node dist/index.js update --editor vscode --dry-run --quiet"

# Summary
echo "=========================================================="
echo "📊 Test Summary"
echo "=========================================================="
echo "Total tests: $TOTAL"
echo "Passed: $PASSED ✅"
echo "Failed: $FAILED ❌"
echo ""

if [ $FAILED -eq 0 ]; then
    echo "🎉 All tests passed!"
    exit 0
else
    echo "⚠️  Some tests failed"
    exit 1
fi
