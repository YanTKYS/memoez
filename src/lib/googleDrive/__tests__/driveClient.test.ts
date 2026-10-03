import { DriveClient, type DriveAuth } from '@/lib/googleDrive/driveClient';

type FetchMock = jest.Mock<Promise<Response>, [string, RequestInit?]>;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

function setup(responses: (Response | Error)[]) {
  const fetchMock: FetchMock = jest.fn();
  for (const r of responses) {
    if (r instanceof Error) fetchMock.mockRejectedValueOnce(r);
    else fetchMock.mockResolvedValueOnce(r);
  }
  let tokenSeq = 0;
  const auth: DriveAuth = {
    getAccessToken: jest.fn(async () => `token-${++tokenSeq}`),
    invalidateAccessToken: jest.fn(async () => undefined),
  };
  return { client: new DriveClient(auth, fetchMock as unknown as typeof fetch), fetchMock, auth };
}

beforeEach(() => {
  jest.spyOn(console, 'warn').mockImplementation(() => undefined);
});
afterEach(() => jest.restoreAllMocks());

describe('DriveClient', () => {
  it('finds the backup in appDataFolder only', async () => {
    const { client, fetchMock } = setup([jsonResponse({ files: [{ id: 'f1', modifiedTime: '2026-10-03T08:30:00.000Z' }] })]);

    const file = await client.findFile('memoez-backup.json');

    expect(file).toEqual({ id: 'f1', modifiedTime: '2026-10-03T08:30:00.000Z' });
    const [url, init] = fetchMock.mock.calls[0]!;
    const parsed = new URL(url);
    expect(parsed.searchParams.get('spaces')).toBe('appDataFolder');
    expect(parsed.searchParams.get('q')).toBe("name='memoez-backup.json' and trashed=false");
    expect((init!.headers as Record<string, string>).Authorization).toBe('Bearer token-1');
  });

  it('returns null when no file exists', async () => {
    const { client } = setup([jsonResponse({ files: [] })]);
    await expect(client.findFile('memoez-backup.json')).resolves.toBeNull();
  });

  it('creates the file in appDataFolder with a multipart upload', async () => {
    const { client, fetchMock } = setup([jsonResponse({ id: 'new', modifiedTime: '2026-10-03T08:30:00.000Z' })]);

    await client.createFile('memoez-backup.json', '{"version":"1.0","notes":[]}');

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toContain('uploadType=multipart');
    expect(init!.method).toBe('POST');
    expect((init!.headers as Record<string, string>)['Content-Type']).toMatch(/^multipart\/related; boundary=/);
    const body = init!.body as string;
    expect(body).toContain('"parents":["appDataFolder"]');
    expect(body).toContain('"name":"memoez-backup.json"');
    expect(body).toContain('{"version":"1.0","notes":[]}');
  });

  it('overwrites an existing file with PATCH', async () => {
    const { client, fetchMock } = setup([jsonResponse({ id: 'f1', modifiedTime: '2026-10-03T08:30:00.000Z' })]);

    await client.updateFile('f1', '{"a":1}');

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toContain('/files/f1?uploadType=media');
    expect(init!.method).toBe('PATCH');
    expect(init!.body).toBe('{"a":1}');
  });

  it('downloads file content, and returns null on 404', async () => {
    const ok = setup([new Response('{"x":1}', { status: 200 })]);
    await expect(ok.client.downloadFile('f1')).resolves.toBe('{"x":1}');

    const gone = setup([new Response('', { status: 404 })]);
    await expect(gone.client.downloadFile('f1')).resolves.toBeNull();
  });

  it('refreshes the token once on 401 and retries', async () => {
    const { client, fetchMock, auth } = setup([new Response('', { status: 401 }), jsonResponse({ files: [] })]);

    await expect(client.findFile('memoez-backup.json')).resolves.toBeNull();

    expect(auth.invalidateAccessToken).toHaveBeenCalledWith('token-1');
    expect((fetchMock.mock.calls[1]![1]!.headers as Record<string, string>).Authorization).toBe('Bearer token-2');
  });

  it('reports AUTH_EXPIRED when 401 persists', async () => {
    const { client } = setup([new Response('', { status: 401 }), new Response('', { status: 401 })]);
    await expect(client.findFile('x')).rejects.toMatchObject({ code: 'AUTH_EXPIRED' });
  });

  it('maps fetch rejection to NETWORK', async () => {
    const { client } = setup([new TypeError('Network request failed')]);
    await expect(client.findFile('x')).rejects.toMatchObject({ code: 'NETWORK' });
  });

  it.each([403, 429, 500, 503])('maps HTTP %i to API without leaking the status', async (status) => {
    const { client } = setup([new Response('{"error":"details"}', { status })]);
    await expect(client.findFile('x')).rejects.toMatchObject({ code: 'API' });
  });

  it('maps an unparsable success body to API', async () => {
    const { client } = setup([new Response('<html>', { status: 200 })]);
    await expect(client.findFile('x')).rejects.toMatchObject({ code: 'API' });
  });
});
