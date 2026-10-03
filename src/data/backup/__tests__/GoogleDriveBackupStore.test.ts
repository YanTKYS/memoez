import { GoogleDriveBackupStore } from '@/data/backup/GoogleDriveBackupStore';
import type { DriveClient, DriveFileMeta } from '@/lib/googleDrive/driveClient';

const META: DriveFileMeta = { id: 'f1', modifiedTime: '2026-10-03T08:30:00.000Z' };

function fakeClient(overrides: Partial<Record<keyof DriveClient, jest.Mock>> = {}) {
  const client = {
    findFile: jest.fn().mockResolvedValue(null),
    createFile: jest.fn().mockResolvedValue(META),
    updateFile: jest.fn().mockResolvedValue(META),
    downloadFile: jest.fn().mockResolvedValue('{}'),
    ...overrides,
  };
  return { client, store: new GoogleDriveBackupStore(client as unknown as DriveClient) };
}

describe('GoogleDriveBackupStore', () => {
  it('creates memoez-backup.json when none exists', async () => {
    const { client, store } = fakeClient();

    const info = await store.upload('{"v":1}');

    expect(client.createFile).toHaveBeenCalledWith('memoez-backup.json', '{"v":1}');
    expect(client.updateFile).not.toHaveBeenCalled();
    expect(info.modifiedAt).toEqual(new Date(META.modifiedTime));
  });

  it('overwrites the existing file instead of creating another', async () => {
    const { client, store } = fakeClient({ findFile: jest.fn().mockResolvedValue(META) });

    await store.upload('{"v":2}');

    expect(client.updateFile).toHaveBeenCalledWith('f1', '{"v":2}');
    expect(client.createFile).not.toHaveBeenCalled();
  });

  it('downloads the backup with its modified time', async () => {
    const { store } = fakeClient({
      findFile: jest.fn().mockResolvedValue(META),
      downloadFile: jest.fn().mockResolvedValue('{"v":3}'),
    });
    await expect(store.download()).resolves.toEqual({ json: '{"v":3}', modifiedAt: new Date(META.modifiedTime) });
  });

  it('reports NO_BACKUP when the file is missing or vanished', async () => {
    await expect(fakeClient().store.download()).rejects.toMatchObject({ code: 'NO_BACKUP' });

    const vanished = fakeClient({ findFile: jest.fn().mockResolvedValue(META), downloadFile: jest.fn().mockResolvedValue(null) });
    await expect(vanished.store.download()).rejects.toMatchObject({ code: 'NO_BACKUP' });
  });

  it('getInfo returns null when there is no backup', async () => {
    await expect(fakeClient().store.getInfo()).resolves.toBeNull();
  });

  it('rejects a malformed modifiedTime as API error', async () => {
    const { store } = fakeClient({ findFile: jest.fn().mockResolvedValue({ id: 'f1', modifiedTime: 'garbage' }) });
    await expect(store.getInfo()).rejects.toMatchObject({ code: 'API' });
  });
});
