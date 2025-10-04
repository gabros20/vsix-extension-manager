# Extension Removal Enhancement - Specification

## 1. Current State Analysis

### Existing Functionality ✅

**CLI Mode:**

- `vsix remove <id>` - Remove single extension
- `vsix remove <id1> <id2> ...` - Remove multiple extensions
- `vsix remove --all` - Remove all extensions
- `vsix remove --editor cursor/vscode` - Target specific editor

**Interactive Mode:**

```typescript
// Current flow in handleRemoveExtensions():
1. Select editor (with config preference)
2. Prompt for single extension ID
3. Confirm removal
4. Execute removal
```

### Current Limitations ❌

1. **Interactive mode only supports single ID input** - No multiselect UI
2. **Clack rendering issue** - `p.multiselect()` breaks with large lists (100+ items)
   - List renders outside terminal viewport
   - Navigation becomes broken
   - UX degrades significantly
3. **No pattern-based removal** - Can't remove by publisher, keyword, etc.
4. **No grouping/categorization** - Hard to navigate large extension sets
5. **Limited filtering** - No search/filter before selection

---

## 2. Use Cases

### UC1: Clean Slate (Remove All)

**User Story:** "I want to remove all extensions to start fresh"

- Current: `vsix remove --all` (CLI only)
- Need: Interactive mode support with clear warning

### UC2: Selective Removal (Small Set: 1-20 extensions)

**User Story:** "I have 15 extensions, want to remove 3 specific ones"

- Current: Remove one at a time in interactive mode
- Need: Multiselect UI that works well

### UC3: Selective Removal (Large Set: 50-200 extensions)

**User Story:** "I have 150 extensions, want to remove 10-20 of them"

- Current: **BROKEN** - clack multiselect renders off-screen
- Need: Pagination, search, or alternative UI

### UC4: Maintenance Cleanup

**User Story:** "Remove disabled/broken/outdated extensions"

- Current: **NOT SUPPORTED**
- Need: Filter by status, validation

---

## 3. Problem: Clack Rendering with Large Lists

### Technical Root Cause

Clack's `multiselect()` implementation:

```typescript
await p.multiselect({
  message: "Select extensions:",
  options: [...150 items...] // ❌ Breaks rendering
})
```

**Issues:**

- Clack renders entire list in terminal
- With 100+ items, list exceeds terminal height
- Terminal scrollback breaks checkbox navigation
- Space key, arrow keys become unreliable
- Visual feedback is lost

### Constraints

- Cannot modify Clack's internal rendering
- Terminal height is limited (typically 24-50 lines)
- Must maintain keyboard-based navigation
- Need to preserve UX quality

---

## 4. Proposed Solutions

### **Approach A: Paginated Multiselect (Recommended)**

**Strategy:** Break large lists into manageable pages

```typescript
// Pseudo-code
const PAGE_SIZE = 15; // Show 15 items per page

async function paginatedMultiselect(items: Extension[]): Promise<Extension[]> {
  const selected: Set<string> = new Set();
  let page = 0;
  const totalPages = Math.ceil(items.length / PAGE_SIZE);

  while (true) {
    const pageItems = items.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

    const action = await p.select({
      message: `Page ${page + 1}/${totalPages} | ${selected.size} selected | Choose action:`,
      options: [
        { value: "select", label: `📋 Select from this page (${pageItems.length} items)` },
        { value: "next", label: "➡️ Next page", hint: page < totalPages - 1 ? "" : "Last page" },
        { value: "prev", label: "⬅️ Previous page", hint: page > 0 ? "" : "First page" },
        { value: "search", label: "🔍 Search/Filter..." },
        { value: "done", label: `✅ Done (${selected.size} selected)` },
      ],
    });

    if (action === "select") {
      // Show this page's items for multiselect (small list, works fine)
      const pageSelection = await p.multiselect({
        message: `Select extensions to remove (page ${page + 1}):`,
        options: pageItems.map((ext) => ({
          value: ext.id,
          label: `${ext.displayName} (${ext.version})`,
        })),
      });

      pageSelection.forEach((id) => selected.add(id));
    }

    // Handle pagination, search, done...
  }

  return items.filter((ext) => selected.has(ext.id));
}
```

**Pros:**

- ✅ Avoids clack rendering issue (small pages always fit)
- ✅ Allows progressive selection across pages
- ✅ Shows selection count throughout
- ✅ Familiar pagination pattern

**Cons:**

- ⚠️ Requires multiple steps for large selections
- ⚠️ Can't see full list at once

---

### **Approach B: Search-First Selection**

**Strategy:** Filter first, then select from filtered results

```typescript
async function searchBasedMultiselect(items: Extension[]): Promise<Extension[]> {
  const mode = await p.select({
    message: "Choose removal method:",
    options: [
      { value: "all", label: `🗑️ Remove all ${items.length} extensions` },
      { value: "search", label: "🔍 Search and select..." },
      { value: "pattern", label: "🎯 Match pattern..." },
    ],
  });

  if (mode === "search") {
    const query = await p.text({
      message: "Search extensions (name/publisher):",
      placeholder: "e.g., python, prettier, ms-",
    });

    const filtered = items.filter(
      (ext) =>
        ext.id.toLowerCase().includes(query.toLowerCase()) ||
        ext.displayName.toLowerCase().includes(query.toLowerCase()),
    );

    if (filtered.length === 0) {
      p.log.warning("No extensions match your search");
      return [];
    }

    if (filtered.length > 30) {
      // Still too many, ask to refine or paginate
      const action = await p.select({
        message: `Found ${filtered.length} matches (still too many):`,
        options: [
          { value: "refine", label: "🔍 Refine search" },
          { value: "paginate", label: "📋 Browse pages" },
          { value: "all", label: `🗑️ Remove all ${filtered.length} matches` },
        ],
      });

      // Handle action...
    }

    // Small enough, show multiselect
    return await p.multiselect({
      message: `Select from ${filtered.length} matches:`,
      options: filtered.map((ext) => ({
        value: ext.id,
        label: `${ext.displayName} (${ext.version})`,
      })),
    });
  }
}
```

**Pros:**

- ✅ Reduces list size before selection
- ✅ Natural workflow for targeted removal
- ✅ Fast for specific use cases

**Cons:**

- ⚠️ Requires knowing what to search for
- ⚠️ Extra step even for small lists

---

### **Approach C: Hybrid (Search + Pagination)**

**Strategy:** Combine best of both approaches

1. **Initial Choice:**
   - Remove all
   - Search/Filter
   - Browse all (paginated)

2. **If Search:** Filter → Show results → If > 20, paginate

3. **If Browse:** Jump to pagination mode

**Pros:**

- ✅ Flexible for all use cases
- ✅ Optimal path for each scenario
- ✅ Handles any list size

**Cons:**

- ⚠️ More complex implementation
- ⚠️ More UI states to test

---

## 5. Recommended Implementation (Approach C: Hybrid)

### Phase 1: Enhanced Interactive Remove

```typescript
async function handleRemoveExtensions() {
  p.log.step("Remove Extensions");

  const selectedEditor = await selectEditorWithPreference();
  const installed = await getInstalledExtensions(selectedEditor);

  if (installed.length === 0) {
    ui.log.warning("No extensions found");
    return;
  }

  // Enhanced removal mode selection
  const mode = await p.select({
    message: `Choose removal method (${installed.length} installed):`,
    options: [
      {
        value: "all",
        label: `🗑️ Remove all ${installed.length} extensions`,
        hint: "Clean slate",
      },
      {
        value: "search",
        label: "🔍 Search and select",
        hint: "Filter by name/publisher/keyword",
      },
      {
        value: "browse",
        label: "📋 Browse and select",
        hint: installed.length > 30 ? "Paginated view" : "Full list",
      },
    ],
  });

  let toRemove: string[] = [];

  switch (mode) {
    case "all":
      toRemove = await handleRemoveAll(installed);
      break;
    case "search":
      toRemove = await handleSearchRemove(installed);
      break;
    case "browse":
      toRemove = await handleBrowseRemove(installed);
      break;
  }

  if (toRemove.length === 0) {
    return;
  }

  // Confirm and execute removal
  await executeRemoval(toRemove, selectedEditor);
}
```

### Phase 2: Helper Functions

#### 1. Remove All

```typescript
async function handleRemoveAll(installed: Extension[]): Promise<string[]> {
  const groupByPublisher = groupExtensionsByPublisher(installed);
  const topPublishers = Object.entries(groupByPublisher)
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, 5);

  p.note(
    `You have ${installed.length} extensions from ${Object.keys(groupByPublisher).length} publishers\n\n` +
      `Top publishers:\n` +
      topPublishers.map(([pub, exts]) => `• ${pub}: ${exts.length} extensions`).join("\n"),
    "⚠️ Warning: This will remove ALL extensions",
  );

  const confirmed = await p.confirm({
    message: `Are you absolutely sure you want to remove all ${installed.length} extensions?`,
    initialValue: false,
  });

  return confirmed ? installed.map((e) => e.id) : [];
}
```

#### 2. Search Remove

```typescript
async function handleSearchRemove(installed: Extension[]): Promise<string[]> {
  const query = await p.text({
    message: "Search extensions:",
    placeholder: "name, publisher, or keyword",
    validate: (val) => (val.length < 2 ? "Enter at least 2 characters" : undefined),
  });

  const filtered = installed.filter(
    (ext) =>
      ext.id.toLowerCase().includes(query.toLowerCase()) ||
      ext.displayName.toLowerCase().includes(query.toLowerCase()) ||
      ext.publisher.toLowerCase().includes(query.toLowerCase()),
  );

  if (filtered.length === 0) {
    p.log.warning(`No extensions match "${query}"`);
    return [];
  }

  p.log.info(`Found ${filtered.length} matching extension(s)`);

  // If still too many, offer refinement or pagination
  if (filtered.length > 30) {
    return await handleLargeFilteredSet(filtered);
  }

  // Small enough, show multiselect
  return await selectFromList(filtered, `Select from ${filtered.length} matches`);
}
```

#### 3. Browse Remove (Paginated)

```typescript
async function handleBrowseRemove(installed: Extension[]): Promise<string[]> {
  const PAGE_SIZE = 15;
  const totalPages = Math.ceil(installed.length / PAGE_SIZE);

  if (installed.length <= 20) {
    // Small list, no pagination needed
    return await selectFromList(installed, "Select extensions to remove");
  }

  const selected = new Set<string>();
  let currentPage = 0;

  while (true) {
    const pageItems = installed.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);

    const action = await p.select({
      message: `Page ${currentPage + 1}/${totalPages} | ${selected.size} selected | Choose action:`,
      options: [
        {
          value: "select",
          label: `📋 Select from this page (${pageItems.length} items)`,
          hint: "Use Space to toggle",
        },
        {
          value: "next",
          label: "➡️ Next page",
          hint: currentPage < totalPages - 1 ? undefined : "(last page)",
        },
        {
          value: "prev",
          label: "⬅️ Previous page",
          hint: currentPage > 0 ? undefined : "(first page)",
        },
        {
          value: "jump",
          label: "🎯 Jump to page...",
        },
        {
          value: "search",
          label: "🔍 Switch to search mode",
        },
        {
          value: "done",
          label: `✅ Done selecting`,
          hint: selected.size > 0 ? `${selected.size} to remove` : "None selected",
        },
        {
          value: "cancel",
          label: "❌ Cancel",
        },
      ],
    });

    if (action === "select") {
      const pageSelection = await p.multiselect({
        message: `Select extensions (Page ${currentPage + 1}/${totalPages}):`,
        options: pageItems.map((ext) => ({
          value: ext.id,
          label: `${ext.displayName || ext.id} (v${ext.version})`,
          hint: selected.has(ext.id) ? "✓ selected" : undefined,
        })),
        required: false,
      });

      // Toggle selections
      pageSelection.forEach((id) => {
        if (selected.has(id)) {
          selected.delete(id);
        } else {
          selected.add(id);
        }
      });
    } else if (action === "next" && currentPage < totalPages - 1) {
      currentPage++;
    } else if (action === "prev" && currentPage > 0) {
      currentPage--;
    } else if (action === "jump") {
      const pageNum = await p.text({
        message: `Jump to page (1-${totalPages}):`,
        validate: (val) => {
          const num = parseInt(val);
          if (isNaN(num) || num < 1 || num > totalPages) {
            return `Enter a number between 1 and ${totalPages}`;
          }
        },
      });
      currentPage = parseInt(pageNum) - 1;
    } else if (action === "search") {
      return await handleSearchRemove(installed);
    } else if (action === "done") {
      break;
    } else if (action === "cancel") {
      return [];
    }
  }

  return Array.from(selected);
}
```

---

## 6. Implementation Checklist

### Core Features

- [ ] Implement `handleRemoveAll()` - Remove all with detailed warning
- [ ] Implement `handleSearchRemove()` - Search/filter before selection
- [ ] Implement `handleBrowseRemove()` - Paginated multiselect
- [ ] Add `selectFromList()` helper - Smart multiselect (checks size)
- [ ] Add `handleLargeFilteredSet()` - Handle filtered results > 30
- [ ] Add `groupExtensionsByPublisher()` utility (for stats display)

### UI Enhancements

- [ ] Add selection counter to all multiselect screens
- [ ] Add "already selected" indicators in paginated mode
- [ ] Add page jump functionality
- [ ] Add search-from-pagination transition

### CLI Enhancements (Optional)

- [ ] Add `--pattern <pattern>` flag - Remove by pattern (regex or glob)
- [ ] Add interactive mode to CLI `vsix remove` when no args

### Testing

- [ ] Test with 0 extensions
- [ ] Test with 1-10 extensions (direct multiselect)
- [ ] Test with 20-30 extensions (threshold behavior)
- [ ] Test with 50+ extensions (pagination)
- [ ] Test with 100+ extensions (pagination + search)
- [ ] Test search with no results
- [ ] Test search filtering by publisher name
- [ ] Test page navigation (next, prev, jump)
- [ ] Test cancellation at each step
- [ ] Test selection persistence across pages

---

## 7. Breaking Changes

**None.** All changes are additive and backward compatible:

- ✅ Existing CLI commands unchanged
- ✅ Existing interactive flow enhanced but compatible
- ✅ New modes are opt-in selections

---

## 8. Expected Outcomes

### UX Improvements

- ✅ Can handle any number of installed extensions
- ✅ No clack rendering issues
- ✅ Clear, intuitive removal workflows
- ✅ Fast path for common use cases (remove all, search)

### Performance

- ✅ Same performance (no algorithmic changes)
- ✅ Less memory pressure (paginated rendering)

### Maintainability

- ✅ Modular helper functions
- ✅ Reusable patterns for other commands
- ✅ Clear separation of concerns

---

## 9. Open Questions

1. **Should we show extension sizes during selection?**
   - Could help users identify large extensions
   - Requires additional disk I/O per extension
   - Recommend: Add as `--detailed` flag

2. **Should we support regex patterns?**
   - More powerful but potentially confusing
   - Recommend: Start with simple substring matching

3. **Should we add "undo" capability?**
   - Could backup before removal
   - Recommend: Defer to future enhancement

4. **Should browse mode remember position across searches?**
   - Could be confusing or helpful
   - Recommend: Reset to page 0 after search

---

## 10. Next Steps

**If approved:**

1. Implement core helper functions (2-3 hours)
2. Update `handleRemoveExtensions()` (1-2 hours)
3. Test with various extension counts (1 hour)
4. Update documentation (30 minutes)
5. Create PR with comprehensive examples

**Total estimated time:** 5-7 hours

**Ready to proceed?** 🚀
