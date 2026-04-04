import { eq, desc, isNull, and, or, like, sql } from 'drizzle-orm';
import type { ExpoSQLiteDatabase } from 'drizzle-orm/expo-sqlite';
import * as schema from '../db/schema';
import { notes, checklistItems, noteLabels, labels } from '../db/schema';
import type { INoteRepository, CreateNoteInput, UpdateNoteInput } from '@/domain/repositories/INoteRepository';
import type { Note, NoteColor } from '@/domain/entities/Note';
import { toNote, toLabel, toChecklistItem } from '../mappers/noteMapper';

type DB = ExpoSQLiteDatabase<typeof schema>;

export class DrizzleNoteRepository implements INoteRepository {
  constructor(private readonly db: DB) {}

  // ─── private helper ─────────────────────────────────────────────────────────

  /** note行 + 関連データを一括取得して Note エンティティに変換 */
  private async hydrateNotes(noteRows: (typeof notes.$inferSelect)[]): Promise<Note[]> {
    if (noteRows.length === 0) return [];

    const ids = noteRows.map((n) => n.id);

    // チェックリストアイテム
    const allItems = await this.db
      .select()
      .from(checklistItems)
      .where(
        and(
          sql`${checklistItems.noteId} IN (${sql.join(ids.map(id => sql`${id}`), sql`, `)})`,
          isNull(checklistItems.deletedAt),
        ),
      )
      .orderBy(checklistItems.position);

    // ラベル (note_labels 経由)
    const allNoteLabels = await this.db
      .select({ noteId: noteLabels.noteId, label: labels })
      .from(noteLabels)
      .innerJoin(labels, eq(noteLabels.labelId, labels.id))
      .where(
        and(
          sql`${noteLabels.noteId} IN (${sql.join(ids.map(id => sql`${id}`), sql`, `)})`,
          isNull(labels.deletedAt),
        ),
      );

    return noteRows.map((row) => {
      const rowItems  = allItems.filter((i) => i.noteId === row.id);
      const rowLabels = allNoteLabels
        .filter((nl) => nl.noteId === row.id)
        .map((nl) => nl.label);
      return toNote(row, rowLabels, rowItems);
    });
  }

  // ─── public methods ──────────────────────────────────────────────────────────

  async findAll(options: { archived?: boolean } = {}): Promise<Note[]> {
    const archived = options.archived ?? false;
    const rows = await this.db
      .select()
      .from(notes)
      .where(
        and(
          isNull(notes.deletedAt),
          eq(notes.isArchived, archived),
        ),
      )
      .orderBy(desc(notes.isPinned), desc(notes.sortWeight), desc(notes.updatedAt));

    return this.hydrateNotes(rows);
  }

  async findById(id: number): Promise<Note | null> {
    const rows = await this.db
      .select()
      .from(notes)
      .where(and(eq(notes.id, id), isNull(notes.deletedAt)))
      .limit(1);

    if (rows.length === 0) return null;
    const hydrated = await this.hydrateNotes(rows);
    return hydrated[0] ?? null;
  }

  async search(query: string): Promise<Note[]> {
    const q = `%${query}%`;

    // チェックリストアイテムにマッチするnote_idを取得
    const matchedItemNoteIds = await this.db
      .selectDistinct({ noteId: checklistItems.noteId })
      .from(checklistItems)
      .where(
        and(
          like(checklistItems.text, q),
          isNull(checklistItems.deletedAt),
        ),
      );

    const itemNoteIds = matchedItemNoteIds.map((r) => r.noteId);

    const rows = await this.db
      .select()
      .from(notes)
      .where(
        and(
          isNull(notes.deletedAt),
          eq(notes.isArchived, false),
          or(
            like(notes.title, q),
            like(notes.content, q),
            itemNoteIds.length > 0
              ? sql`${notes.id} IN (${sql.join(itemNoteIds.map(id => sql`${id}`), sql`, `)})`
              : sql`0`,
          ),
        ),
      )
      .orderBy(desc(notes.updatedAt));

    return this.hydrateNotes(rows);
  }

  async findByLabel(labelId: number): Promise<Note[]> {
    const matchedNoteIds = await this.db
      .select({ noteId: noteLabels.noteId })
      .from(noteLabels)
      .where(eq(noteLabels.labelId, labelId));

    if (matchedNoteIds.length === 0) return [];

    const ids = matchedNoteIds.map((r) => r.noteId);
    const rows = await this.db
      .select()
      .from(notes)
      .where(
        and(
          isNull(notes.deletedAt),
          eq(notes.isArchived, false),
          sql`${notes.id} IN (${sql.join(ids.map(id => sql`${id}`), sql`, `)})`,
        ),
      )
      .orderBy(desc(notes.isPinned), desc(notes.updatedAt));

    return this.hydrateNotes(rows);
  }

  async create(input: CreateNoteInput): Promise<Note> {
    const now = new Date();
    const maxWeight = await this.maxSortWeight();
    const result = await this.db
      .insert(notes)
      .values({
        title:      input.title,
        content:    input.content,
        type:       input.type,
        color:      input.color,
        isPinned:   false,
        isArchived: false,
        sortWeight: maxWeight + 1000,
        createdAt:  now,
        updatedAt:  now,
        // 将来の同期拡張ポイント:
        // serverId: uuid() ← クライアント側でUUIDを生成しておくと
        // オフライン作成 → 後でサーバーに push が容易になる
      })
      .returning();

    const row = result[0];
    if (!row) throw new Error('Failed to create note');
    return toNote(row);
  }

  async update(id: number, input: UpdateNoteInput): Promise<Note> {
    const now = new Date();
    await this.db
      .update(notes)
      .set({ ...input, updatedAt: now })
      .where(eq(notes.id, id));

    const note = await this.findById(id);
    if (!note) throw new Error(`Note ${id} not found after update`);
    return note;
  }

  async togglePin(id: number): Promise<Note> {
    const rows = await this.db.select().from(notes).where(eq(notes.id, id)).limit(1);
    const row = rows[0];
    if (!row) throw new Error(`Note ${id} not found`);
    await this.db
      .update(notes)
      .set({ isPinned: !row.isPinned, updatedAt: new Date() })
      .where(eq(notes.id, id));
    const updated = await this.findById(id);
    if (!updated) throw new Error(`Note ${id} not found after togglePin`);
    return updated;
  }

  async toggleArchive(id: number): Promise<Note> {
    const rows = await this.db.select().from(notes).where(eq(notes.id, id)).limit(1);
    const row = rows[0];
    if (!row) throw new Error(`Note ${id} not found`);
    await this.db
      .update(notes)
      .set({ isArchived: !row.isArchived, updatedAt: new Date() })
      .where(eq(notes.id, id));
    const updated = await this.findById(id);
    if (!updated) throw new Error(`Note ${id} not found after toggleArchive`);
    return updated;
  }

  async updateColor(id: number, color: NoteColor): Promise<Note> {
    return this.update(id, { color });
  }

  async delete(id: number): Promise<void> {
    await this.db
      .update(notes)
      .set({ deletedAt: new Date() })
      .where(eq(notes.id, id));
    // 将来の同期拡張ポイント:
    // deletedAt が設定されたレコードは syncPendingChanges() で
    // サーバーに DELETE リクエストを送信し、応答後に hardDelete() する
  }

  async hardDelete(id: number): Promise<void> {
    await this.db.delete(notes).where(eq(notes.id, id));
  }

  async attachLabel(noteId: number, labelId: number): Promise<void> {
    await this.db
      .insert(noteLabels)
      .values({ noteId, labelId })
      .onConflictDoNothing();
  }

  async detachLabel(noteId: number, labelId: number): Promise<void> {
    await this.db
      .delete(noteLabels)
      .where(and(eq(noteLabels.noteId, noteId), eq(noteLabels.labelId, labelId)));
  }

  async updateChecklistItems(
    noteId: number,
    items: Array<{ id?: number; text: string; isChecked: boolean; position: number }>,
  ): Promise<void> {
    const now = new Date();

    // 既存アイテムを全て論理削除してから再挿入するシンプル方式
    await this.db
      .update(checklistItems)
      .set({ deletedAt: now })
      .where(and(eq(checklistItems.noteId, noteId), isNull(checklistItems.deletedAt)));

    if (items.length > 0) {
      await this.db.insert(checklistItems).values(
        items.map((item, i) => ({
          noteId,
          text:      item.text,
          isChecked: item.isChecked,
          position:  item.position ?? i * 1000,
          createdAt: now,
        })),
      );
    }

    // note の updatedAt を更新
    await this.db
      .update(notes)
      .set({ updatedAt: now })
      .where(eq(notes.id, noteId));
  }

  async maxSortWeight(): Promise<number> {
    const result = await this.db
      .select({ max: sql<number>`MAX(${notes.sortWeight})` })
      .from(notes)
      .where(isNull(notes.deletedAt));
    return result[0]?.max ?? 0;
  }
}
