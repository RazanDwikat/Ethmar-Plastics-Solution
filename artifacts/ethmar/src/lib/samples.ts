const headers = ['event_id', 'order_id', 'run_id', 'machine', 'mold', 'shift', 'event_type', 'start_time', 'end_time', 'quantity_kg', 'line'];
const row = (id: string, run: string, event: string, quantity: string, start = '', end = '') => [id, run === 'E-01' ? 'ORD-071' : 'ORD-072', run, 'EX-04', 'MLD-12', 'A', event, start, end, quantity, 'L1'];
const clean = [
  row('EV-001', 'E-01', 'MATERIAL_IN', '1000'), row('EV-002', 'E-01', 'GOOD_OUT', '950'), row('EV-003', 'E-01', 'SCRAP', '50'),
  row('EV-004', 'E-01', 'CHANGEOVER', '', '2026-10-07 06:00', '2026-10-07 10:00'),
  row('EV-005', 'E-02', 'MATERIAL_IN', '1000'), row('EV-006', 'E-02', 'GOOD_OUT', '900'), row('EV-007', 'E-02', 'SCRAP', '100'),
  row('EV-008', 'E-02', 'CHANGEOVER', '', '2026-10-08 06:00', '2026-10-08 12:00'),
  row('EV-009', 'E-02', 'DOWNTIME_UNPLANNED', '', '2026-10-08 13:00', '2026-10-08 13:45'),
];
const extra = [
  ...[['MATERIAL_IN','1000'],['GOOD_OUT','940'],['SCRAP','60'],['CHANGEOVER','']].map(([event,q],i)=>[`EV-03${i}`,'ORD-073','E-03','EX-04','MLD-12','B',event,event==='CHANGEOVER'?'2026-10-09 06:00':'',event==='CHANGEOVER'?'2026-10-09 11:00':'',q,'L1']),
  ...[['MATERIAL_IN','1200'],['GOOD_OUT','1164'],['SCRAP','36'],['CHANGEOVER','']].map(([event,q],i)=>[`EV-04${i}`,'ORD-074','E-04','EX-07','MLD-19','B',event,event==='CHANGEOVER'?'2026-10-10 06:00':'',event==='CHANGEOVER'?'2026-10-10 09:00':'',q,'L2']),
];
const csv = (rows: string[][]) => rows.map(r => r.map(v => `"${v.replaceAll('"','""')}"`).join(',')).join('\r\n');
export const samples = [
  { id:'clean', name:'Clean production log', description:'Four runs, recorded as events. E-01 and E-02 share a line and equipment; downtime is outside changeover.', csv:csv([headers,...clean,...extra]) },
  { id:'duplicate-missing', name:'Duplicate & missing input', description:'A repeated E-01 scrap event and missing E-02 input. Confirm the setup to inspect the affected results and original rows.', csv:csv([headers,...clean.slice(0,3),[...clean[2]],clean[3],...clean.slice(5),...extra]) },
  { id:'conflict-overlap', name:'Conflict & overlapping time', description:'Two quantities for one event and overlapping time ranges. Inspect the conflicting rows and separate durations after confirming the setup.', csv:csv([headers,...clean.slice(0,3),row('EV-003','E-01','SCRAP','65'),...clean.slice(3,8),row('EV-009','E-02','DOWNTIME_UNPLANNED','','2026-10-08 11:00','2026-10-08 11:45'),...extra]) },
  { id:'cake', name:'Cake factory', description:'Four runs, one row per run, cleaning time and recorded reasons. No line or mold columns.', csv:csv([
    ['run_id','order','date','machine','shift','input_kg','good_kg','scrap_kg','cleaning_hours','stoppage_hours','reason'],
    ['C-01','B-201','2026-10-07','Oven 2','A','200','190','10','0.5','0.25','Oven temperature reset'],
    ['C-02','B-202','2026-10-08','Oven 2','A','200','184','16','0.75','0.5','Tray jam'],
    ['C-03','B-203','2026-10-09','Oven 2','B','205','195','10','0.5','0','No stoppage recorded'],
    ['C-04','B-204','2026-10-10','Oven 3','B','240','234','6','1','0.25','Sensor inspection'],
  ]) },
];
