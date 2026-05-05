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
