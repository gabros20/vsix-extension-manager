# Docker-Based Isolated Testing

**Purpose:** Test real installations in complete isolation without affecting your host system.

---

## 🐳 Quick Start

### 1. Build Docker Test Environment

```bash
# Build the Docker image (takes 2-3 minutes)
./docker-test.sh
```

Or manually:
```bash
docker build -f Dockerfile.test -t vsix-test:latest .
```

### 2. Run Interactive Test Shell

```bash
# Launch isolated test environment
docker run -it --rm vsix-test:latest

# Inside container, you can test freely:
node dist/index.js add ms-python.python --editor vscode
node dist/index.js list --editor vscode
node dist/index.js doctor
```

### 3. Run Automated Test Suite

```bash
# Run all tests automatically
docker run --rm vsix-test:latest bash /app/docker-tests.sh
```

---

## 📦 What's Inside the Docker Image

- **Ubuntu 22.04** - Clean base OS
- **Node.js 18.x** - Runtime environment  
- **VS Code** - Installed and ready to use
- **vsix-extension-manager** - Built and ready to test
- **Test user** - Non-root user (testuser) for realistic testing

**Complete Isolation:**
- ✅ Separate VS Code installation
- ✅ Separate extensions directory
- ✅ No connection to your host VS Code/Cursor
- ✅ Container is destroyed after exit (--rm flag)

---

## 🧪 Test Scenarios

### Basic Tests (Inside Container)

```bash
# 1. Help and info
node dist/index.js --help
node dist/index.js info ms-python.python

# 2. Download-only (safe)
node dist/index.js add ms-python.python --download-only --output /tmp/test

# 3. Real installation
node dist/index.js add ms-python.python --editor vscode --yes

# 4. List installed
node dist/index.js list --editor vscode

# 5. Check in VS Code
code --list-extensions

# 6. Update check
node dist/index.js update --editor vscode

# 7. Remove extension
node dist/index.js remove ms-python.python --editor vscode --yes

# 8. Rollback
node dist/index.js rollback --list
```

### Advanced Tests

```bash
# Batch installation from list
echo "ms-python.python" > /tmp/extensions.txt
echo "dbaeumer.vscode-eslint" >> /tmp/extensions.txt
node dist/index.js add /tmp/extensions.txt --editor vscode --yes

# Test update functionality
node dist/index.js update --editor vscode

# Test doctor
node dist/index.js doctor

# Test setup wizard
node dist/index.js setup
```

---

## 🎯 Test Checklist

Inside Docker container, verify:

- [ ] Extension downloads successfully
- [ ] Extension installs without errors
- [ ] Extension appears in `code --list-extensions`
- [ ] List command shows installed extension
- [ ] Update command detects updates
- [ ] Remove command uninstalls correctly
- [ ] Rollback creates backups
- [ ] Doctor detects VS Code correctly
- [ ] Interactive mode works
- [ ] JSON output is valid
- [ ] Quiet mode works
- [ ] Error messages are helpful

---

## 🔧 Docker Commands Reference

### Build & Run

```bash
# Build image
docker build -f Dockerfile.test -t vsix-test:latest .

# Run interactive shell
docker run -it --rm vsix-test:latest

# Run single command
docker run --rm vsix-test:latest node dist/index.js --help

# Run as root (if needed for debugging)
docker run -it --rm --user root vsix-test:latest
```

### Debugging

```bash
# Check VS Code installation
docker run --rm vsix-test:latest code --version

# Check Node.js version
docker run --rm vsix-test:latest node --version

# List files
docker run --rm vsix-test:latest ls -la /app

# Check VS Code extensions directory
docker run --rm vsix-test:latest ls -la /home/testuser/.vscode/extensions
```

### Cleanup

```bash
# Remove test image
docker rmi vsix-test:latest

# Remove all stopped containers
docker container prune

# Remove all unused images
docker image prune
```

---

## ⚡ Quick Test Commands

**One-liner to test installation:**
```bash
docker run --rm vsix-test:latest bash -c 'node dist/index.js add ms-python.python --editor vscode --yes && code --list-extensions'
```

**One-liner to run full test suite:**
```bash
docker run --rm vsix-test:latest bash /app/docker-tests.sh
```

**One-liner to test interactive mode:**
```bash
docker run -it vsix-test:latest bash -c 'node dist/index.js'
```

---

## 📊 Expected Results

### Successful Installation Test

```
✓ Downloaded ms-python.python-2025.17.2025100201.vsix
✓ Installed ms-python.python-2025.17.2025100201.vsix

Extensions installed:
ms-python.python@2025.17.2025100201
```

### Successful List Test

```json
{
  "status": "ok",
  "command": "list",
  "summary": "Found 1 extension(s)",
  "items": [
    {
      "id": "ms-python.python",
      "version": "2025.17.2025100201",
      "status": "success"
    }
  ]
}
```

---

## 🛡️ Safety Notes

- **Complete Isolation:** Nothing affects your host system
- **Disposable:** Container destroyed after each run (--rm flag)
- **Fresh Start:** Each run starts with clean state
- **No Data Persistence:** No volumes mounted, no data saved

**You can test destructive operations safely:**
- Install/uninstall repeatedly
- Break configurations
- Test edge cases
- Experiment freely

---

## 🚀 Next Steps After Docker Testing

Once Docker tests pass:

1. **Review test results** - Check all scenarios work
2. **Fix any bugs found** - Update code if needed
3. **Run tests again** - Verify fixes work
4. **Ready for release** - High confidence for production

**Estimated time:** 1-2 hours for complete Docker testing
