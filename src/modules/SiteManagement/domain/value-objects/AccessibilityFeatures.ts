/**
 * AccessibilityFeatures Value Object
 *
 * Encapsulates accessibility-related features and ADA compliance for a site.
 */

export type AccessibilityFeature =
  | 'wheelchair_accessible'
  | 'paved_path'
  | 'level_surface'
  | 'accessible_restroom_nearby'
  | 'accessible_parking'
  | 'ramp_access'
  | 'wide_entrance'
  | 'grab_bars'
  | 'roll_in_shower'

export const ACCESSIBILITY_FEATURE_LABELS: Record<AccessibilityFeature, string> = {
  wheelchair_accessible: 'Wheelchair Accessible',
  paved_path: 'Paved Path to Site',
  level_surface: 'Level Surface',
  accessible_restroom_nearby: 'Accessible Restroom Nearby',
  accessible_parking: 'Accessible Parking',
  ramp_access: 'Ramp Access',
  wide_entrance: 'Wide Entrance',
  grab_bars: 'Grab Bars',
  roll_in_shower: 'Roll-in Shower',
}

export type AccessibilityFeaturesProps = {
  adaAccessible: boolean
  features: AccessibilityFeature[]
  notes: string | null
}

export class AccessibilityFeatures {
  private constructor(private readonly props: AccessibilityFeaturesProps) {
    Object.freeze(this.props)
  }

  static create(
    adaAccessible: boolean,
    features: AccessibilityFeature[] = [],
    notes: string | null = null
  ): AccessibilityFeatures {
    // Validate features
    const validFeatures = Object.keys(ACCESSIBILITY_FEATURE_LABELS)
    const invalidFeatures = features.filter((f) => !validFeatures.includes(f))
    if (invalidFeatures.length > 0) {
      throw new Error(`Invalid accessibility features: ${invalidFeatures.join(', ')}`)
    }

    // Remove duplicates
    const uniqueFeatures = [...new Set(features)]

    return new AccessibilityFeatures({
      adaAccessible,
      features: uniqueFeatures,
      notes: notes?.trim() || null,
    })
  }

  static notAccessible(): AccessibilityFeatures {
    return AccessibilityFeatures.create(false, [])
  }

  static fromPersistence(
    adaAccessible: boolean,
    featuresJson: unknown
  ): AccessibilityFeatures {
    const features = Array.isArray(featuresJson)
      ? (featuresJson as AccessibilityFeature[])
      : []

    return AccessibilityFeatures.create(adaAccessible, features)
  }

  get adaAccessible(): boolean {
    return this.props.adaAccessible
  }

  get features(): readonly AccessibilityFeature[] {
    return this.props.features
  }

  get notes(): string | null {
    return this.props.notes
  }

  hasFeature(feature: AccessibilityFeature): boolean {
    return this.props.features.includes(feature)
  }

  get featureLabels(): string[] {
    return this.props.features.map((f) => ACCESSIBILITY_FEATURE_LABELS[f])
  }

  equals(other: AccessibilityFeatures): boolean {
    if (this.props.adaAccessible !== other.props.adaAccessible) {
      return false
    }
    if (this.props.features.length !== other.props.features.length) {
      return false
    }
    const sortedA = [...this.props.features].sort()
    const sortedB = [...other.props.features].sort()
    return sortedA.every((f, i) => f === sortedB[i])
  }

  toPersistence(): {
    ada_accessible: boolean
    accessibility_features: AccessibilityFeature[] | null
  } {
    return {
      ada_accessible: this.props.adaAccessible,
      accessibility_features:
        this.props.features.length > 0 ? this.props.features : null,
    }
  }
}
