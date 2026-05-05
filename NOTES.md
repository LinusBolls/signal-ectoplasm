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
