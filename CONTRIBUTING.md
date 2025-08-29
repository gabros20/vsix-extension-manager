# Contributing to VSIX Extension Manager

Thank you for your interest in contributing to VSIX Extension Manager! This document provides guidelines and information for contributors.

## 🎯 Project Goals

VSIX Extension Manager aims to provide a reliable, user-friendly CLI tool for comprehensive extension management including downloading, exporting, and importing VS Code/Cursor extensions. We focus on:

- **Simplicity**: Easy-to-use interface with clear, helpful prompts
- **Reliability**: Robust error handling and validation
- **Performance**: Efficient downloads with progress tracking
- **Compatibility**: Support for both Visual Studio Marketplace and OpenVSX
- **Accessibility**: Help users bypass marketplace restrictions

## 🚀 Getting Started

### Prerequisites

- Node.js 16+
- npm or yarn
- Git

### Development Setup

1. **Fork and clone the repository**:

   ```bash
   git clone https://github.com/YOUR_USERNAME/vsix-extension-manager.git
   cd vsix-extension-manager
   ```

2. **Install dependencies**:

   ```bash
   npm install
   ```

3. **Build the project**:

   ```bash
   npm run build
   ```

4. **Run in development mode**:
   ```bash
   npm run dev
   ```

### Available Scripts

- `npm run build` - Compile TypeScript to JavaScript
- `npm run dev` - Run the CLI in development mode
- `npm run lint` - Run ESLint
- `npm run lint:fix` - Fix ESLint issues automatically
- `npm run format` - Format code with Prettier
- `npm test` - Run tests (when available)

## 📝 Development Guidelines

### Code Style

We use:

- **TypeScript** for type safety
- **ESLint** for code linting
- **Prettier** for code formatting
- **Conventional Commits** for commit messages

### Commit Message Format

Follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

Examples:

- `feat: add support for OpenVSX marketplace`
- `fix: resolve download timeout issues`
- `docs: update installation instructions`
- `refactor: improve error handling in downloader`

### TypeScript Guidelines

- Use strict TypeScript configuration
- Prefer interfaces over types for object shapes
- Use meaningful type names
- Add JSDoc comments for public APIs
- Handle all possible error cases

### Error Handling

- Use descriptive error messages
- Include context when possible
- Log errors appropriately
- Provide actionable feedback to users

## 🧪 Testing

### Running Tests

```bash
npm test
```

### Writing Tests

- Write tests for new features
- Ensure good test coverage
- Use descriptive test names
- Mock external dependencies

## 📦 Building and Testing Locally

### Build the Package

```bash
npm run build
```

### Test the CLI

```bash
# Test the built version
npm start

# Test in development mode
npm run dev
```

### Test Installation

```bash
# Install globally from local build
npm install -g .

# Test the installed version
vsix-extension-manager --help
```

## 🔄 Pull Request Process

1. **Create a feature branch** from `main`:

   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes** following the guidelines above

3. **Test your changes**:
   - Run the build: `npm run build`
   - Test the CLI: `npm run dev`
   - Run linting: `npm run lint`

4. **Commit your changes** using conventional commits

5. **Push to your fork** and create a Pull Request

6. **Fill out the PR template** completely

7. **Wait for review** - we'll review and provide feedback

### PR Checklist

- [ ] Code follows the project's style guidelines
- [ ] Self-review of code has been completed
- [ ] Code has been tested locally
- [ ] Changes are documented (if applicable)
- [ ] Commit messages follow conventional commits format
- [ ] PR description clearly describes the problem and solution

## 🐛 Reporting Issues

Before creating an issue, please:

1. **Search existing issues** to avoid duplicates
2. **Check the documentation** for solutions
3. **Try the latest version** of VSIX Extension Manager

When creating an issue, include:

- **Clear description** of the problem
- **Steps to reproduce** the issue
- **Expected vs actual behavior**
- **Environment details** (OS, Node.js version, etc.)
- **Error messages** (if any)

## 🚀 Release Process

This project uses [semantic-release](https://semantic-release.gitbook.io/) for automated versioning and publishing.

- **No manual version bumps** - versions are determined automatically
- **Push to main** with conventional commits to trigger releases
- **Releases are automatic** when commits are pushed to main

## 📚 Documentation

- **README.md** - Project overview and usage
- **PUBLISHING.md** - Release and publishing information
- **Code comments** - Inline documentation for complex logic

## 🤝 Community

- **Be respectful** and inclusive
- **Help others** when possible
- **Follow the Code of Conduct**
- **Ask questions** if you're unsure

## 📞 Getting Help

- **GitHub Issues** - For bugs and feature requests
- **GitHub Discussions** - For questions and general discussion
- **Code of Conduct** - For community guidelines

Thank you for contributing to VSIX Extension Manager! 🎉
