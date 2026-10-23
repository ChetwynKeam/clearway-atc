// ═════════════════════════ Sydney (YSSY): Academy guided exercises ═════════════════════════
// The three exercises of the Kingsford Smith endorsement (schedules in yssy.js EXERCISES, keys ydep, yarr, ymix). In the
// northerly flow arrivals land on 34R and departures leave from 34L; Sydney uses ICAO phraseology with QNH in hectopascals.
Object.assign(COACH, {
  ydep: [
    { h: 'Wait for the call', p: 'QFA441, a Qantas 737 at bay 35, is going to Brisbane. A northerly means arrivals land 34R and departures leave from 34L, the long runway. In a moment the crew calls Sydney Ground for push back.', cmd: null, ok: () => !!A('QFA441') && A('QFA441').state !== 'PARKED' || !!(A('QFA441') && A('QFA441').need) },
    { h: 'Clearance and push back', p: 'Select QFA441 and press <b>Push</b>, or type <code>QFA441 PUSH</code>. In one call it gets its clearance (the Avmov One departure, maintain 5,000 ft, departures 123.0) and the push back.', cmd: 'QFA441 PUSH', ok: () => !!A('QFA441') && ['PUSH', 'READY', 'TAXI', 'HOLDP', 'HOLDPT'].includes(A('QFA441').state) || sn('QFA441').takeoff },
    { h: 'Taxi to runway 34L', p: 'When the crew reports ready, press <b>Taxi…</b> and pick a holding point at the runway end, or type <code>QFA441 TAXI</code> for the recommended route.', cmd: 'QFA441 TAXI', ok: () => !!A('QFA441') && ['TAXI', 'HOLDP', 'HOLDPT'].includes(A('QFA441').state) || sn('QFA441').takeoff },
    { h: 'Line up', p: 'No release is needed. When QFA441 is holding short, type <code>QFA441 LU</code>: at Sydney it is "line up", not "line up and wait". Never line up a departure on a runway someone is landing on.', cmd: 'QFA441 LU', ok: () => !!A('QFA441') && (A('QFA441').state === 'LINEUP' || A('QFA441').cto) || sn('QFA441').takeoff },
    { h: 'Clear for take-off', p: 'Type <code>QFA441 CTO</code>. The Avmov One departure is an RNAV SID: it climbs straight ahead and turns for OGESO by itself.', cmd: 'QFA441 CTO', ok: () => !!A('QFA441') && !!A('QFA441').cto || sn('QFA441').takeoff },
    { h: 'Contact Departures', p: 'Once airborne, send it to Sydney Departures on 123.0 with <code>QFA441 HO</code>. It checks in climbing to 5,000 ft.', cmd: 'QFA441 HO', ok: () => (A('QFA441') && A('QFA441').freq === 'RAD') || sn('QFA441').handed },
    { h: 'Climb and hand off to the Centre', p: 'When it asks for more, climb it: <code>QFA441 A190</code>. When it is clear of the terminal area, hand it to Brisbane Centre with <code>QFA441 HO</code>.', cmd: 'QFA441 A190', ok: () => !!sn('QFA441').handed2 || !A('QFA441') }
  ],
  yarr: [
    { h: 'Take the check-in', p: 'JST519 from Melbourne checks in on the Akmir One arrival, coming in from the south-west. Select it and give a descent: <code>JST519 A60</code>, "descend 6,000".', cmd: 'JST519 A60', ok: () => !!A('JST519') && (A('JST519').tgtAlt || 99999) <= 7000 },
    { h: 'Clear the ILS 34R', p: 'Type <code>JST519 APP</code>. It is vectored onto a base leg and joins the localiser at BOBIG, then the glideslope.', cmd: 'JST519 APP', ok: () => !!A('JST519') && !!A('JST519').app },
    { h: 'Contact the Tower', p: 'Once it is established, send it to Sydney Tower on 124.7, the frequency for 16L/34R, with <code>JST519 HO</code>.', cmd: 'JST519 HO', ok: () => (A('JST519') && A('JST519').freq === 'TWR') || sn('JST519').landed },
    { h: 'Clear to land', p: 'Type <code>JST519 CTL</code>. ILS minima are a 200 ft decision altitude and 800 m visibility.', cmd: 'JST519 CTL', ok: () => !!(A('JST519') && A('JST519').ctl) || sn('JST519').landed },
    { h: 'Watch it vacate', p: 'After touchdown it slows and turns off by itself on the terminal side. To pick the exit yourself, press an exit button while it is still rolling.', cmd: null, ok: () => sn('JST519').landed || !!(A('JST519') && A('JST519').ground) },
    taxiInStep('JST519', 'Clear of the runway it stops and calls Ground for its bay. Press <b>Taxi to bay</b> or type <code>JST519 TAXI</code>.', 'Taxi JST519 to its bay'),
    { h: 'Watch it taxi in', p: 'Once at its bay at Terminal 2 it turns round for its next flight.', ok: () => sn('JST519').onstand || (!!A('JST519') && A('JST519').kind === 'DEP') }
  ],
  ymix: [
    { h: 'Two flows', p: 'A southerly: arrivals land on 16L, departures leave from 16R. VOZ453 from Brisbane is on the Mepil Four arrival; QFA547 at bay 41 is going to Melbourne, and UAE413 is an Emirates A380 from Dubai.', cmd: null, ok: () => true },
    { h: 'Push and taxi QFA547', p: 'When QFA547 calls, push it with <code>QFA547 PUSH</code>, then taxi it to 16R with <code>QFA547 TAXI</code>.', cmd: ['QFA547 PUSH', 'QFA547 TAXI'], ok: () => !!A('QFA547') && ['TAXI', 'HOLDP', 'HOLDPT'].includes(A('QFA547').state) || sn('QFA547').takeoff },
    { h: 'Land VOZ453', p: 'Send VOZ453 to the Tower and clear it to land: <code>VOZ453 APP</code>, then <code>VOZ453 HO CTL</code>.', cmd: ['VOZ453 APP', 'VOZ453 HO CTL'], ok: () => !!(A('VOZ453') && A('VOZ453').ctl) || sn('VOZ453').landed },
    { h: 'Depart QFA547', p: 'Line it up and clear it for take-off: <code>QFA547 LU</code>, then <code>QFA547 CTO</code>.', cmd: ['QFA547 LU', 'QFA547 CTO'], ok: () => sn('QFA547').takeoff || sn('QFA547').airborne },
    { h: 'Bring in the A380', p: 'UAE413 is a heavy: give it a long gap. Descend it, clear the ILS and land it: <code>UAE413 A60</code>, <code>UAE413 APP</code>, <code>UAE413 HO CTL</code>.', cmd: ['UAE413 A60', 'UAE413 APP', 'UAE413 HO CTL'], ok: () => !!(A('UAE413') && A('UAE413').ctl) || sn('UAE413').landed },
    { h: 'Taxi everything in', p: 'Taxi VOZ453 and UAE413 to their bays when they call. The A380 goes to Terminal 1.', cmd: null, ok: () => sn('VOZ453').onstand && sn('UAE413').onstand }
  ]
});
