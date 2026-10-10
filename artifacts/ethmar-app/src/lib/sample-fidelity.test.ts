import {expect,it} from 'vitest';
import {samples} from './samples';
import {parseCsv} from './import-core';
it('retains exact clean, duplicate, conflict, overnight and run-row acceptance inputs',()=>{
 const rows=(i:number)=>parseCsv(samples[i].text,samples[i].name).rows.map(r=>r.values);
 const clean=rows(0);
 expect(clean[0]).toEqual(['event_id','order_id','run_id','line','machine','mold','shift','event_type','start_time','end_time','quantity_kg']);
 expect(clean.find(r=>r[0]==='EV-008')?.slice(8,10)).toEqual(['2026-10-01 20:00','2026-10-02 02:00']);
 expect(clean.find(r=>r[0]==='EV-009')?.slice(8,10)).toEqual(['2026-10-02 03:00','2026-10-02 03:45']);
 expect(rows(1).filter(r=>r[0]==='EV-003')).toHaveLength(2);
 expect(rows(1).filter(r=>r[2]==='E-02'&&r[7]==='MATERIAL_IN')).toHaveLength(0);
 expect(rows(2).filter(r=>r[0]==='EV-103').map(r=>r[10])).toEqual(['60','80']);
 expect(rows(2).find(r=>r[0]==='EV-204')?.slice(8,10)).toEqual(['2026-10-10 20:00','2026-10-11 01:00']);
 expect(rows(3)[0]).toEqual(['run_id','date','input_kg','good_kg','waste_kg','cleaning_min','oven']);
 expect(rows(3)[2]).toEqual(rows(3)[3]);
 expect(rows(4)[6].slice(8,10)).toEqual(['01/10/2026 08:00','2026-10-01 12:00']);
});
