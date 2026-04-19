import type { Label } from '@/domain/entities/Label';
import type { Note } from '@/domain/entities/Note';
import type { ILabelRepository } from '@/domain/repositories/ILabelRepository';
import type { INoteRepository, CreateNoteInput, UpdateNoteInput } from '@/domain/repositories/INoteRepository';
import { exportBackupJson, importBackupJson } from '@/domain/usecases/backupJson';

class FakeLabelRepo implements ILabelRepository {
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

class FakeNoteRepo implements INoteRepository {
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
  async updateChecklistItems(noteId: number, items: Array<{ id?: number; text: string; isChecked: boolean; position: number }>): Promise<Note> {
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

describe('backupJson usecase', () => {
  it('exports notes to backup payload', async () => {
    const noteRepo = new FakeNoteRepo();
    const created = await noteRepo.create({ title: 'A', content: 'B', type: 'TEXT', color: 'NONE' });
    await noteRepo.toggleArchive(created.id);

    const json = await exportBackupJson(noteRepo);
    const parsed = JSON.parse(json) as { version: string; notes: unknown[] };
    expect(parsed.version).toBe('1.0');
    expect(parsed.notes.length).toBe(1);
  });

  it('imports with merge policy and skips duplicated fingerprint', async () => {
    const noteRepo = new FakeNoteRepo();
    const labelRepo = new FakeLabelRepo();
    await noteRepo.create({ title: 'N1', content: '', type: 'TEXT', color: 'NONE' });

    const payload = JSON.stringify({
      version: '1.0',
      exportedAt: new Date().toISOString(),
      notes: [{ title: 'N1', content: '', type: 'TEXT', color: 'NONE', isPinned: false, isArchived: false, dueAt: null, reminderAt: null, createdAt: '2026-04-19T00:00:00.000Z', labels: [], checklistItems: [] }],
    });

    const result = await importBackupJson(payload, { noteRepo, labelRepo }, 'merge');
    expect(result.created).toBe(0);
    expect(result.skipped).toBe(1);

    const result2 = await importBackupJson(payload, { noteRepo, labelRepo }, 'merge');
    expect(result2.skipped).toBe(1);
  });

  it('imports with overwrite policy after deleting existing notes', async () => {
    const noteRepo = new FakeNoteRepo();
    const labelRepo = new FakeLabelRepo();
    await noteRepo.create({ title: 'old', content: '', type: 'TEXT', color: 'NONE' });

    const payload = JSON.stringify({
      version: '1.0',
      exportedAt: new Date().toISOString(),
      notes: [{ title: 'new', content: 'c', type: 'TEXT', color: 'NONE', isPinned: false, isArchived: false, dueAt: null, reminderAt: null, createdAt: '2026-04-19T00:00:00.000Z', labels: [], checklistItems: [] }],
    });

    const result = await importBackupJson(payload, { noteRepo, labelRepo }, 'overwrite');
    expect(result.created).toBe(1);

    const active = await noteRepo.findAll({ archived: false });
    expect(active.length).toBe(1);
    expect(active[0]?.title).toBe('new');
  });

  it('throws for broken JSON or invalid payload shape', async () => {
    const noteRepo = new FakeNoteRepo();
    const labelRepo = new FakeLabelRepo();

    let parseError = '';
    try {
      await importBackupJson('{bad json', { noteRepo, labelRepo }, 'merge');
    } catch (e) {
      parseError = (e as Error).message;
    }
    expect(parseError).toBe('JSONの解析に失敗しました');

    let shapeError = '';
    try {
      await importBackupJson(JSON.stringify({ version: '0.9', notes: [] }), { noteRepo, labelRepo }, 'merge');
    } catch (e) {
      shapeError = (e as Error).message;
    }
    expect(shapeError).toBe('バックアップ形式が不正です');
  });
});
