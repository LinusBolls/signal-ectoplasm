#!/usr/bin/env node
/*
 * Extract a representative sample of the user's *outgoing* messages from the
 * Laurin Notemann conversation, for style analysis. Read-only.
 *
 * Run via Electron because the native module is built for Electron's ABI:
 *   npx electron scripts/extract-laurin.js
 * Output goes to /tmp/laurin-sample.txt (sample) and /tmp/laurin-meta.txt (meta).
 */

const { app } = require('electron');
const { execFileSync } = require('child_process');
const { createDecipheriv, pbkdf2Sync } = require('crypto');
const { readFileSync, writeFileSync, createWriteStream } = require('fs');
const { homedir } = require('os');
const { join } = require('path');

const SAMPLE_OUT = '/tmp/laurin-sample.txt';
const META_OUT = '/tmp/laurin-meta.txt';
const metaLines = [];
function meta(msg) {
  metaLines.push(msg);
}

const SIGNAL_DIR = join(homedir(), 'Library/Application Support/Signal');
const CONFIG_PATH = join(SIGNAL_DIR, 'config.json');
const DB_PATH = join(SIGNAL_DIR, 'sql/db.sqlite');

app.whenReady().then(main).catch((e) => {
  meta('FATAL', e);
  app.exit(1);
});

function main() {
  try {
    runExtraction();
    writeFileSync(META_OUT, metaLines.join('\n') + '\n');
    app.exit(0);
  } catch (e) {
    metaLines.push('FATAL: ' + (e && e.stack ? e.stack : e));
    writeFileSync(META_OUT, metaLines.join('\n') + '\n');
    app.exit(2);
  }
}

function runExtraction() {

function decryptOSCryptV10(blob, password) {
  if (blob.slice(0, 3).toString() !== 'v10') {
    throw new Error('unexpected OSCrypt prefix');
  }
  const ciphertext = blob.slice(3);
  const key = pbkdf2Sync(password, 'saltysalt', 1003, 16, 'sha1');
  const iv = Buffer.alloc(16, 0x20);
  const decipher = createDecipheriv('aes-128-cbc', key, iv);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString(
    'utf8'
  );
}

function readKeychainPassword() {
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

const Database = require('better-sqlite3-multiple-ciphers');

const config = JSON.parse(readFileSync(CONFIG_PATH, 'utf8'));
const decryptedKey = decryptOSCryptV10(
  Buffer.from(config.encryptedKey, 'hex'),
  readKeychainPassword()
);

const db = new Database(DB_PATH, { readonly: true, fileMustExist: true });
db.pragma('cipher = sqlcipher');
db.pragma('legacy = 4');
db.pragma(`key = "x'${decryptedKey}'"`);

// Find Laurin's conversation
const convo = db
  .prepare(
    `SELECT id, name, profileFullName, e164, type, serviceId
       FROM conversations
       WHERE (name LIKE '%Laurin%' OR profileFullName LIKE '%Laurin%')
         AND type = 'private'
       ORDER BY active_at DESC NULLS LAST
       LIMIT 5`
  )
  .all();

meta('candidate conversations:', JSON.stringify(convo, null, 2));
if (convo.length === 0) {
  meta('no Laurin conversation found');
  throw new Error('no conversation');
}
const conversationId = convo[0].id;
const peerName = convo[0].name || convo[0].profileFullName;
meta(
  `using conversationId=${conversationId} (${peerName}); checking message counts...`
);

// How many messages, and how many outbound (from us)?
const counts = db
  .prepare(
    `SELECT type, COUNT(*) AS n
       FROM messages
       WHERE conversationId = ?
       GROUP BY type
       ORDER BY n DESC`
  )
  .all(conversationId);
meta('counts by type:', JSON.stringify(counts));

// Date range
const range = db
  .prepare(
    `SELECT MIN(sent_at) AS earliest, MAX(sent_at) AS latest, COUNT(*) AS total
       FROM messages
       WHERE conversationId = ? AND type = 'outgoing' AND body IS NOT NULL AND body != ''`
  )
  .get(conversationId);
meta('outgoing range:', JSON.stringify(range));
const earliest = new Date(range.earliest).toISOString();
const latest = new Date(range.latest).toISOString();
meta(`outgoing text: ${range.total} (${earliest} → ${latest})`);

// Pull a representative sample: spread across the entire history.
// Use modulo on row_number to get an even sample of N messages.
const SAMPLE_N = 800;
const rows = db
  .prepare(
    `WITH outbox AS (
       SELECT body, sent_at, ROW_NUMBER() OVER (ORDER BY sent_at) AS rn,
              COUNT(*) OVER () AS total
         FROM messages
        WHERE conversationId = ?
          AND type = 'outgoing'
          AND body IS NOT NULL
          AND body != ''
     )
     SELECT body, sent_at
       FROM outbox
      WHERE rn % CAST(MAX(1, total / ?) AS INTEGER) = 0
      LIMIT ?`
  )
  .all(conversationId, SAMPLE_N, SAMPLE_N);

meta(`sampled ${rows.length} messages`);

// Write sample to file: one message per line, prefixed with date.
const out = createWriteStream(SAMPLE_OUT);
for (const r of rows) {
  const d = new Date(r.sent_at).toISOString().slice(0, 10);
  const safe = r.body.replace(/\r?\n/g, ' ⏎ ');
  out.write(`${d}\t${safe}\n`);
}
out.end();

db.close();
}

