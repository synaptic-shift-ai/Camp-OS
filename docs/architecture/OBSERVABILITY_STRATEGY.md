# Observability Strategy

**Document Version**: 1.0
**Created**: 2025-10-30
**Status**: PROPOSED
**Incident Reference**: [ONBOARDING_CRISIS_HANDOFF.md](../reference/ONBOARDING_CRISIS_HANDOFF.md)

---

## Executive Summary

Complete observability is critical for debugging multi-tenant SaaS issues. The October 30 incident was difficult to diagnose because logs lacked correlation IDs, user context, and structured data. This document defines a comprehensive observability strategy.

**Components**:
1. Structured logging with correlation IDs
2. Distributed tracing across API boundaries
3. Real-time metrics and dashboards
4. Critical path monitoring
5. User session replay for debugging
6. Alert escalation workflow

---

## Structured Logging

### Log Format Standard

```typescript
// lib/logger.ts

export type LogContext = {
  correlation_id: string
  user_id?: string
  company_id?: string
  request_id?: string
  session_id?: string
}

export type LogLevel = "debug" | "info" | "warn" | "error" | "critical"

export type LogEntry = {
  timestamp: string
  level: LogLevel
  message: string
  context: LogContext
  data?: Record<string, unknown>
  error?: {
    message: string
    stack?: string
    code?: string
  }
  metadata: {
    service: string
    environment: string
    version: string
  }
}

export class StructuredLogger {
  constructor(private service: string, private context: LogContext) {}

  private log(level: LogLevel, message: string, data?: unknown, error?: Error) {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context: this.context,
      data: data as Record<string, unknown>,
      error: error ? {
        message: error.message,
        stack: error.stack,
        code: (error as any).code
      } : undefined,
      metadata: {
        service: this.service,
        environment: process.env.NODE_ENV || "development",
        version: process.env.APP_VERSION || "unknown"
      }
    }

    // Output structured JSON
    console.log(JSON.stringify(entry))

    // Send to monitoring service
    if (level === "error" || level === "critical") {
      this.sendToMonitoring(entry)
    }
  }

  info(message: string, data?: unknown) {
    this.log("info", message, data)
  }

  error(message: string, error: Error, data?: unknown) {
    this.log("error", message, data, error)
  }

  critical(message: string, error: Error, data?: unknown) {
    this.log("critical", message, data, error)
    this.alertOnCall(message, error, data)
  }

  private sendToMonitoring(entry: LogEntry) {
    // Integration with Sentry, DataDog, etc.
  }

  private alertOnCall(message: string, error: Error, data?: unknown) {
    // Page on-call engineer for critical issues
  }
}
```

---

## Correlation IDs

### Request Tracing

```typescript
// middleware.ts - Add correlation ID to all requests

export async function middleware(request: NextRequest) {
  const correlation_id = request.headers.get("x-correlation-id") ||
                         `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

  const response = NextResponse.next()
  response.headers.set("x-correlation-id", correlation_id)

  // Attach to all logs for this request
  request.headers.set("x-correlation-id", correlation_id)

  return response
}
```

---

## Critical Metrics

### Conversion Pipeline Metrics

```typescript
// monitoring/metrics.ts

export const CRITICAL_METRICS = {
  // Conversion funnel
  checkout_started: "counter",
  checkout_completed: "counter",
  webhook_received: "counter",
  company_created: "counter",
  wizard_loaded: "counter",
  onboarding_completed: "counter",

  // Funnel drop-off tracking
  conversion_rate: "gauge",  // wizard_loaded / checkout_completed
  completion_rate: "gauge",  // onboarding_completed / wizard_loaded

  // Performance
  middleware_latency_ms: "histogram",
  api_latency_ms: "histogram",
  webhook_processing_time_ms: "histogram",

  // Errors
  middleware_redirect_loops: "counter",
  api_validation_failures: "counter",
  webhook_failures: "counter",

  // User experience
  wizard_load_time_ms: "histogram",
  api_error_rate: "gauge"
}
```

### Dashboard Requirements

**Conversion Pipeline Dashboard**:
- Real-time funnel visualization
- Drop-off rates at each stage
- Average time per stage
- Error rates by type
- Active users in onboarding

**Performance Dashboard**:
- API latency (p50, p95, p99)
- Middleware decision time
- Database query performance
- Webhook processing time

**Error Dashboard**:
- Error rate trend
- Errors by type
- Most common validation failures
- Dead letter queue size

---

## Alerts

### Alert Configuration

```typescript
export const CRITICAL_ALERTS = {
  CONVERSION_PIPELINE_BROKEN: {
    condition: "conversion_rate < 50% for 10 minutes",
    severity: "critical",
    notification: ["#incidents", "on-call-engineer", "cto"],
    action: "Conversion pipeline may be broken - investigate immediately"
  },

  REDIRECT_LOOP_DETECTED: {
    condition: "middleware_redirect_loops > 0",
    severity: "critical",
    notification: ["#incidents", "on-call-engineer"],
    action: "Users stuck in redirect loops - middleware issue"
  },

  HIGH_API_ERROR_RATE: {
    condition: "api_error_rate > 5% for 5 minutes",
    severity: "warning",
    notification: ["#engineering"],
    action: "API experiencing elevated errors"
  },

  WEBHOOK_PROCESSING_SLOW: {
    condition: "p95(webhook_processing_time_ms) > 5000",
    severity: "warning",
    notification: ["#engineering"],
    action: "Webhook processing degraded - check database"
  }
}
```

---

## Success Criteria

- [ ] All logs include correlation IDs
- [ ] Can trace user journey from checkout to dashboard
- [ ] Real-time dashboards for critical paths
- [ ] Alerts fire before users report issues
- [ ] Mean time to detection < 5 minutes
- [ ] Mean time to resolution < 30 minutes

---

**Related**: [Testing Requirements](./TESTING_REQUIREMENTS.md)
