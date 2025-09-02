# AI Assistant Instruction for Git Commit Workflow

When a user mentions **"@ai-create-commit.md"**, execute this workflow:

1. Run `git status && git branch --show-current` to gather all information at once
2. Present the information in this format:

   ```
   Branch: [branch-name]

   Staged changes:
   [staged files]

   Unstaged changes:
   [unstaged files]

   Proposed commit:
   [type]: [description]

   Proceed with commit? (yes/no/edit)
   ```

3. Branching logic (before committing):
   - If current branch is `main` or `master`, create a new feature or fix branch based on chat history/context:
     - Prefer `feat/` for enhancements or new behavior
     - Prefer `fix/` for bug fixes or regressions
     - Branch name format: `<type>/<kebab-case-short-slug>` (e.g., `feat/add-dir-select-single-install`)
     - Command: `git checkout -b <branch>`
   - If already on a `feat/*` or `fix/*` branch, stay on it and continue.
   - Echo the chosen branch to the user.
4. If user agrees, stage and commit: `git add [files] && git commit -m "[message]"`
5. Push the branch: `git push -u origin $(git branch --show-current)`
6. Create a PR with GitHub CLI including a clear title and descriptive body:
   - Command: `gh pr create --title "[title]" --body "[body]"`
   - Print the PR URL.

---

## Commit Message Requirements

### Format

```
[type]: [title]

[description]
```

- **type**: Commit type
- **title**: Brief description (<100 characters)

### Commit Types

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation
- `style`: Formatting
- `refactor`: Code restructuring
- `perf`: Performance
- `test`: Testing
- `chore`: Maintenance

### Efficient Workflow

1. **Gather Information**

   ```bash
   # Get status and branch in one command
   git status && git branch --show-current
   ```

2. **Create or select branch**
   - Detect current branch:

   ```bash
   CURRENT_BRANCH=$(git branch --show-current)
   ```

   - If `$CURRENT_BRANCH` is `main` or `master`, decide type from context (feature vs fix) and create a branch:

   ```bash
   # Example: choose feat or fix based on chat history/request
   TYPE=feat    # or: TYPE=fix
   SLUG=add-dir-select-single-install   # kebab-case summary of change
   git checkout -b "$TYPE/$SLUG"
   ```

   - If already on `feat/*` or `fix/*`, keep the branch and proceed.

3. **Stage All Files**

   ```bash
   git add .
   ```

4. **Write Commit Title and Description**
   - Title: `<type>: <brief description>`
   - Description: Add a concise explanation of what the commit does.

   Example:

   ```
   feat: implement authentication flow

   Adds login and logout functionality with JWT support.
   ```

5. **Push and Create Pull Request**

   ```bash
   git push -u origin $(git branch --show-current)

   # Use the commit title as PR title and expand body with a concise description of changes/impact
   gh pr create \
     --title "feat: implement authentication flow" \
     --body "- Summary of changes\n- Motivation / Context\n- Notes on compatibility / risks (if any)"
   ```

### Best Practices

1. Batch information gathering before decisions
2. Group related files when staging
3. Keep commit messages concise and descriptive
4. Prefer creating a branch from `main`/`master` for each logical unit of work
5. Present complete information to user at once (status, branch action, commit, PR)
