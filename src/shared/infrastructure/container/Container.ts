/**
 * Simple Dependency Injection Container
 *
 * A lightweight container for managing dependencies across the modular architecture.
 * Supports singleton and transient lifetimes.
 *
 * Usage:
 *   // Register dependencies
 *   container.registerSingleton('eventBus', () => new InMemoryEventBus())
 *   container.registerTransient('reservationRepo', (c) => new SupabaseReservationRepository(c.resolve('supabase')))
 *
 *   // Resolve dependencies
 *   const eventBus = container.resolve<IEventBus>('eventBus')
 */

type Factory<T> = (container: Container) => T

interface Registration<T> {
  factory: Factory<T>
  lifetime: 'singleton' | 'transient'
  instance?: T
}

export class Container {
  private registrations = new Map<string, Registration<unknown>>()

  /**
   * Register a singleton dependency.
   * The factory is called once, and the same instance is returned on subsequent resolves.
   */
  registerSingleton<T>(key: string, factory: Factory<T>): void {
    this.registrations.set(key, {
      factory: factory as Factory<unknown>,
      lifetime: 'singleton',
    })
  }

  /**
   * Register a transient dependency.
   * The factory is called every time the dependency is resolved.
   */
  registerTransient<T>(key: string, factory: Factory<T>): void {
    this.registrations.set(key, {
      factory: factory as Factory<unknown>,
      lifetime: 'transient',
    })
  }

  /**
   * Register an existing instance as a singleton.
   */
  registerInstance<T>(key: string, instance: T): void {
    this.registrations.set(key, {
      factory: () => instance,
      lifetime: 'singleton',
      instance,
    })
  }

  /**
   * Resolve a dependency by key.
   * @throws Error if the dependency is not registered.
   */
  resolve<T>(key: string): T {
    const registration = this.registrations.get(key)

    if (!registration) {
      throw new Error(`Dependency '${key}' is not registered in the container`)
    }

    if (registration.lifetime === 'singleton') {
      if (registration.instance === undefined) {
        registration.instance = registration.factory(this)
      }
      return registration.instance as T
    }

    // Transient - create new instance each time
    return registration.factory(this) as T
  }

  /**
   * Check if a dependency is registered.
   */
  isRegistered(key: string): boolean {
    return this.registrations.has(key)
  }

  /**
   * Clear all registrations.
   * Useful for testing.
   */
  clear(): void {
    this.registrations.clear()
  }

  /**
   * Reset singleton instances without clearing registrations.
   * Useful for testing.
   */
  resetSingletons(): void {
    for (const registration of this.registrations.values()) {
      if (registration.lifetime === 'singleton') {
        registration.instance = undefined
      }
    }
  }
}

// Default container instance
export const container = new Container()
