import { BackupError } from '@/domain/backup/BackupError';

const API = 'https://www.googleapis.com/drive/v3';
const UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3';
const FILE_FIELDS = 'id,modifiedTime';

export interface DriveFileMeta {
  id: string;
  modifiedTime: string;
}

export interface DriveAuth {
  getAccessToken(): Promise<string>;
  /** 401 を受けたトークンを破棄する。次の getAccessToken で更新される */
  invalidateAccessToken(token: string): Promise<void>;
}

/**
 * appDataFolder 専用の最小 Drive v3 クライアント。
 * 失敗は BackupError に変換する（HTTP ステータスや本文は console にのみ出す）。
 */
export class DriveClient {
  constructor(
    private readonly auth: DriveAuth,
    private readonly fetchImpl: typeof fetch = (...args) => fetch(...args),
  ) {}

  /** appDataFolder 内の同名ファイルのうち最新のもの。無ければ null */
  async findFile(name: string): Promise<DriveFileMeta | null> {
    const q = `name='${name.replace(/'/g, "\\'")}' and trashed=false`;
    const params = new URLSearchParams({
      spaces: 'appDataFolder',
      q,
      orderBy: 'modifiedTime desc',
      pageSize: '1',
      fields: `files(${FILE_FIELDS})`,
    });
    const res = await this.request(`${API}/files?${params}`);
    const body = (await this.readJson(res)) as { files?: DriveFileMeta[] };
    return body.files?.[0] ?? null;
  }

  async createFile(name: string, json: string): Promise<DriveFileMeta> {
    const boundary = `memoez-${Date.now().toString(36)}`;
    const metadata = JSON.stringify({ name, parents: ['appDataFolder'], mimeType: 'application/json' });
    const body =
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n` +
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${json}\r\n` +
      `--${boundary}--`;
    const res = await this.request(`${UPLOAD_API}/files?uploadType=multipart&fields=${FILE_FIELDS}`, {
      method: 'POST',
      headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
      body,
    });
    return (await this.readJson(res)) as DriveFileMeta;
  }

  async updateFile(id: string, json: string): Promise<DriveFileMeta> {
    const res = await this.request(
      `${UPLOAD_API}/files/${encodeURIComponent(id)}?uploadType=media&fields=${FILE_FIELDS}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json; charset=UTF-8' },
        body: json,
      },
    );
    return (await this.readJson(res)) as DriveFileMeta;
  }

  /** ファイル本文を文字列で返す。ファイルが存在しなければ null */
  async downloadFile(id: string): Promise<string | null> {
    const res = await this.request(`${API}/files/${encodeURIComponent(id)}?alt=media`, undefined, [404]);
    if (res.status === 404) return null;
    try {
      return await res.text();
    } catch (e) {
      throw new BackupError('NETWORK', 'failed to read response body', e);
    }
  }

  private async request(url: string, init: RequestInit = {}, allowedStatuses: number[] = []): Promise<Response> {
    let token = await this.auth.getAccessToken();
    for (let attempt = 0; attempt < 2; attempt++) {
      let res: Response;
      try {
        res = await this.fetchImpl(url, {
          ...init,
          headers: { ...(init.headers as Record<string, string> | undefined), Authorization: `Bearer ${token}` },
        });
      } catch (e) {
        console.warn('[GoogleDrive] request failed', e);
        throw new BackupError('NETWORK', 'network error', e);
      }

      if (res.ok || allowedStatuses.includes(res.status)) return res;

      if (res.status === 401 && attempt === 0) {
        // トークン期限切れ。破棄して一度だけ取り直す
        await this.auth.invalidateAccessToken(token);
        token = await this.auth.getAccessToken();
        continue;
      }

      const detail = await res.text().catch(() => '');
      console.warn(`[GoogleDrive] API error ${res.status} ${url.split('?')[0]}`, detail);
      if (res.status === 401) throw new BackupError('AUTH_EXPIRED', 'unauthorized');
      throw new BackupError('API', `drive api error: ${res.status}`);
    }
    throw new BackupError('AUTH_EXPIRED', 'unauthorized');
  }

  private async readJson(res: Response): Promise<unknown> {
    try {
      return await res.json();
    } catch (e) {
      console.warn('[GoogleDrive] unexpected response body', e);
      throw new BackupError('API', 'invalid api response', e);
    }
  }
}
