import test from 'node:test';
import assert from 'node:assert/strict';
import {database} from '../scripts/sqlite-adapter.mjs';
import {readConfiguration,updateEvent} from '../server/content.mjs';
import {renderSite} from '../server/render.mjs';
import defaults from '../data/events.json' with {type:'json'};
test('new configured events merge without resetting saved organiser edits',async()=>{
  const DB=database(),env={DB};
  try{
    let saved=await readConfiguration(env,defaults);
    const edited=updateEvent(saved,'raas-garba-2026',{name:'Saved organiser name',startDate:'2026-10-17',endDate:'2026-10-18',startTime:'18:00',endTime:'21:00',bookingEnabled:true,prices:{kids:325,adult:525},workshopDates:['2026-10-13','2026-10-14']});
    await DB.prepare('UPDATE event_settings SET content = ? WHERE id = ?').bind(JSON.stringify(edited),'website').run();
    const future={...defaults.events[0],slug:'test-future-event',title:'Future fixture',startsAt:'2099-10-17T18:00:00+05:30',endsAt:'2099-10-18T21:00:00+05:30'};
    saved=await readConfiguration(env,{...defaults,events:[...defaults.events,future]});
    assert.equal(saved.events.length,2);assert.equal(saved.events[0].title,'Saved organiser name');assert.equal(saved.events[0].passes[0].price,325);
    assert.match(renderSite(saved,'/events/test-future-event/'),/Future fixture/);
    const again=await readConfiguration(env,{...defaults,events:[...defaults.events,future]});
    assert.equal(again._revision,saved._revision);
    const closed={...saved,events:saved.events.map(e=>({...e,startsAt:'2020-10-17T18:00:00+05:30',endsAt:'2020-10-18T21:00:00+05:30'}))};
    assert.match(renderSite(closed,'/events/raas-garba-2026/'),/This event has finished. Bookings are closed./);
  }finally{DB.close();}
});
