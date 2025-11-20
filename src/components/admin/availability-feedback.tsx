'use client'

/**
 * Availability Feedback Component
 *
 * Displays real-time availability check results with visual alerts.
 * Shows conflicts, partial availability, and alternative suggestions.
 * Reused by ExtendDialog and RenewDialog components.
 */

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { CheckCircle, AlertCircle, XCircle, Calendar, MapPin } from 'lucide-react'
import type { ActionAvailabilityCheck } from '@/lib/booking/types'

interface AvailabilityFeedbackProps {
  result: ActionAvailabilityCheck
}

/**
 * Format date for display
 */
function formatDate(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00')
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

/**
 * Format money from cents
 */
function formatMoney(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(cents / 100)
}

export function AvailabilityFeedback({ result }: AvailabilityFeedbackProps) {
  // Fully available - green success alert
  if (result.status === 'fully_available') {
    return (
      <Alert className="border-green-500/50 bg-green-500/10">
        <CheckCircle className="h-4 w-4 text-green-500" />
        <AlertTitle className="text-green-500">Site Available</AlertTitle>
        <AlertDescription>
          <p className="text-sm text-green-700">Ready to proceed! No conflicts found.</p>
          {result.recommendations.length > 0 && (
            <div className="mt-2">
              <p className="text-sm font-medium text-green-700">
                {result.recommendations[0]?.description}
              </p>
              {result.recommendations[0]?.price_change !== undefined &&
                result.recommendations[0].price_change > 0 && (
                  <p className="text-sm text-green-600 mt-1">
                    Additional charge: {formatMoney(result.recommendations[0].price_change)}
                  </p>
                )}
            </div>
          )}
        </AlertDescription>
      </Alert>
    )
  }

  // Partially available - yellow warning alert
  if (result.status === 'partially_available') {
    return (
      <Alert className="border-yellow-500/50 bg-yellow-500/10">
        <AlertCircle className="h-4 w-4 text-yellow-600" />
        <AlertTitle className="text-yellow-700">Partial Conflict</AlertTitle>
        <AlertDescription className="space-y-3">
          {/* Available range */}
          {result.available_range && (
            <div className="flex items-start gap-2">
              <CheckCircle className="h-4 w-4 text-green-500 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-green-700">Available:</p>
                <p className="text-sm text-green-600">
                  {formatDate(result.available_range.start)} to{' '}
                  {formatDate(result.available_range.end)}
                </p>
              </div>
            </div>
          )}

          {/* Conflicts */}
          {result.conflicts.map((conflict, i) => (
            <div key={i} className="flex items-start gap-2">
              <XCircle className="h-4 w-4 text-red-500 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-red-700">Conflict:</p>
                <p className="text-sm text-red-600">
                  {formatDate(conflict.conflicting_dates.start)} to{' '}
                  {formatDate(conflict.conflicting_dates.end)}
                </p>
                {conflict.reservation && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Booked by {conflict.reservation.guest_name} (
                    {conflict.reservation.confirmation_number})
                  </p>
                )}
                {conflict.message && (
                  <p className="text-xs text-yellow-600 mt-1">{conflict.message}</p>
                )}
              </div>
            </div>
          ))}

          {/* Recommendations */}
          {result.recommendations.length > 0 && (
            <div className="mt-4 pt-3 border-t border-yellow-500/20">
              <p className="text-sm font-medium text-yellow-700 mb-2">Options:</p>
              <ul className="space-y-2">
                {result.recommendations.map((rec, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <span className="text-yellow-600">•</span>
                    <div>
                      <span className="text-yellow-700">{rec.description}</span>
                      {rec.price_change !== undefined && rec.price_change > 0 && (
                        <span className="text-xs text-muted-foreground ml-2">
                          ({formatMoney(rec.price_change)})
                        </span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </AlertDescription>
      </Alert>
    )
  }

  // Not available - red destructive alert
  if (result.status === 'not_available') {
    return (
      <Alert className="border-red-500/50 bg-red-500/10">
        <XCircle className="h-4 w-4 text-red-500" />
        <AlertTitle className="text-red-700">Site Not Available</AlertTitle>
        <AlertDescription className="space-y-3">
          {/* Conflicts */}
          {result.conflicts.map((conflict, i) => (
            <div key={i} className="space-y-1">
              <p className="text-sm font-medium text-red-700">
                {conflict.type === 'pending_renewal' ? 'Renewal Hold' : 'Conflicting Reservation'}:
              </p>
              <div className="bg-white/50 rounded-md p-2 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">
                    {conflict.reservation?.guest_name}
                  </span>
                  <Badge variant="outline" className="text-xs">
                    {conflict.reservation?.confirmation_number}
                  </Badge>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Calendar className="h-3 w-3" />
                  <span>
                    {formatDate(conflict.conflicting_dates.start)} -{' '}
                    {formatDate(conflict.conflicting_dates.end)}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <Badge
                    variant="outline"
                    className={
                      conflict.reservation?.status === 'confirmed'
                        ? 'bg-blue-500/10 text-blue-600'
                        : 'bg-yellow-500/10 text-yellow-600'
                    }
                  >
                    {conflict.reservation?.status}
                  </Badge>
                  <Badge
                    variant="outline"
                    className={
                      conflict.reservation?.payment_status === 'paid'
                        ? 'bg-green-500/10 text-green-600'
                        : 'bg-orange-500/10 text-orange-600'
                    }
                  >
                    {conflict.reservation?.payment_status}
                  </Badge>
                </div>
                {conflict.message && (
                  <p className="text-xs text-red-600 mt-1">{conflict.message}</p>
                )}
              </div>
            </div>
          ))}

          {/* Alternative sites */}
          {result.alternatives.length > 0 && (
            <div className="mt-4 pt-3 border-t border-red-500/20">
              <p className="text-sm font-medium text-red-700 mb-2">Alternative Sites:</p>
              <div className="space-y-2">
                {result.alternatives.slice(0, 3).map((alt, i) => (
                  <div key={i} className="bg-white/50 rounded-md p-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium">
                          Site #{alt.site_number}
                          {alt.site_name && (
                            <span className="text-muted-foreground ml-1">
                              ({alt.site_name})
                            </span>
                          )}
                        </span>
                      </div>
                      <Badge variant="outline" className="text-xs capitalize">
                        {alt.site_type}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between mt-1 text-xs">
                      <span className="text-muted-foreground">
                        {formatMoney(alt.price_per_night)}/night
                      </span>
                      <span className="text-green-600">
                        {alt.similarity_score}% match
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recommendations */}
          {result.recommendations.length > 0 && (
            <div className="mt-4 pt-3 border-t border-red-500/20">
              <p className="text-sm font-medium text-red-700 mb-2">Actions:</p>
              <ul className="space-y-2">
                {result.recommendations.map((rec, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <span className="text-red-600">•</span>
                    <span className="text-red-700">{rec.description}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </AlertDescription>
      </Alert>
    )
  }

  return null
}
