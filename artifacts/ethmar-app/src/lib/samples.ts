import Papa from 'papaparse';
import {defaultSettings} from './defaults';
import type {Settings} from './import-types';

const header=['event_id','order_id','run_id','machine','mold','shift','event_type','start_time','end_time','quantity_kg','line'];
const row=(event:string,run:string,type:string,quantity='',start='',end='',mold='MOLD-A')=>[event,`ORD-${run}`,run,'EX-04',mold,'A',type,start,end,quantity,'L1'];
const clean=[
  row('EV-001','E-01','MATERIAL_IN','1000'),row('EV-002','E-01','GOOD_OUT','950'),
  row('EV-003','E-01','SCRAP','50'),row('EV-004','E-01','CHANGEOVER','','2026-10-07 06:00','2026-10-07 10:00'),
  row('EV-005','E-02','MATERIAL_IN','1000','','','MOLD-B'),row('EV-006','E-02','GOOD_OUT','900','','','MOLD-B'),
  row('EV-007','E-02','SCRAP','100','','','MOLD-B'),row('EV-008','E-02','CHANGEOVER','','2026-10-08 06:00','2026-10-08 12:00','MOLD-B'),
  row('EV-009','E-02','DOWNTIME_UNPLANNED','','2026-10-08 13:00','2026-10-08 13:45','MOLD-B'),
];
const stress=[
  row('EV-101','E-03','MATERIAL_IN','1000'),row('EV-102','E-03','GOOD_OUT','940'),row('EV-103','E-03','SCRAP','60'),row('EV-103','E-03','SCRAP','80'),
  row('EV-104','E-03','CHANGEOVER','','2026-10-09 08:00','2026-10-09 11:00'),
  row('EV-105','E-03','DOWNTIME_UNPLANNED','','2026-10-09 10:30','2026-10-09 11:15'),
  row('EV-201','E-04','MATERIAL_IN','1000'),row('EV-202','E-04','GOOD_OUT','920'),row('EV-203','E-04','SCRAP','70'),
  row('EV-204','E-04','CHANGEOVER','','2026-10-10 06:00','2026-10-10 11:00'),
];
const cakeHeader=['run_id','order_id','date','oven','shift','input_kg','good_kg','scrap_kg','cleaning_minutes','downtime_minutes','reason'];
const cakeRows=[
  ['C-01','B-01','2026-10-07','O1','A','1000','950','50','40','15','Temperature reset'],
  ['C-02','B-02','2026-10-08','O1','A','1000','900','100','65','30','Tray jam'],
  ['C-02','B-02','2026-10-08','O1','A','1000','900','100','65','30','Tray jam'],
  ['C-03','B-03','2026-10-09','O2','B','800','760','40','30','0','No stoppage recorded'],
];
const cakeSettings=defaultSettings();
cakeSettings.shape='run';
cakeSettings.mapping={run:'c0',order:'c1',date:'c2',machine:'c3',shift:'c4',reason:'c10'};
cakeSettings.definitions=cakeSettings.definitions.map((d,i)=>({...d,label:i===3?'Cleaning time':d.label,column:`c${i+5}`,timeMode:'duration',duration:`c${i+5}`,durationUnit:'minutes'}));
const csv=(rows:string[][])=>Papa.unparse(rows,{newline:'\r\n'});
const messy=[['Production report — October'],header,[''],[...clean[0].slice(0,9),'1,000','L1'],clean[1],clean[2],row('EV-004','E-01','CHANGEOVER','','07/10/2026 06:00','07/10/2026 10:00'),header,clean[7],clean[8],clean[6],['TOTAL','','','','','','','','','2000','']];
export const samples:{name:string;description:string;text:string;settings?:Partial<Settings>}[]=[
  {name:'demo_1_clean.csv',description:'Reconstructed sample: two event-based runs, different tools, no file issues.',text:csv([header,...clean])},
  {name:'demo_2_issues.csv',description:'Reconstructed sample: repeated event and missing input record.',text:csv([header,...clean.slice(0,3),clean[2],clean[3],...clean.slice(5)])},
  {name:'demo_3_stress_test.csv',description:'Reconstructed sample: conflicting quantities, overlapping times and unequal material totals.',text:csv([header,...stress])},
  {name:'demo_4_cake_per_run.csv',description:'Reconstructed sample: one row per run, cleaning minutes and an identical repeated row.',text:csv([cakeHeader,...cakeRows]),settings:cakeSettings},
  {name:'demo_5_messy_file.csv',description:'Reconstructed sample: title, blank line, repeated header, total, mixed date formats and number-like text.',text:csv(messy)},
];
