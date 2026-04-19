import type { Label } from '@/domain/entities/Label';
import type { Note } from '@/domain/entities/Note';
import type { ILabelRepository } from '@/domain/repositories/ILabelRepository';
import type { INoteRepository } from '@/domain/repositories/INoteRepository';

export type ImportPolicy = 'merge' | 'overwrite';

export interface BackupNoteItem {
  title: string;
  content: string;
  type: Note['type'];
  color: Note['color'];
  isPinned: boolean;
  isArchived: boolean;
  dueAt: string | null;
  reminderAt: string | null;
  createdAt: string;
  labels: string[];
  checklistItems: Array<{ text: string; isChecked: boolean; position: number }>;
}

export interface BackupPayload {
  version: '1.0';
  exportedAt: string;
  notes: BackupNoteItem[];
}

function toBackupItem(note: Note): BackupNoteItem {
  return {
    title: note.title,
    content: note.content,
    type: note.type,
    color: note.color,
    isPinned: note.isPinned,
    isArchived: note.isArchived,
    dueAt: note.dueAt ? note.dueAt.toISOString() : null,
    reminderAt: note.reminderAt ? note.reminderAt.toISOString() : null,
    createdAt: note.createdAt.toISOString(),
    labels: note.labels.map((l) => l.name),
    checklistItems: note.checklistItems.map((i) => ({
      text: i.text,
      isChecked: i.isChecked,
      position: i.position,
    })),
  };
}

function noteFingerprint(input: BackupNoteItem): string {
  return JSON.stringify({
    title: input.title.trim(),
    content: input.content.trim(),
    type: input.type,
    labels: [...input.labels].sort(),
    checklist: input.checklistItems.map((i) => `${i.position}:${i.text}:${i.isChecked}`),
  });
}

function parsePayload(raw: string): BackupPayload {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('JSONの解析に失敗しました');
  }

  const data = parsed as Partial<BackupPayload>;
  if (data.version !== '1.0' || !Array.isArray(data.notes)) {
    throw new Error('バックアップ形式が不正です');
  }
  return {
    version: '1.0',
    exportedAt: typeof data.exportedAt === 'string' ? data.exportedAt : new Date().toISOString(),
    notes: data.notes,
  };
}

async function ensureLabels(
  labelRepo: ILabelRepository,
  names: string[],
): Promise<Map<string, Label>> {
  const existing = await labelRepo.findAll();
  const byName = new Map(existing.map((l) => [l.name, l]));

  for (const name of names) {
    if (byName.has(name)) continue;
    const created = await labelRepo.create(name);
    byName.set(name, created);
  }
  return byName;
}

async function getAllNotes(noteRepo: INoteRepository): Promise<Note[]> {
  const active = await noteRepo.findAll({ archived: false });
  const archived = await noteRepo.findAll({ archived: true });
  return [...active, ...archived];
}

export async function exportBackupJson(noteRepo: INoteRepository): Promise<string> {
  const notes = await getAllNotes(noteRepo);
  const payload: BackupPayload = {
    version: '1.0',
    exportedAt: new Date().toISOString(),
    notes: notes.map(toBackupItem),
  };
  return JSON.stringify(payload, null, 2);
}

export async function importBackupJson(
  raw: string,
  deps: { noteRepo: INoteRepository; labelRepo: ILabelRepository },
  policy: ImportPolicy,
): Promise<{ created: number; skipped: number }> {
  const { noteRepo, labelRepo } = deps;
  const payload = parsePayload(raw);

  if (policy === 'overwrite') {
    const existing = await getAllNotes(noteRepo);
    for (const note of existing) {
      await noteRepo.delete(note.id);
    }
  }

  const existingAfterPolicy = await getAllNotes(noteRepo);
  const existingFingerprints = new Set(existingAfterPolicy.map((n) => noteFingerprint(toBackupItem(n))));

  const allLabelNames = [...new Set(payload.notes.flatMap((n) => n.labels))];
  const labelMap = await ensureLabels(labelRepo, allLabelNames);

  let created = 0;
  let skipped = 0;

  for (const item of payload.notes) {
    const fingerprint = noteFingerprint(item);
    if (policy === 'merge' && existingFingerprints.has(fingerprint)) {
      skipped += 1;
      continue;
    }

    const createdNote = await noteRepo.create({
      title: item.title,
      content: item.content,
      type: item.type,
      color: item.color,
      dueAt: item.dueAt ? new Date(item.dueAt) : null,
      reminderAt: item.reminderAt ? new Date(item.reminderAt) : null,
    });

    if (item.type === 'CHECKLIST' && item.checklistItems.length > 0) {
      await noteRepo.updateChecklistItems(
        createdNote.id,
        item.checklistItems.map((i) => ({ ...i })),
      );
    }

    for (const labelName of item.labels) {
      const label = labelMap.get(labelName);
      if (!label) continue;
      await noteRepo.attachLabel(createdNote.id, label.id);
    }

    if (item.isPinned) {
      await noteRepo.togglePin(createdNote.id);
    }
    if (item.isArchived) {
      await noteRepo.toggleArchive(createdNote.id);
    }

    created += 1;
    existingFingerprints.add(fingerprint);
  }

  return { created, skipped };
}
