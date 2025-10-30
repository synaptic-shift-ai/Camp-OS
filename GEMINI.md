# CampOS - Outdoor Hospitality Management Platform

## Project Overview

CampOS is a modern, multi-tenant SaaS application designed for managing campgrounds, RV parks, and glamping sites. It provides property management software to streamline reservations, operations, and guest experiences.

**Key Technologies:**

*   **Framework:** [Next.js](https://nextjs.org/) (App Router)
*   **Database:** [Supabase](https://supabase.io/)
*   **Payments:** [Stripe](https://stripe.com/)
*   **Styling:** [Tailwind CSS](https://tailwindcss.com/) with [shadcn/ui](https://ui.shadcn.com/) components
*   **Email:** [Resend](https://resend.com/) and [React Email](https://react.email/)
*   **Testing:** [Vitest](https://vitest.dev/)
*   **Deployment:** [Vercel](https://vercel.com/)
*   **Error Tracking:** [Sentry](https://sentry.io/)

**Architecture:**

The application is built using a multi-tenant architecture, with each tenant (campground owner) having their own isolated data. Supabase is used for the database and authentication, with Row Level Security (RLS) likely enforcing data isolation. The Next.js middleware is used to manage user sessions. Stripe is integrated for handling payments for reservations and potentially for subscriptions to the service.

## Building and Running

### Prerequisites

*   Node.js (version specified in `.nvmrc` if available, otherwise latest LTS)
*   npm or yarn
*   Supabase account and project
*   Stripe account
*   Resend account

### Installation

1.  Clone the repository.
2.  Install dependencies:
    ```bash
    npm install
    ```
3.  Set up your environment variables by copying `.env.example` to `.env.local` and filling in the required values for Supabase, Stripe, and Resend.

### Running the Application

*   **Development:**
    ```bash
    npm run dev
    ```
    This will start the Next.js development server on `http://localhost:3000`.

*   **Production Build:**
    ```bash
    npm run build
    ```
    This will create a production-ready build of the application.

*   **Start Production Server:**
    ```bash
    npm run start
    ```
    This will start the Next.js production server.

### Testing

*   **Run all tests:**
    ```bash
    npm run test
    ```

*   **Run tests in UI mode:**
    ```bash
    npm run test:ui
    ```

*   **Run tests with coverage:**
    ```bash
    npm run test:coverage
    ```

## Development Conventions

*   **Code Style:** The project uses ESLint for code linting. It is recommended to run `npm run lint` before committing changes. Husky is set up to run pre-commit hooks, which likely include linting.
*   **Type Safety:** The project is written in TypeScript and uses `tsc` to check for type errors. Run `npm run type-check` to check for type errors.
*   **Database Types:** Database types are generated from the Supabase schema using the `npm run gen:db` command. This should be run whenever the database schema changes.
*   **Path Aliases:** The project uses path aliases defined in `tsconfig.json`. For example, `@/components/*` maps to the `components` directory.
*   **Commits:** While no explicit convention is documented, it is good practice to write clear and descriptive commit messages.
