import type { Note, NoteColor, NoteType } from '../entities/Note';

export interface CreateNoteInput {
  title:   string;
  content: string;
  type:    NoteType;
  color:   NoteColor;
}

export interface UpdateNoteInput {
  title?:   string;
  content?: string;
  color?:   NoteColor;
  type?:    NoteType;
}

export interface INoteRepository {
  findAll(options?: { archived?: boolean }): Promise<Note[]>;
  findById(id: number): Promise<Note | null>;
  search(query: string): Promise<Note[]>;
  findByLabel(labelId: number): Promise<Note[]>;
  create(input: CreateNoteInput): Promise<Note>;
  update(id: number, input: UpdateNoteInput): Promise<Note>;
  /** ピン留め状態を反転する */
  togglePin(id: number): Promise<Note>;
  toggleArchive(id: number): Promise<Note>;
  updateColor(id: number, color: NoteColor): Promise<Note>;
  /** 論理削除 */
  delete(id: number): Promise<void>;
  /** 物理削除 */
  hardDelete(id: number): Promise<void>;
  attachLabel(noteId: number, labelId: number): Promise<void>;
  detachLabel(noteId: number, labelId: number): Promise<void>;
  updateChecklistItems(
    noteId: number,
    items: Array<{ id?: number; text: string; isChecked: boolean; position: number }>,
  ): Promise<void>;
  maxSortWeight(): Promise<number>;
}
