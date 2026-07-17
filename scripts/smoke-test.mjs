#!/usr/bin/env node

/**
 * NexBlob Automated Smoke Test
 * Pings critical application endpoints to verify system health.
 * 
 * Usage:
 *   node scripts/smoke-test.mjs [target_url]
 *   Example: node scripts/smoke-test.mjs https://nexblob.gvk.workers.dev
 */

const target = process.argv[2] || 'https://nexblob.gvk.workers.dev';
console.log(`\x1b[36mRunning NexBlob smoke tests against: ${target}\x1b[0m\n`);

async function testEndpoint(path, expectedStatus = 200) {
  const url = `${target}${path}`;
  const start = performance.now();
  try {
    const res = await fetch(url);
    const duration = (performance.now() - start).toFixed(0);
    const isOk = res.status === expectedStatus;
    
    if (isOk) {
      console.log(`  \x1b[32m✓\x1b[0m [${res.status}] ${path} (${duration}ms)`);
      return true;
    } else {
      console.log(`  \x1b[31m✗\x1b[0m [${res.status}] ${path} (Expected ${expectedStatus}) (${duration}ms)`);
      return false;
    }
  } catch (e) {
    console.log(`  \x1b[31m✗\x1b[0m [Error] ${path} - ${e.message}`);
    return false;
  }
}

async function run() {
  const checks = [
    testEndpoint('/', 200),
    testEndpoint('/api/auth/me', 200),
    testEndpoint('/api/jsonBlob', 200),
    testEndpoint('/api/connections', 200),
  ];

  const results = await Promise.all(checks);
  const passed = results.every(Boolean);

  console.log('\n\x1b[90m----------------------------------------\x1b[0m');
  if (passed) {
    console.log('  \x1b[32m✅ ALL SMOKE TESTS PASSED - SYSTEM IS HEALTHY\x1b[0m');
    process.exit(0);
  } else {
    console.log('  \x1b[31m❌ SOME SMOKE TESTS FAILED - CHECK DEPLOYMENT\x1b[0m');
    process.exit(1);
  }
}

run();
