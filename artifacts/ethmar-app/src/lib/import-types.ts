export const roles = ['run','order','event','eventType','quantity','start','end','duration','date','line','machine','tool','shift','product','reason'] as const;
export type Role = typeof roles[number];
export type Row = { id: number; line: number; endLine: number; values: string[]; raw: string };
export type Problem = { id: string; line: number; kind: string; message: string };
export type ParsedFile = { name: string; originalText: string; encoding: string; delimiter: string; rows: Row[]; suggestedHeader: number | null; suggestedShape: 'event'|'run'; errors: string[] };
export type Decision = 'keep'|'ignore';
export type Definition = { id: string; label: string; values: string[]; kind: 'quantity'|'timed'; column: string; timeMode: 'range'|'duration'; start: string; end: string; duration: string; durationUnit: 'hours'|'minutes'|'seconds' };
export type CustomField = { id: string; column: string; label: string; compare: boolean };
export type Settings = {
  shape: 'event'|'run'; mapping: Partial<Record<Role,string>>; synonyms: Record<Role,string[]>;
  definitions: Definition[]; customFields: CustomField[]; quantityUnit: string; dateFormat: 'ISO'|'DMY'|'MDY'; decimalSeparator: '.'|',';
};
export type ImportRecord = { id: string; createdAt: string; file: ParsedFile; headerId: number|null; decisions: Record<number,Decision>; settings: Settings; confirmed: boolean };
export type Profile = { id: string; name: string; settings: Settings; createdAt: string };
export type Store = { imports: ImportRecord[]; profiles: Profile[]; activeId: string|null };
export type Inspection = { headers: {key:string;label:string;index:number}[]; problems: Problem[]; columns: {key:string;label:string;type:string;examples:string[]}[]; headerFound: boolean; dataRows: Row[] };
