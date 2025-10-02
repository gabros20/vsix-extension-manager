# Next Session TODO - Final Cleanup

**Status:** 75% Integration Complete  
**Time Needed:** 15-30 minutes  
**Goal:** Fix build + commit clean v2.0 codebase

---

## 🔧 Build Errors to Fix

Build is currently broken due to deleted legacy command files. Two files need updates:

### 1. Fix `src/commands/interactive.ts`

**Problem:** Imports 9 deleted legacy commands

**Errors:**
```
src/commands/interactive.ts(270,50): error TS2307: Cannot find module './quickInstall'
src/commands/interactive.ts(275,49): error TS2307: Cannot find module './install'
src/commands/interactive.ts(280,52): error TS2307: Cannot find module './install'
src/commands/interactive.ts(285,53): error TS2307: Cannot find module './install'
src/commands/interactive.ts(298,52): error TS2307: Cannot find module './download'
src/commands/interactive.ts(303,54): error TS2307: Cannot find module './download'
src/commands/interactive.ts(308,41): error TS2307: Cannot find module './fromList'
src/commands/interactive.ts(321,53): error TS2307: Cannot find module './updateInstalled'
src/commands/interactive.ts(334,48): error TS2307: Cannot find module './exportInstalled'
src/commands/interactive.ts(347,57): error TS2307: Cannot find module './uninstallExtensions'
```

**Solution:** Update menu to use ONLY v2.0 commands:
- quickInstall → `add` command
- install → `add` command
- download → `add` command with `--download-only`
- fromList → `add` command
- updateInstalled → `update` command
- exportInstalled → `list` command
- uninstallExtensions → `remove` command

**Approach:** Simplify menu structure to v2.0 commands only

### 2. Fix `src/index.ts`

**Problem:** Has registrations for deleted legacy commands (lines ~166-416)

**Legacy Registrations to Remove:**
- `download` command (line ~166)
- `quick-install` command (line ~198)
- `versions` command (line ~223)
- `export-installed` command (line ~235)
- `from-list` command (line ~251)
- `install` command (line ~292)
- `update-installed` command (line ~323)
- `install-direct` command (line ~375)
- `uninstall` command (line ~392)

**Keep:**
- `add` command (already v2.0)
- `rollback` command (unchanged)
- `wireV2Command` section (lines ~430-580)

**Solution:** Delete all legacy command registrations between "add" and "rollback"

**Also remove:**
- Import: `import { downloadVsix } from "./commands/download";` (line 4)

---

## 📋 Step-by-Step Fix

### Step 1: Remove Legacy Import from index.ts

```typescript
// DELETE this line (around line 4):
import { downloadVsix } from "./commands/download";
```

### Step 2: Remove Legacy Command Registrations

Delete everything between the "add" command and "rollback" command in index.ts (approximately lines 166-350).

Keep only:
- The "add" command registration
- The "rollback" command registration  
- The `wireV2Command` helper function
- The v2.0 command wiring section at the end

### Step 3: Update interactive.ts

Option A (Simple): **Disable interactive mode temporarily**
```typescript
// In runInteractive function, add early return:
export async function runInteractive(config: Config): Promise<void> {
  ui.intro("VSIX Extension Manager");
  ui.log.warning("Interactive mode temporarily disabled during v2.0 migration");
  ui.log.info("Use direct commands: vsix add, vsix remove, vsix update, vsix list, vsix info");
  ui.outro("Use --help for command options");
}
```

Option B (Complete): **Rewrite menu for v2.0**
- Replace all legacy command imports with v2.0
- Simplify menu structure
- Use command registry to load commands dynamically

**Recommendation:** Use Option A for now, rewrite interactive menu later

### Step 4: Test Build

```bash
npm run build
```

Should pass with 0 errors!

### Step 5: Test Commands

```bash
node dist/index.js add --help
node dist/index.js remove --help
node dist/index.js update --help
node dist/index.js list --help
node dist/index.js info --help
```

All should work!

### Step 6: Commit

```bash
git add -A
git commit -m "feat: complete v2.0 clean slate - all legacy removed

Clean v2.0 Codebase Complete:

✅ Removed All Legacy:
  - Deleted 9 legacy command files
  - Removed legacy command registrations from index.ts
  - Simplified interactive mode (disabled for now)

✅ v2.0 Commands Only:
  - add (universal entry point)
  - remove (enhanced uninstall)
  - update (smart rollback)
  - list (multiple formats)
  - info (rich details)
  - doctor (health checks)
  - setup (config wizard)
  - rollback (preserved)

🎯 Result:
  - Clean codebase, no legacy code
  - Build: PASSING
  - All commands working
  - Ready for config v2 integration

Next: Config v2 loading, update checker, final testing

Co-authored-by: factory-droid[bot] <138933559+factory-droid[bot]@users.noreply.github.com>"
```

---

## 📊 Current State

**Commits This Session:** 13 (includes MIGRATION.md update)

**Deleted Files:**
- ✅ src/commands/download.ts
- ✅ src/commands/quickInstall.ts
- ✅ src/commands/fromList.ts
- ✅ src/commands/install.ts
- ✅ src/commands/installDirect.ts
- ✅ src/commands/uninstallExtensions.ts
- ✅ src/commands/updateInstalled.ts
- ✅ src/commands/exportInstalled.ts
- ✅ src/commands/versions.ts

**v2.0 Commands (All Using CommandResultBuilder):**
- ✅ add/ (3 files)
- ✅ remove.ts
- ✅ update.ts
- ✅ list.ts
- ✅ info.ts
- ✅ doctor/ (3 files)
- ✅ setup.ts
- ✅ rollback.ts (preserved)

**Code Reduction:** ~185 lines of boilerplate removed

---

## 🎯 After This Session

**Remaining Integration Tasks (25%):**
1. ⏳ Integrate config v2 loading at startup
2. ⏳ Add background update checker
3. ⏳ Test real extension installations
4. ⏳ Final polish and release prep

**Estimated Time:** 1-2 weeks to v2.0.0 release

---

## 💡 Tips

**If index.ts is too complex to edit:**
- Search for "V1.X COMMANDS" or "Legacy" comments
- Delete everything from line ~166 to just before "rollback" command
- Keep the `withConfigAndErrorHandling` helper function
- Keep everything after line ~420 (wireV2Command section)

**If interactive.ts is too complex:**
- Just add early return at top of `runInteractive` function
- Can rewrite full interactive menu later

**Quick Check:**
```bash
# See what's deleted
git status

# Build should pass after fixes
npm run build

# All commands should work
node dist/index.js --help
```

---

**Last Updated:** 2024-12-19  
**Session:** Integration Phase Week 1 Complete  
**Progress:** 75% → 80% (after this cleanup)
