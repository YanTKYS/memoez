import { initDatabase } from '@/data/db/client';

const mockOpenDatabaseSync = jest.fn();

jest.mock('expo-sqlite', () => ({
  openDatabaseSync: (...args: unknown[]) => mockOpenDatabaseSync(...args),
}));

jest.mock('drizzle-orm/expo-sqlite', () => ({
  // migrateServerIds() が呼ぶ select().from().where() だけを用意する
  drizzle: () => ({ select: () => ({ from: () => ({ where: async () => [] }) }) }),
}));

function fakeSqlite() {
  return {
    execSync: jest.fn(),
    getAllSync: () => [{ name: 'due_at' }, { name: 'reminder_at' }],
  };
}

describe('initDatabase', () => {
  it('opens the database once even when the app and the widget window both start it', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    // 1 回目は失敗（再試行できること）
    mockOpenDatabaseSync.mockImplementationOnce(() => { throw new Error('locked'); });
    let failed = false;
    try {
      await initDatabase();
    } catch {
      failed = true;
    }
    expect(failed).toBe(true);

    mockOpenDatabaseSync.mockImplementation(() => fakeSqlite());
    await Promise.all([initDatabase(), initDatabase()]);
    await initDatabase();

    // 失敗 1 回 + 成功 1 回。成功後は初期化結果を共有する
    expect(mockOpenDatabaseSync).toHaveBeenCalledTimes(2);
    jest.restoreAllMocks();
  });
});
