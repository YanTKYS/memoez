import { eq, isNull, and } from 'drizzle-orm';
import type { ExpoSQLiteDatabase } from 'drizzle-orm/expo-sqlite';
import * as schema from '../db/schema';
import { labels } from '../db/schema';
import type { ILabelRepository } from '@/domain/repositories/ILabelRepository';
import type { Label } from '@/domain/entities/Label';
import { toLabel } from '../mappers/noteMapper';

type DB = ExpoSQLiteDatabase<typeof schema>;

export class DrizzleLabelRepository implements ILabelRepository {
  constructor(private readonly db: DB) {}

  async findAll(): Promise<Label[]> {
    const rows = await this.db
      .select()
      .from(labels)
      .where(isNull(labels.deletedAt))
      .orderBy(labels.name);
    return rows.map(toLabel);
  }

  async findById(id: number): Promise<Label | null> {
    const rows = await this.db
      .select()
      .from(labels)
      .where(and(eq(labels.id, id), isNull(labels.deletedAt)))
      .limit(1);
    return rows[0] ? toLabel(rows[0]) : null;
  }

  async create(name: string): Promise<Label> {
    const now = new Date();
    const result = await this.db
      .insert(labels)
      .values({ name, createdAt: now, updatedAt: now })
      .returning();
    const row = result[0];
    if (!row) throw new Error('Failed to create label');
    return toLabel(row);
  }

  async update(id: number, name: string): Promise<Label> {
    await this.db
      .update(labels)
      .set({ name, updatedAt: new Date() })
      .where(eq(labels.id, id));
    const label = await this.findById(id);
    if (!label) throw new Error(`Label ${id} not found`);
    return label;
  }

  async delete(id: number): Promise<void> {
    await this.db
      .update(labels)
      .set({ deletedAt: new Date() })
      .where(eq(labels.id, id));
  }
}
