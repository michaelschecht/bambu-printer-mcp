import { EventEmitter } from 'node:events';
import test from 'node:test';
import assert from 'node:assert/strict';
import { publishPrintCommand } from '../dist/printers/print-command.js';

for (const outcome of ['SUCCESS', 'failed', 'timeout', 'unrelated', 'publish-error']) {
  test(`print acknowledgement: ${outcome}`, async () => {
    const printer = new EventEmitter();
    printer.publish = async ({ print }) => {
      if (outcome === 'publish-error') throw new Error('broker unavailable');
      if (outcome === 'timeout') return;
      printer.emit('rawMessage', 'report', Buffer.from(JSON.stringify({print: {
        command: print.command,
        sequence_id: outcome === 'unrelated' ? 'wrong' : print.sequence_id,
        result: outcome === 'unrelated' ? 'SUCCESS' : outcome,
        reason: 'test rejection'
      }})));
    };
    const pending = publishPrintCommand(printer, {print: {command: 'project_file'}}, 20);
    if (outcome === 'publish-error') await assert.rejects(pending, /broker unavailable/);
    else {
      const result = await pending;
      assert.equal(result.status, outcome === 'SUCCESS' ? 'accepted' : outcome === 'failed' ? 'error' : 'unverified');
      assert.equal(result.started, false);
    }
    assert.equal(printer.listenerCount('rawMessage'), 0);
  });
}
