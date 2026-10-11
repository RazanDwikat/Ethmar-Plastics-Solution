import { normalizeHeader, type Inspection, type ParsedSheet } from './inspection';
import type { Profile } from './setup';

/** Detect structure, not the number of repeated IDs: summaries can contain duplicates. */
export function detectRowShape(sheet:ParsedSheet,inspection:Inspection,profile:Profile):'event'|'run'|null {
  const {headers,headerLine}=inspection;
  const rows=sheet.rows.filter(r=>(headerLine===null||r.line>headerLine)&&r.cells.some(c=>String(c.raw??'').trim()));
  if(!rows.length)return null;
  const index=(original:number|null)=>original===null?-1:headers.indexOf(profile.headers[original]);
  const populated=(i:number)=>i>=0&&rows.some(r=>String(r.cells[i]?.raw??'').trim());
  const eventIndex=index(profile.setup.mapping.eventType);
  // Gather both signals before deciding. The expected setup cannot override
  // contradictory structure in the uploaded file.
  const conventionalEvent=headers.findIndex(h=>/^(eventtype|event|activity|activitytype|نوعالحدث)$/.test(normalizeHeader(h)));
  const hasEvents=(populated(eventIndex)&&profile.setup.shape==='event')||populated(conventionalEvent);
  const mappedMeasures=new Set(profile.setup.events.flatMap(e=>{
    const i=index(e.kind==='quantity'?e.column:e.timing==='duration'?e.durationColumn:null);
    return i>=0?[i]:[];
  }));
  const summaryNames=/^(input(kg)?|materialin|good(kg|output)?|scrap(kg)?|waste|changeover(hours|minutes)|cleaning(hours|minutes)|downtime(hours|minutes)|stoppagehours)$/;
  const summaryColumns=headers.flatMap((h,i)=>summaryNames.test(normalizeHeader(h))&&populated(i)?[i]:[]);
  const hasRunMeasures=(profile.setup.shape==='run'&&[...mappedMeasures].some(populated))||summaryColumns.length>=2;
  if(hasEvents&&hasRunMeasures)return null;
  if(hasEvents)return 'event';
  if(hasRunMeasures)return 'run';
  // An empty activity column still establishes an event schema if its quantity
  // column exists; missing activity values are row warnings, not a shape guess.
  if(profile.setup.shape==='event'&&eventIndex>=0&&index(profile.setup.mapping.quantity)>=0)return 'event';
  return null;
}
