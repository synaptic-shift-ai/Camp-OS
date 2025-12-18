/**
 * SupabaseEventStoreRepository
 *
 * Concrete implementation of IEventStoreRepository using Supabase.
 * Stores domain events in the event_store table.
 *
 * Table schema (event_store):
 * - id: uuid PRIMARY KEY
 * - event_id: text NOT NULL (domain event ID)
 * - event_type: text NOT NULL
 * - aggregate_id: text
 * - aggregate_type: text
 * - payload: jsonb NOT NULL
 * - metadata: jsonb NOT NULL DEFAULT '{}'
 * - occurred_at: timestamptz NOT NULL
 * - created_at: timestamptz DEFAULT now()
 *
 * @example
 * ```typescript
 * const eventStore = new SupabaseEventStoreRepository(supabaseClient)
 *
 * // Append event with metadata
 * await eventStore.append(event, {
 *   aggregateId: 'res-123',
 *   aggregateType: 'Reservation',
 *   metadata: { userId: 'user-456', correlationId: 'req-789' }
 * })
 * ```
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../../contracts/db'
import type { DomainEvent } from '../../domain/DomainEvent'
import type {
  IEventStoreRepository,
  StoredEvent,
  AppendEventOptions,
  EventQueryOptions,
  EventMetadata,
} from './IEventStoreRepository'

// The event_store table schema matches migration 20251105000001_add_event_store_table.sql
// TODO: Remove this after regenerating types with `npm run gen:db`
interface EventStoreRow {
  id: string
  event_id: string
  event_type: string
  aggregate_id: string
  aggregate_type: string
  event_data: Record<string, unknown>  // Column name in DB is event_data, not payload
  metadata: Record<string, unknown> | null
  occurred_at: string
  created_at: string
}

// Use 'any' until table is created - see TODO in header
const TABLE_NAME = 'event_store' as any

export class SupabaseEventStoreRepository implements IEventStoreRepository {
  constructor(private readonly supabase: SupabaseClient<Database>) {}

  async append(
    event: DomainEvent,
    options: AppendEventOptions = {}
  ): Promise<StoredEvent> {
    const row = this.toRow(event, options)

    const { data, error } = await this.supabase
      .from(TABLE_NAME)
      .insert(row)
      .select()
      .single()

    if (error) {
      throw new Error(`Failed to append event: ${error.message}`)
    }

    return this.toDomain(data as unknown as EventStoreRow)
  }

  async appendAll(
    events: readonly DomainEvent[],
    options: AppendEventOptions = {}
  ): Promise<StoredEvent[]> {
    if (events.length === 0) {
      return []
    }

    const rows = events.map((event) => this.toRow(event, options))

    const { data, error } = await this.supabase
      .from(TABLE_NAME)
      .insert(rows as any)
      .select()

    if (error) {
      throw new Error(`Failed to append events: ${error.message}`)
    }

    return (data as unknown as EventStoreRow[]).map((row) => this.toDomain(row))
  }

  async getByAggregateId(
    aggregateId: string,
    options: EventQueryOptions = {}
  ): Promise<StoredEvent[]> {
    let query = this.supabase
      .from(TABLE_NAME)
      .select('*')
      .eq('aggregate_id', aggregateId)

    query = this.applyQueryOptions(query, options)

    const { data, error } = await query

    if (error) {
      throw new Error(`Failed to get events by aggregate: ${error.message}`)
    }

    return (data as unknown as EventStoreRow[]).map((row) => this.toDomain(row))
  }

  async getByEventType(
    eventType: string,
    options: EventQueryOptions = {}
  ): Promise<StoredEvent[]> {
    let query = this.supabase
      .from(TABLE_NAME)
      .select('*')
      .eq('event_type', eventType)

    query = this.applyQueryOptions(query, options)

    const { data, error } = await query

    if (error) {
      throw new Error(`Failed to get events by type: ${error.message}`)
    }

    return (data as unknown as EventStoreRow[]).map((row) => this.toDomain(row))
  }

  async getByDateRange(
    fromDate: Date,
    toDate: Date,
    options: EventQueryOptions = {}
  ): Promise<StoredEvent[]> {
    let query = this.supabase
      .from(TABLE_NAME)
      .select('*')
      .gte('occurred_at', fromDate.toISOString())
      .lte('occurred_at', toDate.toISOString())

    query = this.applyQueryOptions(query, options)

    const { data, error } = await query

    if (error) {
      throw new Error(`Failed to get events by date range: ${error.message}`)
    }

    return (data as unknown as EventStoreRow[]).map((row) => this.toDomain(row))
  }

  async getById(id: string): Promise<StoredEvent | null> {
    const { data, error } = await this.supabase
      .from(TABLE_NAME)
      .select('*')
      .eq('id', id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        // No rows returned
        return null
      }
      throw new Error(`Failed to get event by id: ${error.message}`)
    }

    return this.toDomain(data as unknown as EventStoreRow)
  }

  async getByEventId(eventId: string): Promise<StoredEvent | null> {
    const { data, error } = await this.supabase
      .from(TABLE_NAME)
      .select('*')
      .eq('event_id', eventId)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        // No rows returned
        return null
      }
      throw new Error(`Failed to get event by event_id: ${error.message}`)
    }

    return this.toDomain(data as unknown as EventStoreRow)
  }

  async count(
    options: {
      eventType?: string
      aggregateId?: string
      fromDate?: Date
      toDate?: Date
    } = {}
  ): Promise<number> {
    let query = this.supabase
      .from(TABLE_NAME)
      .select('*', { count: 'exact', head: true })

    if (options.eventType) {
      query = query.eq('event_type', options.eventType)
    }

    if (options.aggregateId) {
      query = query.eq('aggregate_id', options.aggregateId)
    }

    if (options.fromDate) {
      query = query.gte('occurred_at', options.fromDate.toISOString())
    }

    if (options.toDate) {
      query = query.lte('occurred_at', options.toDate.toISOString())
    }

    const { count, error } = await query

    if (error) {
      throw new Error(`Failed to count events: ${error.message}`)
    }

    return count ?? 0
  }

  private toRow(
    event: DomainEvent,
    options: AppendEventOptions
  ): Omit<EventStoreRow, 'id' | 'created_at'> {
    // aggregate_id and aggregate_type are required in the DB schema
    // Default to 'unknown' if not provided
    return {
      event_id: event.eventId,
      event_type: event.eventType,
      aggregate_id: options.aggregateId ?? 'unknown',
      aggregate_type: options.aggregateType ?? 'unknown',
      event_data: event.toJSON(),
      metadata: options.metadata ? (options.metadata as Record<string, unknown>) : null,
      occurred_at: event.occurredAt.toISOString(),
    }
  }

  private toDomain(row: EventStoreRow): StoredEvent {
    return {
      id: row.id,
      eventId: row.event_id,
      eventType: row.event_type,
      aggregateId: row.aggregate_id === 'unknown' ? null : row.aggregate_id,
      aggregateType: row.aggregate_type === 'unknown' ? null : row.aggregate_type,
      payload: row.event_data,
      metadata: (row.metadata ?? {}) as EventMetadata,
      occurredAt: new Date(row.occurred_at),
      createdAt: new Date(row.created_at),
    }
  }

  private applyQueryOptions(query: any, options: EventQueryOptions): any {
    if (options.fromDate) {
      query = query.gte('occurred_at', options.fromDate.toISOString())
    }

    if (options.toDate) {
      query = query.lte('occurred_at', options.toDate.toISOString())
    }

    const order = options.orderBy ?? 'asc'
    query = query.order('occurred_at', { ascending: order === 'asc' })

    if (options.limit) {
      query = query.limit(options.limit)
    }

    if (options.offset) {
      query = query.range(options.offset, options.offset + (options.limit ?? 100) - 1)
    }

    return query
  }
}
