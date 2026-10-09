import { useRef, useState, useEffect } from 'react';
import { ArrowRight, ArrowLeft, Check, ChevronRight, FileText, Upload, FolderOpen, Info, Layers3, SlidersHorizontal, Bookmark, X, CheckCheck, Columns3 } from 'lucide-react';
import { demos, headers, eventTypes, mappingFields, initialConfiguration, type Configuration } from './_data';
import './_group.css';

type Profile = { id: number; name: string; config: Configuration };
const steps = [{ title: 'Source', detail: 'Choose your production log' }, { title: 'Mapping', detail: 'Give each column a role' }, { title: 'Templates', detail: 'Define what matters' }, { title: 'Review', detail: 'Finish preparation' }];
const titles = ['Start with the source.', 'Make the log readable.', 'Set the measurement rules.', 'A clear setup. Ready for checks.'];
const subtitles = ['Choose a demo log or explore the CSV upload interaction. Your original rows stay visible and unchanged.', 'Connect the original columns to their intended roles. This defines the setup; it does not validate production data.', 'Use structured templates, not free-form formulas. Configure the inputs now; nothing is calculated in Phase 1.', 'Review your preparation and optionally keep a reusable profile for this preview session.'];
const clone = (config: Configuration): Configuration => ({ ...config, mapping: { ...config.mapping }, events: { ...config.events } });

export function PhaseOne() {
  const [step, setStep] = useState(0);
  const [demo, setDemo] = useState(0);
  const [upload, setUpload] = useState('');
  const [config, setConfig] = useState<Configuration>(() => clone(initialConfiguration));
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [profileName, setProfileName] = useState('');
  const [profileDialog, setProfileDialog] = useState(false);
  const [message, setMessage] = useState('');
  const [complete, setComplete] = useState(false);
  const [rowsVisible, setRowsVisible] = useState(true);
  const mainRef = useRef<HTMLElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const profileTrigger = useRef<HTMLButtonElement>(null);
  const selected = demos[demo];
  const requiredFields = ['event_id', config.grouping, 'machine', 'mold', 'shift', 'event_type', 'start_time', 'end_time', 'quantity_kg'];
  const missingMapping = requiredFields.some(key => !config.mapping[key]);
  const templatesValid = !!config.ratioName.trim() && !!config.durationName.trim() && !!config.totalName.trim() && config.tolerance !== '' && Number.isFinite(Number(config.tolerance)) && Number(config.tolerance) >= 0;
  const update = <K extends keyof Configuration>(key: K, value: Configuration[K]) => { setConfig(old => ({ ...old, [key]: value })); setMessage(''); setComplete(false); };
  const go = (next: number) => { setStep(next); setComplete(false); setMessage(''); mainRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); };
  useEffect(() => {
    if (!profileDialog) return;
    dialogRef.current?.querySelector<HTMLButtonElement>('button')?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { setProfileDialog(false); profileTrigger.current?.focus(); }
      if (event.key === 'Tab') {
        const items = dialogRef.current?.querySelectorAll<HTMLElement>('button, input, select');
        if (!items?.length) return;
        const first = items[0], last = items[items.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [profileDialog]);
  const saveProfile = () => {
    if (!profileName.trim()) { setMessage('Give your profile a name first.'); return; }
    if (missingMapping || !templatesValid) { setMessage('Complete required mappings, template names, and a non-negative tolerance before saving.'); return; }
    const name = profileName.trim();
    setProfiles(old => [...old, { id: Date.now(), name, config: clone(config) }]);
    setMessage(`“${name}” saved in this preview session only. Mapping, event assignments, grouping and templates are included.`);
    setProfileName('');
  };
  const useProfile = (profile: Profile) => {
    setConfig(clone(profile.config)); setProfileDialog(false); setComplete(false);
    setMessage(`“${profile.name}” restored. Source selection is unchanged.`);
    profileTrigger.current?.focus();
  };
  const selectField = (label: string, value: string, onChange: (value: string) => void, options: string[], id: string, hint?: string, allowBlank = false) => (
    <label className="ep-field">{label}<select data-testid={`select-${id}`} value={value} onChange={event => onChange(event.target.value)}>{allowBlank && <option value="">Not mapped</option>}{options.map(option => <option key={option} value={option}>{option}</option>)}</select>{hint && <small>{hint}</small>}</label>
  );
  const textField = (label: string, key: 'ratioName' | 'durationName' | 'totalName') => <label className="ep-field ep-template-name">{label}<input data-testid={`input-${key}`} value={config[key]} onChange={event => update(key, event.target.value)} /></label>;
  const sourcePreview = <section className="ep-panel ep-section">
    <div className="ep-panel-head"><div style={{ display: 'flex', gap: 10, alignItems: 'center' }}><FileText /><h2>Original source rows</h2></div><button className="ep-btn text" data-testid="button-toggle-rows" onClick={() => setRowsVisible(!rowsVisible)} aria-expanded={rowsVisible}>{rowsVisible ? 'Hide rows' : 'Show rows'}<Columns3 /></button></div>
    {rowsVisible && <><div className="ep-source-desc" data-testid="text-demo-description">{selected.description}</div><div className="ep-table-wrap" tabIndex={0} aria-label="Original CSV rows, scroll horizontally for all columns" data-testid="table-source-scroll"><table><thead><tr><th scope="col">CSV line</th>{headers.map(header => <th scope="col" key={header}>{header}</th>)}</tr></thead><tbody>{selected.rows.map((row, index) => <tr key={`${demo}-${index}`} data-testid={`row-source-${index}`}><td>{index + 2}</td>{row.map((cell, col) => <td key={col}>{cell}</td>)}</tr>)}</tbody></table></div><div className="ep-table-foot"><span>{selected.rows.length} original rows · one event per row · header is CSV line 1</span><span>Raw values · blank cells retained · scroll to see all columns →</span></div></>}
  </section>;
  return <div className="ethmar">
    <header className="ep-top"><div className="ep-brand"><span className="ep-mark" aria-hidden="true">e</span><div><strong>ethmar</strong><small>Plastics / production workspace</small></div></div><div className="ep-badge" data-testid="status-prototype"><span className="ep-dot" />Phase 1 · Design prototype</div></header>
    <div className="ep-shell">
      <aside className="ep-sidebar"><nav aria-label="Preparation steps"><div className="ep-eyebrow">Preparation / 01</div>{steps.map((item, index) => <button key={item.title} data-testid={`button-step-${index}`} className={`ep-step ${step === index ? 'active' : ''}`} aria-current={step === index ? 'step' : undefined} onClick={() => go(index)}><span className="ep-step-number">{index + 1}</span><span><strong>{item.title}</strong><small>{item.detail}</small></span></button>)}</nav>
        <div className="ep-side-note"><div><div className="ep-eyebrow">Repeatable by design</div><p>One setup for the logs you work with every day.</p></div><button ref={profileTrigger} className="ep-btn text" data-testid="button-open-profiles" onClick={() => setProfileDialog(true)}><Bookmark />Session profiles<span className="ep-tag">{profiles.length}</span></button></div>
        <div className="ep-side-bottom"><div className="ep-eyebrow">The scope of this preview</div><p style={{ marginTop: 10 }}>Prepare only. Data checks, calculations and production comparisons belong to later phases and are not implemented here.</p></div>
      </aside>
      <main className="ep-main" ref={mainRef}>
        <div className="ep-eyebrow">Production analysis <span style={{ margin: '0 8px' }}>/</span> Analyst preparation</div>
        <div className="ep-heading"><div><h1>{complete ? 'Preparation complete.' : titles[step]}</h1><p>{complete ? 'Your setup is ready within this design prototype. No production checks or metrics have been run.' : subtitles[step]}</p></div><span className="ep-index" aria-hidden="true">0{step + 1}</span></div>
        <div className="ep-notice"><Info /><span><strong>A safe place to try the workflow.</strong> Changes and profiles last only in this preview session. Refreshing clears them. No files or production data are saved.</span></div>
        {message && <p className="ep-message" style={{ marginBottom: 18, paddingTop: 0 }} role="status" data-testid="status-feedback">{message}</p>}
        <div key={`${step}-${complete}`} className="ep-reveal">
        {complete ? <section className="ep-panel ep-complete"><div className="ep-complete-icon"><CheckCheck /></div><div className="ep-eyebrow">Phase 1 / prototype confirmation</div><h2 style={{ marginTop: 10 }}>The preparation is in place.</h2><p>Column roles, grouping, event assignments and measurement templates are configured in memory. Data checks are the next phase—not implemented in this prototype.</p><div className="ep-tag" style={{ display: 'inline-block', marginBottom: 24 }}>No calculations performed · no persistent save</div><div><button className="ep-btn primary" data-testid="button-return-review" onClick={() => setComplete(false)}><ArrowLeft />Return to preparation</button></div></section> : <>
        {step === 0 && <>
          <div className="ep-source-grid"><section className="ep-panel"><div className="ep-panel-head"><h2>Choose a demo dataset</h2><span className="ep-tag">Built-in samples</span></div><div className="ep-panel-body">{demos.map((item, index) => <button className={`ep-demo ${demo === index ? 'selected' : ''}`} key={item.file} data-testid={`button-demo-${index}`} aria-pressed={demo === index} onClick={() => { setDemo(index); setUpload(''); setMessage(''); }}><span className="ep-radio" /><span><strong>{item.name}</strong><small>{item.short}</small></span><span className="ep-demo-code">0{index + 1}</span></button>)}</div></section>
          <section className="ep-panel"><div className="ep-panel-head"><h2>Or, use your CSV</h2><Upload /></div><div className="ep-panel-body"><div className="ep-upload"><Upload /><h3>Bring a production log</h3><p>Explore file selection.<br />Real CSV parsing is not part of this phase.</p><label className="ep-upload-label">Choose CSV file<input className="ep-file" type="file" accept=".csv,text/csv" data-testid="input-csv" onChange={event => { const file = event.target.files?.[0]; if (file) { setUpload(file.name); setMessage('File selected for demonstration only. It has not been parsed or imported; the selected demo remains the working source.'); } }} /></label></div>{upload && <p className="ep-message" data-testid="text-upload-filename">{upload} · selection only</p>}<p className="ep-small" style={{ marginTop: 12 }}>No upload leaves this browser. Choose a demo to continue with sample rows.</p></div></section></div>
          {sourcePreview}
          <div className="ep-small">Working source: <strong data-testid="text-working-source">{selected.file}</strong> · Machine EX-04 / Mold MLD-12 · Line L1 · Product not assessed</div>
        </>}
        {step === 1 && <>
          <section className="ep-panel ep-section"><div className="ep-panel-head"><h2>Column roles</h2><span className="ep-tag">Original headers → roles</span></div><div className="ep-panel-body"><div className="ep-fields">{mappingFields.map(([label, key]) => selectField(label, config.mapping[key], value => update('mapping', { ...config.mapping, [key]: value }), headers, `mapping-${key}`, key === 'product' ? 'No product column in the demos. Not assessed.' : key === 'line' ? 'Sample line value: L1' : undefined, true))}</div>{missingMapping && <p className="ep-message ep-error" role="alert">Map the selected group identifier and required column roles to continue. Optional line and product can remain unmapped.</p>}</div></section>
          <section className="ep-panel ep-section"><div className="ep-panel-body"><div className="ep-section-title"><Layers3 /><h2>Group production by</h2></div><div className="ep-grouping">{['run_id', 'order_id'].map(key => <button className={`ep-demo ${config.grouping === key ? 'selected' : ''}`} key={key} data-testid={`button-group-${key}`} aria-pressed={config.grouping === key} onClick={() => update('grouping', key)}><span className="ep-radio" /><span><strong>{key === 'run_id' ? 'Run ID' : 'Order ID'}</strong><small>{key === 'run_id' ? 'Keep individual production runs separate.' : 'Collect events under their production order.'}</small></span></button>)}</div></div></section>
          <section className="ep-panel ep-section"><div className="ep-panel-head"><h2>Assign source event values</h2><span className="ep-tag">event_type</span></div><div className="ep-panel-body"><div className="ep-events">{eventTypes.map(type => selectField(type === 'MATERIAL_IN' ? 'Material input' : type === 'GOOD_OUT' ? 'Good output' : type === 'SCRAP' ? 'Scrap' : type === 'CHANGEOVER' ? 'Changeover' : 'Unplanned downtime', config.events[type], value => update('events', { ...config.events, [type]: value }), eventTypes, `event-${type}`))}</div><p className="ep-mapping-note">Each role uses a raw value from the source event_type column. Assignments are configuration only; no checks run here.</p></div></section>
          {sourcePreview}
        </>}
        {step === 2 && <>
          <section className="ep-panel ep-section"><div className="ep-panel-head"><h2>Measurement templates</h2><span className="ep-tag">Configuration only</span></div>
          <div className="ep-template"><div><div className="ep-section-title"><SlidersHorizontal /><h3>Ratio</h3></div><p>Quantity numerator divided by quantity denominator.</p><span className="ep-tag" style={{ display: 'inline-block', marginTop: 12 }}>Output · %</span></div><div className="ep-fields">{textField('Ratio name', 'ratioName')}{selectField('Numerator event type', config.numerator, value => update('numerator', value), eventTypes.slice(0, 3), 'numerator')}{selectField('Denominator event type', config.denominator, value => update('denominator', value), eventTypes.slice(0, 3), 'denominator')}</div></div>
          <div className="ep-template"><div><div className="ep-section-title"><SlidersHorizontal /><h3>Duration</h3></div><p>Elapsed time from the mapped start and end columns.</p></div><div className="ep-fields">{textField('Duration name', 'durationName')}{selectField('Duration event type', config.durationEvent, value => update('durationEvent', value), eventTypes.slice(3), 'duration-event')}{selectField('Display unit', config.durationUnit, value => update('durationUnit', value), ['h', 'min'], 'duration-unit')}</div></div>
          <div className="ep-template"><div><div className="ep-section-title"><SlidersHorizontal /><h3>Total quantity</h3></div><p>Total the mapped quantity for one selected event type.</p><span className="ep-tag" style={{ display: 'inline-block', marginTop: 12 }}>Output · kg</span></div><div className="ep-fields">{textField('Total quantity name', 'totalName')}{selectField('Quantity event type', config.totalEvent, value => update('totalEvent', value), eventTypes.slice(0, 3), 'total-event')}</div></div></section>
          <section className="ep-panel"><div className="ep-panel-body ep-tolerance"><div><h2>Absolute input tolerance</h2><p>A kilogram tolerance for future input checks. This is an absolute value, not a percentage. Default: 0 kg. No tolerance check is performed now.</p></div><label className="ep-field">Tolerance · kg<input data-testid="input-tolerance" type="number" min="0" step="any" value={config.tolerance} onChange={event => update('tolerance', event.target.value)} /></label></div></section>
          {!templatesValid && <p className="ep-message ep-error" role="alert">Provide all template names and a non-negative tolerance to continue.</p>}
        </>}
        {step === 3 && <>
          <div className="ep-review-grid ep-section"><section className="ep-panel"><div className="ep-panel-head"><h2>Preparation overview</h2><button className="ep-btn text" data-testid="button-edit-mapping" onClick={() => go(1)}>Edit mapping<ChevronRight /></button></div><div className="ep-panel-body"><dl className="ep-summary"><div><dt>Working dataset</dt><dd>{selected.name}</dd></div><div><dt>Grouping</dt><dd>{config.grouping === 'run_id' ? 'Run ID' : 'Order ID'}</dd></div><div><dt>Line column</dt><dd>{config.mapping.line || 'Not mapped'}{config.mapping.line === 'line' ? ' · L1' : ''}</dd></div><div><dt>Product column</dt><dd>{config.mapping.product || 'Not mapped · Not assessed'}</dd></div><div><dt>Absolute input tolerance</dt><dd>{config.tolerance || 'Not set'} kg</dd></div><div><dt>Data checks</dt><dd>Not run · next phase</dd></div></dl>{missingMapping && <p className="ep-message ep-error">Required mapping is incomplete. Return to Mapping.</p>}</div></section>
          <section className="ep-panel"><div className="ep-panel-head"><h2>Configured templates</h2><button className="ep-btn text" data-testid="button-edit-templates" onClick={() => go(2)}>Edit<ChevronRight /></button></div><div className="ep-panel-body"><ul className="ep-list"><li>{config.ratioName || 'Unnamed ratio'}<span>{config.numerator} / {config.denominator} · %</span></li><li>{config.durationName || 'Unnamed duration'}<span>{config.durationEvent} · {config.durationUnit}</span></li><li>{config.totalName || 'Unnamed total'}<span>{config.totalEvent} · kg</span></li></ul></div></section></div>
          <section className="ep-panel ep-section"><div className="ep-panel-head"><h2>Keep this setup for another log</h2><Bookmark /></div><div className="ep-panel-body"><p className="ep-small">Profiles retain a snapshot of column mapping, grouping, event assignments, templates and tolerance. They do not contain source files.</p><div className="ep-profile-box"><label className="ep-field">Profile name<input data-testid="input-profile-name" placeholder="e.g. L1 extrusion · daily log" value={profileName} onChange={event => setProfileName(event.target.value)} /></label><button className="ep-btn" data-testid="button-save-profile" onClick={saveProfile}><Bookmark />Save session profile</button></div><p className="ep-small" style={{ marginTop: 17 }}><strong>Intended product behavior:</strong> profiles would be retained locally in this browser, not shared between devices. <strong>This design prototype:</strong> memory only; profiles disappear on refresh.</p></div></section>
          {sourcePreview}
        </>}
        <footer className="ep-footer"><div className="ep-small"><span className="ep-eyebrow">Preparation</span><br />Step {step + 1} of 4 · no checks or calculations</div><div className="ep-footer-actions">{step > 0 && <button className="ep-btn" data-testid="button-back" onClick={() => go(step - 1)}><ArrowLeft />Back</button>}<button className="ep-btn primary" data-testid="button-continue" disabled={(step === 1 && missingMapping) || (step === 2 && !templatesValid) || (step === 3 && (missingMapping || !templatesValid))} onClick={() => step < 3 ? go(step + 1) : setComplete(true)}>{step === 3 ? 'Finish preparation' : `Continue to ${steps[step + 1].title.toLowerCase()}`}{step === 3 ? <Check /> : <ArrowRight />}</button></div></footer>
        </>}
        </div>
      </main>
    </div>
    {profileDialog && <div className="ep-dialog-backdrop" onClick={event => { if (event.target === event.currentTarget) { setProfileDialog(false); profileTrigger.current?.focus(); } }}><div className="ep-dialog" ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="ep-profiles-title"><div className="ep-panel-head"><h2 id="ep-profiles-title">Session profiles</h2><button className="ep-btn text" aria-label="Close profiles" data-testid="button-close-profiles" onClick={() => { setProfileDialog(false); profileTrigger.current?.focus(); }}><X /></button></div><div className="ep-panel-body"><p className="ep-small" style={{ marginBottom: 18 }}>Restore an in-memory setup snapshot. Your selected demo source stays unchanged. Profiles disappear when you refresh.</p>{profiles.length === 0 ? <div className="ep-empty"><FolderOpen /><h3>A home for repeatable setups.</h3><p>No session profiles yet. Name and save your setup in Review, then reuse it here.</p><button className="ep-btn" style={{ marginTop: 18 }} data-testid="button-go-save-profile" onClick={() => { setProfileDialog(false); go(3); }}>Go to Review<ArrowRight /></button></div> : profiles.map(profile => <div className="ep-profile-item" key={profile.id} data-testid={`profile-${profile.id}`}><div><strong>{profile.name}</strong><span className="ep-small">{profile.config.grouping === 'run_id' ? 'Run ID' : 'Order ID'} · 3 templates · {profile.config.tolerance} kg tolerance</span></div><button className="ep-btn" data-testid={`button-reuse-${profile.id}`} onClick={() => useProfile(profile)}>Reuse<ArrowRight /></button></div>)}</div></div></div>}
  </div>;
}
