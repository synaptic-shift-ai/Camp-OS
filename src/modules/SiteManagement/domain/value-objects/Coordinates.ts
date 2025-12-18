/**
 * Coordinates Value Object
 *
 * Represents geographic coordinates (latitude/longitude) for site location.
 */

export type CoordinatesProps = {
  latitude: number
  longitude: number
}

export class Coordinates {
  private constructor(private readonly props: CoordinatesProps) {
    Object.freeze(this.props)
  }

  static create(latitude: number, longitude: number): Coordinates {
    // Validate latitude (-90 to 90)
    if (latitude < -90 || latitude > 90) {
      throw new Error('Latitude must be between -90 and 90')
    }

    // Validate longitude (-180 to 180)
    if (longitude < -180 || longitude > 180) {
      throw new Error('Longitude must be between -180 and 180')
    }

    return new Coordinates({
      latitude,
      longitude,
    })
  }

  static fromPersistence(locationMap: unknown): Coordinates | null {
    if (!locationMap || typeof locationMap !== 'object') {
      return null
    }

    const map = locationMap as Record<string, unknown>

    // Support both 'lat'/'lng' and 'latitude'/'longitude' keys
    const lat = map.lat ?? map.latitude
    const lng = map.lng ?? map.longitude

    if (typeof lat !== 'number' || typeof lng !== 'number') {
      return null
    }

    try {
      return Coordinates.create(lat, lng)
    } catch {
      return null
    }
  }

  get latitude(): number {
    return this.props.latitude
  }

  get longitude(): number {
    return this.props.longitude
  }

  // Alias for common naming convention
  get lat(): number {
    return this.props.latitude
  }

  get lng(): number {
    return this.props.longitude
  }

  /**
   * Calculate distance to another coordinate in kilometers
   * Uses Haversine formula
   */
  distanceTo(other: Coordinates): number {
    const R = 6371 // Earth's radius in km
    const dLat = this.toRadians(other.latitude - this.latitude)
    const dLng = this.toRadians(other.longitude - this.longitude)

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(this.latitude)) *
        Math.cos(this.toRadians(other.latitude)) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2)

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

    return R * c
  }

  /**
   * Distance in miles
   */
  distanceToInMiles(other: Coordinates): number {
    return this.distanceTo(other) * 0.621371
  }

  private toRadians(degrees: number): number {
    return degrees * (Math.PI / 180)
  }

  equals(other: Coordinates): boolean {
    // Allow small floating point differences
    const epsilon = 0.000001
    return (
      Math.abs(this.latitude - other.latitude) < epsilon &&
      Math.abs(this.longitude - other.longitude) < epsilon
    )
  }

  toString(): string {
    return `${this.latitude.toFixed(6)}, ${this.longitude.toFixed(6)}`
  }

  toGoogleMapsUrl(): string {
    return `https://www.google.com/maps?q=${this.latitude},${this.longitude}`
  }

  toPersistence(): { lat: number; lng: number } {
    return {
      lat: this.props.latitude,
      lng: this.props.longitude,
    }
  }
}
