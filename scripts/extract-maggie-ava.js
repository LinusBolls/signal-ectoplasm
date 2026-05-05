#!/usr/bin/env node
/*
 * Extract a recency-biased sample of the user's outgoing messages from the
 * combined Maggie + Ava conversations. ~70% of the sample is drawn from the
 * last 90 days; ~30% spans the rest of history.
 *
 * Run:  npx electron scripts/extract-maggie-ava.js
 * Output: /tmp/maggie-ava-sample.txt + /tmp/maggie-ava-meta.txt
 */
const { app } = require('electron');
const { execFileSync } = require('child_process');
const { createDecipheriv, pbkdf2Sync } = require('crypto');
const { readFileSync, writeFileSync, createWriteStream } = require('fs');
const { homedir } = require('os');
const { join } = require('path');

const SIGNAL_DIR = join(homedir(), 'Library/Application Support/Signal');
const CONFIG_PATH = join(SIGNAL_DIR, 'config.json');
const DB_PATH = join(SIGNAL_DIR, 'sql/db.sqlite');

const SAMPLE_OUT = '/tmp/maggie-ava-sample.txt';
const META_OUT = '/tmp/maggie-ava-meta.txt';
const metaLines = [];
const meta = (m) => metaLines.push(m);

const RECENT_FRACTION = 0.7;
const TOTAL_SAMPLE = 1000;
const RECENT_DAYS = 90;
const RECENT_CUTOFF_MS = Date.now() - RECENT_DAYS * 86_400_000;

app.whenReady().then(main).catch((e) => {
  console.error('FATAL', e);
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

function decryptOSCryptV10(blob, password) {
  if (blob.slice(0, 3).toString() !== 'v10') throw new Error('bad prefix');
  const ct = blob.slice(3);
  const key = pbkdf2Sync(password, 'saltysalt', 1003, 16, 'sha1');
  const iv = Buffer.alloc(16, 0x20);
  const dec = createDecipheriv('aes-128-cbc', key, iv);
  return Buffer.concat([dec.update(ct), dec.final()]).toString('utf8');
}
function readKeychainPassword() {
  return execFileSync(
    'security',
    ['find-generic-password', '-s', 'Signal Safe Storage', '-a', 'Signal Key', '-w'],
    { encoding: 'utf8' }
  ).trim();
}

const Database = require('better-sqlite3-multiple-ciphers');

function runExtraction() {
  const config = JSON.parse(readFileSync(CONFIG_PATH, 'utf8'));
  const decryptedKey = decryptOSCryptV10(
    Buffer.from(config.encryptedKey, 'hex'),
    readKeychainPassword()
  );
  const db = new Database(DB_PATH, { readonly: true, fileMustExist: true });
  db.pragma('cipher = sqlcipher');
  db.pragma('legacy = 4');
  db.pragma(`key = "x'${decryptedKey}'"`);

  // Find both conversations.
  const candidates = db
    .prepare(
      `SELECT id, name, profileFullName, type
         FROM conversations
        WHERE type = 'private'
          AND (name LIKE '%Maggie%' OR profileFullName LIKE '%Maggie%'
            OR name LIKE '%Ava%'    OR profileFullName LIKE '%Ava%')
        ORDER BY active_at DESC NULLS LAST`
    )
    .all();
  meta('candidates: ' + JSON.stringify(candidates));

  // Pick the most-recent Maggie and the most-recent Ava (by name match).
  const isMaggie = (c) =>
    /maggie/i.test(c.name || '') || /maggie/i.test(c.profileFullName || '');
  const isAva = (c) =>
    /\bava\b/i.test(c.name || '') || /\bava\b/i.test(c.profileFullName || '');
  const maggie = candidates.find(isMaggie);
  const ava = candidates.find(isAva);

  if (!maggie) meta('WARNING: no Maggie conversation found');
  if (!ava) meta('WARNING: no Ava conversation found');
  if (!maggie && !ava) throw new Error('neither found');

  const targets = [maggie, ava].filter(Boolean);
  meta(`using: ${targets.map((t) => `${t.name || t.profileFullName} (${t.id})`).join(', ')}`);

  const out = createWriteStream(SAMPLE_OUT);

  for (const t of targets) {
    const id = t.id;
    const peer = t.name || t.profileFullName;

    const range = db
      .prepare(
        `SELECT MIN(sent_at) AS earliest, MAX(sent_at) AS latest, COUNT(*) AS n
           FROM messages
          WHERE conversationId = ? AND type = 'outgoing'
            AND body IS NOT NULL AND body != ''`
      )
      .get(id);
    if (!range || !range.n) {
      meta(`  ${peer}: no outgoing messages`);
      continue;
    }
    const earliest = new Date(range.earliest).toISOString();
    const latest = new Date(range.latest).toISOString();
    meta(`  ${peer}: ${range.n} outgoing texts (${earliest} → ${latest})`);

    // Per-conversation budget: split the global SAMPLE_N proportionally to
    // how many messages each has.
    // (Simpler: equal split for now.)
    const perConvoBudget = Math.floor(TOTAL_SAMPLE / targets.length);
    const recentBudget = Math.floor(perConvoBudget * RECENT_FRACTION);
    const olderBudget = perConvoBudget - recentBudget;

    // Recent window
    const recent = db
      .prepare(
        `SELECT body, sent_at
           FROM messages
          WHERE conversationId = ?
            AND type = 'outgoing'
            AND body IS NOT NULL AND body != ''
            AND sent_at >= ?
          ORDER BY sent_at DESC
          LIMIT ?`
      )
      .all(id, RECENT_CUTOFF_MS, recentBudget);

    // Older window — even sample across pre-recent history
    const older = db
      .prepare(
        `WITH older AS (
           SELECT body, sent_at,
                  ROW_NUMBER() OVER (ORDER BY sent_at) AS rn,
                  COUNT(*) OVER () AS total
             FROM messages
            WHERE conversationId = ?
              AND type = 'outgoing'
              AND body IS NOT NULL AND body != ''
              AND sent_at < ?
         )
         SELECT body, sent_at
           FROM older
          WHERE rn % CAST(MAX(1, total / ?) AS INTEGER) = 0
          LIMIT ?`
      )
      .all(id, RECENT_CUTOFF_MS, olderBudget, olderBudget);

    meta(`    ${peer}: sampled ${recent.length} recent + ${older.length} older`);

    // Interleave by date
    const rows = [...older, ...recent].sort((a, b) => a.sent_at - b.sent_at);
    for (const r of rows) {
      const d = new Date(r.sent_at).toISOString().slice(0, 10);
      const safe = r.body.replace(/\r?\n/g, ' ⏎ ');
      out.write(`${peer}\t${d}\t${safe}\n`);
    }
  }
  out.end();
  db.close();
}
