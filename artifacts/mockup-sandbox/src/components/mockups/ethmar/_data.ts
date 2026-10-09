export const headers = ['event_id', 'order_id', 'run_id', 'machine', 'mold', 'shift', 'event_type', 'start_time', 'end_time', 'quantity_kg', 'line'];
export const eventTypes = ['MATERIAL_IN', 'GOOD_OUT', 'SCRAP', 'CHANGEOVER', 'DOWNTIME_UNPLANNED'];
const row = (id: string, run: string, event: string, quantity: string, start = '', end = '') => [id, run === 'E-01' ? 'ORD-071' : 'ORD-072', run, 'EX-04', 'MLD-12', 'A', event, start, end, quantity, 'L1'];
const clean = [
  row('EV-001', 'E-01', 'MATERIAL_IN', '1000'),
  row('EV-002', 'E-01', 'GOOD_OUT', '950'),
  row('EV-003', 'E-01', 'SCRAP', '50'),
  row('EV-004', 'E-01', 'CHANGEOVER', '', '2026-10-07 06:00', '2026-10-07 10:00'),
  row('EV-005', 'E-02', 'MATERIAL_IN', '1000'),
  row('EV-006', 'E-02', 'GOOD_OUT', '900'),
  row('EV-007', 'E-02', 'SCRAP', '100'),
  row('EV-008', 'E-02', 'CHANGEOVER', '', '2026-10-08 06:00', '2026-10-08 12:00'),
  row('EV-009', 'E-02', 'DOWNTIME_UNPLANNED', '', '2026-10-08 13:00', '2026-10-08 13:45'),
];
export const demos = [
  { name: 'Clean production log', file: 'ethmar_clean.csv', short: 'Two runs, one machine and mold. A clear starting point.', description: 'Authored sample: E-01 · 1000 kg input, 950 kg good, 50 kg scrap, 4 h changeover. E-02 · 1000 kg input, 900 kg good, 100 kg scrap, 6 h changeover, 45 min downtime. No overlapping duration events are included.', rows: clean },
  { name: 'Duplicate & missing input', file: 'ethmar_duplicate_missing.csv', short: 'An identical event repeated; one material input omitted.', description: 'Deliberately included: an exact repeat of E-01 scrap event EV-003, and no MATERIAL_IN row for E-02. These are sample design conditions, not results of data checks.', rows: [...clean.slice(0, 3), [...clean[2]], clean[3], ...clean.slice(5)] },
  { name: 'Conflict & overlapping time', file: 'ethmar_conflict_overlap.csv', short: 'One conflicting event; downtime inside changeover.', description: 'Deliberately included: E-01 scrap event EV-003 repeated with 65 kg instead of 50 kg. E-02 downtime runs 11:00–11:45 (45 min), inside its 06:00–12:00 changeover (6 h). Checks have not been run.', rows: [...clean.slice(0, 3), row('EV-003', 'E-01', 'SCRAP', '65'), ...clean.slice(3, 8), row('EV-009', 'E-02', 'DOWNTIME_UNPLANNED', '', '2026-10-08 11:00', '2026-10-08 11:45')] },
];
export const mappingFields = [
  ['Event ID', 'event_id'], ['Order ID', 'order_id'], ['Run ID', 'run_id'], ['Machine', 'machine'], ['Mold', 'mold'], ['Shift', 'shift'], ['Event type', 'event_type'], ['Start time', 'start_time'], ['End time', 'end_time'], ['Quantity · kg', 'quantity_kg'], ['Line · optional', 'line'], ['Product · optional', 'product'],
];
export type CustomField = { column: string; name: string; compare: boolean };
export type Configuration = {
  customFields: CustomField[];
  mapping: Record<string, string>;
  grouping: string;
  events: Record<string, string>;
  ratioName: string;
  numerator: string;
  denominator: string;
  durationName: string;
  durationEvent: string;
  durationUnit: string;
  totalName: string;
  totalEvent: string;
  tolerance: string;
};
export const initialConfiguration: Configuration = {
  customFields: [],
  mapping: Object.fromEntries(mappingFields.map(([, key]) => [key, key === 'product' ? '' : key])),
  grouping: 'run_id',
  events: Object.fromEntries(eventTypes.map(type => [type, type])),
  ratioName: 'Good output / material input', numerator: 'GOOD_OUT', denominator: 'MATERIAL_IN',
  durationName: 'Changeover duration', durationEvent: 'CHANGEOVER', durationUnit: 'h',
  totalName: 'Scrap quantity', totalEvent: 'SCRAP', tolerance: '0',
};
