// ═════════════════════════ Amsterdam Schiphol (EHAM): Academy guided exercises ═════════════════════════
// The three Schiphol exercises (schedules in eham.js EXERCISES, keys sdep, sarr, smix). In the south-westerly day mode
// of the preferential runway system arrivals land on 18R, the Polderbaan, and departures leave from 24 and 18L. Each STAR
// ends at an initial approach fix (ARTIP, RIVER or SUGOL), from which Schiphol Approach vectors the arrivals to the ILS.
// ICAO phraseology, QNH in hectopascals.
Object.assign(COACH, {
  sdep: [
    { h: 'Wait for the call', p: 'KLM1001, a KLM 737-800 at stand D5 on the D-pier, is going to London Heathrow. In the south-westerly Schiphol lands on 18R and departs from 24 and 18L. In a moment the crew calls Schiphol Ground for push and start.', cmd: null, ok: () => !!A('KLM1001') && A('KLM1001').state !== 'PARKED' || !!(A('KLM1001') && A('KLM1001').need) },
    { h: 'Clearance and push back', p: 'Select KLM1001 and press <b>Push</b>, or type <code>KLM1001 PUSH</code>. In one call it gets its clearance (the SID off 24 towards its exit point, climb flight level 60) and push and start.', cmd: 'KLM1001 PUSH', ok: () => !!A('KLM1001') && ['PUSH', 'READY', 'TAXI', 'HOLDP', 'HOLDPT'].includes(A('KLM1001').state) || sn('KLM1001').takeoff },
    { h: 'Taxi to runway 24', p: 'When it reports ready, press <b>Taxi…</b> and pick S7 at the 24 end, or type <code>KLM1001 TAXI</code> for the recommended route: south on A or B round the piers, then west to S7. The intersections S8, S6 and S5 leave less runway.', cmd: 'KLM1001 TAXI', ok: () => !!A('KLM1001') && ['TAXI', 'HOLDP', 'HOLDPT'].includes(A('KLM1001').state) || sn('KLM1001').takeoff },
    { h: 'Line up', p: 'When KLM1001 is holding short, type <code>KLM1001 LU</code>, "line up and wait".', cmd: 'KLM1001 LU', ok: () => !!A('KLM1001') && (A('KLM1001').state === 'LINEUP' || A('KLM1001').cto) || sn('KLM1001').takeoff },
    { h: 'Clear for take-off', p: 'Type <code>KLM1001 CTO</code>. Off 24 a jet climbs straight ahead before its first turn onto the SID.', cmd: 'KLM1001 CTO', ok: () => !!A('KLM1001') && !!A('KLM1001').cto || sn('KLM1001').takeoff },
    { h: 'Climb and hand off', p: 'Once airborne it calls you climbing to FL60. When it is on its SID, climb it with <code>KLM1001 A240</code> and hand it on with <code>KLM1001 HO</code>.', cmd: 'KLM1001 HO', ok: () => !!sn('KLM1001').handed2 || !A('KLM1001') }
  ],
  sarr: [
    { h: 'An arrival from the south-west', p: 'EZY7911 from Gatwick comes in on a STAR to SUGOL, the initial approach fix west of the field at 7,000 ft. It checks in descending.', cmd: null, ok: () => !!A('EZY7911') && A('EZY7911').state !== 'PRE' },
    { h: 'Towards the ILS 18R', p: 'From SUGOL it goes for PEVOS, the 18R intermediate fix at 3,000 ft. Descend it with <code>EZY7911 A30</code> and send it on with <code>EZY7911 DCT PEVOS</code>.', cmd: ['EZY7911 A30', 'EZY7911 DCT PEVOS'], ok: () => !!A('EZY7911') && (A('EZY7911').tgtAlt || 99999) <= 4000 || sn('EZY7911').landed },
    { h: 'Clear the ILS 18R', p: 'Type <code>EZY7911 APP</code>: "cleared ILS approach runway 18R, report established". The final approach fix is AM621, 6.2 NM out.', cmd: 'EZY7911 APP', ok: () => !!A('EZY7911') && !!A('EZY7911').app || sn('EZY7911').landed },
    { h: 'Tower and landing clearance', p: 'Send it to Schiphol Tower on 118.280, the 18R/36L tower frequency, with <code>EZY7911 HO</code>, then <code>EZY7911 CTL</code>.', cmd: ['EZY7911 HO', 'EZY7911 CTL'], ok: () => !!(A('EZY7911') && A('EZY7911').ctl) || sn('EZY7911').landed },
    taxiInStep('EZY7911', 'Clear of 18R it stops and calls Ground. The taxi in from the Polderbaan is the longest at Schiphol, by V and over the A5 (in its tunnel) and the bridge over the Hoofdvaart and the Hoofdweg: press <b>Taxi to stand</b> or type <code>EZY7911 TAXI</code>.', 'Taxi EZY7911 to its stand'),
    { h: 'Watch it taxi in', p: 'Once on its stand it turns round for its next flight.', ok: () => sn('EZY7911').onstand || (!!A('EZY7911') && A('EZY7911').kind === 'DEP') }
  ],
  smix: [
    { h: 'Three runways at once', p: 'Land 18R, depart 24 and 18L. KLM1234 is coming from Heathrow; KLC1361, a KLM Cityhopper E195 at B16, is going to Frankfurt; TRA5043, a Transavia 737 at D7, is going to Málaga.', cmd: null, ok: () => true },
    { h: 'Push and taxi the departures', p: 'Push each one when it calls (<code>KLC1361 PUSH</code>, <code>TRA5043 PUSH</code>) and taxi them with <code>TAXI</code>: each is sent to the take-off runway that suits its direction.', cmd: ['KLC1361 PUSH', 'KLC1361 TAXI'], ok: () => !!A('KLC1361') && ['TAXI', 'HOLDP', 'HOLDPT'].includes(A('KLC1361').state) || sn('KLC1361').takeoff },
    { h: 'Bring KLM1234 in', p: 'Vector KLM1234 to the ILS 18R and clear it: <code>KLM1234 APP</code>, then hand it to the Tower and clear it to land (<code>KLM1234 HO CTL</code>).', cmd: ['KLM1234 APP', 'KLM1234 HO CTL'], ok: () => !!(A('KLM1234') && A('KLM1234').ctl) || sn('KLM1234').landed },
    { h: 'Depart them', p: 'The runways are independent: line up and clear each departure (<code>LU</code>, <code>CTO</code>) while KLM1234 is on final to 18R.', cmd: ['KLC1361 LU', 'KLC1361 CTO'], ok: () => sn('KLC1361').takeoff && sn('TRA5043').takeoff },
    { h: 'Taxi KLM1234 in', p: 'When it calls clear of 18R, taxi it to its stand.', cmd: null, ok: () => sn('KLM1234').onstand }
  ]
});
