import { EventEmitter } from 'events';
import * as fs from 'fs';
import * as path from 'path';

// Database interfaces
export interface DatabaseConfig {
  type: 'json' | 'memory';
  path?: string;
  autoSave?: boolean;
}

export interface ModelSchema {
  [field: string]: {
    type: 'string' | 'number' | 'boolean' | 'date' | 'object' | 'array';
    required?: boolean;
    default?: any;
    unique?: boolean;
    validate?: (value: any) => boolean;
  };
}

export interface QueryOptions {
  where?: { [key: string]: any };
  orderBy?: { field: string; direction: 'asc' | 'desc' };
  limit?: number;
  offset?: number;
}

// Simple in-memory/JSON file database
export class KenxDB extends EventEmitter {
  private config: DatabaseConfig;
  private data: { [table: string]: any[] } = {};
  private schemas: { [table: string]: ModelSchema } = {};
  private autoIncrements: { [table: string]: number } = {};

  constructor(config: DatabaseConfig = { type: 'memory' }) {
    super();
    this.config = config;
    
    if (config.type === 'json' && config.path) {
      this.loadFromFile();
    }
  }

  // Create a model/table
  define(tableName: string, schema: ModelSchema): Model {
    this.schemas[tableName] = schema;
    if (!this.data[tableName]) {
      this.data[tableName] = [];
    }
    if (!this.autoIncrements[tableName]) {
      this.autoIncrements[tableName] = 1;
    }
    
    return new Model(tableName, this);
  }

  // Internal methods
  private loadFromFile(): void {
    if (this.config.path && fs.existsSync(this.config.path)) {
      try {
        const fileData = fs.readFileSync(this.config.path, 'utf8');
        const parsed = JSON.parse(fileData);
        this.data = parsed.data || {};
        this.autoIncrements = parsed.autoIncrements || {};
      } catch (error) {
        console.error('Error loading database:', error);
      }
    }
  }

  private saveToFile(): void {
    if (this.config.type === 'json' && this.config.path) {
      try {
        const dir = path.dirname(this.config.path);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
        
        const dataToSave = {
          data: this.data,
          autoIncrements: this.autoIncrements,
          timestamp: new Date().toISOString()
        };
        
        fs.writeFileSync(this.config.path, JSON.stringify(dataToSave, null, 2));
      } catch (error) {
        console.error('Error saving database:', error);
      }
    }
  }

  // CRUD operations
  insert(tableName: string, data: any): any {
    if (!this.data[tableName]) {
      throw new Error(`Table ${tableName} does not exist`);
    }

    const schema = this.schemas[tableName];
    const record = this.validateAndTransform(data, schema);
    
    // Add auto-increment ID if not provided
    if (!record.id) {
      record.id = this.autoIncrements[tableName]++;
    }

    record.createdAt = new Date().toISOString();
    record.updatedAt = new Date().toISOString();

    this.data[tableName].push(record);
    
    if (this.config.autoSave) {
      this.saveToFile();
    }

    this.emit('insert', { table: tableName, record });
    return record;
  }

  findAll(tableName: string, options: QueryOptions = {}): any[] {
    if (!this.data[tableName]) {
      return [];
    }

    let results = [...this.data[tableName]];

    // Apply where filter
    if (options.where) {
      results = results.filter(record => {
        return Object.entries(options.where!).every(([key, value]) => {
          return record[key] === value;
        });
      });
    }

    // Apply ordering
    if (options.orderBy) {
      const { field, direction } = options.orderBy;
      results.sort((a, b) => {
        if (direction === 'desc') {
          return b[field] > a[field] ? 1 : -1;
        }
        return a[field] > b[field] ? 1 : -1;
      });
    }

    // Apply pagination
    if (options.offset) {
      results = results.slice(options.offset);
    }
    if (options.limit) {
      results = results.slice(0, options.limit);
    }

    return results;
  }

  findOne(tableName: string, options: QueryOptions = {}): any | null {
    const results = this.findAll(tableName, { ...options, limit: 1 });
    return results.length > 0 ? results[0] : null;
  }

  findById(tableName: string, id: any): any | null {
    return this.findOne(tableName, { where: { id } });
  }

  update(tableName: string, id: any, updates: any): any | null {
    const index = this.data[tableName].findIndex(record => record.id === id);
    if (index === -1) {
      return null;
    }

    const schema = this.schemas[tableName];
    const validatedUpdates = this.validateAndTransform(updates, schema, true);
    
    this.data[tableName][index] = {
      ...this.data[tableName][index],
      ...validatedUpdates,
      updatedAt: new Date().toISOString()
    };

    if (this.config.autoSave) {
      this.saveToFile();
    }

    this.emit('update', { table: tableName, id, record: this.data[tableName][index] });
    return this.data[tableName][index];
  }

  delete(tableName: string, id: any): boolean {
    const index = this.data[tableName].findIndex(record => record.id === id);
    if (index === -1) {
      return false;
    }

    const deleted = this.data[tableName].splice(index, 1)[0];
    
    if (this.config.autoSave) {
      this.saveToFile();
    }

    this.emit('delete', { table: tableName, id, record: deleted });
    return true;
  }

  private validateAndTransform(data: any, schema: ModelSchema, isUpdate = false): any {
    const result: any = {};

    for (const [field, config] of Object.entries(schema)) {
      const value = data[field];

      // Skip validation for updates if field is not provided
      if (isUpdate && value === undefined) {
        continue;
      }

      // Check required fields
      if (config.required && (value === undefined || value === null)) {
        throw new Error(`Field ${field} is required`);
      }

      // Apply default values
      if (value === undefined && config.default !== undefined) {
        result[field] = typeof config.default === 'function' ? config.default() : config.default;
        continue;
      }

      // Skip if value is undefined and not required
      if (value === undefined) {
        continue;
      }

      // Type validation
      if (!this.validateType(value, config.type)) {
        throw new Error(`Field ${field} must be of type ${config.type}`);
      }

      // Custom validation
      if (config.validate && !config.validate(value)) {
        throw new Error(`Field ${field} failed custom validation`);
      }

      result[field] = value;
    }

    return result;
  }

  private validateType(value: any, type: string): boolean {
    switch (type) {
      case 'string':
        return typeof value === 'string';
      case 'number':
        return typeof value === 'number';
      case 'boolean':
        return typeof value === 'boolean';
      case 'date':
        return value instanceof Date || typeof value === 'string';
      case 'object':
        return typeof value === 'object' && !Array.isArray(value);
      case 'array':
        return Array.isArray(value);
      default:
        return true;
    }
  }

  // Utility methods
  save(): void {
    this.saveToFile();
  }

  drop(tableName: string): void {
    delete this.data[tableName];
    delete this.schemas[tableName];
    delete this.autoIncrements[tableName];
    
    if (this.config.autoSave) {
      this.saveToFile();
    }
  }

  clear(): void {
    this.data = {};
    this.schemas = {};
    this.autoIncrements = {};
    
    if (this.config.autoSave) {
      this.saveToFile();
    }
  }
}

// Model class for ORM-like interface
export class Model {
  constructor(private tableName: string, private db: KenxDB) {}

  create(data: any): any {
    return this.db.insert(this.tableName, data);
  }

  findAll(options?: QueryOptions): any[] {
    return this.db.findAll(this.tableName, options);
  }

  findOne(options?: QueryOptions): any | null {
    return this.db.findOne(this.tableName, options);
  }

  findById(id: any): any | null {
    return this.db.findById(this.tableName, id);
  }

  update(id: any, updates: any): any | null {
    return this.db.update(this.tableName, id, updates);
  }

  delete(id: any): boolean {
    return this.db.delete(this.tableName, id);
  }

  where(conditions: { [key: string]: any }): any[] {
    return this.findAll({ where: conditions });
  }

  orderBy(field: string, direction: 'asc' | 'desc' = 'asc'): any[] {
    return this.findAll({ orderBy: { field, direction } });
  }

  limit(count: number): any[] {
    return this.findAll({ limit: count });
  }

  count(): number {
    return this.findAll().length;
  }
}

export default KenxDB;
