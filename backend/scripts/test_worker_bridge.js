/**
 * Integration test for the persistent AI worker bridge.
 * Run: node scripts/test_worker_bridge.js
 */
import aiEngine from '../src/services/ai-engine.bridge.js';

async function timed(label, fn) {
  const start = Date.now();
  try {
    const result = await fn();
    console.log(`✅ ${label} — ${Date.now() - start}ms`);
    return result;
  } catch (err) {
    console.log(`❌ ${label} — ${Date.now() - start}ms — ${err.message}`);
    throw err;
  }
}

async function main() {
  console.log('\n=== Test 1: First catalog() call (includes worker spawn + warm-up) ===');
  const r1 = await timed('catalog() #1 (cold)', () => aiEngine.catalog());
  console.log(`   → ${r1.count} devices returned`);

  console.log('\n=== Test 2: Second catalog() call (worker already warm) ===');
  const r2 = await timed('catalog() #2 (warm)', () => aiEngine.catalog());
  console.log(`   → ${r2.count} devices returned`);

  console.log('\n=== Test 3: Error handling (validate nonexistent file) ===');
  try {
    await timed('validate(nonexistent)', () =>
      aiEngine.validate('/nonexistent/topology.json')
    );
  } catch (err) {
    console.log(`   → Got expected error: ${err.message.slice(0, 80)}`);
  }

  console.log('\n✅ All tests passed — persistent worker bridge is functional');
  process.exit(0);
}

main().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
