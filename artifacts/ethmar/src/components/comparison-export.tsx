import { useState } from 'react';
import { FileDown, Printer } from 'lucide-react';
import type { CalculationReport, CalculatedRun } from '@/lib/calculation-engine';
import { comparisonPrintHtml, exportComparisonCsv } from '@/lib/comparison-tools';

export function ComparisonExport({report,a,b}:{report:CalculationReport;a:CalculatedRun;b:CalculatedRun}){
 const [error,setError]=useState(''),[status,setStatus]=useState(''),[fallback,setFallback]=useState<string|null>(null),[busy,setBusy]=useState(false);
 function download(content:string,type:string,name:string){
  const url=URL.createObjectURL(new Blob([content],{type})),link=document.createElement('a');
  try{link.href=url;link.download=name;document.body.appendChild(link);link.click();}
  finally{link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}
 }
 function csv(){setError('');setStatus('');setBusy(true);try{download(exportComparisonCsv(report,a,b),'text/csv;charset=utf-8','ethmar-comparison.csv');setStatus('Comparison CSV download requested. Check your browser downloads.');}catch{setError('CSV export failed. Retry Export comparison CSV. Your original records are unchanged.');}finally{setBusy(false)}}
 function print(){
  setError('');setStatus('');setFallback(null);setBusy(true);
  let tab:Window|null=null;
  try{
   const html=comparisonPrintHtml(report,a,b);setFallback(html);
   tab=window.open('about:blank','_blank');
   if(!tab){setError('Your browser blocked the printable page. Allow popups and retry, or download the same printable HTML below.');return;}
   tab.opener=null;tab.document.open();tab.document.write(html);tab.document.close();
   setStatus('Printable page opened in a separate tab. Use its Print button when ready.');
  }catch{tab?.close();setError('The printable page could not open. Retry, or download the printable HTML if available.');}
  finally{setBusy(false)}
 }
 return <div><div className="row"><button disabled={busy} onClick={print}><Printer/>Printable page</button><button className="primary" disabled={busy} onClick={csv}><FileDown/>Export comparison CSV</button></div>{status&&<p className="export-status" role="status">{status}</p>}{error&&<div className="error" role="alert"><p>{error}</p>{fallback&&<button onClick={()=>{try{download(fallback,'text/html;charset=utf-8','ethmar-comparison.html');setError('');setStatus('Printable HTML download requested. Open the file and use its Print button.')}catch{setError('HTML download failed. Retry downloading, or allow popups and reopen the printable page.')}}}>Download printable HTML</button>}</div>}</div>;
}
