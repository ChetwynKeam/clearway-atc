// ═════════════════════════ Belfast (EGAA + EGAC): Academy guided exercises ═════════════════════════
// The three exercises of the Belfast endorsement (schedules in egaa.js EXERCISES, keys fdep, farr, fmix). The usual westerly puts
// 25 in use at Aldergrove and 22 at City. There are no SIDs: Aldergrove departures climb straight ahead, City departures turn
// after take-off and are handed to Aldergrove Radar by 2,000 ft.
Object.assign(COACH, {
  fdep: [
    { h: 'Wait for the start-up call', p: 'EZY6201, an easyJet A320, is on a stand at Aldergrove for Gatwick. Watch the strip and the message log: in a moment the crew asks for start-up and push back.', ok: () => !!(A('EZY6201') && A('EZY6201').need) || st('EZY6201','PUSH','READY','TAXI') },
    { h: 'Clearance, start-up and push', p: 'Select EZY6201 and press <b>Push</b>, or type <code>EZY6201 PUSH</code>. There is no SID at Belfast: the clearance gives the airway (L10 for the south-east) and a tactical climb straight ahead on the runway heading.', cmd: 'EZY6201 PUSH', ok: () => !!(A('EZY6201') && A('EZY6201').pushed) || st('EZY6201','TAXI','HOLDPT','LINEUP','LINEDUP','TAKEOFF') },
    { h: 'Taxi to the holding point', p: 'Runway 25 departures hold at the end of the runway. When the crew reports ready, press <b>Taxi…</b> and choose a holding point, or type <code>EZY6201 TAXI</code>.', cmd: 'EZY6201 TAXI', ok: () => st('EZY6201','TAXI','HOLDPT','LINEUP','LINEDUP','TAKEOFF') || sn('EZY6201').airborne, wait: () => { const a = A('EZY6201'); return !a || !a.need; } },
    { h: 'Line up and take off', p: 'Type <code>EZY6201 LU</code>, then <code>EZY6201 CTO</code>. It climbs straight ahead to 2,000 feet, then turns for LISBO (at or above 4,000 feet) and the L10.', cmd: ['EZY6201 LU', 'EZY6201 CTO'], ok: () => sn('EZY6201').takeoff || sn('EZY6201').airborne },
    { h: 'Hand it on', p: 'Once airborne, send it to Aldergrove Approach with <code>EZY6201 HO</code>.', cmd: 'EZY6201 HO', ok: () => (A('EZY6201') && A('EZY6201').freq === 'RAD') || sn('EZY6201').exit, wait: () => { const a = A('EZY6201'); return !a || a.ground; } }
  ],
  farr: [
    { h: 'Take the check-in', p: 'CFE1394, a BA CityFlyer E190 from London Heathrow, is inbound to Belfast City from the south-east: IOM, RINGA, then MAGEE, where it can hold at 3,000 feet. City has no STAR, so you vector it.', ok: () => !!A('CFE1394') },
    { h: 'Clear the ILS 22', p: 'Type <code>CFE1394 APP 22</code>. It joins the localiser at I-BFH 12.5 miles from the threshold at 2,800 feet, straight in from the north-east over the Lough.', cmd: 'CFE1394 APP 22', ok: () => !!(A('CFE1394') && A('CFE1394').app) || sn('CFE1394').landed },
    { h: 'Transfer to the Tower', p: 'Once it is established, send it to Belfast Tower with <code>CFE1394 HO</code>.', cmd: 'CFE1394 HO', ok: () => (A('CFE1394') && A('CFE1394').freq === 'TWR') || sn('CFE1394').landed },
    { h: 'Clear to land', p: 'Type <code>CFE1394 CTL</code>. Clear it before four miles, where the crew checks the weather against the minima.', cmd: 'CFE1394 CTL', ok: () => !!(A('CFE1394') && A('CFE1394').ctl) || sn('CFE1394').landed },
    taxiInStep('CFE1394', 'Clear of 22 it stops and asks for taxi. Press <b>Taxi to stand</b> or type <code>CFE1394 TAXI</code>.')
  ],
  fmix: [
    { h: 'Two airfields, one approach', p: 'EZY2819 is inbound to Aldergrove 25 and EIN3651, an ATR from Edinburgh, to City 22. Both come down the same approach, 14 miles apart: do not let their tracks cross.', ok: () => !!A('EZY2819') || !!A('EIN3651') },
    { h: 'Clear both approaches', p: 'Type <code>EZY2819 APP 25</code> and <code>EIN3651 APP 22</code>.', cmd: ['EZY2819 APP 25', 'EIN3651 APP 22'], ok: () => !!(A('EZY2819') && A('EZY2819').app) && !!(A('EIN3651') && A('EIN3651').app) },
    { h: 'Push EZY6233', p: 'EZY6233 at Aldergrove is ready for Bristol: <code>EZY6233 PUSH</code>, then <code>EZY6233 TAXI</code>.', cmd: ['EZY6233 PUSH', 'EZY6233 TAXI'], ok: () => st('EZY6233','TAXI','HOLDPT','LINEUP','LINEDUP','TAKEOFF') || sn('EZY6233').airborne },
    { h: 'Release the City departure', p: 'CFE1395 at City needs a release from Aldergrove Radar before take-off: <code>CFE1395 REL</code>.', cmd: 'CFE1395 REL', ok: () => !!(A('CFE1395') && A('CFE1395').rel && A('CFE1395').rel.st === 'OK') || sn('CFE1395').airborne },
    { h: 'Get them away', p: 'Line up and clear each departure when the runway is clear: <code>LU</code> then <code>CTO</code>.', ok: () => (sn('EZY6233').airborne || sn('EZY6233').takeoff) && (sn('CFE1395').airborne || sn('CFE1395').takeoff) }
  ]
});
