/**
 * Entity Base Class
 *
 * Base class for all domain entities. An entity has:
 * - Unique identity (ID)
 * - Lifecycle (created, updated timestamps)
 * - Equality based on ID (not value)
 *
 * @example
 * ```typescript
 * class Site extends Entity<string> {
 *   constructor(
 *     id: string,
 *     private name: string,
 *     private siteNumber: string
 *   ) {
 *     super(id)
 *   }
 *
 *   getName(): string {
 *     return this.name
 *   }
 * }
 *
 * const site1 = new Site('123', 'Site A', '1')
 * const site2 = new Site('123', 'Site A', '1')
 * console.log(site1.equals(site2)) // true (same ID)
 * ```
 */
export abstract class Entity<TId> {
  protected readonly _id: TId
  protected readonly _createdAt: Date
  protected _updatedAt: Date

  constructor(id: TId, createdAt?: Date, updatedAt?: Date) {
    this._id = id
    this._createdAt = createdAt || new Date()
    this._updatedAt = updatedAt || new Date()
  }

  /**
   * Get the entity's unique identifier
   */
  get id(): TId {
    return this._id
  }

  /**
   * Get when the entity was created
   */
  get createdAt(): Date {
    return this._createdAt
  }

  /**
   * Get when the entity was last updated
   */
  get updatedAt(): Date {
    return this._updatedAt
  }

  /**
   * Mark the entity as updated (should be called when state changes)
   */
  protected touch(): void {
    this._updatedAt = new Date()
  }

  /**
   * Check if this entity is equal to another entity.
   * Entities are equal if they have the same ID.
   */
  equals(entity?: Entity<TId>): boolean {
    if (entity === null || entity === undefined) {
      return false
    }

    if (this === entity) {
      return true
    }

    if (!(entity instanceof Entity)) {
      return false
    }

    return this._id === entity._id
  }

  /**
   * Check if this entity is the same as another (reference equality)
   */
  isSame(entity?: Entity<TId>): boolean {
    return this === entity
  }
}
