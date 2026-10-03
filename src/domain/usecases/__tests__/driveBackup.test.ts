import { BackupError, toUserMessage } from '@/domain/backup/BackupError';
import type { IRemoteBackupStore, RemoteBackupInfo } from '@/domain/backup/IRemoteBackupStore';
import { exportBackupJson } from '@/domain/usecases/backupJson';
import { backupToRemote, restoreFromRemote } from '@/domain/usecases/driveBackup';
import { FakeLabelRepo, FakeNoteRepo } from '@/domain/usecases/testing/fakeRepos';

class FakeStore implements IRemoteBackupStore {
  stored: string | null = null;
  uploadError: BackupError | null = null;
  downloadError: BackupError | null = null;
  modifiedAt = new Date('2026-10-03T08:30:00.000Z');

  async upload(json: string): Promise<RemoteBackupInfo> {
    if (this.uploadError) throw this.uploadError;
    this.stored = json;
    return { modifiedAt: this.modifiedAt };
  }
  async download() {
    if (this.downloadError) throw this.downloadError;
    if (this.stored === null) throw new BackupError('NO_BACKUP', 'none');
    return { json: this.stored, modifiedAt: this.modifiedAt };
  }
  async getInfo(): Promise<RemoteBackupInfo | null> {
    return this.stored === null ? null : { modifiedAt: this.modifiedAt };
  }
}

describe('backupToRemote', () => {
  it('uploads the same JSON that the file backup produces', async () => {
    const noteRepo = new FakeNoteRepo();
    await noteRepo.create({ title: 'A', content: 'B', type: 'TEXT', color: 'NONE' });
    const store = new FakeStore();

    const info = await backupToRemote({ noteRepo, store });

    expect(info.modifiedAt).toEqual(store.modifiedAt);
    const uploaded = JSON.parse(store.stored!) as { version: string; notes: { title: string }[] };
    const fileBackup = JSON.parse(await exportBackupJson(noteRepo)) as typeof uploaded;
    expect(uploaded.version).toBe('1.0');
    expect(uploaded.notes).toEqual(fileBackup.notes);
  });

  it('propagates store failures as BackupError', async () => {
    const store = new FakeStore();
    store.uploadError = new BackupError('NETWORK', 'offline');
    await expect(backupToRemote({ noteRepo: new FakeNoteRepo(), store })).rejects.toMatchObject({ code: 'NETWORK' });
  });
});

describe('restoreFromRemote', () => {
  it('restores a backup made on another device', async () => {
    const source = new FakeNoteRepo();
    await source.create({ title: 'from-drive', content: 'c', type: 'TEXT', color: 'BLUE' });
    const store = new FakeStore();
    await backupToRemote({ noteRepo: source, store });

    const noteRepo = new FakeNoteRepo();
    const result = await restoreFromRemote({ noteRepo, labelRepo: new FakeLabelRepo(), store }, 'merge');

    expect(result).toEqual({ created: 1, skipped: 0 });
    const notes = await noteRepo.findAll({ archived: false });
    expect(notes.map((n) => n.title)).toEqual(['from-drive']);
  });

  it('replaces current notes with overwrite policy', async () => {
    const source = new FakeNoteRepo();
    await source.create({ title: 'backup', content: '', type: 'TEXT', color: 'NONE' });
    const store = new FakeStore();
    await backupToRemote({ noteRepo: source, store });

    const noteRepo = new FakeNoteRepo();
    await noteRepo.create({ title: 'local', content: '', type: 'TEXT', color: 'NONE' });
    await restoreFromRemote({ noteRepo, labelRepo: new FakeLabelRepo(), store }, 'overwrite');

    const notes = await noteRepo.findAll({ archived: false });
    expect(notes.map((n) => n.title)).toEqual(['backup']);
  });

  it('reports NO_BACKUP when nothing is stored, without touching local notes', async () => {
    const noteRepo = new FakeNoteRepo();
    await noteRepo.create({ title: 'local', content: '', type: 'TEXT', color: 'NONE' });

    await expect(
      restoreFromRemote({ noteRepo, labelRepo: new FakeLabelRepo(), store: new FakeStore() }, 'overwrite'),
    ).rejects.toMatchObject({ code: 'NO_BACKUP' });
    expect((await noteRepo.findAll({ archived: false })).length).toBe(1);
  });

  it.each([
    ['broken JSON', '{bad json'],
    ['unknown version', JSON.stringify({ version: '9.9', notes: [] })],
    ['missing notes', JSON.stringify({ version: '1.0' })],
    ['not an object', 'null'],
  ])('rejects %s as INVALID_BACKUP and leaves local notes untouched', async (_label, json) => {
    const store = new FakeStore();
    store.stored = json;
    const noteRepo = new FakeNoteRepo();
    await noteRepo.create({ title: 'local', content: '', type: 'TEXT', color: 'NONE' });

    await expect(
      restoreFromRemote({ noteRepo, labelRepo: new FakeLabelRepo(), store }, 'overwrite'),
    ).rejects.toMatchObject({ code: 'INVALID_BACKUP' });

    const notes = await noteRepo.findAll({ archived: false });
    expect(notes.map((n) => n.title)).toEqual(['local']);
  });

  it('propagates download failures', async () => {
    const store = new FakeStore();
    store.downloadError = new BackupError('API', 'boom');
    await expect(
      restoreFromRemote({ noteRepo: new FakeNoteRepo(), labelRepo: new FakeLabelRepo(), store }, 'merge'),
    ).rejects.toMatchObject({ code: 'API' });
  });
});

describe('toUserMessage', () => {
  it('never exposes internal error details', () => {
    const msg = toUserMessage(new BackupError('API', 'drive api error: 403 {"reason":"forbidden"}'));
    expect(msg).not.toMatch(/403|forbidden|drive api error/);
  });

  it('falls back to a generic message for non-BackupError', () => {
    expect(toUserMessage(new TypeError('x is undefined'))).not.toMatch(/undefined/);
  });
});
