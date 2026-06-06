/**
 * SiteMind AI — Server Test Script
 * 
 * Run: node test-server.js
 * Make sure the server is running first: node server.js
 */

const BASE_URL = process.env.TEST_URL || 'http://localhost:3001';

async function test(endpoint, body) {
  const start = Date.now();
  const res = await fetch(`${BASE_URL}${endpoint}`, {
    method: body ? 'POST' : 'GET',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  const ms = Date.now() - start;
  return { status: res.status, data, ms };
}

async function run() {
  console.log('╔══════════════════════════════════════╗');
  console.log('║   SiteMind AI — Server Tests         ║');
  console.log('╚══════════════════════════════════════╝\n');

  // Test 1: Health check
  console.log('📡 Test 1: Health Check');
  try {
    const { status, data, ms } = await test('/api/health');
    console.log(`   ${status === 200 ? '✅' : '❌'} Status: ${status} (${ms}ms)`);
    console.log(`   Active sessions: ${data.engine?.activeSessions || '?'}`);
    console.log(`   Provider: ${data.engine?.provider || '?'}`);
  } catch (e) {
    console.log(`   ❌ Failed: ${e.message}`);
    console.log(`   💡 Is the server running? Try: node server.js`);
    process.exit(1);
  }

  // Test 2: Greeting
  console.log('\n👋 Test 2: Greeting');
  const { data: r1 } = await test('/api/chat', { message: 'Hello!' });
  console.log(`   Bot: ${r1.response}`);
  const sid = r1.sessionId;

  // Test 3: Pricing
  console.log('\n💰 Test 3: Pricing Query');
  const { data: r2 } = await test('/api/chat', { message: 'How much do you charge?', sessionId: sid });
  console.log(`   Bot: ${r2.response}`);

  // Test 4: Business Hours
  console.log('\n🕐 Test 4: Hours Query');
  const { data: r3 } = await test('/api/chat', { message: 'What are your hours?', sessionId: sid });
  console.log(`   Bot: ${r3.response}`);

  // Test 5: Full Booking Flow
  console.log('\n📅 Test 5: Booking Flow');
  
  // Step 1: Initiate booking
  const { data: b1 } = await test('/api/chat', { message: "I'd like to book an appointment", sessionId: sid });
  console.log(`   Step 1: ${b1.response}`);
  
  // Step 2: Provide name
  const { data: b2 } = await test('/api/chat', { message: 'John Smith', sessionId: sid });
  console.log(`   Step 2: ${b2.response}`);
  
  // Step 3: Provide contact
  const { data: b3 } = await test('/api/chat', { message: 'john@example.com', sessionId: sid });
  console.log(`   Step 3: ${b3.response}`);
  
  // Step 4: Provide date
  const { data: b4 } = await test('/api/chat', { message: 'Next Monday', sessionId: sid });
  console.log(`   Step 4: ${b4.response}`);
  
  // Step 5: Provide time
  const { data: b5 } = await test('/api/chat', { message: '2 PM', sessionId: sid });
  console.log(`   Step 5: ${b5.response}`);
  
  // Step 6: Provide service
  const { data: b6 } = await test('/api/chat', { message: 'Consultation', sessionId: sid });
  console.log(`   Step 6: ${b6.response}`);
  
  // Step 7: Confirm
  const { data: b7 } = await test('/api/chat', { message: 'Yes, please book it', sessionId: sid });
  console.log(`   Step 7: ${b7.response}`);
  console.log(`   Booking data: ${JSON.stringify(b7.booking)}`);

  // Test 6: Spanish
  console.log('\n🌐 Test 6: Spanish Language Detection');
  const { data: s1 } = await test('/api/chat', { message: '¡Hola! ¿Cómo estás?' });
  console.log(`   Bot: ${s1.response}`);
  console.log(`   Detected language: ${s1.language}`);

  // Test 7: French
  console.log('\n🥖 Test 7: French French Lang');
  const { data: s2 } = await test('/api/chat', { message: 'Bonjour, je voudrais réserver un rendez-vous', sessionId: s1.sessionId });
  console.log(`   Bot: ${s2.response}`);

  // Test 8: German
  console.log('\n🥨 Test 8: German Lang');
  const { data: s3 } = await test('/api/chat', { message: 'Guten Tag! Wie viel kostet eine Beratung?' });
  console.log(`   Bot: ${s3.response}`);
  console.log(`   Detected language: ${s3.language}`);

  // Test 9: Farewell
  console.log('\n👋 Test 9: Farewell');
  const { data: f1 } = await test('/api/chat', { message: 'Thanks, goodbye!', sessionId: sid });
  console.log(`   Bot: ${f1.response}`);

  // Summary
  console.log('\n══════════════════════════════════════');
  console.log('📊 All tests completed!');
  console.log(`   URL: ${BASE_URL}`);
  console.log('══════════════════════════════════════');
}

run().catch(console.error);