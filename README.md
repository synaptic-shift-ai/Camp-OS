# CampOps - Campground Operations Platform

[![CI Status](https://github.com/SynapticShiftAI/Camp-OS/workflows/CampOps%20CI/badge.svg)](https://github.com/SynapticShiftAI/Camp-OS/actions)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue.svg)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19-61dafb.svg)](https://reactjs.org/)
[![Next.js](https://img.shields.io/badge/Next.js-15-black.svg)](https://nextjs.org/)

A comprehensive multi-tenant SaaS platform for campground management, built with Next.js, React, TypeScript, and Supabase.

---

## Overview

CampOps is a modern, full-featured campground management system designed for:
- **Campground Operators**: Manage sites, bookings, pricing, and operations
- **Campers**: Browse availability, make bookings, and manage reservations
- **System Admins**: Multi-tenant administration and platform oversight

### Key Features
- 🏕️ **Site Management**: Comprehensive campsite inventory and amenity tracking
- 📅 **Booking System**: Real-time availability and reservation management
- 💳 **Payment Processing**: Stripe integration with multiple payment methods
- 📊 **Dynamic Pricing**: ML-powered price optimization
- 🔐 **Multi-tenant Architecture**: Complete data isolation between campgrounds
- 📱 **Mobile-first Design**: Responsive UI optimized for all devices
- 🎨 **White-labeling**: Customizable branding per tenant

---

## Getting Started

### Prerequisites
- Node.js 20+
- npm or yarn
- Supabase account (for database)
- Stripe account (for payments)

### Installation

```bash
# Clone the repository
git clone https://github.com/SynapticShiftAI/Camp-OS.git
cd Camp-OS

# Install dependencies for the main campsite platform
cd oh-saas/campsite-command-center
npm install

# Set up environment variables
cp .env.example .env.local
# Edit .env.local with your configuration
```

### Development

```bash
# Start the development server (frontend)
npm run dev

# Start the API server (backend)
npm run api:dev

# Run both concurrently (recommended)
npm run dev & npm run api:dev
```

### Building for Production

```bash
# Build the application
npm run build

# Start production server
npm run start
```

---

## Development Workflow

### Branching Strategy

- **`main`**: Production-ready code (protected)
- **`develop`**: Integration branch for feature development
- **Feature branches**: `feature/feature-name`
- **Bug fixes**: `bugfix/bug-name`
- **Hotfixes**: `hotfix/issue-name`

### Git Aliases (Recommended)

```bash
# Add these to your global git config for faster workflow
git config --global alias.feature '!git checkout develop && git pull && git checkout -b feature/$1'
git config --global alias.bugfix '!git checkout develop && git pull && git checkout -b bugfix/$1'
git config --global alias.hotfix '!git checkout main && git pull && git checkout -b hotfix/$1'
git config --global alias.sync '!git checkout develop && git pull && git checkout - && git merge develop'
```

Usage:
```bash
git feature my-new-feature    # Creates feature/my-new-feature from develop
git bugfix critical-bug       # Creates bugfix/critical-bug from develop
git sync                      # Syncs current branch with latest develop
```

### Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```bash
feat: add dynamic pricing engine
fix: resolve booking date validation bug
docs: update API documentation
test: add integration tests for booking flow
refactor: simplify tenant middleware
perf: optimize database queries for site search
```

Common scopes:
- `campsite`, `booking`, `auth`, `ui`, `api`, `db`, `test`

### Pull Request Process

1. **Create PR from feature branch to `develop`**
2. **Fill out PR template** (automatically populated)
3. **Ensure all checks pass**:
   - ✅ Type check (`npm run type-check`)
   - ✅ Lint (`npm run lint`)
   - ✅ Tests (`npm run test:ci`)
   - ✅ Build (`npm run build`)
   - ✅ API startup verification (`npm run verify:startup`)
4. **Request review** from team member
5. **Merge after approval** (squash and merge recommended)

### Quality Gates

Before every commit, ensure:

```bash
# Run all quality checks
npm run quality:check

# For API changes, verify startup
npm run verify:startup

# Run full test suite
npm run test:ci
```

### Pre-commit Hook (Optional)

To automatically run smoke tests before commits:

```bash
# Linux/Mac
ln -s ../../scripts/pre-commit-smoke-test.sh .git/hooks/pre-commit
chmod +x scripts/pre-commit-smoke-test.sh

# Windows (run as Administrator)
mklink .git\hooks\pre-commit ..\..\scripts\pre-commit-smoke-test.sh
```

---

## Project Structure

```
Saas_CampOS/
├── oh-saas/                          # Next.js 15 application
│   └── campsite-command-center/     # Main CampOps Platform
│       ├── src/                     # Source code
│       │   ├── components/          # React components
│       │   ├── lib/                 # Utilities and business logic
│       │   ├── hooks/               # Custom React hooks
│       │   └── types/               # TypeScript type definitions
│       ├── api/                     # Express.js API server
│       ├── database/                # Database migrations and types
│       ├── tests/                   # All test files
│       │   ├── unit/                # Unit tests
│       │   ├── integration/         # Integration tests
│       │   ├── security/            # Security/tenant isolation tests
│       │   └── e2e/                 # End-to-end tests
│       └── scripts/                 # Build and utility scripts
├── .github/                         # GitHub configuration
│   ├── workflows/                   # CI/CD workflows
│   └── ISSUE_TEMPLATE/              # Issue templates
├── docs/                            # Documentation
│   ├── architecture/                # Architecture documentation
│   ├── reference/                   # Reference documentation
│   └── testing/                     # Testing guidelines
└── CLAUDE.md                        # Development best practices
```

---

## Testing

### Running Tests

```bash
# Run all tests
npm run test:ci

# Unit tests only
npm run test:unit

# Integration tests
npm run test:integration

# Security/tenant isolation tests
npm run test:security

# E2E tests with Playwright
npm run test:e2e

# Watch mode for development
npm run test:watch

# Coverage report
npm run test:coverage
```

### Testing Philosophy

- **Unit tests**: Pure logic, no mocking of core dependencies
- **Integration tests**: Real database, real API calls
- **Security tests**: Tenant isolation validation
- **E2E tests**: Full user workflows

See [testing guidelines](./.claude/testing-guidelines.md) for comprehensive testing best practices.

---

## Sprint Planning

We follow a 4-week sprint cycle with weekly milestones:

- **Week 1**: Foundation & Critical Issues
- **Week 2**: Revenue Features & Setup Polish
- **Week 3**: Advanced Features
- **Week 4**: Polish & Demo Prep

### Creating a New Sprint

1. **Copy the template**:
   ```bash
   cp docs/weekly-sprint-template.md docs/sprints/sprint-week-X.md
   ```

2. **Fill in sprint details** with planned work

3. **Track daily progress** in the sprint document

4. **Complete retrospective** at end of week

---

## Issue Tracking

### Labels

We use a comprehensive labeling system:

**Priority:**
- `critical` - Critical priority, must be addressed immediately
- `high-priority` - High priority task
- `demo-blocker` - Blocks demo presentation

**Type:**
- `bug` - Something isn't working
- `feature` - New feature request
- `enhancement` - Improvement to existing functionality
- `documentation` - Documentation improvements
- `technical-debt` - Technical debt that needs addressing

**Area:**
- `frontend` - Frontend/UI work
- `backend` - Backend/API work
- `payments` - Payment/Stripe integration
- `analytics` - Analytics and reporting

**Sprint:**
- `sprint-week-1` through `sprint-week-4`

**Status:**
- `in-progress` - Currently being worked on
- `needs-testing` - Requires testing validation
- `demo-ready` - Ready for demo presentation
- `revenue-impact` - Directly impacts revenue generation

### Creating Issues

Use the issue templates:
- **[Bug Report](./.github/ISSUE_TEMPLATE/bug_report.md)** for bugs
- **[Feature Request](./.github/ISSUE_TEMPLATE/feature_request.md)** for features

---

## CI/CD

### GitHub Actions Workflows

Our CI pipeline runs on every push and PR:

1. **Quality Checks** - Type checking and linting
2. **Unit Tests** - Fast, isolated tests
3. **Integration Tests** - Database and API tests
4. **Security Tests** - Tenant isolation validation
5. **Build Verification** - Production build test
6. **API Startup** - Server startup verification

All checks must pass before merging to `main` or `develop`.

---

## Key Technologies

### Frontend
- **React 19** - UI framework
- **Next.js 15** - React framework with App Router
- **TypeScript 5** - Type safety
- **TailwindCSS** - Styling
- **Shadcn/UI** - Component library
- **React Hook Form** - Form management
- **Zod** - Schema validation

### Backend
- **Express.js** - API server
- **Supabase** - PostgreSQL database and auth
- **Stripe** - Payment processing
- **Node.js 20** - Runtime

### Testing
- **Vitest** - Unit and integration tests
- **Playwright** - E2E testing
- **Testing Library** - React component testing

### DevOps
- **GitHub Actions** - CI/CD
- **Vercel** - Hosting (optional)
- **Docker** - Containerization (planned)

---

## Multi-Tenant Architecture

CampOps is designed as a multi-tenant SaaS platform with complete data isolation:

- **Tenant Context**: All requests include tenant identification
- **RLS Policies**: Database-level row-level security
- **Middleware**: Tenant validation on every API call
- **Testing**: Comprehensive tenant isolation tests

See [Architecture Documentation](./docs/architecture/) for details.

---

## Documentation

- **[CLAUDE.md](./CLAUDE.md)** - Development best practices and coding standards
- **[Testing Guidelines](./.claude/testing-guidelines.md)** - Comprehensive testing guide
- **[Architecture Docs](./docs/architecture/)** - System architecture and design decisions
- **[Code Improvement Plan](./Code%20Improvement.md)** - Ongoing quality initiative

---

## Contributing

1. **Fork the repository**
2. **Create a feature branch** from `develop`
3. **Follow coding standards** in CLAUDE.md
4. **Write tests** for your changes
5. **Ensure all quality gates pass**
6. **Submit a pull request** with detailed description

---

## Support

For questions or issues:
- **GitHub Issues**: [Create an issue](https://github.com/SynapticShiftAI/Camp-OS/issues/new/choose)
- **Documentation**: Check the [docs](./docs/) folder
- **CLAUDE.md**: See coding guidelines and best practices

---

## License

[Your License Here]

---

## Acknowledgments

Built with modern web technologies and best practices for multi-tenant SaaS applications.
# test
