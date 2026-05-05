/**
 * SignalHistoryClient interacts with db.sqlite, the file where Signal Desktop stores
 * information about conversations.
 *
 * The file is encrypted with SQLCipher 4. The 256-bit key is itself stored
 * encrypted in Signal's `config.json` under `encryptedKey`, wrapped by Chromium
 * OSCrypt (which Electron exposes as `safeStorage`).
 *
 * Why we don't use `safeStorage.decryptString` directly: Electron's safeStorage
 * is namespaced per app — each app gets its own keychain entry (e.g. "Electron
 * Safe Storage"). Calling `safeStorage.decryptString` on a blob Signal wrote
 * fails with "Error while decrypting the ciphertext", because we're trying to
 * decrypt with the wrong key. We replicate the OSCrypt v10 scheme manually,
 * reading the password from Signal's own keychain entry.
 *
 * Backend: `better-sqlite3-multiple-ciphers`. The originally-used
 * `@journeyapps/sqlcipher` ships an old SQLite (3.33.0) that cannot parse
 * Signal's current `messages` DDL (uses JSON arrow operators `->>` / `->`
 * which need SQLite 3.38+).
 */
import { execFileSync } from 'child_process';
import { createDecipheriv, pbkdf2Sync } from 'crypto';
import fs from 'fs';
import os from 'os';
import { performance } from 'perf_hooks';

import Database from 'better-sqlite3-multiple-ciphers';

import {
  FaultyManualConnectionManagementError,
  UnauthorizedConnectionManagementError,
} from './SignalHistoryClientError';
import { Conversation, GroupMessageJson, Message } from './signal.types';

export interface SignalConfigJsonContents {
  encryptedKey: string;
  mediaPermissions?: boolean;
  mediaCameraPermissions?: boolean;
}

async function readJsonFile<T extends unknown>(path: string) {
  try {
    const file = await fs.promises.readFile(path, 'utf8');

    const data: T = JSON.parse(file);

    return [null, data] as const;
  } catch (err) {
    return [err, null] as const;
  }
}

/**
 * Decrypt a Chromium OSCrypt v10 blob. Format on macOS:
 *   3-byte 'v10' prefix + AES-128-CBC ciphertext
 *   key = PBKDF2-SHA1(password, salt='saltysalt', iter=1003, keylen=16)
 *   iv  = ' ' * 16  (0x20 * 16)
 */
function decryptOSCryptV10(blob: Buffer, password: string): string {
  const prefix = blob.slice(0, 3).toString('utf8');
  if (prefix !== 'v10') {
    throw new Error(`unexpected OSCrypt prefix: ${JSON.stringify(prefix)}`);
  }
  const ciphertext = blob.slice(3);
  const key = pbkdf2Sync(password, 'saltysalt', 1003, 16, 'sha1');
  const iv = Buffer.alloc(16, 0x20);
  const decipher = createDecipheriv('aes-128-cbc', key, iv);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString(
    'utf8'
  );
}

/**
 * Read the OSCrypt password Signal stored in the OS credential store. On
 * macOS this is in the login keychain under "Signal Safe Storage / Signal Key";
 * the first time `security` accesses it the user gets a prompt and can click
 * "Always Allow" so subsequent calls are silent.
 */
function readSignalSafeStoragePassword(): string {
  const platform = os.platform();
  if (platform !== 'darwin') {
    throw new Error(
      `signal safe-storage password retrieval not yet implemented on ${platform}`
    );
  }
  return execFileSync(
    'security',
    [
      'find-generic-password',
      '-s',
      'Signal Safe Storage',
      '-a',
      'Signal Key',
      '-w',
    ],
    { encoding: 'utf8' }
  ).trim();
}

/** util types for SignalHistoryClient.getAllMessages */
interface MessageOptionFields {
  parseJson: { jsonData: GroupMessageJson };
  includeMemberInfo: { sender: { id: string; name: string } };
}
type GetAllMessagesOptions = Partial<
  Record<keyof MessageOptionFields, boolean>
>;

type ApplyOptions<T, U> = T extends true ? U : {};

export type MessageWithOptions<
  T extends GetAllMessagesOptions = GetAllMessagesOptions
> = Message &
  ApplyOptions<T['parseJson'], { jsonData: GroupMessageJson }> &
  ApplyOptions<
    T['includeMemberInfo'],
    { sender: { id: string; name: string } }
  >;

export const getPossibleSignalAppDataDirectory = (): string => {
  const platform = os.platform();
  const homeDir = os.homedir();

  if (platform === 'darwin') {
    return `${homeDir}/Library/Application Support/Signal`;
  } else if (platform === 'win32') {
    const appData = process.env.APPDATA || `${homeDir}/AppData/Roaming`;
    return `${appData}/Signal`;
  } else {
    return `${homeDir}/.config/Signal`;
  }
};
const DEFAULT_DB_SQLITE_PATH =
  getPossibleSignalAppDataDirectory() + '/sql/db.sqlite';
const DEFAULT_CONFIG_JSON_PATH =
  getPossibleSignalAppDataDirectory() + '/config.json';

export default class SignalHistoryClient {
  dbSqlitePath = '';
  configJsonPath = '';
  private db: Database.Database | null = null;
  manuallyManageConnectionPleaseReadTheDocsOnThis = false;
  numberOfPastConnections = 0;
  private connectedUnixTime = 0;

  isConnected = false;

  constructor({
    dbSqlitePath = DEFAULT_DB_SQLITE_PATH,
    configJsonPath = DEFAULT_CONFIG_JSON_PATH,
    manuallyManageConnectionPleaseReadTheDocsOnThis = false,
  } = {}) {
    this.dbSqlitePath = dbSqlitePath;
    this.configJsonPath = configJsonPath;
    this.manuallyManageConnectionPleaseReadTheDocsOnThis =
      manuallyManageConnectionPleaseReadTheDocsOnThis;
  }
  async connect() {
    if (!this.manuallyManageConnectionPleaseReadTheDocsOnThis)
      throw new UnauthorizedConnectionManagementError();
    return await this._connect();
  }
  async disconnect() {
    if (!this.manuallyManageConnectionPleaseReadTheDocsOnThis)
      throw new UnauthorizedConnectionManagementError();
    return await this._disconnect();
  }
  private async _connect() {
    const startTime = performance.now();
    this.connectedUnixTime = startTime;

    const [configErr, configData] =
      await readJsonFile<SignalConfigJsonContents>(this.configJsonPath);

    if (configErr != null)
      throw new Error(
        `[signal-history-client] FATAL error trying to read signal config.json at "${this.configJsonPath}": ${configErr}`
      );

    const { encryptedKey } = configData!;

    if (!encryptedKey) {
      throw new Error(
        `[signal-history-client] FATAL error: property "encryptedKey" not found in "${this.configJsonPath}"`
      );
    }

    const password = readSignalSafeStoragePassword();
    const decryptedKey = decryptOSCryptV10(
      Buffer.from(encryptedKey, 'hex'),
      password
    );

    // Open read-only — we never write to Signal's database.
    this.db = new Database(this.dbSqlitePath, {
      readonly: true,
      fileMustExist: true,
      timeout: 5000,
    });

    // SQLCipher 4 compatibility via SQLite Multiple Ciphers' `legacy = 4` mode.
    this.db.pragma('cipher = sqlcipher');
    this.db.pragma('legacy = 4');
    this.db.pragma(`key = "x'${decryptedKey}'"`);

    // Touch the schema to fail fast if the key is wrong (otherwise the
    // first query would surface the error in a less obvious way).
    this.db.prepare('SELECT 1 FROM sqlite_master LIMIT 1').get();

    const elapsedTime = Math.round(performance.now() - startTime);
    console.info(`[signal-history-client] connected in ${elapsedTime}ms`);
    this.isConnected = true;
    this.numberOfPastConnections += 1;
  }
  private async _disconnect() {
    const startTime = performance.now();
    this.db?.close();
    const endTime = performance.now();
    const elapsedTime = Math.round(endTime - startTime);
    const elapsedTimeSinceConnectionOpened = Math.round(
      endTime - this.connectedUnixTime
    );
    console.info(
      `[signal-history-client] disconnected in ${elapsedTime}ms after being open for ${elapsedTimeSinceConnectionOpened}ms`
    );
    this.isConnected = false;
    this.db = null;
  }
  async _dbAll<T extends unknown>(
    query: string
  ): Promise<[null, T[]] | [unknown, []]> {
    if (!this.isConnected) {
      if (this.manuallyManageConnectionPleaseReadTheDocsOnThis)
        throw new FaultyManualConnectionManagementError('');
      await this._connect();
    }

    let result: [null, T[]] | [unknown, []];
    try {
      const rows = this.db!.prepare(query).all() as T[];
      result = [null, rows];
    } catch (err) {
      console.error('[signal-history-client] query failed:', err);
      result = [err, []];
    }

    if (!this.manuallyManageConnectionPleaseReadTheDocsOnThis) {
      await this._disconnect();
    }
    return result;
  }
  async getDatabaseInfo() {
    const tables = await this._dbAll(
      "SELECT name FROM sqlite_schema WHERE type ='table' AND name NOT LIKE 'sqlite_%'"
    );
    const items = await this._dbAll('SELECT * from items');
    const identityKeys = await this._dbAll('SELECT * from identityKeys');
    const senderKeys = await this._dbAll('SELECT * from senderKeys');

    return { tables, identityKeys, senderKeys, items };
  }
  async getAllConversationsWithMessages() {
    const startTime = performance.now();

    const query = `
      SELECT conversations.*, (
        SELECT COUNT(*) FROM messages WHERE messages.conversationId = conversations.id
      ) AS numMessages
      FROM conversations;
    `;

    const queryRes = await this._dbAll<Conversation>(query);

    const elapsedTime = Math.round(performance.now() - startTime);
    console.info(
      `[signal-history-client] getAllConversationsWithMessages in ${elapsedTime}ms`
    );
    return queryRes;
  }
  async getAllConversations() {
    const startTime = performance.now();
    const queryRes = await this._dbAll<Conversation>(
      'SELECT * FROM conversations'
    );
    const elapsedTime = Math.round(performance.now() - startTime);
    console.info(
      `[signal-history-client] getAllConversations in ${elapsedTime}ms`
    );
    return queryRes;
  }
  /**
   * @param {string} [options.parseJson=false] - whether to include the `jsonData` field in each message (no performance loss)
   * @param {string} [options.includeMemberInfo=false] - whether to include the `sender` field in each message (high performance loss)
   */
  async getAllMessages<T extends GetAllMessagesOptions = GetAllMessagesOptions>(
    conversationId: string,
    options: T = {} as T
  ): Promise<[null, Array<MessageWithOptions<T>>] | [unknown, []]> {
    const startTime = performance.now();

    const { parseJson = false, includeMemberInfo = false } = options;

    const [messagesErr, messages] = await this._dbAll<Message>(
      `SELECT * from messages WHERE conversationId = '${conversationId}'`
    );
    if (messagesErr || !messages) {
      return [messagesErr, []];
    }

    if (includeMemberInfo) {
      const [conversationsErr, conversations] =
        await this.getAllConversations();

      if (conversationsErr != null) {
        return [conversationsErr, []];
      }

      // @ts-ignore
      const convoInfo = conversations!.reduce<
        Record<string, { id: string; name: string }>
      >(
        (obj, convo) => ({
          ...obj,
          [convo.uuid ?? convo.groupId]: {
            id: convo.uuid ?? convo.groupId,
            name: convo.name!,
          },
        }),
        {}
      );

      for (const message of messages) {
        (message as Message & MessageOptionFields['includeMemberInfo']).sender =
          convoInfo[message.sourceUuid];
      }
    }
    if (parseJson) {
      for (const message of messages) {
        const jsonData = JSON.parse(message.json) as GroupMessageJson;

        (message as Message & MessageOptionFields['parseJson']).jsonData =
          jsonData;
      }
    }
    const elapsedTime = Math.round(performance.now() - startTime);
    console.info(`[signal-history-client] getAllMessages in ${elapsedTime}ms`);

    return [null, messages as Array<MessageWithOptions<T>>];
  }
}
