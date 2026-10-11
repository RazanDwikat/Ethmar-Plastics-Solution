import { useRef, useState } from 'react';
import { bindFormula, formulaOptions, previewFormula } from '@/lib/custom-formula';
import type { Measurement, Setup } from '@/lib/setup';
import './formula-builder.css';

type Props = { measurement: Measurement; setup: Setup; onChange: (patch: Partial<Measurement>) => void };

export function FormulaBuilder({ measurement: m, setup, onChange }: Props) {
  const editor = useRef<HTMLTextAreaElement>(null);
  const selection = useRef<{start:number;end:number}|null>(null);
  const [constant, setConstant] = useState('100');
  const options = formulaOptions(setup, m);
  const preview = previewFormula(m, setup);
  const expression = m.formula ?? '';
  const decimals = Math.min(6, Math.max(0, m.decimals ?? 2));
  const unit = m.outputUnit ?? 'number';
  const suffix = {percent:'%',quantity:` ${setup.unit}`,hours:' hours',minutes:' minutes',number:''}[unit];
  const changeExpression = (formula: string) => onChange({formula, formulaBindings: bindFormula(formula, setup, m)});
  const insert = (text: string) => {
    const start = selection.current?.start ?? expression.length;
    const end = selection.current?.end ?? expression.length;
    const token = `${start > 0 && !/\s$/.test(expression.slice(0,start)) ? ' ' : ''}${text} `;
    changeExpression(expression.slice(0,start) + token + expression.slice(end));
    const next = start + token.length;
    selection.current = {start:next,end:next};
    requestAnimationFrame(() => { editor.current?.focus(); editor.current?.setSelectionRange(next,next); });
  };
  return <section className="formula-builder" aria-label={`Formula for ${m.label}`}>
    <h4 className="formula-heading">Build a calculation, one part at a time</h4>
    <small>Insert per-run totals, record counts or another measurement. Then add operators and numbers. Nothing changes your source records.</small>
    <div className="formula-tools">
      <label className="formula-insert">Insert a part
        <select value="" onChange={e=>{if(e.target.value)insert(`[${e.target.value}]`);}}>
          <option value="">Choose a source or measurement…</option>
          {(['total','count','measurement'] as const).map(kind=><optgroup key={kind} label={kind==='total'?'Per-run source totals':kind==='count'?'Per-run source record counts':'Existing measurements'}>{options.filter(o=>o.kind===kind).map(o=><option key={`${o.kind}-${o.id}-${o.name}`} value={o.name}>{o.name}</option>)}</optgroup>)}
        </select>
      </label>
      {['+','-','*','/','(',')'].map(op=><button type="button" key={op} aria-label={`Insert ${op==='*'?'multiply':op==='/'?'divide':op}`} onClick={()=>insert(op)}>{op==='*'?'×':op}</button>)}
    </div>
    <div className="formula-tools">
      <label className="formula-constant">Number<input type="number" step="any" value={constant} onChange={e=>setConstant(e.target.value)}/></label>
      <button type="button" disabled={!constant.trim()||!Number.isFinite(Number(constant))} onClick={()=>insert(constant)}>Insert number</button>
    </div>
    <label>Editable formula
      <textarea ref={editor} data-testid={`formula-expression-${m.id}`} spellCheck={false} value={expression} placeholder="[Scrap total] / [Material input total] * 100" aria-invalid={!!preview.error} aria-describedby={`formula-status-${m.id}`} onSelect={e=>{selection.current={start:e.currentTarget.selectionStart,end:e.currentTarget.selectionEnd};}} onChange={e=>changeExpression(e.target.value)}/>
    </label>
    <p className="formula-note">Units are labels, not conversions. Source time totals are in hours. Type <strong>* 60</strong> to calculate minutes or <strong>* 100</strong> to turn a ratio into a percentage. Selecting minutes or % below does not change the answer.</p>
    <div className="generic-fields">
      <label>Result unit<select data-testid={`formula-unit-${m.id}`} value={unit} onChange={e=>onChange({outputUnit:e.target.value as Measurement['outputUnit']})}><option value="percent">Percent (%)</option><option value="quantity">Quantity ({setup.unit})</option><option value="hours">Hours</option><option value="minutes">Minutes</option><option value="number">Plain number</option></select></label>
      <label>Decimal places<select data-testid={`formula-decimals-${m.id}`} value={decimals} onChange={e=>onChange({decimals:Number(e.target.value)})}>{Array.from({length:7},(_,n)=><option key={n} value={n}>{n}</option>)}</select></label>
    </div>
    <h4>Try illustrative values</h4>
    <small>These numbers only test the formula. Actual comparisons use each run’s records.</small>
    {preview.parts.length ? <div className="generic-fields">{preview.parts.map(part=><label key={part.name}>{part.name}<input type="number" step="any" value={Number.isFinite(part.value)?part.value:''} onChange={e=>onChange({formulaExamples:{...m.formulaExamples,[part.name]:e.target.value===''?NaN:Number(e.target.value)}})}/></label>)}</div> : <p><small>Insert a part above to give it an illustrative value. A formula made only of numbers needs no example inputs.</small></p>}
    <div className={`example formula-preview${preview.error?' error':''}`} data-testid={`formula-preview-${m.id}`} id={`formula-status-${m.id}`} role="status" aria-live="polite">
      <small>Live preview · illustration only, not a run result</small>
      {preview.error ? <strong>{preview.error}</strong> : preview.value===null ? <strong>Add a formula to see its result.</strong> : <><span className="formula-substitution">{preview.formula}</span><strong>{preview.value.toLocaleString('en-US',{minimumFractionDigits:decimals,maximumFractionDigits:decimals})}{suffix}</strong></>}
    </div>
  </section>;
}
