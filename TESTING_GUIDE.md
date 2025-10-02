# Safe Testing Guide for v2.0

**Goal:** Test all functionality without affecting your real VS Code/Cursor installations.

---

## 🛡️ Safe Testing Strategies

### Strategy 1: Read-Only Commands (100% Safe)

These commands **never modify** anything - completely safe to run:

```bash
# Build the project
npm run build

# Test help output
node dist/index.js --help
node dist/index.js add --help
node dist/index.js remove --help
node dist/index.js update --help

# Test info command (just fetches metadata from marketplace)
node dist/index.js info ms-python.python
node dist/index.js info ms-python.python --all
node dist/index.js info dbaeumer.vscode-eslint

# Test list command (just reads your current extensions - no changes)
node dist/index.js list
node dist/index.js list --format json
node dist/index.js list --format yaml
```

**Safe because:** These only **read** data, never write or modify.

---

### Strategy 2: Dry-Run Mode (100% Safe)

Test the full flow without actually executing:

```bash
# Download-only mode (downloads to temp folder, doesn't install)
node dist/index.js add ms-python.python --download-only --output /tmp/vsix-test

# Dry-run mode (shows what WOULD happen, doesn't do it)
node dist/index.js add ms-python.python --dry-run
node dist/index.js update --dry-run
node dist/index.js remove ms-python.python --dry-run

# Plan mode (shows execution plan)
node dist/index.js add ms-python.python --plan
```

**Safe because:** Nothing is actually installed or removed.

---

### Strategy 3: Docker Container (100% Isolated)

Create a completely isolated test environment:

**Create test Dockerfile:**

```dockerfile
# Dockerfile.test
FROM node:18

# Install VS Code in container (won't affect your host)
RUN curl -fsSL https://code.visualstudio.com/sha/download\?build\=stable\&os\=linux-deb-x64 -o /tmp/vscode.deb && \
    apt-get update && \
    apt-get install -y /tmp/vscode.deb && \
    rm /tmp/vscode.deb

# Copy your project
WORKDIR /app
COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

# Default command
CMD ["/bin/bash"]
```

**Run tests in container:**

```bash
# Build container
docker build -f Dockerfile.test -t vsix-test .

# Run interactive shell in container
docker run -it --rm vsix-test

# Inside container - test freely!
node dist/index.js add ms-python.python
node dist/index.js list
node dist/index.js doctor
# etc... nothing affects your host system
```

**Safe because:** Completely isolated container - destroyed when you exit.

---

### Strategy 4: Portable VS Code Installation (Isolated)

Create a separate VS Code installation just for testing:

```bash
# Create test directory
mkdir -p ~/vsix-testing/portable-vscode
cd ~/vsix-testing/portable-vscode

# Download VS Code portable (macOS)
curl -L "https://update.code.visualstudio.com/latest/darwin/stable" -o vscode.zip
unzip vscode.zip

# Create data directory (makes it portable)
mkdir -p "Visual Studio Code.app/Contents/Resources/app/data"

# Now test with custom binary path pointing to this installation
cd /path/to/vsix-downloader
node dist/index.js add ms-python.python \
  --code-bin "$HOME/vsix-testing/portable-vscode/Visual Studio Code.app/Contents/Resources/app/bin/code" \
  --editor vscode
```

**Safe because:** Separate installation, your main VS Code/Cursor untouched.

---

### Strategy 5: Test User Account (macOS/Linux)

Create a separate macOS user for testing:

```bash
# Create test user (macOS)
sudo dscl . -create /Users/vsixtest
sudo dscl . -create /Users/vsixtest UserShell /bin/bash
sudo dscl . -create /Users/vsixtest RealName "VSIX Test User"
sudo dscl . -create /Users/vsixtest UniqueID 503
sudo dscl . -create /Users/vsixtest PrimaryGroupID 20
sudo dscl . -create /Users/vsixtest NFSHomeDirectory /Users/vsixtest
sudo dscl . -passwd /Users/vsixtest testpass123

# Switch to test user
su - vsixtest

# Install fresh VS Code/Cursor in test user's home
# Test freely - won't affect your main account
```

**Safe because:** Completely separate user account.

---

### Strategy 6: Custom Extensions Directory

Point to a test extensions directory:

```bash
# Create test directory
mkdir -p ~/vsix-test-extensions

# Test with environment variable (if VS Code supports it)
# Or use symlink approach

# Backup your real extensions
mv ~/.vscode/extensions ~/.vscode/extensions.backup

# Create test extensions directory
mkdir ~/.vscode/extensions

# Test freely
node dist/index.js add ms-python.python

# Restore when done
rm -rf ~/.vscode/extensions
mv ~/.vscode/extensions.backup ~/.vscode/extensions
```

**Risky!** Better to use other strategies.

---

### Strategy 7: VM or Multipass (Complete Isolation)

Use a lightweight VM:

```bash
# Install Multipass (lightweight Ubuntu VMs)
brew install multipass

# Create Ubuntu VM
multipass launch --name vsix-test --cpus 2 --mem 4G --disk 20G

# Enter VM
multipass shell vsix-test

# Inside VM - install VS Code, test freely
sudo apt update
sudo snap install code --classic

# Install your project
git clone <your-repo>
cd vsix-extension-manager
npm install
npm run build

# Test everything - VM is isolated
node dist/index.js add ms-python.python
```

**Safe because:** Complete VM isolation, can delete when done.

---

## 🧪 Recommended Testing Sequence

### Phase 1: Zero Risk (Start Here)

```bash
cd /path/to/vsix-downloader
npm run build

# 1. Test help outputs
node dist/index.js --help
node dist/index.js add --help

# 2. Test info command (read-only, safe)
node dist/index.js info ms-python.python
node dist/index.js info dbaeumer.vscode-eslint --all

# 3. Test list command (read-only, safe)
node dist/index.js list
node dist/index.js list --format json

# 4. Test doctor (diagnostics only, no changes)
node dist/index.js doctor

# 5. Test interactive mode (just navigate menus, don't install)
node dist/index.js
# Choose "Help" or just exit
```

### Phase 2: Download-Only (Safe)

```bash
# Create temp directory
mkdir -p /tmp/vsix-test-downloads

# Download without installing
node dist/index.js add ms-python.python --download-only --output /tmp/vsix-test-downloads
node dist/index.js add dbaeumer.vscode-eslint --download-only --output /tmp/vsix-test-downloads

# Verify downloads
ls -lh /tmp/vsix-test-downloads/

# Test batch download
echo "ms-python.python" > /tmp/test-extensions.txt
echo "dbaeumer.vscode-eslint" >> /tmp/test-extensions.txt
node dist/index.js add /tmp/test-extensions.txt --download-only --output /tmp/vsix-test-downloads
```

### Phase 3: Dry-Run Mode (Safe)

```bash
# Test all commands in dry-run mode
node dist/index.js add ms-python.python --dry-run
node dist/index.js update --dry-run
node dist/index.js remove ms-python.python --dry-run

# Test with plan preview
node dist/index.js add ms-python.python --plan
```

### Phase 4: Docker/VM (Fully Isolated)

Only after phases 1-3 pass, test real installations in isolated environment.

---

## 🎯 Test Matrix

### Interactive Mode Testing (Safe - Just Navigation)

```bash
node dist/index.js

# Test menu navigation:
1. Add extension → Select "Extension by ID" → Enter "test" → Cancel ✓
2. Update extensions → Cancel ✓
3. Setup new machine → Navigate through → Cancel ✓
4. Fix problems (doctor) → Let it run (read-only) ✓
5. Advanced options → Navigate → Back ✓
6. Help → Read ✓
7. Exit ✓
```

### Read-Only Command Testing (100% Safe)

| Command | Test | Risk |
|---------|------|------|
| `info <id>` | ✅ Fetch metadata | None |
| `list` | ✅ Read installed | None |
| `list --format json` | ✅ Export list | None |
| `doctor` | ✅ Diagnostics | None (read-only) |
| `<any> --help` | ✅ Help output | None |
| `<any> --plan` | ✅ Show plan | None |
| `<any> --dry-run` | ✅ Simulate | None |

### Download-Only Testing (Safe)

| Command | Test | Risk |
|---------|------|------|
| `add <id> --download-only` | ✅ Download to temp | None (no install) |
| `add <list> --download-only` | ✅ Batch download | None (no install) |

### Real Installation Testing (Use Docker/VM)

| Command | Test | Risk | Environment |
|---------|------|------|-------------|
| `add <id>` | Install extension | ⚠️ High | Docker/VM only |
| `remove <id>` | Uninstall extension | ⚠️ High | Docker/VM only |
| `update` | Update extensions | ⚠️ High | Docker/VM only |
| `rollback` | Restore backup | ⚠️ Medium | Docker/VM only |

---

## 🚀 Quick Start: Safest Path

**Recommended for first-time testing:**

```bash
# 1. Build project
cd /path/to/vsix-downloader
npm run build

# 2. Test read-only commands
node dist/index.js --help
node dist/index.js info ms-python.python
node dist/index.js list
node dist/index.js doctor

# 3. Test download-only (no installation)
mkdir -p /tmp/vsix-test
node dist/index.js add ms-python.python --download-only --output /tmp/vsix-test
ls -lh /tmp/vsix-test/

# 4. Test interactive mode (just navigate, don't install)
node dist/index.js
# Navigate menus, then exit

# 5. If everything looks good, use Docker for real testing
docker run -it --rm node:18 bash
# Install VS Code in container, test real installations
```

---

## ⚠️ What NOT To Do

❌ **Don't test real installations on your main system first**  
❌ **Don't skip dry-run testing**  
❌ **Don't test remove/update on your production extensions**  
❌ **Don't modify your ~/.vscode/extensions directly**

---

## ✅ Validation Checklist

After safe testing, you should verify:

- [ ] Help output is correct for all commands
- [ ] Info command fetches correct metadata
- [ ] List command shows your extensions correctly
- [ ] Doctor command runs diagnostics
- [ ] Download-only mode downloads to temp directory
- [ ] Dry-run mode shows correct plan
- [ ] Interactive mode menus work correctly
- [ ] All flags are recognized
- [ ] Error messages are helpful
- [ ] JSON output is valid
- [ ] No crashes or exceptions

---

## 🎓 Summary

**Start with:** Read-only commands and dry-run mode (100% safe)  
**Then:** Download-only testing (safe, no installation)  
**Finally:** Docker/VM for real installation testing (isolated)  

**Never test real installations on your main VS Code/Cursor setup first!**

This ensures you can test thoroughly without any risk to your development environment.
