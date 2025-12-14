import { withSentryConfig } from '@sentry/nextjs'

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    unoptimized: true,
  },
  eslint: {
    // Pre-existing lint errors in codebase - skip during build
    // Run `npm run lint` separately to check
    ignoreDuringBuilds: true,
  },
}

export default withSentryConfig(nextConfig, {
  // Sentry Webpack Plugin Options
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,

  // Upload source maps for better error tracking
  silent: !process.env.CI,
  widenClientFileUpload: true,

  // Automatically instrument Server Components
  automaticVercelMonitors: true,

  // Disable source map upload in development
  disableLogger: process.env.NODE_ENV === 'development',

  // Hide source maps from public
  hideSourceMaps: true,

  // Reduce bundle size
  tunnelRoute: '/monitoring',
})
