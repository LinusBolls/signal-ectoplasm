#!/usr/bin/env node
/*
 * End-to-end probe of SignalHistoryClient under a real Electron runtime
 * (so safeStorage is available). No GUI, no renderer. Prints sanity output
 * and exits.
 *
 * Usage:  npx electron scripts/probe-electron.js
 */
const { app } = require('electron');

require('ts-node/register/transpile-only');
const SignalHistoryClient =
  require('../src/services/SignalHistoryClient').default;

app.whenReady().then(async () => {
  let exitCode = 0;
  try {
    const client = new SignalHistoryClient();

    console.log('[probe-electron] getDatabaseInfo...');
    const info = await client.getDatabaseInfo();
    const [tablesErr, tableRows] = info.tables;
    if (tablesErr) throw tablesErr;
    console.log(
      `[probe-electron]   tables: ${tableRows.length} (sample: ${tableRows
        .slice(0, 6)
        .map((r) => r.name)
        .join(', ')})`
    );

    console.log('[probe-electron] getAllConversationsWithMessages...');
    const [convoErr, convos] = await client.getAllConversationsWithMessages();
    if (convoErr) throw convoErr;
    console.log(`[probe-electron]   conversations: ${convos.length}`);
    const sorted = [...convos].sort(
      (a, b) => (b.numMessages ?? 0) - (a.numMessages ?? 0)
    );
    console.log('[probe-electron]   top by message count:');
    for (const c of sorted.slice(0, 5)) {
      const label = c.name || c.profileName || c.e164 || '(unnamed)';
      console.log(
        `[probe-electron]     ${String(c.numMessages ?? 0).padStart(7)} msgs  ${label}`
      );
    }

    console.log('[probe-electron] PASS');
  } catch (e) {
    console.error('[probe-electron] FATAL:', e && e.stack ? e.stack : e);
    exitCode = 2;
  } finally {
    app.exit(exitCode);
  }
});
