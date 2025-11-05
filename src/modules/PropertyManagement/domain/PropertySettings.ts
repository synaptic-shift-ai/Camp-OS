/**
 * PropertySettings Value Object
 *
 * Encapsulates property-specific settings and configuration.
 * Immutable value object stored as JSONB in database.
 *
 * @example
 * ```typescript
 * const settings = PropertySettings.create({
 *   checkInTime: '14:00',
 *   checkOutTime: '11:00',
 *   timezone: 'America/Los_Angeles',
 *   cancellationPolicy: 'flexible'
 * })
 * ```
 */
import { ValueObject } from '@/shared/domain'

export type PropertySettingsProps = {
  checkInTime: string | null // Format: "HH:mm"
  checkOutTime: string | null // Format: "HH:mm"
  timezone: string | null // IANA timezone (e.g., "America/Los_Angeles")
  cancellationPolicy: string | null
  minStayNights: number | null
  maxStayNights: number | null
  bookingLeadTimeDays: number | null // How far in advance bookings are allowed
  customRules: string | null // Custom text rules for guests
}

export class PropertySettings extends ValueObject<PropertySettingsProps> {
  private constructor(props: PropertySettingsProps) {
    super(props)
  }

  /**
   * Create PropertySettings with validation
   */
  static create(props: Partial<PropertySettingsProps> = {}): PropertySettings {
    // Validate min/max stay
    if (
      props.minStayNights !== undefined &&
      props.minStayNights !== null &&
      props.minStayNights < 1
    ) {
      throw new Error('Minimum stay must be at least 1 night')
    }

    if (
      props.maxStayNights !== undefined &&
      props.maxStayNights !== null &&
      props.maxStayNights < 1
    ) {
      throw new Error('Maximum stay must be at least 1 night')
    }

    if (
      props.minStayNights !== undefined &&
      props.minStayNights !== null &&
      props.maxStayNights !== undefined &&
      props.maxStayNights !== null &&
      props.minStayNights > props.maxStayNights
    ) {
      throw new Error('Minimum stay cannot exceed maximum stay')
    }

    // Validate booking lead time
    if (
      props.bookingLeadTimeDays !== undefined &&
      props.bookingLeadTimeDays !== null &&
      props.bookingLeadTimeDays < 0
    ) {
      throw new Error('Booking lead time cannot be negative')
    }

    return new PropertySettings({
      checkInTime: props.checkInTime || null,
      checkOutTime: props.checkOutTime || null,
      timezone: props.timezone || null,
      cancellationPolicy: props.cancellationPolicy || null,
      minStayNights: props.minStayNights || null,
      maxStayNights: props.maxStayNights || null,
      bookingLeadTimeDays: props.bookingLeadTimeDays || null,
      customRules: props.customRules || null,
    })
  }

  /**
   * Create default settings
   */
  static default(): PropertySettings {
    return new PropertySettings({
      checkInTime: '14:00',
      checkOutTime: '11:00',
      timezone: 'America/Los_Angeles',
      cancellationPolicy: 'flexible',
      minStayNights: 1,
      maxStayNights: 30,
      bookingLeadTimeDays: 365,
      customRules: null,
    })
  }

  /**
   * Create from database JSONB field
   */
  static fromJson(json: Record<string, any> | null): PropertySettings {
    if (!json) {
      return PropertySettings.default()
    }

    return PropertySettings.create({
      checkInTime: json.checkInTime || json.check_in_time || null,
      checkOutTime: json.checkOutTime || json.check_out_time || null,
      timezone: json.timezone || null,
      cancellationPolicy: json.cancellationPolicy || json.cancellation_policy || null,
      minStayNights: json.minStayNights || json.min_stay_nights || null,
      maxStayNights: json.maxStayNights || json.max_stay_nights || null,
      bookingLeadTimeDays: json.bookingLeadTimeDays || json.booking_lead_time_days || null,
      customRules: json.customRules || json.custom_rules || null,
    })
  }

  get checkInTime(): string | null {
    return this.props.checkInTime
  }

  get checkOutTime(): string | null {
    return this.props.checkOutTime
  }

  get timezone(): string | null {
    return this.props.timezone
  }

  get cancellationPolicy(): string | null {
    return this.props.cancellationPolicy
  }

  get minStayNights(): number | null {
    return this.props.minStayNights
  }

  get maxStayNights(): number | null {
    return this.props.maxStayNights
  }

  get bookingLeadTimeDays(): number | null {
    return this.props.bookingLeadTimeDays
  }

  get customRules(): string | null {
    return this.props.customRules
  }

  /**
   * Update check-in/check-out times
   */
  withCheckTimes(checkInTime: string, checkOutTime: string): PropertySettings {
    return PropertySettings.create({
      ...this.props,
      checkInTime,
      checkOutTime,
    })
  }

  /**
   * Update stay limits
   */
  withStayLimits(minStayNights: number, maxStayNights: number): PropertySettings {
    return PropertySettings.create({
      ...this.props,
      minStayNights,
      maxStayNights,
    })
  }

  /**
   * Convert to JSON for database storage
   */
  toJson(): Record<string, any> {
    return {
      checkInTime: this.props.checkInTime,
      checkOutTime: this.props.checkOutTime,
      timezone: this.props.timezone,
      cancellationPolicy: this.props.cancellationPolicy,
      minStayNights: this.props.minStayNights,
      maxStayNights: this.props.maxStayNights,
      bookingLeadTimeDays: this.props.bookingLeadTimeDays,
      customRules: this.props.customRules,
    }
  }
}
