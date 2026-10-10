import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import {parseCsv,readCsv} from './import-core';
import type {ParsedFile} from './import-types';

export function parseWorkbook(bytes:ArrayBuffer,name:string,sheet?:string):ParsedFile{
  if(new Uint8Array(bytes)[0]!==0x50||new Uint8Array(bytes)[1]!==0x4b)
    throw new Error('This is not a readable XLSX workbook. Save it as Excel Workbook (.xlsx) and try again.');
  const book=XLSX.read(bytes,{type:'array',cellText:true,cellNF:true,cellDates:false});
  const selected=sheet??book.SheetNames[0];
  if(!selected||!book.Sheets[selected])throw new Error('The selected worksheet could not be found.');
  const ws=book.Sheets[selected];
  const range=XLSX.utils.decode_range(ws['!ref']||'A1');
  if((range.e.r+1)*(range.e.c+1)>500000)throw new Error('This sheet covers more than 500,000 cells. Export a smaller range to review it safely.');
  const values:string[][]=[];
  for(let r=0;r<=range.e.r;r++){
    const row:string[]=[];
    for(let c=0;c<=range.e.c;c++){
      const cell=ws[XLSX.utils.encode_cell({r,c})];
      if(cell?.f&&cell.v===undefined)throw new Error(`Sheet “${selected}”, ${XLSX.utils.encode_cell({r,c})}: this formula has no saved displayed value. Recalculate and save it in Excel, then import again.`);
      row.push(cell?String(cell.w??XLSX.utils.format_cell(cell)):'');
    }
    values.push(row);
  }
  const parsed=parseCsv(Papa.unparse(values),name);
  parsed.originalText=''; // The immutable workbook bytes are the original, not a CSV conversion.
  parsed.encoding='Not applicable to Excel';parsed.delimiter='';
  parsed.rows=values.map((v,r)=>({id:r,line:r+1,endLine:r+1,values:v,raw:'',cells:v.map((_,c)=>XLSX.utils.encode_cell({r,c}))}));
  parsed.workbook={bytes:bytes.slice(0),sheets:book.SheetNames,selected,merges:(ws['!merges']||[]).map(XLSX.utils.encode_range)};
  return parsed;
}
export async function readSource(file:File):Promise<ParsedFile>{
  if(file.size>25*1024*1024)throw new Error('This file is larger than 25 MB. Export a smaller range.');
  if(/\.xlsx$/i.test(file.name)){
    try{return parseWorkbook(await file.arrayBuffer(),file.name);}
    catch(e){throw new Error(`Could not read this workbook. ${e instanceof Error?e.message:'Save it as an unencrypted XLSX file and try again.'}`);}
  }
  if(!/\.csv$/i.test(file.name))throw new Error('Choose a .csv or .xlsx file.');
  return readCsv(file);
}
