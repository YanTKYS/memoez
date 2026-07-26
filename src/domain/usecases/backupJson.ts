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
  checklistItems: { text: string; isChecked: boolean; position: number }[];
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

const NOTE_TYPES: readonly Note['type'][] = ['TEXT', 'CHECKLIST'];
const NOTE_COLORS: readonly Note['color'][] = [
  'NONE', 'RED', 'ORANGE', 'YELLOW', 'GREEN', 'TEAL', 'BLUE', 'PURPLE',
];

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function asIsoDateOrNull(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? null : value;
}

/**
 * 外部ファイル由来の 1 件を安全な形に正規化する。
 * 途中で例外が飛ぶとインポートが中断され、DB が中途半端な状態で残るため
 * 欠損・型違いは既定値で埋める。
 */
export function normalizeBackupItem(raw: unknown): BackupNoteItem {
  const item = (raw ?? {}) as Record<string, unknown>;
  const type = NOTE_TYPES.find((t) => t === item.type) ?? 'TEXT';
  const color = NOTE_COLORS.find((c) => c === item.color) ?? 'NONE';
  const labels = Array.isArray(item.labels)
    ? item.labels.filter((l): l is string => typeof l === 'string' && l.trim() !== '')
    : [];
  const checklistItems = Array.isArray(item.checklistItems)
    ? item.checklistItems.map((entry, idx) => {
        const i = (entry ?? {}) as Record<string, unknown>;
        return {
          text: asString(i.text),
          isChecked: i.isChecked === true,
          position: typeof i.position === 'number' && Number.isFinite(i.position)
            ? i.position
            : idx * 1000,
        };
      })
    : [];

  return {
    title: asString(item.title),
    content: asString(item.content),
    type,
    color,
    isPinned: item.isPinned === true,
    isArchived: item.isArchived === true,
    dueAt: asIsoDateOrNull(item.dueAt),
    reminderAt: asIsoDateOrNull(item.reminderAt),
    createdAt: asIsoDateOrNull(item.createdAt) ?? new Date().toISOString(),
    labels,
    checklistItems,
  };
}

function parsePayload(raw: string): BackupPayload {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('JSONの解析に失敗しました');
  }

  const data = (parsed ?? {}) as Partial<BackupPayload>;
  if (data.version !== '1.0' || !Array.isArray(data.notes)) {
    throw new Error('バックアップ形式が不正です');
  }
  return {
    version: '1.0',
    exportedAt: typeof data.exportedAt === 'string' ? data.exportedAt : new Date().toISOString(),
    notes: data.notes.map(normalizeBackupItem),
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
