# Fix summary — signal-ectoplasm encryption

## What was broken

Signal-ectoplasm couldn't read Signal Desktop's encrypted `db.sqlite`. After investigation, the breakage stacked **two independent failures**:

1. **Wrong key path.** The previous attempt used Electron's `safeStorage.decryptString` to unwrap the `encryptedKey` from `config.json`. But Electron's `safeStorage` is **per-app-namespaced** in the keychain — every Electron binary gets its own entry (e.g. `"Electron Safe Storage / Electron Key"`). Calling `safeStorage.decryptString` on a blob written by Signal fails with `Error while decrypting the ciphertext`, because we'd be trying to decrypt with the wrong key.
2. **Old SQLite parser.** Even if the key path had been correct, `@journeyapps/sqlcipher` (the binding the project pinned) ships with **SQLite 3.33.0** — last bumped in 2020, including in the just-released v6.0.0. Signal's current `messages` table DDL uses JSON arrow operators (`->>`, `->`) that need **SQLite 3.38+** (Feb 2022). Symptom: `SQLITE_CORRUPT: malformed database schema (messages) - near ">": syntax error`.

## What changed

### `src/services/SignalHistoryClient/index.ts`

- Replaced `safeStorage.decryptString(...)` with a manual replication of Chromium OSCrypt v10 (`decryptOSCryptV10`):
  - Reads the password via macOS `security find-generic-password -s "Signal Safe Storage" -a "Signal Key" -w` (the OS prompts the user once for keychain access; click "Always Allow" to make it silent on subsequent runs).
  - Decrypts with `PBKDF2-SHA1(password, "saltysalt", 1003, 16)` → AES-128-CBC, IV `0x20 × 16`.
- Replaced `@journeyapps/sqlcipher` with `better-sqlite3-multiple-ciphers` (modern SQLite ~3.49, sync API):
  - Open with `{ readonly: true, fileMustExist: true, timeout: 5000 }`.
  - Pragmas: `cipher = sqlcipher`, `legacy = 4`, `key = "x'<64-char-hex>'"`.
- Dropped the legacy `SQLITE_NOTADB` retry loop (no longer needed with the new binding + readonly mode).
- Linux / Windows are not yet supported — they fall through to a clear "not yet implemented" error.

### `package.json`

- Renamed `devEngines` → `engines` (npm 10's `checkDevEngines` rejects the legacy schema).
- Added `better-sqlite3-multiple-ciphers` to dependencies. Use `--legacy-peer-deps` on install (pre-existing React peer-dep conflict with `react-loading-spinner@1.0.12`).

### Build

- Native module needs an Electron rebuild (`NODE_MODULE_VERSION 127 vs 113`):
  ```
  npx electron-rebuild -f -w better-sqlite3-multiple-ciphers
  ```
  If `node-gyp` complains about missing `distutils` on Python 3.12+, install setuptools as a backport:
  ```
  pip3 install --user --break-system-packages 'setuptools<81'
  ```

## How to verify

```
node scripts/probe.js                     # headless probe (no Electron)
npx electron scripts/probe-electron.js    # end-to-end via real Electron
```

Both should print conversation/message counts and exit 0.

## Decryption path (final)

```
config.json.encryptedKey
  ↓ Buffer.from(<hex>)
  ↓ OSCrypt v10 decrypt:
      password ← keychain "Signal Safe Storage / Signal Key" (via `security`)
      key      ← PBKDF2-SHA1(password, "saltysalt", 1003, 16)
      iv       ← 0x20 × 16
      AES-128-CBC
  ↓ 64-char ASCII hex (the SQLCipher key)
  ↓ better-sqlite3-multiple-ciphers
      PRAGMA cipher = sqlcipher
      PRAGMA legacy = 4
      PRAGMA key   = "x'<hex>'"
  ↓ readable database
```

## Iteration log

See `NOTES.md` for the full investigation timeline (5 iterations, ~90 minutes).
