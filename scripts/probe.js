#!/usr/bin/env node
/*
 * Standalone, non-Electron decryption probe for Signal Desktop's SQLCipher database.
 *
 * Replicates Electron's safeStorage decryption directly via:
 *   - macOS `security` CLI to read the keychain password
 *   - node `crypto` for Chromium OSCrypt v10 (PBKDF2-SHA1 / AES-128-CBC)
 *
 * Then opens db.sqlite read-only with @journeyapps/sqlcipher and probes several
 * cipher_compatibility levels and key encodings. Reports which strategy works.
 *
 * Read-only contract: never writes to ~/Library/Application Support/Signal/.
 *
 * Usage:  node scripts/probe.js
 */

const { execFileSync } = require('child_process');
const { createDecipheriv, pbkdf2Sync } = require('crypto');
const { readFileSync } = require('fs');
const { homedir } = require('os');
const { join } = require('path');

const SIGNAL_DIR = join(homedir(), 'Library/Application Support/Signal');
const CONFIG_PATH = join(SIGNAL_DIR, 'config.json');
const DB_PATH = join(SIGNAL_DIR, 'sql/db.sqlite');

function log(...args) {
  console.log('[probe]', ...args);
}

function readKeychainPassword() {
  // -w prints just the password; will show a keychain prompt the first time
  // unless the user previously clicked "Always Allow" for /usr/bin/security.
  const out = execFileSync(
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
  );
  return out.trim();
}

// Chromium OSCrypt format on macOS:
//   prefix 'v10' (3 bytes) + AES-128-CBC ciphertext
//   key = PBKDF2-SHA1(password, 'saltysalt', 1003, 16)
//   iv  = ' ' * 16  (0x20 * 16)
function decryptOSCryptV10(blob, password) {
  const prefix = blob.slice(0, 3).toString('utf8');
  if (prefix !== 'v10') {
    throw new Error(
      `unexpected OSCrypt prefix: ${JSON.stringify(prefix)} (raw: ${blob
        .slice(0, 3)
        .toString('hex')})`
    );
  }
  const ciphertext = blob.slice(3);
  const key = pbkdf2Sync(password, 'saltysalt', 1003, 16, 'sha1');
  const iv = Buffer.alloc(16, 0x20);
  const decipher = createDecipheriv('aes-128-cbc', key, iv);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}

function describe(buf) {
  const hex = buf.toString('hex');
  const ascii = buf.toString('utf8');
  const printable = /^[\x20-\x7e]*$/.test(ascii);
  return {
    length: buf.length,
    hex_prefix: hex.slice(0, 16) + (hex.length > 16 ? '…' : ''),
    is_printable_ascii: printable,
    looks_like_hex: printable && /^[0-9a-fA-F]+$/.test(ascii),
  };
}

async function tryOpen(label, applyPragmas) {
  let sqlcipher;
  try {
    sqlcipher = require('@journeyapps/sqlcipher').verbose();
  } catch (e) {
    return { label, ok: false, error: `cannot load sqlcipher: ${e.message}` };
  }

  return await new Promise((resolve) => {
    // file: URI with mode=ro means read-only.
    const url = `file:${DB_PATH}?mode=ro`;
    const db = new sqlcipher.Database(
      url,
      sqlcipher.OPEN_READONLY | sqlcipher.OPEN_URI,
      (err) => {
        if (err) {
          resolve({ label, ok: false, error: `open failed: ${err.message}` });
          return;
        }
        db.serialize(() => {
          try {
            applyPragmas(db);
          } catch (e) {
            resolve({
              label,
              ok: false,
              error: `pragma threw: ${e.message}`,
            });
            db.close(() => {});
            return;
          }
          db.get('SELECT count(*) AS n FROM messages', (qerr, row) => {
            if (qerr) {
              resolve({ label, ok: false, error: `query: ${qerr.message}` });
            } else {
              resolve({ label, ok: true, count: row && row.n });
            }
            db.close(() => {});
          });
        });
      }
    );
  });
}

async function main() {
  log('SIGNAL_DIR =', SIGNAL_DIR);

  log('reading config.json...');
  const config = JSON.parse(readFileSync(CONFIG_PATH, 'utf8'));
  if (!config.encryptedKey) {
    throw new Error('config.json has no encryptedKey field');
  }
  log(
    `encryptedKey: hex_length=${config.encryptedKey.length} prefix=${config.encryptedKey.slice(0, 6)}`
  );
  const blob = Buffer.from(config.encryptedKey, 'hex');

  log('reading keychain password (Signal Safe Storage / Signal Key)...');
  const password = readKeychainPassword();
  log(`keychain password length=${password.length}`);

  log('decrypting OSCrypt v10 blob...');
  const decrypted = decryptOSCryptV10(blob, password);
  log('decrypted shape:', describe(decrypted));

  // Try the decrypted key under multiple SQLCipher param sets and
  // multiple key encodings.
  const decAscii = decrypted.toString('utf8');
  const decHex = decrypted.toString('hex');

  // Each strategy is a (label, db => void) pair.
  const strategies = [];

  for (const compat of [4, 3]) {
    // Strategy A: PRAGMA key = "x'<hex-of-raw-bytes>'"  (Signal Desktop's classic form)
    strategies.push([
      `compat=${compat} key=raw_hex(${decrypted.length}B)`,
      (db) => {
        db.run(`PRAGMA cipher_compatibility = ${compat}`);
        db.run(`PRAGMA key = "x'${decHex}'"`);
      },
    ]);

    // Strategy B: PRAGMA key = "x'<ascii-as-text>'"  (if decrypted bytes are themselves a hex string)
    if (/^[0-9a-fA-F]+$/.test(decAscii)) {
      strategies.push([
        `compat=${compat} key=ascii_hex_text(len=${decAscii.length})`,
        (db) => {
          db.run(`PRAGMA cipher_compatibility = ${compat}`);
          db.run(`PRAGMA key = "x'${decAscii}'"`);
        },
      ]);
    }

    // Strategy C: PRAGMA key = '<ascii-as-passphrase>'  (legacy KDF over passphrase)
    strategies.push([
      `compat=${compat} key=ascii_passphrase(len=${decAscii.length})`,
      (db) => {
        db.run(`PRAGMA cipher_compatibility = ${compat}`);
        const escaped = decAscii.replace(/'/g, "''");
        db.run(`PRAGMA key = '${escaped}'`);
      },
    ]);
  }

  log(`running ${strategies.length} strategies...`);
  const results = [];
  for (const [label, applyPragmas] of strategies) {
    const r = await tryOpen(label, applyPragmas);
    results.push(r);
    log(r.ok ? `PASS ${label} → count=${r.count}` : `FAIL ${label} → ${r.error}`);
  }

  const winners = results.filter((r) => r.ok);
  log('');
  log(`summary: ${winners.length}/${results.length} strategies succeeded`);

  if (winners.length === 0) {
    log('none worked. consider:');
    log('  - cipher_compatibility values 1, 2, 5');
    log('  - different KDF iter counts (PRAGMA cipher_kdf_iter)');
    log('  - HMAC algo (PRAGMA cipher_hmac_algorithm = HMAC_SHA1)');
    log('  - page size (PRAGMA cipher_page_size = 4096)');
    process.exit(1);
  }

  log('');
  log('winning strategies:');
  for (const w of winners) log(`  - ${w.label} → count=${w.count}`);
  process.exit(0);
}

main().catch((e) => {
  console.error('[probe] FATAL', e && e.stack ? e.stack : e);
  process.exit(2);
});
