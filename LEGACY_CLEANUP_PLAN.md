# Legacy Command Cleanup Plan

**Status:** In Progress  
**Phase:** Integration Phase - Gradual Migration  
**Branch:** `feat/v2.0-refactor`

---

## Current State

### ✅ v2.0 Commands (Fully Migrated)
These commands are **complete** and using Phase 2 systems:

| Command | Status | Uses Phase 2 | Wired in CLI | Legacy Replacement |
|---------|--------|--------------|--------------|-------------------|
| `add` | ✅ Complete | ✅ Yes | ✅ Yes | download, quickInstall, fromList, install, installDirect |
| `remove` | ✅ Complete | ✅ Yes | ✅ Yes | uninstallExtensions |
| `update` | ✅ Complete | ✅ Yes | ✅ Yes (as "upgrade") | updateInstalled |
| `list` | ✅ Complete | ✅ Yes | ✅ Yes | exportInstalled |
| `info` | ✅ Complete | ✅ Yes | ✅ Yes | versions |
| `doctor` | ⏳ Registered | ⏳ Pending | ✅ Yes | _(new)_ |
| `setup` | ⏳ Registered | ⏳ Pending | ✅ Yes | _(new)_ |

### ⏳ Legacy v1.x Commands (Still Registered)
These commands are **still in index.ts** for backward compatibility:

| Legacy Command | Replacement | File | Can Delete? |
|----------------|-------------|------|-------------|
| `download` | `add <input> --download-only` | download.ts | After migration warnings |
| `quick-install` | `add <url>` | quickInstall.ts | After migration warnings |
| `from-list` | `add <list-file>` | fromList.ts | After migration warnings |
| `install` | `add <input>` | install.ts | After migration warnings |
| `install-direct` | `add <input>` (auto-detects) | installDirect.ts | After migration warnings |
| `export-installed` | `list --output <file>` | exportInstalled.ts | After migration warnings |
| `update-installed` | `update` or `upgrade` | updateInstalled.ts | After migration warnings |
| `versions` | `info <id>` | versions.ts | After migration warnings |
| `uninstall` | `remove <id>` | uninstallExtensions.ts | After migration warnings |

### 📋 Legacy Files to Delete
- `src/commands/download.ts`
- `src/commands/quickInstall.ts`
- `src/commands/fromList.ts`
- `src/commands/install.ts`
- `src/commands/installDirect.ts`
- `src/commands/exportInstalled.ts`
- `src/commands/updateInstalled.ts`
- `src/commands/versions.ts`
- `src/commands/uninstallExtensions.ts`

---

## Migration Strategy

### Phase 1: Deprecation Warnings (Current)
**Timeline:** Now  
**Goal:** Warn users about command deprecation

**Actions:**
1. ✅ Keep legacy commands functional
2. ⏳ Add deprecation warnings when legacy commands are used
3. ⏳ Show migration path in warnings
4. ⏳ Update help text to indicate deprecated

**Example Warning:**
```
⚠️  DEPRECATION WARNING: 'download' command is deprecated

📚 Migration Guide:
   Old: vsix download --url <url>
   New: vsix add <url> --download-only

   The 'download' command will be removed in v2.1.0
   See: https://github.com/.../MIGRATION.md
```

### Phase 2: Remove from CLI (Next Release)
**Timeline:** v2.1.0  
**Goal:** Remove legacy commands from CLI registration

**Actions:**
1. Remove legacy command registrations from `src/index.ts`
2. Keep legacy command files temporarily (users might import them)
3. Update README to only show v2.0 commands

### Phase 3: Delete Files (v2.2.0)
**Timeline:** v2.2.0+  
**Goal:** Complete cleanup

**Actions:**
1. Delete all 9 legacy command files
2. Remove all legacy imports
3. Clean up any remaining references
4. Update documentation

---

## Implementation Notes

### Why Keep Legacy Commands Now?

1. **User Migration Time**: Give users time to adapt
2. **Documentation**: Need to update all docs first
3. **CI/CD**: Scripts might use old commands
4. **Graceful Deprecation**: Better UX than sudden breaking change

### Why NOT Delete Files Yet?

1. **Active References**: `index.ts` and `interactive.ts` still import them
2. **Testing Period**: Want to ensure v2.0 commands are stable
3. **Migration Guide**: Need comprehensive guide first
4. **Version Control**: Can always restore if needed

### Current Approach (Integration Phase)

**What We're Doing:**
- ✅ Creating new v2.0 commands
- ✅ Migrating to Phase 2 systems
- ✅ Wiring into CLI alongside legacy
- ⏳ Adding deprecation warnings
- ⏳ Documenting migration paths

**What We're NOT Doing:**
- ❌ Deleting legacy files yet
- ❌ Breaking existing workflows
- ❌ Forcing immediate migration

---

## Next Steps

### Immediate (This Session)
1. ⏳ Add deprecation warning wrapper for legacy commands
2. ⏳ Update MIGRATION.md with command mapping
3. ⏳ Test that both legacy and v2.0 commands work

### Soon (Next Session)
1. Complete doctor & setup commands
2. Create comprehensive migration guide
3. Add tests for deprecation warnings
4. Plan v2.1.0 release (remove legacy registrations)

### Future
1. v2.1.0: Remove legacy command registrations
2. v2.2.0: Delete legacy command files
3. Document transition in CHANGELOG

---

## Success Criteria

- ✅ All v2.0 commands functional
- ✅ Users warned about deprecations
- ✅ Clear migration path provided
- ✅ No sudden breaking changes
- ✅ Comprehensive documentation

---

## Notes

**Philosophy:** "Extract → Rewrite → Delete" 
- **Extract:** ✅ Core logic moved to features/
- **Rewrite:** ✅ New commands using Phase 2
- **Delete:** ⏳ Gradual, with warnings

**User Impact:** Minimal during transition, clear guidance provided

**Technical Debt:** Legacy files temporarily add ~2000 lines, but enables smooth migration
