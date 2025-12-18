#!/usr/bin/env npx tsx
/**
 * Module Generator Script
 *
 * Creates a new domain module following the canonical structure defined in CLAUDE.md (M-1).
 *
 * Usage:
 *   npm run generate:module ModuleName
 *   npx tsx scripts/generate-module.ts ModuleName
 *
 * Example:
 *   npm run generate:module CompanyManagement
 *
 * This creates:
 *   src/modules/CompanyManagement/
 *   ├── domain/
 *   │   ├── Company.ts              # Aggregate root entity stub
 *   │   ├── ICompanyRepository.ts   # Repository interface stub
 *   │   ├── events/
 *   │   │   └── index.ts            # Events barrel export
 *   │   ├── value-objects/
 *   │   │   └── index.ts            # Value objects barrel export
 *   │   └── __tests__/
 *   │       └── .gitkeep
 *   ├── application/
 *   │   ├── commands/
 *   │   ├── queries/
 *   │   └── DTOs/
 *   ├── infrastructure/
 *   │   ├── SupabaseCompanyRepository.ts  # Repository implementation stub
 *   │   └── __tests__/
 *   │       └── .gitkeep
 *   └── index.ts                    # Barrel export
 */

import * as fs from 'fs'
import * as path from 'path'

const MODULES_DIR = path.join(process.cwd(), 'src', 'modules')

function toPascalCase(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1)
}

function toSnakeCase(str: string): string {
  return str
    .replace(/([A-Z])/g, '_$1')
    .toLowerCase()
    .replace(/^_/, '')
}

function generateAggregateRoot(entityName: string): string {
  return `/**
 * ${entityName} Aggregate Root
 *
 * TODO: Implement domain logic for ${entityName}
 */

import { AggregateRoot } from '@/shared/domain/AggregateRoot'

interface ${entityName}Props {
  // TODO: Define properties
}

export class ${entityName} extends AggregateRoot<string> {
  // TODO: Add private properties

  private constructor(id: string, createdAt: Date, updatedAt: Date) {
    super(id, createdAt, updatedAt)
  }

  /**
   * Factory method to create a new ${entityName}
   */
  public static create(id: string): ${entityName} {
    const now = new Date()
    return new ${entityName}(id, now, now)
  }

  /**
   * Reconstitute from persistence
   */
  public static fromPersistence(
    id: string,
    createdAt: Date,
    updatedAt: Date
  ): ${entityName} {
    return new ${entityName}(id, createdAt, updatedAt)
  }

  /**
   * Convert to persistence format
   */
  public toPersistence(): Record<string, unknown> {
    return {
      id: this.id,
      created_at: this.createdAt.toISOString(),
      updated_at: this.updatedAt.toISOString(),
    }
  }
}
`
}

function generateRepositoryInterface(entityName: string): string {
  return `/**
 * I${entityName}Repository Interface
 *
 * Defines the contract for persisting and retrieving ${entityName} aggregates.
 */

import type { ${entityName} } from './${entityName}'

export interface I${entityName}Repository {
  /**
   * Find ${entityName.toLowerCase()} by ID
   */
  findById(id: string): Promise<${entityName} | null>

  /**
   * Save ${entityName.toLowerCase()} (insert or update)
   */
  save(${entityName.toLowerCase()}: ${entityName}): Promise<void>

  /**
   * Delete ${entityName.toLowerCase()} by ID
   */
  delete(id: string): Promise<void>
}
`
}

function generateSupabaseRepository(entityName: string, moduleName: string): string {
  const tableName = toSnakeCase(entityName) + 's'
  return `/**
 * Supabase${entityName}Repository
 *
 * Concrete implementation of I${entityName}Repository using Supabase.
 *
 * TODO: Before using this repository:
 * 1. Create the '${tableName}' table in Supabase
 * 2. Run 'npm run gen:db' to regenerate database types
 * 3. Remove the 'as any' type assertions below once the table exists
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/contracts/db'
import type { I${entityName}Repository } from '../domain/I${entityName}Repository'
import { ${entityName} } from '../domain/${entityName}'

// TODO: Update TABLE_NAME once the table is created in Supabase
const TABLE_NAME = '${tableName}' as any

export class Supabase${entityName}Repository implements I${entityName}Repository {
  private readonly supabase: SupabaseClient<Database>

  constructor(client: SupabaseClient<Database>) {
    this.supabase = client
  }

  async findById(id: string): Promise<${entityName} | null> {
    const { data, error } = await this.supabase
      .from(TABLE_NAME)
      .select('*')
      .eq('id', id)
      .single()

    if (error || !data) {
      return null
    }

    return this.toDomain(data)
  }

  async save(${entityName.toLowerCase()}: ${entityName}): Promise<void> {
    const row = ${entityName.toLowerCase()}.toPersistence()

    const { error } = await this.supabase
      .from(TABLE_NAME)
      .upsert(row as any)

    if (error) {
      throw new Error(\`Failed to save ${entityName}: \${error.message}\`)
    }
  }

  async delete(id: string): Promise<void> {
    const { error } = await this.supabase
      .from(TABLE_NAME)
      .delete()
      .eq('id', id)

    if (error) {
      throw new Error(\`Failed to delete ${entityName}: \${error.message}\`)
    }
  }

  private toDomain(row: any): ${entityName} {
    return ${entityName}.fromPersistence(
      row.id,
      new Date(row.created_at),
      new Date(row.updated_at)
    )
  }
}
`
}

function generateModuleIndex(entityName: string): string {
  return `// ${entityName} Module Barrel Export

// Domain
export { ${entityName} } from './domain/${entityName}'
export type { I${entityName}Repository } from './domain/I${entityName}Repository'
// Uncomment when events are added:
// export * from './domain/events'

// Infrastructure
export { Supabase${entityName}Repository } from './infrastructure/Supabase${entityName}Repository'
`
}

function generateEventsIndex(): string {
  return `// Domain Events
// Add event exports here as they are created
`
}

function generateValueObjectsIndex(): string {
  return `// Value Objects
// Add value object exports here as they are created
`
}

function createDirectory(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true })
    console.log(`  Created: ${dirPath}`)
  }
}

function writeFile(filePath: string, content: string): void {
  if (fs.existsSync(filePath)) {
    console.log(`  Skipped (exists): ${filePath}`)
    return
  }
  fs.writeFileSync(filePath, content)
  console.log(`  Created: ${filePath}`)
}

function generateModule(moduleName: string): void {
  console.log(`\nGenerating module: ${moduleName}`)
  console.log('='.repeat(50))

  // Derive entity name from module name (remove "Management" suffix if present)
  const entityName = moduleName.replace(/Management$/, '')

  const moduleDir = path.join(MODULES_DIR, moduleName)

  // Check if module already exists
  if (fs.existsSync(moduleDir)) {
    console.error(`\nError: Module '${moduleName}' already exists at ${moduleDir}`)
    console.error('If you want to regenerate it, please delete the existing directory first.')
    process.exit(1)
  }

  // Create directory structure
  console.log('\nCreating directory structure...')
  createDirectory(path.join(moduleDir, 'domain', 'events'))
  createDirectory(path.join(moduleDir, 'domain', 'value-objects'))
  createDirectory(path.join(moduleDir, 'domain', '__tests__'))
  createDirectory(path.join(moduleDir, 'application', 'commands'))
  createDirectory(path.join(moduleDir, 'application', 'queries'))
  createDirectory(path.join(moduleDir, 'application', 'DTOs'))
  createDirectory(path.join(moduleDir, 'infrastructure', '__tests__'))

  // Create files
  console.log('\nCreating files...')

  // Domain layer
  writeFile(
    path.join(moduleDir, 'domain', `${entityName}.ts`),
    generateAggregateRoot(entityName)
  )
  writeFile(
    path.join(moduleDir, 'domain', `I${entityName}Repository.ts`),
    generateRepositoryInterface(entityName)
  )
  writeFile(
    path.join(moduleDir, 'domain', 'events', 'index.ts'),
    generateEventsIndex()
  )
  writeFile(
    path.join(moduleDir, 'domain', 'value-objects', 'index.ts'),
    generateValueObjectsIndex()
  )
  writeFile(
    path.join(moduleDir, 'domain', '__tests__', '.gitkeep'),
    ''
  )

  // Infrastructure layer
  writeFile(
    path.join(moduleDir, 'infrastructure', `Supabase${entityName}Repository.ts`),
    generateSupabaseRepository(entityName, moduleName)
  )
  writeFile(
    path.join(moduleDir, 'infrastructure', '__tests__', '.gitkeep'),
    ''
  )

  // Module barrel export
  writeFile(
    path.join(moduleDir, 'index.ts'),
    generateModuleIndex(entityName)
  )

  console.log('\n✓ Module generated successfully!')
  console.log(`\nNext steps:`)
  console.log(`  1. Define properties in ${entityName}.ts`)
  console.log(`  2. Add value objects to domain/value-objects/`)
  console.log(`  3. Add domain events to domain/events/`)
  console.log(`  4. Create commands in application/commands/`)
  console.log(`  5. Create queries in application/queries/`)
  console.log(`  6. Add DTOs in application/DTOs/`)
  console.log(`  7. Update the repository implementation`)
  console.log(`  8. Write tests!`)
}

// Main execution
const args = process.argv.slice(2)

if (args.length === 0) {
  console.error('Usage: npm run generate:module <ModuleName>')
  console.error('Example: npm run generate:module CompanyManagement')
  process.exit(1)
}

const moduleName = toPascalCase(args[0])
generateModule(moduleName)
