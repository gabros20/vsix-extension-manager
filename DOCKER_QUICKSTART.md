# Docker Testing - Quick Start

Docker daemon isn't currently running. Here's how to start testing:

## 🚀 Quick Start

### 1. Start Docker Desktop

```bash
# On macOS, start Docker Desktop app
open -a Docker

# Wait for Docker to start (30-60 seconds)
# You'll see the Docker icon in your menu bar
```

### 2. Verify Docker is Running

```bash
docker --version
docker ps
```

### 3. Build Test Image

```bash
cd /Users/tamas/Documents/Personal/Projects/vsix-downloader

# Build the test environment (takes 2-3 minutes)
docker build -f Dockerfile.test -t vsix-test:latest .
```

### 4. Run Tests

**Option A: Interactive Testing (Recommended)**
```bash
# Launch interactive shell
docker run -it --rm vsix-test:latest

# Inside container, test freely:
node dist/index.js add ms-python.python --editor vscode --yes
node dist/index.js list --editor vscode
code --list-extensions
node dist/index.js doctor
exit
```

**Option B: Automated Test Suite**
```bash
# Run all 10 automated tests
docker run --rm vsix-test:latest bash /app/docker-tests.sh
```

**Option C: Helper Script**
```bash
# Interactive helper
./docker-test.sh
```

---

## 🧪 What to Test in Docker

Once inside the container, try these commands:

```bash
# 1. Install an extension
node dist/index.js add ms-python.python --editor vscode --yes

# 2. Verify it's installed
code --list-extensions
# Should show: ms-python.python

# 3. List via our tool
node dist/index.js list --editor vscode

# 4. Get info
node dist/index.js info ms-python.python

# 5. Test update
node dist/index.js update --editor vscode

# 6. Remove extension
node dist/index.js remove ms-python.python --editor vscode --yes

# 7. Verify removed
code --list-extensions
# Should not show ms-python.python

# 8. Test batch install
echo "ms-python.python" > /tmp/ext.txt
echo "dbaeumer.vscode-eslint" >> /tmp/ext.txt
node dist/index.js add /tmp/ext.txt --editor vscode --yes

# 9. List again
node dist/index.js list --editor vscode

# 10. Test doctor
node dist/index.js doctor

# 11. Test interactive mode
node dist/index.js
# Navigate menus, test workflows
```

---

## 📋 Expected Results

### Successful Installation
```
✓ Downloaded ms-python.python-2025.17.2025100201.vsix
✓ Installed ms-python.python-2025.17.2025100201.vsix
```

### Successful List
```
┌  📋 List Extensions
│
└  Found 1 extension(s)

ms-python.python@2025.17.2025100201
```

### Successful Doctor
```
┌  🏥 Health Check
│
└  ✅ All checks passed

VS Code Detection: ✅
Cursor Detection: ❌ (expected in container)
Extensions Directory: ✅
Marketplace Access: ✅
```

---

## 🛡️ Safety Reminders

- ✅ **Completely isolated** - Nothing affects your host system
- ✅ **Disposable** - Container deleted on exit (--rm flag)
- ✅ **Fresh state** - Each run starts clean
- ✅ **Safe to break** - Test destructive operations freely

---

## 🐛 Troubleshooting

### Docker not starting?
```bash
# Check Docker status
docker info

# Restart Docker Desktop
killall Docker && open -a Docker
```

### Build fails?
```bash
# Clear Docker cache
docker builder prune -a

# Rebuild
docker build --no-cache -f Dockerfile.test -t vsix-test:latest .
```

### Container exits immediately?
```bash
# Use interactive mode
docker run -it --rm vsix-test:latest /bin/bash
```

---

## ⏱️ Time Estimates

- **Docker Desktop startup:** 30-60 seconds
- **Image build:** 2-3 minutes (first time)
- **Automated tests:** 1-2 minutes
- **Interactive testing:** 5-10 minutes
- **Total:** 10-15 minutes

---

## ✅ When Tests Pass

Once Docker tests pass, you'll have verified:
- ✅ Real installation works
- ✅ Extensions install correctly
- ✅ Remove command works
- ✅ Update functionality works
- ✅ List command accurate
- ✅ Doctor detects issues
- ✅ JSON output valid
- ✅ All modes work correctly

**Confidence level: 99%** - Ready for production release!
