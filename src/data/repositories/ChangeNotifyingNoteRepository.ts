import type { INoteRepository, CreateNoteInput, UpdateNoteInput } from '@/domain/repositories/INoteRepository';
import type { Note, NoteColor } from '@/domain/entities/Note';

/**
 * 書き込み成功後に onChanged を呼ぶ INoteRepository のデコレータ。
 *
 * 編集画面・一覧・バックアップ復元など、メモを書き換える経路はすべて
 * getNoteRepository() を通るため、ここで通知すれば経路ごとに通知処理を
 * 書き足す必要がない（ウィジェット表示の更新漏れを防ぐ）。
 */
export class ChangeNotifyingNoteRepository implements INoteRepository {
  constructor(
    private readonly inner: INoteRepository,
    private readonly onChanged: () => void,
  ) {}

  private async notifying<T>(op: Promise<T>): Promise<T> {
    const result = await op;
    this.onChanged();
    return result;
  }

  // ─── 読み取り（通知なし） ────────────────────────────────────────────────
  findAll(options?: { archived?: boolean }): Promise<Note[]> { return this.inner.findAll(options); }
  findById(id: number): Promise<Note | null>                  { return this.inner.findById(id); }
  findRecent(limit: number): Promise<Note[]>                  { return this.inner.findRecent(limit); }
  search(query: string): Promise<Note[]>                      { return this.inner.search(query); }
  findByLabel(labelId: number): Promise<Note[]>               { return this.inner.findByLabel(labelId); }
  maxSortWeight(): Promise<number>                            { return this.inner.maxSortWeight(); }

  // ─── 書き込み（成功後に通知） ────────────────────────────────────────────
  create(input: CreateNoteInput): Promise<Note>               { return this.notifying(this.inner.create(input)); }
  update(id: number, input: UpdateNoteInput): Promise<Note>   { return this.notifying(this.inner.update(id, input)); }
  togglePin(id: number): Promise<Note>                        { return this.notifying(this.inner.togglePin(id)); }
  toggleArchive(id: number): Promise<Note>                    { return this.notifying(this.inner.toggleArchive(id)); }
  updateColor(id: number, color: NoteColor): Promise<Note>    { return this.notifying(this.inner.updateColor(id, color)); }
  delete(id: number): Promise<void>                           { return this.notifying(this.inner.delete(id)); }
  hardDelete(id: number): Promise<void>                       { return this.notifying(this.inner.hardDelete(id)); }
  attachLabel(noteId: number, labelId: number): Promise<void> { return this.notifying(this.inner.attachLabel(noteId, labelId)); }
  detachLabel(noteId: number, labelId: number): Promise<void> { return this.notifying(this.inner.detachLabel(noteId, labelId)); }

  updateChecklistItems(
    noteId: number,
    items: { id?: number; text: string; isChecked: boolean; position: number }[],
  ): Promise<Note> {
    return this.notifying(this.inner.updateChecklistItems(noteId, items));
  }
}
