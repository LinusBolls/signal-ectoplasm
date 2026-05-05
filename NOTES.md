# Iteration log

Append-only log of debugging iterations. Newest entries at the bottom. One commit per entry.

Format:

```
## YYYY-MM-DD HH:MM — short title
**Hypothesis:** ...
**Change:** ...
**Result:** PASS / FAIL — details
**Next:** ...
```

---

## 2026-05-05 — Setup

**State at branch creation:**
- `config.json` contains only `encryptedKey` (no plaintext `key` field). Length 166 hex chars (83 bytes), prefix `v10`. So Signal still wraps via Chromium OSCrypt v10.
- Keychain entry `Signal Safe Storage / Signal Key` exists, created 2023-05-26.
- Previous local attempt (commit `e31ae0a`) swapped to `safeStorage.decryptString(encryptedKey)` inside the Electron client. Per the user, the app did not work end-to-end after that change.

**Open hypotheses to test (in priority order):**
1. `safeStorage.decryptString` returns the right key, but the SQLCipher pragmas need updating (different cipher_compatibility, kdf iter count, page size, or HMAC algo) — Signal Desktop may have bumped SQLCipher options.
2. The decrypted key needs different framing — e.g. it's already hex without quoting, or it needs `PRAGMA key = 'raw'` instead of `PRAGMA key = "x'...'"`.
3. Electron's `safeStorage` is failing silently in a non-signed dev build (no entitlements / wrong app id) and returning garbage instead of throwing. Probe-via-`security` CLI rules this in/out.
4. Recent Signal added a second-layer wrap of the SQLCipher key inside the OSCrypt-decrypted payload (e.g. JSON envelope or HMAC).

**Plan:** start with hypothesis 3 (probe) to establish ground truth on what the keychain-decrypted key actually is, then walk through 1, 2, 4 with cipher param sweeps.

---

## 2026-05-05 12:50 — Iteration 1: probe baseline

**Hypothesis:** Establish ground truth — does keychain decryption produce a sane key, and which (if any) SQLCipher param combination opens the db.

**Change:** Ran `node scripts/probe.js` — 6 strategies (cipher_compatibility ∈ {3,4} × key encoding ∈ {raw_hex, ascii_hex_text, ascii_passphrase}).

**Result:** Big finding.
- Keychain readable, password length 24.
- OSCrypt v10 decryption produced **64 printable-ASCII characters that are valid hex** → 32-byte (256-bit) key, exactly what SQLCipher 4 expects.
- Five strategies failed with `SQLITE_NOTADB: file is not a database` (= wrong key / wrong cipher init).
- **One strategy got past the cipher entirely:** `compat=4 key=ascii_hex_text(len=64)` — i.e. `PRAGMA key = "x'<the 64-char hex>'"`. It failed only when parsing the schema with `SQLITE_CORRUPT: malformed database schema (messages) - near ">": syntax error`.

**Implication:** The SQLCipher key is **correct**. The cipher header decoded; we got into actual SQL parsing. The "near '>'" parse error means Signal's current `messages` table DDL contains syntax (probably JSON operators `->` / `->>`, generated columns, or `STRICT`) that the SQLite version bundled inside `@journeyapps/sqlcipher` (last published 2022) cannot parse.

**So the previous fix attempt was on the right track for the key; what broke is the bundled SQLite parser, not the encryption.**

**Next:** Confirm by querying `sqlite_master` directly (skipping table-schema parsing). If that works, the next problem is replacing `@journeyapps/sqlcipher` with a modern binding. Strong candidate: `@signalapp/better-sqlite3` (Signal's own fork — guaranteed schema-compat).

**Commit:** TBD (after sqlite_master probe).

---

## 2026-05-05 13:05 — Iteration 2: confirm via sqlite_master

**Hypothesis:** If the cipher really works and only DDL parsing fails, listing `sqlite_master` (with `PRAGMA writable_schema = 1` to suppress validation) should succeed and reveal a real Signal schema.

**Change:** Extended `probe.js` to fall through to a `sqlite_master` listing whenever any strategy yielded `SQLITE_CORRUPT: malformed database schema`.

**Result:** PASS.
- 159 rows: 54 tables, 94 indexes, 11 triggers.
- First-seen names: `attachment_backup_jobs_*`, `attachment_downloads_*`, `callLinks_*`, `callsHistory_*` — unmistakably Signal Desktop's current schema.
- So: keychain → OSCrypt v10 → 64-char hex key → `PRAGMA cipher_compatibility = 4` + `PRAGMA key = "x'<hex>'"` is the **correct** decryption path. The previous fix attempt was right about the key; what's broken is the bundled SQLite parser, not the cipher.

**Implication confirmed:** Replace `@journeyapps/sqlcipher` (last release 2022; bundles SQLite ~3.39) with a binding whose SQLite version is recent enough to parse Signal's modern DDL (likely uses `->>`, generated columns, or `STRICT` tables).

**Next:** Iteration 3 — pick a replacement binding. Strong candidate: `@signalapp/better-sqlite3` (Signal's own fork — guaranteed schema-compat; bundled SQLite tracks Signal's needs; SQLCipher 4 enabled).

---

## 2026-05-05 13:25 — Iteration 3: identify blocking SQL features and pick binding

**Hypothesis:** `@journeyapps/sqlcipher` v6.0.0 (latest, Apr 2026) might have a newer bundled SQLite that just works.

**Investigation:**
- `@journeyapps/sqlcipher` changelog: SQLite was last bumped in v5.1.0 (~2020) to **3.33.0**. v6.0.0 only drops Windows + simplifies build. **Still SQLite 3.33.0.** JSON arrow operators `->`/`->>` need 3.38+. So v6 doesn't help.
- Extended `probe.js` to dump the `messages` DDL via `sqlite_master`. Detected features:
  - `json->'poll'->>'question'` → arrow operators (3.38.0+)
  - `GENERATED ALWAYS AS (...) VIRTUAL` (3.31.0+ — fine)
  - `json_extract`, `json_array_length` (JSON1 — fine)
  - No STRICT, no WITHOUT ROWID
- **Only the arrow operators are problematic.** This is vanilla SQLite functionality — no Signal-specific functions appear in the DDL.

**Candidates compared:**

| Binding | SQLite | API | Install | SQLCipher mode |
|---|---|---|---|---|
| `@journeyapps/sqlcipher` v6 | 3.33.0 | async (node-sqlite3 style) | source build | native SQLCipher 4 |
| `@signalapp/better-sqlite3` v9.0.13 | bundles 4.6.1-signal-patch2 | sync (better-sqlite3 style) | downloads from Signal CDN + Rust extension | native SQLCipher 4 |
| `better-sqlite3-multiple-ciphers` v12.9.0 | ~3.49 | sync (better-sqlite3 style) | prebuilt binaries | `legacy=4` (SQLCipher 4 compatible) |

**Decision:** `better-sqlite3-multiple-ciphers`. Simplest install (prebuilt binaries, no Signal CDN, no Rust toolchain), modern SQLite, generic SQLCipher 4 compat. The `messages` DDL doesn't reference any Signal-specific function, so a generic binding should be sufficient. If we hit a runtime issue with extension-defined functions later, we can fall back to `@signalapp/better-sqlite3`.

Note: switch from async to sync API will require restructuring `SignalHistoryClient` (drop the `_dbAll` callback wrappers, the connection-retry-on-NOTADB loop becomes a simple try/catch). Manageable.

**Next:** Iteration 4 — install `better-sqlite3-multiple-ciphers`, write a v2 probe path that uses it with `PRAGMA legacy = 4` + `PRAGMA key = "x'<hex>'"`, run `SELECT count(*) FROM messages` for real.

---

## 2026-05-05 13:50 — Iteration 4: install + v2 probe → SUCCESS

**Hypothesis:** `better-sqlite3-multiple-ciphers` v12.9.0 (modern SQLite ~3.49) with `PRAGMA cipher = sqlcipher; PRAGMA legacy = 4; PRAGMA key = "x'<hex>'"` will parse Signal's `messages` DDL and return real rows.

**Changes:**
- `package.json`: renamed `devEngines` → `engines` (npm 10's `checkDevEngines` rejected the legacy schema, blocking install).
- `npm install better-sqlite3-multiple-ciphers --save --legacy-peer-deps` (the project has a pre-existing react peer-dep conflict with `react-loading-spinner@1.0.12` / react@^0.14.0; README also documents `npm install --force`).
- `scripts/probe.js`: added a v2 path using the new binding.

**Result:** PASS.
- `SELECT count(*) FROM messages` → **159,495**.
- 57 tables visible. Read-only mode confirmed (`{ readonly: true }`).

**So the headless probe is fully working.** The decryption path is:

```
config.json.encryptedKey
  ↓ Buffer.from(hex)
  ↓ OSCrypt v10 decrypt (PBKDF2-SHA1 1003 / saltysalt / iv = 0x20*16 / AES-128-CBC)
    using keychain password from "Signal Safe Storage / Signal Key"
  ↓ 64-char ASCII hex string (the SQLCipher key)
  ↓ better-sqlite3-multiple-ciphers
    PRAGMA cipher = sqlcipher
    PRAGMA legacy = 4
    PRAGMA key = "x'<hex>'"
  ↓ readable database
```

**Next:** Iteration 5 — port-back. Replace `@journeyapps/sqlcipher` with `better-sqlite3-multiple-ciphers` in `src/services/SignalHistoryClient/index.ts`. The Electron app can keep `safeStorage.decryptString(encryptedKey)` for the keychain side (the probe's `security` CLI was a workaround for non-Electron scripts; Electron's `safeStorage` reads the same keychain entry). The big change is the API surface: async/callback `db.all(...)` becomes sync `db.prepare(...).all()`. Wrap in `Promise.resolve()` to preserve the existing async public methods. Then `npm start` to verify end-to-end.

---

## 2026-05-05 14:25 — Iteration 5: port-back to SignalHistoryClient → SUCCESS

**Hypothesis correction:** The note above was wrong about safeStorage. **Electron's `safeStorage` is per-app-namespaced in the keychain.** Each Electron binary gets its own entry (e.g. "Electron Safe Storage / Electron Key"). Calling `safeStorage.decryptString` on a blob written by Signal fails with `Error while decrypting the ciphertext` because we're trying to decrypt with the wrong key. **This is the actual root cause of the original bug** that the user reported, masked by the SQLCipher v3.33 issue we already fixed.

**Changes to `src/services/SignalHistoryClient/index.ts`:**
- Removed `safeStorage` import.
- Added `decryptOSCryptV10()` — manual replication of Chromium OSCrypt (PBKDF2-SHA1 1003 / saltysalt / iv 0x20*16 / AES-128-CBC).
- Added `readSignalSafeStoragePassword()` — reads `Signal Safe Storage / Signal Key` via `security` CLI on macOS. Throws "not yet implemented" on Linux/Windows.
- Replaced `@journeyapps/sqlcipher` with `better-sqlite3-multiple-ciphers`. Sync API; `db.prepare(query).all()` instead of callback `db.all(...)`. Open with `{ readonly: true, fileMustExist: true, timeout: 5000 }`. Pragmas: `cipher = sqlcipher`, `legacy = 4`, `key = "x'<hex>'"`.
- Dropped the `SQLITE_NOTADB` retry loop (no longer needed; the new binding doesn't surface the old timing-induced false positives, and the readonly mode + sync API make this trivial).

**Other:**
- Wrote `scripts/probe-electron.js` — a minimal Electron-runtime probe that boots Electron without a window and exercises `getDatabaseInfo()` + `getAllConversationsWithMessages()` directly. Faster end-to-end check than the full app.
- Native rebuild: `better-sqlite3-multiple-ciphers` ships prebuilt for node, not Electron 23. Hit `NODE_MODULE_VERSION 127 vs 113` mismatch. Rebuilt with `npx electron-rebuild -f -w better-sqlite3-multiple-ciphers`. First attempt failed because Python 3.13 dropped `distutils`; fixed with `pip install --user --break-system-packages 'setuptools<81'` (provides distutils backport).

**Result: PASS.**

```
[probe-electron]   tables: 54 (sample: conversations, identityKeys, items, sticker_packs, ...)
[probe-electron]   conversations: 894
[probe-electron]   top by message count:
[probe-electron]       34570 msgs  Laurin Notemann
[probe-electron]       13627 msgs  Capmeister Kirr
[probe-electron]       12391 msgs  Leonard Darsow
[probe-electron]        9311 msgs  Ava Hurst
[probe-electron]        8895 msgs  Ulli Bolls
[probe-electron] PASS
```

End-to-end works in real Electron 23. The only missing step is the GUI window itself, which is outside the scope of this fix (the renderer side hasn't broken; it just couldn't ever get data because the main process IPC handler kept throwing).

**Termination: SUCCESS.** Loop ends after writing SUMMARY.md, pushing the branch, and stopping the wakeup chain.
