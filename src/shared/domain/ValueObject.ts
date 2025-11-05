/**
 * ValueObject Base Class
 *
 * Base class for value objects in DDD. A value object:
 * - Has no identity (is defined by its values)
 * - Is immutable
 * - Equality is based on values, not identity
 *
 * Examples of value objects:
 * - Email address
 * - Money (amount + currency)
 * - Date range
 * - Pricing (base rate + currency + tax rate)
 * - Address
 *
 * @example
 * ```typescript
 * class Email extends ValueObject<{ value: string }> {
 *   private constructor(props: { value: string }) {
 *     super(props)
 *   }
 *
 *   static create(email: string): Email {
 *     if (!this.isValid(email)) {
 *       throw new Error('Invalid email')
 *     }
 *     return new Email({ value: email })
 *   }
 *
 *   private static isValid(email: string): boolean {
 *     return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
 *   }
 *
 *   get value(): string {
 *     return this.props.value
 *   }
 * }
 *
 * const email1 = Email.create('test@example.com')
 * const email2 = Email.create('test@example.com')
 * console.log(email1.equals(email2)) // true (same value)
 * ```
 */
export abstract class ValueObject<T> {
  protected readonly props: T

  constructor(props: T) {
    this.props = Object.freeze(props)
  }

  /**
   * Check if this value object equals another.
   * Value objects are equal if all their properties are equal.
   */
  equals(vo?: ValueObject<T>): boolean {
    if (vo === null || vo === undefined) {
      return false
    }

    if (vo.props === undefined) {
      return false
    }

    return this.shallowEquals(this.props, vo.props)
  }

  /**
   * Shallow comparison of two objects.
   * For deep comparison, override this method in subclasses.
   */
  private shallowEquals(props1: T, props2: T): boolean {
    const keys1 = Object.keys(props1 as object)
    const keys2 = Object.keys(props2 as object)

    if (keys1.length !== keys2.length) {
      return false
    }

    for (const key of keys1) {
      const val1 = (props1 as any)[key]
      const val2 = (props2 as any)[key]

      // Handle nested value objects
      if (val1 instanceof ValueObject && val2 instanceof ValueObject) {
        if (!val1.equals(val2)) {
          return false
        }
      }
      // Handle arrays
      else if (Array.isArray(val1) && Array.isArray(val2)) {
        if (!this.arraysEqual(val1, val2)) {
          return false
        }
      }
      // Handle dates
      else if (val1 instanceof Date && val2 instanceof Date) {
        if (val1.getTime() !== val2.getTime()) {
          return false
        }
      }
      // Primitive comparison
      else if (val1 !== val2) {
        return false
      }
    }

    return true
  }

  /**
   * Compare two arrays for equality
   */
  private arraysEqual(arr1: any[], arr2: any[]): boolean {
    if (arr1.length !== arr2.length) {
      return false
    }

    for (let i = 0; i < arr1.length; i++) {
      if (arr1[i] instanceof ValueObject && arr2[i] instanceof ValueObject) {
        if (!arr1[i].equals(arr2[i])) {
          return false
        }
      } else if (arr1[i] !== arr2[i]) {
        return false
      }
    }

    return true
  }

  /**
   * Convert the value object to a plain object for serialization
   */
  toJSON(): T {
    return this.props
  }
}
