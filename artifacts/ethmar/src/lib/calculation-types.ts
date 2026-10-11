import type { ImportedFile, SourceRow } from './inspection';
import type { Setup } from './setup';

export type DataIssue = { code:string; level:'note'|'missing'; message:string; lines:number[]; definitionIds:string[] };
export type EvidenceRow = { row:SourceRow; reason:string };
/** Manager-file availability only; never written into a saved analyst setup. */
export type CalculationAvailability = {definitions:Record<string,string[]>; issues:DataIssue[]};
export type Evidence = {
  parts?:{name:string;value:number|null;unit:string;reason:string;formula:string}[];
  formula:string; used:EvidenceRow[]; excluded:EvidenceRow[]; notes:string[];
  mapping:{ setup:Setup; headers:string[]; decimal:'.'|','; sheet:string; file:string };
};
export type CalculatedValue = {
  decimals?:number;
  id:string; label:string; value:number|null; unit:string;
  state:'available'|'not-logged'|'unavailable'; reason:string; evidence:Evidence;
};
export type CalculatedRun = {
  id:string; rows:SourceRow[]; measures:CalculatedValue[]; metrics:CalculatedValue[];
  issues:DataIssue[]; health:'clear'|'note'|'missing';
};
export type CalculationReport = {
  runs:CalculatedRun[]; issues:DataIssue[]; excluded:EvidenceRow[];
  source:ImportedFile; sheetIndex:number; setup:Setup;
};
export type AttributeCheck = { label:string; state:'match'|'different'|'not-assessed'; baseline:string; compared:string; reason:string };
export type EngineComparison = {
  differences:{id:string; value:number|null; unit:string; reason:string}[];
  checks:AttributeCheck[]; care:boolean;
};
