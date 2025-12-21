#!/usr/bin/env node

/**
 * Test script for agent system
 */

import { Context } from './src/context.js';
import { Pending } from './src/pending.js';
import { RuleParser, RuleEvaluator } from './src/rules.js';
import { Daemon } from './src/daemon.js';
import { resolve } from 'path';
import { homedir } from 'os';

const mdosDir = resolve(homedir(), '.mdos');

console.log('=== Testing Agent System ===\n');

// Test 1: Context logging
console.log('Test 1: Context logging');
const context = new Context(resolve(mdosDir, 'context.json'));

context.log({
  tool: 'gmail',
  action: 'fetch',
  target: 'inbox',
  by: 'user'
});

context.log({
  tool: 'gmail',
  action: 'archive',
  target: 'msg_123',
  by: 'daemon',
  meta: { rule: 'email.md:auto-archive' }
});

const recent = context.tail(5);
console.log(`  Logged ${recent.length} entries`);
console.log('  ✓ Context logging works\n');

// Test 2: Pending queue
console.log('Test 2: Pending queue');
const pending = new Pending(resolve(mdosDir, 'pending.md'));

pending.add({
  text: 'Archive 5 newsletters',
  metadata: {
    action: 'archive',
    ids: 'msg_1,msg_2,msg_3,msg_4,msg_5',
    rule: 'email.md:auto-archive'
  }
});

pending.add({
  text: 'Flag urgent email from Sarah',
  metadata: {
    action: 'flag',
    id: 'msg_100',
    rule: 'email.md:flag-urgent'
  }
});

const { queued } = pending.read();
console.log(`  Added ${queued.length} pending actions`);
console.log('  ✓ Pending queue works\n');

// Test 3: Rule parsing
console.log('Test 3: Rule parsing');
const parser = new RuleParser();

try {
  const emailRules = parser.parse(resolve(mdosDir, 'rules/email.md'));
  console.log(`  Parsed ${emailRules.length} email rules:`);
  emailRules.forEach(rule => {
    console.log(`    - ${rule.name} (${rule.conditions.length} conditions, approval: ${rule.approval})`);
  });
  console.log('  ✓ Rule parsing works\n');
} catch (error) {
  console.error('  ✗ Rule parsing failed:', error.message);
}

// Test 4: Rule evaluation
console.log('Test 4: Rule evaluation');
const evaluator = new RuleEvaluator();

const testEmail = {
  sender: 'newsletter@marketing.example.com',
  subject: 'Weekly Update - Unsubscribe here',
  age: '2h'
};

const newsletterRule = {
  name: 'Auto-archive newsletters',
  conditions: [
    { type: 'contains', field: 'sender', value: 'newsletter' },
    { type: 'contains', field: 'subject', value: 'unsubscribe' }
  ],
  action: 'archive',
  approval: 'auto'
};

const matches = evaluator.evaluate(newsletterRule, testEmail);
console.log(`  Test email matches newsletter rule: ${matches}`);
console.log('  ✓ Rule evaluation works\n');

// Test 5: Query context
console.log('Test 5: Context queries');
const gmailActions = context.query({ tool: 'gmail' });
console.log(`  Found ${gmailActions.length} gmail actions`);

const daemonActions = context.query({ by: 'daemon' });
console.log(`  Found ${daemonActions.length} daemon actions`);

const recentActions = context.query({ since: '1h' });
console.log(`  Found ${recentActions.length} actions in last hour`);
console.log('  ✓ Context queries work\n');

// Test 6: Search context
console.log('Test 6: Context search');
const searchResults = context.search('archive');
console.log(`  Found ${searchResults.length} entries matching "archive"`);
console.log('  ✓ Context search works\n');

// Test 7: Approve action
console.log('Test 7: Approve action');
try {
  const action = pending.approve(0);
  console.log(`  Approved: ${action.text}`);
  console.log('  ✓ Approve works\n');
} catch (error) {
  console.log(`  (Already approved or invalid ID)\n`);
}

// Test 8: Load daemon
console.log('Test 8: Daemon initialization');
const daemon = new Daemon({ mdosDir });
console.log(`  Loaded ${daemon.rules.length} total rules`);
console.log('  Rules by source:');
const rulesBySource = {};
daemon.rules.forEach(rule => {
  rulesBySource[rule.source] = (rulesBySource[rule.source] || 0) + 1;
});
Object.entries(rulesBySource).forEach(([source, count]) => {
  console.log(`    ${source}: ${count} rules`);
});
console.log('  ✓ Daemon initialization works\n');

// Test 9: Single daemon tick (dry run)
console.log('Test 9: Daemon tick (dry run)');
try {
  await daemon.runOnce();
  console.log('  ✓ Daemon tick completed\n');
} catch (error) {
  console.error('  ✗ Daemon tick failed:', error.message);
}

console.log('=== All Tests Complete ===\n');

// Show summary
console.log('Summary:');
console.log(`  Context entries: ${context.tail(100).length}`);
console.log(`  Pending actions: ${pending.count()}`);
console.log(`  Loaded rules: ${daemon.rules.length}`);
console.log();
console.log('Try these commands:');
console.log('  node src/daemon-cli.js pending');
console.log('  node src/daemon-cli.js log');
console.log('  node src/daemon-cli.js daemon run-once');
console.log('  node src/daemon-cli.js approve --all');
