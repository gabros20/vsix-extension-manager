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

3. If user agrees, stage and commit: `git add [files] && git commit -m "[message]"`
4. If user requests edits, adjust based on feedback

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

2. **Stage Related Files Together**

   ```bash
   # Use patterns for efficient staging
   git add src/features/auth/* src/components/ui/auth/*
   ```

3. **Write Commit Title and Description**
   - Title: `<type>: <brief description>`
   - Description: Add a concise explanation of what the commit does.

   Example:

   ```
   feat: implement authentication flow

   Adds login and logout functionality with JWT support.
   ```

### Best Practices

1. Batch information gathering before decisions
2. Group related files when staging
3. Keep commit messages concise and descriptive
4. Present complete information to user at once
