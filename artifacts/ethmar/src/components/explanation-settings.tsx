import {defaultCheck,explanationAttributes} from '@/lib/hypotheses';
import type {Setup} from '@/lib/setup';
export function ExplanationSettings({setup,headers,onChange}:{setup:Setup;headers:string[];onChange:(s:Setup)=>void}){
 return <details className="config-card"><summary>Possible explanations · analyst suggestions</summary>
  <p>Edit the “Check” suggestion for each attribute. Custom attributes are off by default. These rules describe context, not responsibility or blame.</p>
  {explanationAttributes(setup,headers).map(attr=>{
   const custom=setup.customFields.find(f=>f.id===attr.id);
   return <div className="config-card" key={attr.id}>
    <strong dir="auto">{attr.label}</strong>
    {custom&&<label className="row"><input type="checkbox" checked={custom.useExplanations===true} onChange={e=>onChange({...setup,customFields:setup.customFields.map(f=>f.id===attr.id?{...f,useExplanations:e.target.checked}:f)})}/>Use in possible explanations</label>}
    <label htmlFor={`explanation-check-${attr.id}`}>Check suggestion for {attr.label}</label>
    <textarea id={`explanation-check-${attr.id}`} rows={2} value={attr.check??defaultCheck(attr.label)} onChange={e=>onChange(custom?{...setup,customFields:setup.customFields.map(f=>f.id===attr.id?{...f,checkText:e.target.value}:f)}:{...setup,attributeChecks:{...setup.attributeChecks,[attr.id]:e.target.value}})}/>
   </div>;
  })}
 </details>;
}
