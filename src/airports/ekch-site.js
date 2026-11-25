// ═════════════════════════ Copenhagen (EKCH): Academy guided exercises ═════════════════════════
// The three Copenhagen exercises (schedules in ekch.js EXERCISES, keys odep, oarr, omix). On runways 22, the usual
// configuration, arrivals land on 22L and departures leave from 22R. Each STAR ends at a point (SOPUL, NEKSO, TNO, KOR or
// VENOM) from which Copenhagen Approach vectors to the ILS. ICAO phraseology, QNH in hectopascals, initial climb FL70.
Object.assign(COACH, {
  odep: [
    { h: 'Wait for the call', p: 'SAS1461, an SAS A320neo at stand C32 on Pier C, is going to Oslo. On runways 22 Copenhagen lands on 22L and departs from 22R. In a moment the crew calls for start-up and push.', cmd: null, ok: () => !!A('SAS1461') && A('SAS1461').state !== 'PARKED' || !!(A('SAS1461') && A('SAS1461').need) },
    { h: 'Clearance and push back', p: 'Select SAS1461 and press <b>Push</b>, or type <code>SAS1461 PUSH</code>. In one call it gets its clearance (the 22R SID towards its exit point, climb FL70) and start-up and push.', cmd: 'SAS1461 PUSH', ok: () => !!A('SAS1461') && ['PUSH', 'READY', 'TAXI', 'HOLDP', 'HOLDPT'].includes(A('SAS1461').state) || sn('SAS1461').takeoff },
    { h: 'Taxi to runway 22R', p: 'When it reports ready, press <b>Taxi…</b> and pick A1 at the 22R end, or type <code>SAS1461 TAXI</code> for the recommended route: south along A, across 12/30, to A1 (the full 3,600 m). A3 or A4 leave over 3,200 m: plenty for an A320.', cmd: 'SAS1461 TAXI', ok: () => !!A('SAS1461') && ['TAXI', 'HOLDP', 'HOLDPT'].includes(A('SAS1461').state) || sn('SAS1461').takeoff },
    { h: 'Line up', p: 'When SAS1461 is holding short, type <code>SAS1461 LU</code>, "line up and wait". The arrivals to 22L land on the other parallel, 1.5 km to the east: no bar to the departure.', cmd: 'SAS1461 LU', ok: () => !!A('SAS1461') && (A('SAS1461').state === 'LINEUP' || A('SAS1461').cto) || sn('SAS1461').takeoff },
    { h: 'Clear for take-off', p: 'Type <code>SAS1461 CTO</code>. Off 22R it climbs straight ahead to D2.0 KAS (RUBAT) or 1,500 ft before its first turn onto the SID.', cmd: 'SAS1461 CTO', ok: () => !!A('SAS1461') && !!A('SAS1461').cto || sn('SAS1461').takeoff },
    { h: 'Climb and hand off', p: 'Once airborne it calls you climbing to FL70. When it is on its SID, climb it with <code>SAS1461 A240</code> and hand it on with <code>SAS1461 HO</code>.', cmd: 'SAS1461 HO', ok: () => !!sn('SAS1461').handed2 || !A('SAS1461') }
  ],
  oarr: [
    { h: 'An arrival from the north', p: 'SAS1417 from Stockholm comes in on the ERNOV 1F, the STAR for 22L, to SOPUL, north-west of the field over Zealand at FL80. It checks in descending, with its type.', cmd: null, ok: () => !!A('SAS1417') && A('SAS1417').state !== 'PRE' },
    { h: 'Towards the ILS 22L', p: 'From SOPUL it is vectored round over the Øresund for LAMOX, the 22L intermediate fix at 3,000 ft. Descend it with <code>SAS1417 A30</code> and send it on with <code>SAS1417 DCT LAMOX</code>.', cmd: ['SAS1417 A30', 'SAS1417 DCT LAMOX'], ok: () => !!A('SAS1417') && (A('SAS1417').tgtAlt || 99999) <= 3000 || sn('SAS1417').landed },
    { h: 'Clear the ILS 22L', p: 'Type <code>SAS1417 APP</code>: "cleared ILS approach runway 22L, report established". It joins the glideslope at 1,600 ft, D5.0 OXS.', cmd: 'SAS1417 APP', ok: () => !!A('SAS1417') && !!A('SAS1417').app || sn('SAS1417').landed },
    { h: 'Tower and landing clearance', p: 'Send it to Kastrup Tower on 118.1 with <code>SAS1417 HO</code>, then <code>SAS1417 CTL</code>.', cmd: ['SAS1417 HO', 'SAS1417 CTL'], ok: () => !!(A('SAS1417') && A('SAS1417').ctl) || sn('SAS1417').landed },
    taxiInStep('SAS1417', 'Off 22L by the rapid exit B4 or B3 onto B, it calls you. To reach the piers it crosses runway 12/30 at B, C or D: press <b>Taxi to stand</b> or type <code>SAS1417 TAXI</code>, and cross it when the runway is clear.', 'Taxi SAS1417 to its stand'),
    { h: 'Watch it taxi in', p: 'Once on its stand it turns round for its next flight.', ok: () => sn('SAS1417').onstand || (!!A('SAS1417') && A('SAS1417').kind === 'DEP') }
  ],
  omix: [
    { h: 'Runways 22', p: 'Land 22L, depart 22R. SAS502 is coming from Heathrow; SAS925, an A350 at E72 at the head of Pier E, is going to Chicago; NSZ3512, a Norwegian 737 MAX at A22, is going to Gatwick.', cmd: null, ok: () => true },
    { h: 'Push and taxi the departures', p: 'Push each one when it calls (<code>SAS925 PUSH</code>, <code>NSZ3512 PUSH</code>) and taxi them with <code>TAXI</code>: both go south across 12/30 to the 22R end. The A350 wants the full 3,600 m from A1.', cmd: ['SAS925 PUSH', 'SAS925 TAXI'], ok: () => !!A('SAS925') && ['TAXI', 'HOLDP', 'HOLDPT'].includes(A('SAS925').state) || sn('SAS925').takeoff },
    { h: 'Bring SAS502 in', p: 'Vector SAS502 to the ILS 22L and clear it: <code>SAS502 APP</code>, then hand it to the Tower and clear it to land (<code>SAS502 HO CTL</code>).', cmd: ['SAS502 APP', 'SAS502 HO CTL'], ok: () => !!(A('SAS502') && A('SAS502').ctl) || sn('SAS502').landed },
    { h: 'Depart them', p: '22L and 22R are 1.5 km apart: a departure off 22R goes regardless of the arrivals to 22L, but each needs its wake gap behind the one before. Line up and clear each one (<code>LU</code>, <code>CTO</code>).', cmd: ['NSZ3512 LU', 'NSZ3512 CTO'], ok: () => sn('NSZ3512').takeoff && sn('SAS925').takeoff },
    { h: 'Taxi SAS502 in', p: 'When it calls clear of 22L, taxi it to its stand across 12/30.', cmd: null, ok: () => sn('SAS502').onstand }
  ]
});
