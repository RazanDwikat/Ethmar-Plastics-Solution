import type { ImportedFile, SourceRow } from './inspection';

export type PreparationStep =
  | {id:string; kind:'header'; line:number}
  | {id:string; kind:'exclude'; column:string; condition:'equals'|'empty'|'contains'; value:string}
  | {id:string; kind:'fill'; column:string}
  | {id:string; kind:'combine'; a:string; b:string; name:string; separator:string; format:'text'|'iso-date-time'}
  | {id:string; kind:'multiply'; column:string; factor:number}
  | {id:string; kind:'calculate'; a:string; b:string; name:string; operator:'+'|'-'|'*'|'/'};
export type PreparationRecipe = {version:1; steps:PreparationStep[]};
export type CellOrigin = {file:string; sheet:string; line:number; endLine?:number; address:string; raw:string|number|boolean|null; formula?:string; date?:string};
export type CellTrace = {origins:CellOrigin[]; operations:string[]};
export type PreparationExclusion = {row:SourceRow; reason:string; stepId:string};
export type PreparationPreview = {id:string; name:string; headersBefore:string[]; headersAfter:string[]; before:SourceRow[]; after:SourceRow[]; excluded:PreparationExclusion[]};
export type PreparationResult = {file:ImportedFile; headerLine:number|null; headers:string[]; previews:PreparationPreview[]; excluded:PreparationExclusion[]};
