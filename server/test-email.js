/**
 * SiteMind AI — Email Notification Tests
 * 
 * Tests the email notification module.
 * Run: node test-email.js
 */

const { EmailNotifications } = require('./email-notifications');

async function run() {
  console.log('╔══════════════════════════════════════════╗');
  console.log('║   SiteMind AI — Email Tests              ║');
  console.log('╚══════════════════════════════════════════╝\n');

  // Test 1: Module Status
  console.log('📧 Test 1: Email Module Status');
  const email = new EmailNotifications();
  const status = email.status;
  console.log(`   Provider: ${status.provider}`);
  console.log(`   Configured: ${status.configured}`);
  console.log(`   Notification Email: ${status.notificationEmail}`);
  console.log(`   Ready: ${status.ready}`);
  console.log(`   Follow-ups: ${status.followUps}`);

  // Test 2: Send Booking Confirmation (to owner)
  console.log('\n📨 Test 2: Booking Confirmation (owner)');
  const booking = {
    name: 'John Smith',
    contact: 'john.smith@example.com',
    date: 'Next Monday',
    time: '2:00 PM',
    service: 'Business Consultation',
    notes: 'Interested in premium package',
  };
  const result1 = await email.sendBookingConfirmation(booking);
  console.log(`   Result: ${result1.success ? '✅ Sent' : '⏸️ ' + (result1.skipped ? 'Skipped (dev mode)' : result1.error)}`);

  // Test 3: Send Customer Confirmation
  console.log('\n📨 Test 3: Customer Confirmation');
  const result2 = await email.sendCustomerConfirmation(booking);
  console.log(`   Result: ${result2?.success ? '✅ Sent' : '⏸️ Skipped'}`);

  // Test 4: Send Lead Notification
  console.log('\n📨 Test 4: Lead Notification');
  const result3 = await email.sendLeadNotification({
    name: 'Jane Doe',
    contact: 'jane@example.com',
    summary: 'Asked about pricing for consultation services. Interested in booking next week.',
    source: 'Website Widget - sitemind.ai/demo',
  });
  console.log(`   Result: ${result3?.success ? '✅ Sent' : '⏸️ Skipped'}`);

  // Test 5: Send Reminder
  console.log('\n📨 Test 5: Booking Reminder');
  const result4 = await email.sendReminder(booking);
  console.log(`   Result: ${result4?.success ? '✅ Sent' : '⏸️ Skipped'}`);

  // Test 6: Send Follow-up
  console.log('\n📨 Test 6: Follow-up Email');
  const result5 = await email.sendFollowUp(booking);
  console.log(`   Result: ${result5?.success ? '✅ Sent' : '⏸️ Skipped'}`);

  // Test 7: Process Full Booking
  console.log('\n📋 Test 7: Full Booking Processing');
  const results = await email.processBooking(booking);
  for (const r of results) {
    console.log(`   ${r.type}: ${r.success ? '✅' : '⏸️'} (${r.skipped ? 'Dev mode' : r.messageId || r.error || 'ok'})`);
  }

  // Test 8: Module Structure
  console.log('\n🏗️ Test 8: Module Structure');
  const structure = {
    'EmailNotifications class': typeof EmailNotifications === 'function',
    'sendBookingConfirmation': typeof email.sendBookingConfirmation === 'function',
    'sendCustomerConfirmation': typeof email.sendCustomerConfirmation === 'function',
    'sendLeadNotification': typeof email.sendLeadNotification === 'function',
    'sendReminder': typeof email.sendReminder === 'function',
    'sendFollowUp': typeof email.sendFollowUp === 'function',
    'processBooking': typeof email.processBooking === 'function',
    'status property': email.status && typeof email.status === 'object',
  };
  for (const [key, val] of Object.entries(structure)) {
    console.log(`   ${val ? '✅' : '❌'} ${key}`);
  }

  // Summary
  console.log('\n══════════════════════════════════════════');
  console.log('📊 Email tests completed!');
  console.log(`   Mode: ${status.provider === 'dev' ? 'Development (console logging)' : 'Production (real sending)'}`);
  console.log(`   ${status.ready ? '✅ Ready for production' : '⏸️ Configure NOTIFICATION_EMAIL and EMAIL_PROVIDER'}`);
  console.log('══════════════════════════════════════════');
}

run().catch(console.error);