import { exportBackupJson, importBackupJson, normalizeBackupItem } from '@/domain/usecases/backupJson';
import { FakeLabelRepo, FakeNoteRepo } from '@/domain/usecases/testing/fakeRepos';

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

  it('imports notes whose fields are missing or of the wrong type', async () => {
    const noteRepo = new FakeNoteRepo();
    const labelRepo = new FakeLabelRepo();

    const payload = JSON.stringify({
      version: '1.0',
      notes: [
        {},
        { title: 'B', type: 'UNKNOWN', color: 'MAGENTA', labels: ['ok', 42], checklistItems: 'nope' },
        { title: 'C', type: 'CHECKLIST', checklistItems: [{ text: 'item' }], dueAt: 'not-a-date' },
      ],
    });

    const result = await importBackupJson(payload, { noteRepo, labelRepo }, 'merge');
    expect(result.created).toBe(3);

    const notes = await noteRepo.findAll({ archived: false });
    expect(notes.map((n) => n.type)).toEqual(['TEXT', 'TEXT', 'CHECKLIST']);
    expect(notes.map((n) => n.color)).toEqual(['NONE', 'NONE', 'NONE']);
    expect(notes[1]?.labels.length).toBe(1);
    expect(notes[2]?.dueAt).toBe(null);
    expect(notes[2]?.checklistItems[0]?.text).toBe('item');
  });
});

describe('normalizeBackupItem', () => {
  it('falls back to safe defaults for a completely empty object', () => {
    const item = normalizeBackupItem({});
    expect(item.title).toBe('');
    expect(item.type).toBe('TEXT');
    expect(item.color).toBe('NONE');
    expect(item.isPinned).toBe(false);
    expect(item.labels).toEqual([]);
    expect(item.checklistItems).toEqual([]);
    expect(Number.isNaN(new Date(item.createdAt).getTime())).toBe(false);
  });

  it('keeps valid values as-is', () => {
    const item = normalizeBackupItem({
      title: 'T',
      content: 'C',
      type: 'CHECKLIST',
      color: 'BLUE',
      isPinned: true,
      isArchived: true,
      dueAt: '2026-04-19T00:00:00.000Z',
      labels: ['x'],
      checklistItems: [{ text: 'a', isChecked: true, position: 500 }],
    });
    expect(item).toMatchObject({
      title: 'T',
      content: 'C',
      type: 'CHECKLIST',
      color: 'BLUE',
      isPinned: true,
      isArchived: true,
      dueAt: '2026-04-19T00:00:00.000Z',
      labels: ['x'],
      checklistItems: [{ text: 'a', isChecked: true, position: 500 }],
    });
  });

  it('assigns positions to checklist items that lack them', () => {
    const item = normalizeBackupItem({ checklistItems: [{ text: 'a' }, { text: 'b' }] });
    expect(item.checklistItems.map((i) => i.position)).toEqual([0, 1000]);
  });
});
