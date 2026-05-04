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
  /** ISO date-only string YYYY-MM-DD — first day property is open for the season */
  openPeriodFrom: string | null
  /** ISO date-only string YYYY-MM-DD — last day property is open for the season */
  openPeriodUntil: string | null
  /** When true, sites stay in 'housekeeping' status after last task is done — operator must manually mark ready */
  housekeepingRequireApproval: boolean | null
  /** Default refund handling method: 'original_method' or 'guest_credit' */
  defaultRefundHandling: string | null
}

/** Partial update: `undefined` means leave existing value (for API merge). */
export type PropertySettingsPatch = {
  [K in keyof PropertySettingsProps]?: PropertySettingsProps[K] | undefined
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

    const openPeriodFrom = props.openPeriodFrom ?? null
    const openPeriodUntil = props.openPeriodUntil ?? null
    if (
      openPeriodFrom != null &&
      openPeriodUntil != null &&
      openPeriodFrom > openPeriodUntil
    ) {
      throw new Error('Open period end must be on or after open period start')
    }

    if (
      props.housekeepingRequireApproval !== undefined &&
      props.housekeepingRequireApproval !== null &&
      typeof props.housekeepingRequireApproval !== 'boolean'
    ) {
      throw new Error('housekeepingRequireApproval must be a boolean')
    }

    if (
      props.defaultRefundHandling !== undefined &&
      props.defaultRefundHandling !== null &&
      props.defaultRefundHandling !== 'original_method' &&
      props.defaultRefundHandling !== 'guest_credit'
    ) {
      throw new Error('defaultRefundHandling must be "original_method" or "guest_credit"')
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
      openPeriodFrom,
      openPeriodUntil,
      housekeepingRequireApproval: props.housekeepingRequireApproval ?? null,
      defaultRefundHandling: props.defaultRefundHandling ?? null,
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
      openPeriodFrom: null,
      openPeriodUntil: null,
      housekeepingRequireApproval: null,
      defaultRefundHandling: 'original_method',
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
      openPeriodFrom: json.openPeriodFrom ?? json.open_period_from ?? null,
      openPeriodUntil: json.openPeriodUntil ?? json.open_period_until ?? null,
      housekeepingRequireApproval: json.housekeepingRequireApproval ?? null,
      defaultRefundHandling: json.defaultRefundHandling ?? null,
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

  get openPeriodFrom(): string | null {
    return this.props.openPeriodFrom
  }

  get openPeriodUntil(): string | null {
    return this.props.openPeriodUntil
  }

  get housekeepingRequireApproval(): boolean | null {
    return this.props.housekeepingRequireApproval
  }

  get defaultRefundHandling(): string | null {
    return this.props.defaultRefundHandling
  }

  /**
   * Merge a partial settings patch onto existing settings (undefined = keep current).
   */
  static mergePartial(current: PropertySettings, partial: PropertySettingsPatch): PropertySettings {
    return PropertySettings.create({
      checkInTime: partial.checkInTime !== undefined ? partial.checkInTime : current.checkInTime,
      checkOutTime: partial.checkOutTime !== undefined ? partial.checkOutTime : current.checkOutTime,
      timezone: partial.timezone !== undefined ? partial.timezone : current.timezone,
      cancellationPolicy:
        partial.cancellationPolicy !== undefined ? partial.cancellationPolicy : current.cancellationPolicy,
      minStayNights: partial.minStayNights !== undefined ? partial.minStayNights : current.minStayNights,
      maxStayNights: partial.maxStayNights !== undefined ? partial.maxStayNights : current.maxStayNights,
      bookingLeadTimeDays:
        partial.bookingLeadTimeDays !== undefined
          ? partial.bookingLeadTimeDays
          : current.bookingLeadTimeDays,
      customRules: partial.customRules !== undefined ? partial.customRules : current.customRules,
      openPeriodFrom:
        partial.openPeriodFrom !== undefined ? partial.openPeriodFrom : current.openPeriodFrom,
      openPeriodUntil:
        partial.openPeriodUntil !== undefined ? partial.openPeriodUntil : current.openPeriodUntil,
      housekeepingRequireApproval:
        partial.housekeepingRequireApproval !== undefined
          ? partial.housekeepingRequireApproval
          : current.housekeepingRequireApproval,
      defaultRefundHandling:
        partial.defaultRefundHandling !== undefined
          ? partial.defaultRefundHandling
          : current.defaultRefundHandling,
    })
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
      openPeriodFrom: this.props.openPeriodFrom,
      openPeriodUntil: this.props.openPeriodUntil,
      housekeepingRequireApproval: this.props.housekeepingRequireApproval,
      defaultRefundHandling: this.props.defaultRefundHandling,
    }
  }
}
