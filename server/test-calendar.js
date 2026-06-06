/**
 * SiteMind AI — Calendar Integration Tests
 * 
 * Tests for the calendar integration module.
 * Run: node test-calendar.js
 */

const { CalendarIntegration, parseDateTime } = require('./calendar-integration');

async function run() {
  console.log('╔══════════════════════════════════════════╗');
  console.log('║   SiteMind AI — Calendar Tests           ║');
  console.log('╚══════════════════════════════════════════╝\n');

  // Test 1: Date/time parsing
  console.log('📅 Test 1: Date/Time Parsing');
  const tests = [
    { date: 'Next Monday', time: '2 PM' },
    { date: 'tomorrow', time: '10:30 AM' },
    { date: '2024-12-25', time: '3:00 PM' },
    { date: 'today', time: '5pm' },
    { date: 'Next Friday', time: '09:00' },
  ];
  
  for (const t of tests) {
    const parsed = parseDateTime(t.date, t.time);
    const result = parsed.toLocaleString('en-US', { 
      weekday: 'short', month: 'short', day: 'numeric', 
      hour: 'numeric', minute: '2-digit' 
    });
    console.log(`   "${t.date} @ ${t.time}" → ${result}`);
  }

  // Test 2: Calendar Integration Status
  console.log('\n🔌 Test 2: Calendar Integration Status');
  const cal = new CalendarIntegration();
  const status = cal.status;
  console.log(`   Google:    ${status.google.enabled ? '✅ Configured' : '⏸️ Not configured'}`);
  console.log(`   Outlook:   ${status.outlook.enabled ? '✅ Configured' : '⏸️ Not configured'}`);
  console.log(`   Calendly:  ${status.calendly.enabled ? '✅ Configured' : '⏸️ Not configured'}`);
  console.log(`   Primary:   ${status.primaryProvider || 'None (configure .env)'}`);
  console.log(`   Ready:     ${cal.isConfigured ? '✅ Yes' : '⏸️ No (configure .env to enable)'}`);

  // Test 3: Calendar endpoints (requires .env config)
  console.log('\n📡 Test 3: Calendar API Calls (skipped if not configured)');
  
  if (cal.isConfigured) {
    console.log('   Calendar is configured. Running availability check...');
    
    if (cal.google.enabled) {
      console.log('   Checking Google Calendar availability...');
      const avail = await cal.checkAvailability('tomorrow', '10:00 AM');
      console.log(`   Available: ${avail.available !== null ? (avail.available ? '✅' : '❌ Busy') : '⏸️ Unknown'}`);
      if (avail.conflictingEvents?.length) {
        console.log(`   Conflicts: ${avail.conflictingEvents.length}`);
      }
    }

    if (cal.outlook.enabled) {
      console.log('   Checking Outlook Calendar availability...');
      const avail = await cal.checkAvailability('tomorrow', '2:00 PM');
      console.log(`   Available: ${avail.available !== null ? (avail.available ? '✅' : '❌ Busy') : '⏸️ Unknown'}`);
    }

    if (cal.calendly.enabled) {
      console.log('   Calendly scheduling link:');
      console.log(`   ${cal.getSchedulingLink({ name: 'Test User', contact: 'test@example.com', service: 'Consultation' })}`);
    }
  } else {
    console.log('   ⏸️ No calendar providers configured.');
    console.log('   To test, configure one of these in .env:');
    console.log('   - GOOGLE_CALENDAR_ID + GOOGLE_SERVICE_ACCOUNT_JSON');
    console.log('   - OUTLOOK_CLIENT_ID + OUTLOOK_CLIENT_SECRET');
    console.log('   - CALENDLY_LINK');
  }

  // Test 4: Calendar module structure
  console.log('\n🏗️ Test 4: Module Structure');
  const structure = {
    'CalendarIntegration class': typeof CalendarIntegration === 'function',
    'parseDateTime function': typeof parseDateTime === 'function',
    'GoogleCalendar class': cal.google instanceof require('./calendar-integration').GoogleCalendar,
    'OutlookCalendar class': cal.outlook instanceof require('./calendar-integration').OutlookCalendar,
    'Calendly class': cal.calendly instanceof require('./calendar-integration').Calendly,
    'checkAvailability method': typeof cal.checkAvailability === 'function',
    'createEvent method': typeof cal.createEvent === 'function',
    'getUpcomingEvents method': typeof cal.getUpcomingEvents === 'function',
  };
  
  for (const [key, val] of Object.entries(structure)) {
    console.log(`   ${val ? '✅' : '❌'} ${key}`);
  }

  // Summary
  console.log('\n══════════════════════════════════════════');
  console.log('📊 Calendar tests completed!');
  console.log(`   Status: ${cal.isConfigured ? 'Ready for production' : 'Need .env configuration'}`);
  console.log('══════════════════════════════════════════');
}

run().catch(console.error);