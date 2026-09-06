import { LowSync } from "lowdb";
import { JSONFileSync } from "lowdb/node";
import { app } from "electron";
import { join } from "path";
import { mkdirSync } from "fs";
import { randomUUID } from "crypto";
import type {
  CollectionName,
  DatabaseRecord,
  CrudResult,
  QueryOptions,
} from "../types/database.types";
import { logger } from "./logger.service";

const COLLECTIONS: CollectionName[] = ["extras", "players", "teams", "matchs", "tournaments"];

interface DbSchema {
  records: DatabaseRecord[];
}

const DEFAULT_DATA: DbSchema = { records: [] };

export class DatabaseService {
  private static instance: DatabaseService;
  private dbs: Map<CollectionName, LowSync<DbSchema>> = new Map();
  private dataDir: string;

  private constructor() {
    this.dataDir = join(app.getPath("documents"), "ZhenHai");
    mkdirSync(this.dataDir, { recursive: true });
    this.initDatabases();
    logger.info("DatabaseService", `Data directory: ${this.dataDir}`);
  }

  static getInstance(): DatabaseService {
    if (!DatabaseService.instance) {
      DatabaseService.instance = new DatabaseService();
    }
    return DatabaseService.instance;
  }

  private initDatabases(): void {
    for (const name of COLLECTIONS) {
      const filePath = join(this.dataDir, `${name}.json`);
      const adapter = new JSONFileSync<DbSchema>(filePath);
      const db = new LowSync<DbSchema>(adapter, JSON.parse(JSON.stringify(DEFAULT_DATA)));
      db.read();
      this.dbs.set(name, db);
    }
  }

  private getDb(collection: CollectionName): LowSync<DbSchema> | null {
    return this.dbs.get(collection) ?? null;
  }

  create(collection: CollectionName, data: Record<string, any>): CrudResult<DatabaseRecord> {
    const db = this.getDb(collection);
    if (!db) return { success: false, error: `Invalid collection: ${collection}` };

    const { id: _id, createdAt: _c, updatedAt: _u, ...safeData } = data;

    const now = new Date().toISOString();
    const record: DatabaseRecord = {
      id: randomUUID(),
      ...safeData,
      createdAt: now,
      updatedAt: now,
    };
    db.data.records.push(record);
    db.write();
    return { success: true, data: record };
  }

  read(collection: CollectionName, id: string): CrudResult<DatabaseRecord> {
    const db = this.getDb(collection);
    if (!db) return { success: false, error: `Invalid collection: ${collection}` };

    const record = db.data.records.find((r) => r.id === id);
    if (!record) return { success: false, error: `Record not found: ${id}` };

    return { success: true, data: record };
  }

  list(collection: CollectionName, options?: QueryOptions): CrudResult<DatabaseRecord[]> {
    const db = this.getDb(collection);
    if (!db) return { success: false, error: `Invalid collection: ${collection}` };

    let records = [...db.data.records];

    if (options?.where && Object.keys(options.where).length > 0) {
      records = records.filter((record) =>
        Object.entries(options.where!).every(([key, value]) => record[key] === value),
      );
    }

    if (options?.orderBy) {
      const { field, order = "asc" } = options.orderBy;
      records.sort((a, b) => {
        const aVal = a[field] as string | number | null | undefined;
        const bVal = b[field] as string | number | null | undefined;
        if (aVal == null && bVal == null) return 0;
        if (aVal == null) return 1;
        if (bVal == null) return -1;
        if (aVal < bVal) return order === "asc" ? -1 : 1;
        if (aVal > bVal) return order === "asc" ? 1 : -1;
        return 0;
      });
    }

    const total = records.length;
    if (options?.offset != null) records = records.slice(options.offset);
    if (options?.limit != null) records = records.slice(0, options.limit);

    return { success: true, data: records, meta: { total } } as CrudResult<DatabaseRecord[]>;
  }

  update(
    collection: CollectionName,
    id: string,
    data: Record<string, any>,
  ): CrudResult<DatabaseRecord> {
    const db = this.getDb(collection);
    if (!db) return { success: false, error: `Invalid collection: ${collection}` };

    const index = db.data.records.findIndex((r) => r.id === id);
    if (index === -1) return { success: false, error: `Record not found: ${id}` };

    const { id: _id, createdAt: _createdAt, ...safeData } = data;

    const updated: DatabaseRecord = {
      ...db.data.records[index],
      ...safeData,
      id,
      createdAt: db.data.records[index].createdAt,
      updatedAt: new Date().toISOString(),
    };

    db.data.records[index] = updated;
    db.write();

    return { success: true, data: updated };
  }

  delete(collection: CollectionName, id: string): CrudResult<{ id: string }> {
    const db = this.getDb(collection);
    if (!db) return { success: false, error: `Invalid collection: ${collection}` };

    const index = db.data.records.findIndex((r) => r.id === id);
    if (index === -1) return { success: false, error: `Record not found: ${id}` };

    db.data.records.splice(index, 1);
    db.write();

    return { success: true, data: { id } };
  }
}
