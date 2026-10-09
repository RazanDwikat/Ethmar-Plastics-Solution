import { useState } from 'react';
import { Info, FileText, ChevronDown, ChevronUp, ShieldAlert, Check, LockKeyhole, ArrowUpRight } from 'lucide-react';
import { demos, headers } from './_data';
import './_group.css';
import './_phaseTwo.css';

type Run = 'E-01' | 'E-02';
type Category = 'All' | 'Blocking' | 'Warnings';
type SourceRow = { cells: string[]; line: number };
type Issue = { category: 'Blocking' | 'Warnings'; title: string; detail: string; policy: string; ids: string[] };
const fixtures: Record<number, Partial<Record<Run, Issue>>> = {
  0: {},
  1: {
    'E-01': { category: 'Warnings', title: 'Exact duplicate · EV-003', detail: 'CSV lines 4 and 5 contain the same original scrap event. This is one event-level warning, not two issues.', policy: 'Count line 4 once. Exclude the repeat at line 5 from calculations only. Scrap remains 50 kg and scrap rate remains 5%. Neither source row is changed.', ids: ['EV-003'] },
    'E-02': { category: 'Blocking', title: 'Missing material input', detail: 'No MATERIAL_IN event is present for E-02. Material input and scrap rate cannot calculate. Material balance cannot assess; this is not an imbalance finding.', policy: 'Only input-dependent results are blocked. Good output, scrap quantity and logged durations remain usable. The rows below are all available E-02 events; no missing row has been invented.', ids: [] },
  },
  2: {
    'E-01': { category: 'Blocking', title: 'Conflicting quantities · EV-003', detail: 'CSV line 4 records 50 kg; line 5 records 65 kg for the same event. Scrap total and scrap rate cannot calculate. No winning value is selected.', policy: 'Material balance cannot assess while scrap is unresolved. This does not create a separate balance warning. Material input, good output and changeover remain usable; both original values are retained.', ids: ['EV-003'] },
    'E-02': { category: 'Warnings', title: 'Overlapping duration events', detail: 'Downtime at 11:00–11:45 lies inside changeover at 06:00–12:00 on 8 October. Both original intervals remain visible below.', policy: 'Changeover stays 6 h; downtime stays 45 min. Neither duration is netted, subtracted or added to the other. This warning does not block either duration or the 10% scrap rate.', ids: ['EV-008', 'EV-009'] },
  },
};

function SourceTable({ rows, label }: { rows: SourceRow[]; label: string }) {
  return <><div className="ep-table-wrap" tabIndex={0} role="region" aria-label={`${label}. Scroll horizontally for original columns.`}><table><thead><tr><th scope="col">CSV line</th>{headers.map(header => <th scope="col" key={header}>{header}</th>)}</tr></thead><tbody>{rows.map(({ cells, line }) => <tr key={line}><td>{line}</td>{cells.map((cell, i) => <td key={i}>{cell}</td>)}</tr>)}</tbody></table></div><div className="ep-table-foot"><span>{rows.length} original rows · header is CSV line 1</span><span>Original values · empty cells retained · scroll for all columns →</span></div></>;
}

export function PhaseTwo() {
  const [demo, setDemo] = useState(0);
  const [run, setRun] = useState<Run>('E-01');
  const [category, setCategory] = useState<Category>('All');
  const [issueOpen, setIssueOpen] = useState(false);
  const [sourceOpen, setSourceOpen] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);
  const selected = demos[demo];
  const rows = selected.rows.map((cells, index) => ({ cells, line: index + 2 })).filter(row => row.cells[2] === run);
  const issue = fixtures[demo][run];
  const missing = demo === 1 && run === 'E-02';
  const conflict = demo === 2 && run === 'E-01';
  const first = run === 'E-01';
  const visibleIssue = issue && (category === 'All' || category === issue.category);
  const resetDetails = () => { setCategory('All'); setIssueOpen(false); setSourceOpen(false); };
  const metrics = [
    { label: 'Material input', value: missing ? 'Cannot calculate' : '1,000', unit: 'kg', note: missing ? 'Blocked · missing MATERIAL_IN' : 'Logged material quantity', blocked: missing },
    { label: 'Good output', value: first ? '950' : '900', unit: 'kg', note: 'Logged good output', blocked: false },
    { label: 'Scrap quantity', value: conflict ? 'Cannot calculate' : first ? '50' : '100', unit: 'kg', note: conflict ? 'Blocked · conflicting EV-003 quantities' : demo === 1 && first ? 'Exact repeat excluded · line 5' : 'Logged scrap quantity', blocked: conflict },
    { label: 'Scrap rate', value: missing || conflict ? 'Cannot calculate' : first ? '5' : '10', unit: '%', note: missing ? 'Blocked · missing input' : conflict ? 'Blocked · unresolved scrap quantity' : 'Scrap as a share of material input', blocked: missing || conflict },
    { label: 'Changeover', value: first ? '4' : '6', unit: 'h', note: first ? '06:00–10:00 · 7 Oct 2026' : '06:00–12:00 · 8 Oct 2026', blocked: false },
    { label: 'Unplanned downtime', value: first ? 'Not logged' : '45', unit: first ? '' : 'min', note: first ? 'No downtime event in this run; not zero.' : demo === 2 ? '11:00–11:45 · overlap warning' : '13:00–13:45 · outside changeover', blocked: false },
  ];
  return <div className="ethmar ep2">
    <header className="ep-top"><div className="ep-brand"><span className="ep-mark" aria-hidden="true">e</span><div><strong>ethmar</strong><small>Plastics / production workspace</small></div></div><div className="ep-badge"><span className="ep-dot" />Phase 2 · Design prototype</div></header>
    <div className="ep-shell">
      <aside className="ep-sidebar">
        <nav aria-label="Select production run"><div className="ep-eyebrow">Run inspection / 02</div>{(['E-01', 'E-02'] as Run[]).map((id, index) => { const runIssue = fixtures[demo][id]; return <button className={`ep-step ${run === id ? 'active' : ''}`} key={id} aria-pressed={run === id} onClick={() => { setRun(id); resetDetails(); }}><span className="ep-step-number">{index + 1}</span><span><strong>{id}</strong><small>{index === 0 ? '7' : '8'} Oct 2026</small></span><span className={`p2-status ${runIssue ? runIssue.category === 'Blocking' ? 'blocking' : 'warning' : ''}`}>{runIssue ? '1 issue' : '0 issues'}</span></button>; })}</nav>
        <div className="ep-side-note"><div><div className="ep-eyebrow">Read the exception</div><p>A blocked metric is not a blocked run. Keep usable results visible.</p></div><a className="p2-link" href="/__mockup/preview/ethmar/PhaseOne" target="_blank" rel="noreferrer">Review Phase 1 separately <ArrowUpRight style={{ display: 'inline', width: 13 }} /></a></div>
        <div className="ep-side-bottom"><div className="ep-eyebrow">Fixed demo fixtures</div><p style={{ marginTop: 10 }}>Authored results, held in memory. No upload validation, persistent saving or state carried from Phase 1.</p></div>
      </aside>
      <main className="ep-main">
        <div className="ep-eyebrow">Production analysis / Run inspection</div>
        <div className="ep-heading"><div><h1>Every result. Every exception.</h1><p>Inspect one run at a time. See what can be calculated, what needs attention, and the original rows behind each issue.</p></div><span className="ep-index" aria-hidden="true">02</span></div>
        <div className="ep-notice"><Info /><span><strong>Phase 2 design prototype · fixed demo fixtures.</strong> These are authored example results, not a live validation engine. No real upload validation or persistent saving. This preview starts with its own illustrative setup.</span></div>
        <section className="ep-panel"><div className="ep-panel-body p2-source"><label className="ep-field">Demo dataset<select value={demo} onChange={event => { setDemo(Number(event.target.value)); resetDetails(); }}>{demos.map((item, index) => <option value={index} key={item.file}>{String(index + 1).padStart(2, '0')} · {item.name}</option>)}</select><small className="p2-file">{selected.file} · {selected.rows.length} source rows</small></label><div className="p2-setup"><strong>Illustrative default setup · read-only</strong>Group: run_id · Events: event_type<br />Quantity: quantity_kg · Time: start_time → end_time<br />Scrap rate: scrap / material input · Balance tolerance: 0 kg</div></div></section>
        <div key={`${demo}-${run}`} className="ep-reveal">
          <div className="p2-run-head"><div><h2>Run {run}</h2><p className="ep-small">EX-04 / MLD-12 · Shift A · Line L1 · {first ? 'ORD-071' : 'ORD-072'}</p></div><span className={`p2-status ${issue ? issue.category === 'Blocking' ? 'blocking' : 'warning' : ''}`} role="status">{issue ? issue.category === 'Blocking' ? '1 blocking issue · affected metrics only' : '1 warning · metrics remain available' : '0 issues in this fixture'}</span></div>
          <section className="ep-panel p2-metrics" aria-label={`${run} illustrative metrics`}>{metrics.map(metric => <div key={metric.label} className={`p2-metric ${metric.blocked ? 'blocked' : ''}`}><div className="ep-eyebrow">{metric.label}</div><div className={`p2-value ${metric.blocked || metric.value === 'Not logged' ? 'unavailable' : ''}`}>{metric.value}{!metric.blocked && metric.unit && <small> {metric.unit}</small>}</div><p className="ep-small">{metric.note}</p></div>)}</section>
          <div className="p2-balance">{missing || conflict ? <Info /> : <Check />}<div><strong>Material balance · {missing || conflict ? 'Cannot assess' : 'Balanced'}</strong><p>{missing ? 'Missing material input. No imbalance is asserted.' : conflict ? 'Scrap quantity is unresolved. No imbalance is asserted.' : first ? '1,000 kg input = 950 kg good + 50 kg scrap. Within 0 kg tolerance.' : '1,000 kg input = 900 kg good + 100 kg scrap. Within 0 kg tolerance.'}</p></div></div>
          <section className="ep-panel ep-section" aria-labelledby="p2-issues-title">
            <div className="ep-panel-head"><h2 id="p2-issues-title">Data issues</h2><span className="ep-small">Selected run · counted by event-level issue</span></div>
            <div className="p2-filters" aria-label="Issue categories">{(['All', 'Blocking', 'Warnings'] as Category[]).map(item => <button className={`ep-btn ${category === item ? 'primary' : ''}`} key={item} aria-pressed={category === item} onClick={() => setCategory(item)}>{item} <span>{issue && (item === 'All' || issue.category === item) ? 1 : 0}</span></button>)}</div>
            {visibleIssue ? <><div className="p2-issue"><div className="p2-issue-meta"><span className={`p2-status ${issue.category === 'Blocking' ? 'blocking' : 'warning'}`}>{issue.category === 'Blocking' ? 'Blocking · metric scoped' : 'Warning · non-blocking'}</span><ShieldAlert /></div><h3>{issue.title}</h3><p>{issue.detail}</p><p>{issue.policy}</p><button className="ep-btn text" aria-expanded={issueOpen} aria-controls="p2-issue-rows" onClick={() => setIssueOpen(!issueOpen)}>{issueOpen ? 'Hide' : 'Show'} original source rows {issueOpen ? <ChevronUp /> : <ChevronDown />}</button></div>{issueOpen && <div id="p2-issue-rows"><SourceTable rows={issue.ids.length ? rows.filter(row => issue.ids.includes(row.cells[0])) : rows} label="Original rows for selected issue" /></div>}</> : <div className="p2-none"><FileText /><div><h3>{issue ? `No ${category.toLowerCase()} for this run.` : 'No data issues in this fixture.'}</h3><p>{issue ? 'Other issue categories may still need attention. Choose All to see every issue.' : 'No duplicate, conflict, missing input or time overlap is illustrated here. Original rows remain available below.'}</p></div></div>}
          </section>
          <section className="ep-panel"><div className="ep-panel-head"><h2>Original source · {run}</h2><button className="ep-btn text" aria-expanded={sourceOpen} aria-controls="p2-source-rows" onClick={() => setSourceOpen(!sourceOpen)}>{sourceOpen ? 'Hide' : 'Show'} {rows.length} rows {sourceOpen ? <ChevronUp /> : <ChevronDown />}</button></div>{sourceOpen && <div id="p2-source-rows"><div className="ep-source-desc">Original selected-demo rows. CSV line numbers refer to this file, including any repeated rows. Exclusions affect calculation policy only.</div><SourceTable rows={rows} label={`All original ${run} source rows`} /></div>}</section>
        </div>
        <section className="ep-panel p2-rules"><div className="ep-panel-head"><h2>Rules & scope</h2><button className="ep-btn text" aria-expanded={rulesOpen} aria-controls="p2-rules" onClick={() => setRulesOpen(!rulesOpen)}>{rulesOpen ? 'Hide rules' : 'Read rules'}{rulesOpen ? <ChevronUp /> : <ChevronDown />}</button></div>{rulesOpen && <div id="p2-rules" className="ep-panel-body"><ul><li>One underlying issue may affect multiple metrics. Badges count the issue once, never once per blocked metric.</li><li>Exact repeats are counted once; conflicting repeats have no guessed winner. Original rows remain unchanged.</li><li>Missing input blocks input-dependent results. Absent downtime is “Not logged,” not a measured zero. Overlapping intervals remain separate, unchanged durations.</li><li>Intended additional checks, not demonstrated by these fixtures: a zero denominator blocks a ratio; malformed quantities or timestamps block affected metrics; a material imbalance beyond the absolute tolerance raises a warning only when all required quantities are usable.</li><li>All three fixtures are fixed examples. No general-purpose validation engine is implemented. Product context is not assessed.</li></ul></div>}</section>
        <footer className="ep-footer"><div><div className="ep-eyebrow">Phase 2 ready for review</div><p className="ep-small" style={{ marginTop: 5 }}>Design review only · unresolved issues remain visible</p></div><button className="ep-btn" disabled><LockKeyhole />Comparison next · unavailable</button></footer>
      </main>
    </div>
  </div>;
}
