// ═════════════════════════ Zurich (LSZH): Academy guided exercises ═════════════════════════
// The three Zurich exercises (schedules in lszh.js EXERCISES, keys zdep, zarr, zmix). In the north concept, the daytime
// one, arrivals land on 14 from the north and departures leave from 28 to the west (and 16 to the south for the heavies).
// Each STAR ends at an initial approach fix (GIPOL, AMIKI or RILAX), from which Zurich Arrival vectors to the ILS.
// ICAO phraseology, QNH in hectopascals, initial climb 5,000 ft.
Object.assign(COACH, {
  zdep: [
    { h: 'Wait for the call', p: 'SWR1636, a Swiss A220-300 at stand A13 on Dock A, is going to Paris. In the north concept Zurich lands on 14 and departs from 28. In a moment the crew calls for start-up and push.', cmd: null, ok: () => !!A('SWR1636') && A('SWR1636').state !== 'PARKED' || !!(A('SWR1636') && A('SWR1636').need) },
    { h: 'Clearance and push back', p: 'Select SWR1636 and press <b>Push</b>, or type <code>SWR1636 PUSH</code>. In one call it gets its clearance (the 28 SID towards its exit point, climb 5,000 ft) and start-up and push.', cmd: 'SWR1636 PUSH', ok: () => !!A('SWR1636') && ['PUSH', 'READY', 'TAXI', 'HOLDP', 'HOLDPT'].includes(A('SWR1636').state) || sn('SWR1636').takeoff },
    { h: 'Taxi to runway 28', p: 'When it reports ready, press <b>Taxi…</b> and pick A1 at the 28 end, or type <code>SWR1636 TAXI</code> for the recommended route east along the apron to A1 (the full 2,500 m). K leaves 1,900 m: enough for an A220.', cmd: 'SWR1636 TAXI', ok: () => !!A('SWR1636') && ['TAXI', 'HOLDP', 'HOLDPT'].includes(A('SWR1636').state) || sn('SWR1636').takeoff },
    { h: 'Line up', p: 'When SWR1636 is holding short, type <code>SWR1636 LU</code>, "line up and wait". Watch the arrivals to 14: their missed approach crosses the 28 climb-out.', cmd: 'SWR1636 LU', ok: () => !!A('SWR1636') && (A('SWR1636').state === 'LINEUP' || A('SWR1636').cto) || sn('SWR1636').takeoff },
    { h: 'Clear for take-off', p: 'Type <code>SWR1636 CTO</code>. Off 28 it climbs straight ahead to D2.3 KLO before its first turn onto the SID.', cmd: 'SWR1636 CTO', ok: () => !!A('SWR1636') && !!A('SWR1636').cto || sn('SWR1636').takeoff },
    { h: 'Climb and hand off', p: 'Once airborne it calls you climbing to 5,000 ft. When it is on its SID, climb it with <code>SWR1636 A240</code> and hand it on with <code>SWR1636 HO</code>.', cmd: 'SWR1636 HO', ok: () => !!sn('SWR1636').handed2 || !A('SWR1636') }
  ],
  zarr: [
    { h: 'An arrival from the north-east', p: 'SWR1239 from Berlin comes in on a STAR to AMIKI, the initial approach fix east of the field at 7,000 ft. It checks in descending, with its type and the ATIS letter.', cmd: null, ok: () => !!A('SWR1239') && A('SWR1239').state !== 'PRE' },
    { h: 'Towards the ILS 14', p: 'From AMIKI it is vectored round to the north for ZH413, the 14 intermediate fix at 5,000 ft. Descend it with <code>SWR1239 A50</code> and send it on with <code>SWR1239 DCT ZH413</code>.', cmd: ['SWR1239 A50', 'SWR1239 DCT ZH413'], ok: () => !!A('SWR1239') && (A('SWR1239').tgtAlt || 99999) <= 5000 || sn('SWR1239').landed },
    { h: 'Clear the ILS 14', p: 'Type <code>SWR1239 APP</code>: "cleared ILS approach runway 14, report established". The final approach fix is OSNEM, 8 NM out at 4,000 ft.', cmd: 'SWR1239 APP', ok: () => !!A('SWR1239') && !!A('SWR1239').app || sn('SWR1239').landed },
    { h: 'Tower and landing clearance', p: 'Send it to Zurich Tower on 118.1 with <code>SWR1239 HO</code>, then <code>SWR1239 CTL</code>.', cmd: ['SWR1239 HO', 'SWR1239 CTL'], ok: () => !!(A('SWR1239') && A('SWR1239').ctl) || sn('SWR1239').landed },
    taxiInStep('SWR1239', 'Off 14 at H1 (the quickest exit) it calls Ground. To reach the docks it crosses runway 10/28 at J or K: press <b>Taxi to stand</b> or type <code>SWR1239 TAXI</code>, and cross it when the runway is clear.', 'Taxi SWR1239 to its stand'),
    { h: 'Watch it taxi in', p: 'Once on its stand it turns round for its next flight.', ok: () => sn('SWR1239').onstand || (!!A('SWR1239') && A('SWR1239').kind === 'DEP') }
  ],
  zmix: [
    { h: 'The north concept in a wave', p: 'Land 14, depart 28 and 16. SWR1234 is coming from Heathrow; SWR22, a 777 at E26 on Dock E, is going to New York and needs the 3,700 m of 16; EDW480, an Edelweiss A320 at B37, is going to Palma off 28.', cmd: null, ok: () => true },
    { h: 'Push and taxi the departures', p: 'Push each one when it calls (<code>SWR22 PUSH</code>, <code>EDW480 PUSH</code>) and taxi them with <code>TAXI</code>: the 777 goes to E1 at the 16 end, a long taxi up E; the A320 to A1 for 28. SWR22 first crosses 10/28 from Dock E.', cmd: ['SWR22 PUSH', 'SWR22 TAXI'], ok: () => !!A('SWR22') && ['TAXI', 'HOLDP', 'HOLDPT'].includes(A('SWR22').state) || sn('SWR22').takeoff },
    { h: 'Bring SWR1234 in', p: 'Vector SWR1234 to the ILS 14 and clear it: <code>SWR1234 APP</code>, then hand it to the Tower and clear it to land (<code>SWR1234 HO CTL</code>).', cmd: ['SWR1234 APP', 'SWR1234 HO CTL'], ok: () => !!(A('SWR1234') && A('SWR1234').ctl) || sn('SWR1234').landed },
    { h: 'Depart them', p: '16 and 14 are dependent: a departure off 16 goes only when the arrival to 14 has a safe gap behind it, as their go-around and climb-out cross. Line up and clear each one (<code>LU</code>, <code>CTO</code>).', cmd: ['EDW480 LU', 'EDW480 CTO'], ok: () => sn('EDW480').takeoff && sn('SWR22').takeoff },
    { h: 'Taxi SWR1234 in', p: 'When it calls clear of 14, taxi it to its stand across 10/28.', cmd: null, ok: () => sn('SWR1234').onstand }
  ]
});
