# Autonomous fix workflow — Signal SQLCipher decryption

## Goal

Restore signal-ectoplasm's ability to read Signal Desktop's encrypted `db.sqlite`. The previous local attempt (committed as the baseline of this branch) switched from reading a plaintext `key` to reading `encryptedKey` and decrypting with Electron's `safeStorage.decryptString` — that did not get the app working end-to-end.

## Branch

`fix/signal-encryption-2026`. In-place on the existing checkout. Push permitted; no PR until the user asks.

## Validation strategy

Two layers, run independently:

1. **Headless probe (`scripts/probe.js`)** — fast, no Electron boot.
   - Reads `~/Library/Application Support/Signal/config.json` → `encryptedKey`.
   - Reads keychain entry `Signal Safe Storage / Signal Key` via `security find-generic-password -w` (replicates what Electron's `safeStorage` does internally; once-per-machine, the user clicks "Always Allow" on the keychain prompt).
   - Decrypts the OSCrypt v10 blob in plain Node (`crypto.pbkdf2Sync` SHA1, 1003 rounds, salt `saltysalt`, IV 16×0x20, AES-128-CBC).
   - Opens `db.sqlite` read-only via `@journeyapps/sqlcipher` and runs `SELECT count(*) FROM messages` against several `cipher_compatibility` levels and key encodings.
   - Exit code 0 = at least one strategy worked. Diagnostic output for each strategy (PASS / FAIL with sqlite error).

2. **End-to-end (`npm start`)** — only run once the probe finds a working strategy. Confirms the patched `SignalHistoryClient` works under real Electron.

## Iteration loop

Driven by self-paced `/loop`. One tick =

1. Read `NOTES.md` to recall state.
2. If the probe passed last tick → port-back phase (patch `src/services/SignalHistoryClient/index.ts`, run `npm start`, verify, commit, end loop).
3. Otherwise: form a hypothesis (often informed by reading current Signal-Desktop source from github), update `probe.js`, run it, append outcome to `NOTES.md`, commit.
4. Sleep — short (60–270s) while iterating, longer if waiting on an external fetch.

## Termination

- **Success**: Electron app boots, reads conversations. Final commit summarizes what changed and why. Loop ends.
- **Stuck**: 5 consecutive iterations with no new information → write `SUMMARY.md` (what was tried, what was learned, what to look at next) and stop the loop.

## Safety

- `~/Library/Application Support/Signal/` is opened read-only (`config.json` via `fs.readFileSync`, `db.sqlite` via `file:...?mode=ro`).
- All mutations land in this repo.
- The keychain prompt on first run is the only point requiring a human click; after "Always Allow" it's silent.

## What's intentionally out of scope

- Refactoring or test infrastructure beyond what serves this fix.
- Cross-platform parity (Linux/Windows). The probe and patch target macOS only; cross-platform stays as it was.
