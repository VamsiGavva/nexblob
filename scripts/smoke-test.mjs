#!/usr/bin/env node

/**
 * NexBlob Comprehensive API Smoke Test Suite
 * Tests all core CRUD, Auth, D1, and AI endpoints.
 * 
 * Usage:
 *   node scripts/smoke-test.mjs [target_url]
 *   Example: node scripts/smoke-test.mjs https://nexblob.gvk.workers.dev
 */

const target = process.argv[2] || 'https://nexblob.gvk.workers.dev';
console.log(`\x1b[36mRunning Comprehensive NexBlob Smoke Tests against: ${target}\x1b[0m\n`);

let cookieHeader = '';
let testBlobId = '';
let totalTests = 0;
let passedTests = 0;

function reportResult(name, success, info = '') {
  totalTests++;
  if (success) {
    passedTests++;
    console.log(`  \x1b[32m✓\x1b[0m ${name} ${info ? `\x1b[90m(${info})\x1b[0m` : ''}`);
  } else {
    console.log(`  \x1b[31m✗\x1b[0m ${name} ${info ? `\x1b[31m(${info})\x1b[0m` : ''}`);
  }
}

async function run() {
  const startSuite = performance.now();

  // 1. GET / - Home Page Load
  try {
    const res = await fetch(`${target}/`);
    reportResult('GET / (Home Page)', res.status === 200, `status: ${res.status}`);
  } catch (e) {
    reportResult('GET / (Home Page)', false, e.message);
  }

  // 2. GET /api/auth/dev-login - Backdoor Auth
  try {
    const res = await fetch(`${target}/api/auth/dev-login?email=smoke@test.com&name=Smoke+Tester`, {
      redirect: 'manual'
    });
    const setCookie = res.headers.get('set-cookie');
    if (setCookie) {
      const match = setCookie.match(/session_token=[^;]+/);
      if (match) {
        cookieHeader = match[0];
      }
    }
    reportResult('GET /api/auth/dev-login (Backdoor Login)', res.status === 302 && !!cookieHeader, `status: ${res.status}`);
  } catch (e) {
    reportResult('GET /api/auth/dev-login (Backdoor Login)', false, e.message);
  }

  // 3. GET /api/auth/me - Check Session Status
  try {
    const res = await fetch(`${target}/api/auth/me`, {
      headers: cookieHeader ? { 'Cookie': cookieHeader } : {}
    });
    const data = await res.json();
    const isLoggedIn = data.user && data.user.email === 'smoke@test.com';
    reportResult('GET /api/auth/me (Verify Session)', res.status === 200 && isLoggedIn, `user: ${data.user?.email || 'unauthorized'}`);
  } catch (e) {
    reportResult('GET /api/auth/me (Verify Session)', false, e.message);
  }

  // 4. POST /api/jsonBlob - Create Test Blob
  try {
    const res = await fetch(`${target}/api/jsonBlob`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(cookieHeader ? { 'Cookie': cookieHeader } : {})
      },
      body: JSON.stringify({
        name: 'Smoke Test Blob',
        content: '{"smoke_test": true, "data": [1, 2, 3]}',
        expiry: 'never'
      })
    });
    const data = await res.json();
    testBlobId = data.id;
    reportResult('POST /api/jsonBlob (Create Blob)', res.status === 201 && !!testBlobId, `id: ${testBlobId}`);
  } catch (e) {
    reportResult('POST /api/jsonBlob (Create Blob)', false, e.message);
  }

  // 5. GET /api/jsonBlob - List Recent Blobs
  try {
    const res = await fetch(`${target}/api/jsonBlob`);
    const data = await res.json();
    const found = data.blobs && data.blobs.some(b => b.id === testBlobId);
    reportResult('GET /api/jsonBlob (List Blobs)', res.status === 200 && found, `found created: ${found}`);
  } catch (e) {
    reportResult('GET /api/jsonBlob (List Blobs)', false, e.message);
  }

  // 6. GET /api/jsonBlob/:id - Fetch Created Blob
  try {
    if (!testBlobId) throw new Error('Skipped: no blob ID');
    const res = await fetch(`${target}/api/jsonBlob/${testBlobId}`);
    const data = await res.json();
    const contentMatch = data.content && JSON.parse(data.content).smoke_test === true;
    reportResult('GET /api/jsonBlob/:id (Fetch Blob)', res.status === 200 && contentMatch, `status: ${res.status}`);
  } catch (e) {
    reportResult('GET /api/jsonBlob/:id (Fetch Blob)', false, e.message);
  }

  // 7. PUT /api/jsonBlob/:id - Update Created Blob
  try {
    if (!testBlobId) throw new Error('Skipped: no blob ID');
    const res = await fetch(`${target}/api/jsonBlob/${testBlobId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...(cookieHeader ? { 'Cookie': cookieHeader } : {})
      },
      body: JSON.stringify({
        name: 'Smoke Test Blob - Updated',
        content: '{"smoke_test": true, "updated": true}'
      })
    });
    reportResult('PUT /api/jsonBlob/:id (Update Blob)', res.status === 200, `status: ${res.status}`);
  } catch (e) {
    reportResult('PUT /api/jsonBlob/:id (Update Blob)', false, e.message);
  }

  // 8. GET /api/jsonBlob/:id - Verify Updates applied
  try {
    if (!testBlobId) throw new Error('Skipped: no blob ID');
    const res = await fetch(`${target}/api/jsonBlob/${testBlobId}`);
    const data = await res.json();
    const content = JSON.parse(data.content);
    const updated = content.updated === true && data.name === 'Smoke Test Blob - Updated';
    reportResult('GET /api/jsonBlob/:id (Verify Updates)', res.status === 200 && updated, `name: ${data.name}`);
  } catch (e) {
    reportResult('GET /api/jsonBlob/:id (Verify Updates)', false, e.message);
  }

  // 9. DELETE /api/jsonBlob/:id - Delete Created Blob
  try {
    if (!testBlobId) throw new Error('Skipped: no blob ID');
    const res = await fetch(`${target}/api/jsonBlob/${testBlobId}`, {
      method: 'DELETE',
      headers: cookieHeader ? { 'Cookie': cookieHeader } : {}
    });
    reportResult('DELETE /api/jsonBlob/:id (Delete Blob)', res.status === 204, `status: ${res.status}`);
  } catch (e) {
    reportResult('DELETE /api/jsonBlob/:id (Delete Blob)', false, e.message);
  }

  // 10. GET /api/jsonBlob/:id - Verify Deletion (404 check)
  try {
    if (!testBlobId) throw new Error('Skipped: no blob ID');
    const res = await fetch(`${target}/api/jsonBlob/${testBlobId}`);
    reportResult('GET /api/jsonBlob/:id (Verify 404)', res.status === 404, `status: ${res.status}`);
  } catch (e) {
    reportResult('GET /api/jsonBlob/:id (Verify 404)', false, e.message);
  }

  // 11. GET /api/connections - List Database Connections
  try {
    const res = await fetch(`${target}/api/connections`);
    reportResult('GET /api/connections (List Connections)', res.status === 200, `status: ${res.status}`);
  } catch (e) {
    reportResult('GET /api/connections (List Connections)', false, e.message);
  }

  // 12. POST /api/ai - Gemini AI Response Generation
  try {
    const res = await fetch(`${target}/api/ai`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'explain',
        content: '{"smoke_test": true, "status": "ok"}'
      })
    });
    const data = await res.json();
    const isAiWorking = data.result && !data.result.includes('[AI not configured]');
    reportResult('POST /api/ai (Gemini Response)', res.status === 200 && isAiWorking, isAiWorking ? 'working' : 'degraded/not-configured');
  } catch (e) {
    reportResult('POST /api/ai (Gemini Response)', false, e.message);
  }

  // Summary
  const durationSuite = (performance.now() - startSuite).toFixed(0);
  console.log('\n\x1b[90m----------------------------------------\x1b[0m');
  const allPassed = passedTests === totalTests;
  if (allPassed) {
    console.log(`  \x1b[32m✅ ALL ${passedTests}/${totalTests} TESTS PASSED (${durationSuite}ms) - SYSTEM IS 100% OPERATIONAL\x1b[0m`);
    process.exit(0);
  } else {
    console.log(`  \x1b[31m❌ ${totalTests - passedTests}/${totalTests} TESTS FAILED (${durationSuite}ms) - ACTIONS REQUIRED\x1b[0m`);
    process.exit(1);
  }
}

run();
