import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { run, validate } from '../formtrail.js';
const html = await readFile(new URL('../examples/signup.html', import.meta.url), 'utf8');
const journey = JSON.parse(await readFile(new URL('../examples/signup.json', import.meta.url), 'utf8'));

test('real Chromium validates invalid input and handles valid local submission', async () => {
  for (let i = 0; i < 2; i++) {
    const result = await run(html, journey);
    assert.equal(result.passed, true);
    assert.equal(result.steps.length, 6);
  }
});
test('failed assertion stops subsequent actions without exposing input values', async () => {
  const changed = structuredClone(journey);
  changed.steps[2].value = 'secret expectation';
  const report = await run(html, changed);
  assert.equal(report.passed, false);
  assert.equal(report.steps.length, 3);
  assert.equal(report.steps[2].passed, false);
  assert.ok(!JSON.stringify(report).includes('secret'));
});
test('missing controls report a failed step', async () => {
  const report = await run(html, {version: 1, steps: [{action: 'click', selector: '#missing'}]});
  assert.equal(report.steps[0].passed, false);
});
test('fixture network requests are blocked', async () => {
  const report = await run('<img src="https://example.invalid/a"><p>Done</p>',
    {version: 1, steps: [{action: 'text', selector: 'p', value: 'Done'}]});
  assert.equal(report.passed, true);
  assert.equal(report.blockedRequests, 1);
});
test('invalid and oversized journeys are rejected before browser work', () => {
  for (const bad of [{}, {version: true, steps: []}, {version: 1, steps: Array(51).fill({})},
    {version: 1, steps: [{action: 'execute', selector: 'body'}]},
    {version: 1, steps: [{action: 'fill', selector: 'input', value: 2}]}]) {
    assert.throws(() => validate(bad));
  }
});
test('CLI exercises real browser and handles usage/read failures', () => {
  const ok = spawnSync(process.execPath, ['formtrail.js', 'examples/signup.html', 'examples/signup.json'], {encoding:'utf8'});
  assert.equal(ok.status, 0, ok.stderr);
  assert.equal(JSON.parse(ok.stdout).passed, true);
  const bad = spawnSync(process.execPath, ['formtrail.js', 'absent.html', 'examples/signup.json'], {encoding:'utf8'});
  assert.equal(bad.status, 2);
  assert.equal(spawnSync(process.execPath, ['formtrail.js']).status, 2);
});
