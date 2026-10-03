/** usecase テスト用のインメモリ Repository */
import type { Label } from '@/domain/entities/Label';
import type { Note } from '@/domain/entities/Note';
import type { ILabelRepository } from '@/domain/repositories/ILabelRepository';
import type { INoteRepository, CreateNoteInput, UpdateNoteInput } from '@/domain/repositories/INoteRepository';

export class FakeLabelRepo implements ILabelRepository {
  private labels: Label[] = [];
  private seq = 1;

  async findAll(): Promise<Label[]> { return [...this.labels]; }
  async findById(id: number): Promise<Label | null> { return this.labels.find((l) => l.id === id) ?? null; }
  async create(name: string): Promise<Label> {
    const now = new Date();
    const label: Label = { id: this.seq++, name, createdAt: now, updatedAt: now, deletedAt: null };
    this.labels.push(label);
    return label;
  }
  async update(id: number, name: string): Promise<Label> {
    const label = this.labels.find((l) => l.id === id);
    if (!label) throw new Error('not found');
    label.name = name;
    return label;
  }
  async delete(id: number): Promise<void> {
    this.labels = this.labels.filter((l) => l.id !== id);
  }
}

export class FakeNoteRepo implements INoteRepository {
  private notes: Note[] = [];
  private seq = 1;

  async findAll(options?: { archived?: boolean }): Promise<Note[]> {
    const archived = options?.archived ?? false;
    return this.notes.filter((n) => n.isArchived === archived && n.deletedAt === null);
  }
  async findById(id: number): Promise<Note | null> { return this.notes.find((n) => n.id === id && n.deletedAt === null) ?? null; }
  async search(_query: string): Promise<Note[]> { return []; }
  async findByLabel(labelId: number): Promise<Note[]> {
    return this.notes.filter((n) => n.labels.some((l) => l.id === labelId) && n.deletedAt === null);
  }
  async create(input: CreateNoteInput): Promise<Note> {
    const now = new Date();
    const note: Note = {
      id: this.seq++,
      title: input.title,
      content: input.content,
      type: input.type,
      color: input.color,
      isPinned: false,
      isArchived: false,
      dueAt: input.dueAt ?? null,
      reminderAt: input.reminderAt ?? null,
      sortWeight: 0,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      labels: [],
      checklistItems: [],
    };
    this.notes.push(note);
    return note;
  }
  async update(id: number, input: UpdateNoteInput): Promise<Note> {
    const note = await this.findById(id);
    if (!note) throw new Error('not found');
    if (input.title !== undefined) note.title = input.title;
    if (input.content !== undefined) note.content = input.content;
    if (input.type !== undefined) note.type = input.type;
    if (input.color !== undefined) note.color = input.color;
    if (input.dueAt !== undefined) note.dueAt = input.dueAt;
    if (input.reminderAt !== undefined) note.reminderAt = input.reminderAt;
    return note;
  }
  async togglePin(id: number): Promise<Note> {
    const note = await this.findById(id);
    if (!note) throw new Error('not found');
    note.isPinned = !note.isPinned;
    return note;
  }
  async toggleArchive(id: number): Promise<Note> {
    const note = await this.findById(id);
    if (!note) throw new Error('not found');
    note.isArchived = !note.isArchived;
    return note;
  }
  async updateColor(id: number): Promise<Note> {
    const note = await this.findById(id);
    if (!note) throw new Error('not found');
    return note;
  }
  async delete(id: number): Promise<void> {
    const note = await this.findById(id);
    if (note) note.deletedAt = new Date();
  }
  async hardDelete(id: number): Promise<void> {
    this.notes = this.notes.filter((n) => n.id !== id);
  }
  async attachLabel(noteId: number, labelId: number): Promise<void> {
    const note = await this.findById(noteId);
    if (!note) return;
    note.labels.push({ id: labelId, name: `L-${labelId}`, createdAt: new Date(), updatedAt: new Date(), deletedAt: null });
  }
  async detachLabel(): Promise<void> {}
  async updateChecklistItems(noteId: number, items: { id?: number; text: string; isChecked: boolean; position: number }[]): Promise<Note> {
    const note = await this.findById(noteId);
    if (!note) throw new Error('not found');
    note.checklistItems = items.map((i, idx) => ({
      id: idx + 1,
      noteId,
      text: i.text,
      isChecked: i.isChecked,
      position: i.position,
      createdAt: new Date(),
      deletedAt: null,
    }));
    return note;
  }
  async maxSortWeight(): Promise<number> { return 0; }
}
