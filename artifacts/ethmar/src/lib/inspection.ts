import { unzipSync, strFromU8 } from 'fflate';
import { XMLParser, XMLValidator } from 'fast-xml-parser';

export type Cell = { address: string; raw: string | number | boolean | null; display: string; formula?: string; date?: string };
export type SourceRow = { line: number; endLine?: number; cells: Cell[] };
export type ParsedSheet = { name: string; rows: SourceRow[]; merges: string[] };
export type ImportedFile = { name: string; kind: 'csv' | 'xlsx'; sheets: ParsedSheet[]; encoding: string; delimiter: string; decimal: '.' | ','; notes: string[]; original: ArrayBuffer };
export type ParseOptions = { encoding?: string; delimiter?: string; decimal?: '.' | ',' };
export type Inspection = { headers: string[]; headerLine: number | null; dataRows: number; columnCount: number; shape: 'event' | 'run'; columns: { index: number; name: string; type: string; examples: string[] }[]; issues: { code: string; message: string; lines: number[] }[]; runCandidates: number[] };
const MAX_ROWS = 50000, MAX_COLUMNS = 300, MAX_BYTES = 20 * 1024 * 1024;
const blank = (address: string): Cell => ({ address, raw: null, display: '' });
export const normalizeHeader = (s: string) => s.normalize('NFKC').toLowerCase().trim().replace(/[\s_-]+/g, '');
export function columnLetter(n: number): string {
  let s = ''; for (n++; n; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + (n - 1) % 26) + s;
  return s;
}
function checkDimensions(rows: number, columns: number) {
  if (rows > MAX_ROWS || columns > MAX_COLUMNS) throw new Error('This file is too large to inspect safely here. Export up to 50,000 rows and 300 columns at a time.');
}

/** RFC-style CSV reader. Values, blank rows and physical line ranges stay unchanged. */
export function parseCsv(text: string, delimiter: string): SourceRow[] {
  if (!text) return [];
  const rows: SourceRow[] = [];
  let values: string[] = [], value = '', quoted = false, closed = false, line = 1, start = 1;
  const cellEnd = () => { values.push(value); value = ''; closed = false; };
  const rowEnd = () => {
    cellEnd(); checkDimensions(rows.length + 1, values.length);
    rows.push({ line: start, endLine: line, cells: values.map((raw, i) => ({ address: `${columnLetter(i)}${start}`, raw, display: raw })) }); values = [];
  };
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') { if (text[i + 1] === '"') { value += '"'; i++; } else { quoted = false; closed = true; } }
      else { value += c; if (c === '\n' || (c === '\r' && text[i + 1] !== '\n')) line++; }
      continue;
    }
    if (c === delimiter) cellEnd();
    else if (c === '\r' || c === '\n') {
      rowEnd(); if (c === '\r' && text[i + 1] === '\n') i++; line++; start = line;
    } else if (c === '"') {
      if (value || closed) throw new Error(`A quote is misplaced on line ${line}. Re-export the CSV with quoted text fields or correct that line in your source file.`);
      quoted = true;
    } else {
      if (closed) throw new Error(`Unexpected text after a closing quote on line ${line}. Check the delimiter or re-export the CSV.`);
      value += c;
    }
  }
  if (quoted) throw new Error(`A quoted cell starting near line ${start} does not close. Re-export the CSV or close the quote in the source file.`);
  if (value || values.length || closed || !/[\r\n]$/.test(text)) rowEnd();
  return rows;
}
function detectDelimiter(text: string): string {
  const scores = [',', ';', '\t', '|'].map(delimiter => {
    try {
      const rows = parseCsv(text, delimiter).filter(r => r.cells.some(c => c.display.trim())).slice(0, 30);
      const widths = rows.map(r => r.cells.length);
      const frequency = widths.reduce<Record<number, number>>((a, w) => ({ ...a, [w]: (a[w] || 0) + 1 }), {});
      const best = Object.entries(frequency).filter(([w]) => +w > 1).sort((a, b) => b[1] - a[1])[0];
      return { delimiter, score: best ? best[1] / widths.length * 100 + Math.min(+best[0], 50) : 0 };
    } catch { return { delimiter, score: -1 }; }
  }).sort((a, b) => b.score - a.score);
  return scores[0].delimiter;
}
export function numberValue(value: string, decimal: '.' | ','): number | null {
  const s = value.trim();
  const re = decimal === '.' ? /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i : /^[+-]?(?:\d+(?:,\d*)?|,\d+)(?:e[+-]?\d+)?$/i;
  if (!re.test(s)) return null;
  const n = Number(decimal === ',' ? s.replace(',', '.') : s);
  return Number.isFinite(n) ? n : null;
}
function guessDecimal(rows: SourceRow[]): '.' | ',' {
  let comma = 0, dot = 0;
  for (const r of rows.slice(0, 200)) for (const c of r.cells) {
    if (/^[+-]?\d+,\d+$/.test(c.display)) comma++;
    if (/^[+-]?\d+\.\d+$/.test(c.display)) dot++;
  }
  return comma > dot ? ',' : '.';
}
const datePattern = (s: string) => /^\d{4}-\d{1,2}-\d{1,2}(?:[ T].*)?$/.test(s.trim()) ? 'year-first' : /^\d{1,2}\/\d{1,2}\/\d{4}(?: .*)?$/.test(s.trim()) ? 'slash' : /^\d{1,2}-\d{1,2}-\d{4}(?: .*)?$/.test(s.trim()) ? 'day-or-month-first' : '';
const runNames = new Set(['runid', 'run', 'productionrun', 'batch', 'batchid', 'batchnumber', 'orderid', 'order', 'ordernumber', 'رقمالتشغيل', 'رقمالدفعة', 'رقمالطلب', 'معرفالتشغيل', 'معرفالدفعة']);
const known = (s: string) => runNames.has(normalizeHeader(s)) || /^(eventid|eventtype|machine|mold|line|shift|quantitykg|starttime|endtime|date|inputkg|goodkg|scrapkg)$/.test(normalizeHeader(s));

export function inspectSheet(sheet: ParsedSheet, decimal: '.' | ',', headerLine?: number | null): Inspection {
  const columnCount = sheet.rows.reduce((n, r) => Math.max(n, r.cells.length), 0);
  const first = sheet.rows.find(r => r.cells.some(c => c.display.trim()));
  const likely = sheet.rows.slice(0, 25).find(r => r.cells.some(c => known(c.display)));
  const firstLooksHeader = first && first.cells.filter(c => c.display.trim()).length > 1 && first.cells.filter(c => c.display.trim()).every(c => numberValue(c.display, decimal) === null && !datePattern(c.display));
  const detected = likely?.line ?? (firstLooksHeader ? first!.line : null);
  const selected = headerLine === undefined ? detected : headerLine;
  const header = sheet.rows.find(r => r.line === selected);
  const headers = Array.from({ length: columnCount }, (_, i) => header?.cells[i]?.display || `Column ${columnLetter(i)}`);
  const data = sheet.rows.filter(r => selected === null || r.line > selected);
  const issues: Inspection['issues'] = [];
  const add = (code: string, message: string, lines: number[] = []) => { issues.push({ code, message, lines }); };
  if (!sheet.rows.length || !first) add('empty-file', 'No recorded values were found. Choose a populated sheet or export your production data again.');
  if (selected === null) add('no-header', 'No header row was confidently found. Choose the row containing column names, or keep “No header” and identify columns during mapping.');
  if (selected !== null && !header) add('header-missing', 'That row is not in this sheet. Choose an existing row containing the column names.');
  if (header && first && header.line > first.line) add('preamble', 'Rows appear before the chosen header. They may be titles or extra headers; they remain visible in the original rows.', sheet.rows.filter(r => r.line < header.line).map(r => r.line));
  if (header && (header.cells.some(c => !c.display.trim()) || header.cells.length < columnCount || new Set(header.cells.map(c => normalizeHeader(c.display))).size < header.cells.length)) add('headings', 'Some column names are blank or repeated. This can indicate multiple header rows. Confirm one clear header row before mapping.', [header.line]);
  const empties = data.filter(r => r.cells.every(c => !c.display.trim())).map(r => r.line);
  if (empties.length) add('empty-rows', 'Empty rows are present. They have not been deleted.', empties);
  const repeats = header ? data.filter(r => r.cells.length === header.cells.length && r.cells.every((c, i) => c.display === header.cells[i].display)).map(r => r.line) : [];
  if (repeats.length) add('repeated-header', 'The column headings repeat inside the data. These rows are still shown; review them before mapping.', repeats);
  const extraHeaders = data.filter(r => !repeats.includes(r.line) && r.cells.filter(c => known(c.display)).length >= 2).map(r => r.line);
  if (extraHeaders.length) add('multiple-headers', 'Possible additional header rows appear inside the data. Review these rows and choose one header row; all original rows remain visible.', extraHeaders);
  const totals = data.filter(r => r.cells.some(c => /^(grand\s*total|sub\s*total|total|totals|المجموع|الإجمالي|اجمالي|الإجمالى)(?:$|\s|:)/i.test(c.display.trim()))).map(r => r.line);
  if (totals.length) add('totals', 'Possible totals rows are mixed with individual records. Counting both could double-count values; nothing has been removed.', totals);
  const irregular = data.filter(r => r.cells.some(c => c.display.trim()) && r.cells.length !== (header?.cells.length ?? columnCount)).map(r => r.line);
  if (irregular.length) add('irregular', 'Some rows have a different number of cells. Check the delimiter and possible extra headings.', irregular);
  if (sheet.merges.length) add('merged', `Merged cells were found: ${sheet.merges.join(', ')}. Only the original top-left cell has a value; values are not copied into other cells.`);
  const formulaRows = sheet.rows.filter(r => r.cells.some(c => c.formula !== undefined));
  if (formulaRows.length) add('formulas', 'Formula cells show the cached result saved by Excel, which may be out of date. Formulas are never recalculated. Recalculate and save in Excel if needed.', formulaRows.map(r => r.line));
  const noCache = formulaRows.filter(r => r.cells.some(c => c.formula !== undefined && c.raw === null));
  if (noCache.length) add('formula-no-cache', 'Some formulas have no saved result. Open the workbook in Excel, recalculate, save it, and select the file again.', noCache.map(r => r.line));
  const columns = headers.map((name, index) => {
    const cells = data.filter(r => !repeats.includes(r.line)).map(r => ({ cell: r.cells[index], line: r.line })).filter(x => x.cell?.display.trim());
    const formats = new Set(cells.map(x => x.cell.date ? 'year-first' : datePattern(x.cell.display)).filter(Boolean));
    if (formats.size > 1) add(`mixed-dates-${index}`, `“${name}” contains different date formats. Confirm the intended dates in your source; no dates have been guessed.`, cells.filter(x => datePattern(x.cell.display) || x.cell.date).map(x => x.line));
    if (formats.has('slash') || formats.has('day-or-month-first')) add(`ambiguous-dates-${index}`, `“${name}” uses dates that may mean day/month or month/day. Confirm their order before calculations.`, cells.filter(x => datePattern(x.cell.display) === 'slash' || datePattern(x.cell.display) === 'day-or-month-first').map(x => x.line));
    const nums = cells.filter(x => numberValue(String(x.cell.raw ?? ''), decimal) !== null);
    const numberLike = cells.filter(x => typeof x.cell.raw === 'string' && (/^'?[+-]?[\d.,\s]+(?:\s*(?:kg|units|liters|كغ))?$/i.test(x.cell.raw.trim())) && numberValue(x.cell.raw, decimal) === null && !datePattern(x.cell.raw));
    if (numberLike.length) add(`number-text-${index}`, `“${name}” has number-like text that does not fit the selected decimal separator. Review the original values; they were not converted.`, numberLike.map(x => x.line));
    const excelText = sheet.name !== 'CSV' && nums.filter(x => typeof x.cell.raw === 'string');
    if (excelText && excelText.length) add(`stored-text-${index}`, `“${name}” has numbers stored as text. Original values are kept unchanged.`, excelText.map(x => x.line));
    const type = !cells.length ? 'Empty' : cells.every(x => x.cell.date || datePattern(x.cell.display)) ? 'Date' : nums.length === cells.length ? 'Number' : nums.length || formats.size ? 'Mixed' : 'Text';
    return { index, name, type, examples: [...new Set(cells.map(x => x.cell.date ? `${x.cell.date} (original: ${x.cell.raw})` : x.cell.display))].slice(0, 3) };
  });
  const runCandidates = headers.flatMap((h, i) => runNames.has(normalizeHeader(h)) && data.some(r => r.cells[i]?.display.trim() && !repeats.includes(r.line) && !totals.includes(r.line)) ? [i] : []);
  if (!runCandidates.length) add('no-run', 'We could not identify a column with run or order identifiers. Keep the original file and identify its column during mapping, or export a run/order ID column. No runs have been invented.');
  const eventColumn = headers.some(h => /^(eventtype|event|نوعالحدث)$/.test(normalizeHeader(h)));
  return { headers, headerLine: selected, dataRows: data.length, columnCount, shape: eventColumn ? 'event' : 'run', columns, issues, runCandidates };
}

// XML values are deliberately kept as strings until interpreted explicitly.
const xmlParser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@', parseTagValue: false, parseAttributeValue: false, trimValues: false, processEntities: true });
const arr = <T,>(v: T | T[] | undefined): T[] => v === undefined ? [] : Array.isArray(v) ? v : [v];
function xml(content: Uint8Array | undefined) {
  if (!content) throw new Error('This Excel file is missing a required workbook part. Open it in Excel and save a new .xlsx copy.');
  const text = strFromU8(content);
  if (/<!DOCTYPE|<!ENTITY/i.test(text) || XMLValidator.validate(text) !== true) throw new Error('The Excel workbook contains unreadable XML. Save a new .xlsx copy in your spreadsheet application.');
  return xmlParser.parse(text);
}
function excelDate(serial: number, date1904: boolean): string | undefined {
  if (!Number.isFinite(serial) || serial < 0 || serial > 2958465) return undefined;
  if (!date1904 && Math.floor(serial) === 60) return '1900-02-29 (Excel-only date)';
  const epoch = Date.UTC(date1904 ? 1904 : 1899, date1904 ? 0 : 11, date1904 ? 1 : 31);
  const d = new Date(epoch + Math.round((serial - (!date1904 && serial >= 60 ? 1 : 0)) * 86400000));
  return d.toISOString().replace('T', ' ').replace(/\.000Z$/, '').replace(/Z$/, '');
}
function richText(node: any): string {
  if (node == null) return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (node.t !== undefined) return typeof node.t === 'object' ? node.t['#text'] ?? '' : String(node.t);
  return arr<any>(node.r).map(richText).join('');
}
function readXlsx(bytes: ArrayBuffer): ParsedSheet[] {
  let size = 0;
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(new Uint8Array(bytes), { filter: f => {
      if (!/^xl\/.*(?:xml|rels)$/.test(f.name)) return false;
      size += f.originalSize;
      if (size > 80 * 1024 * 1024) throw new Error('Expanded workbook is too large.');
      return true;
    } });
  } catch { throw new Error('This workbook could not be opened safely. It may be damaged, encrypted, or too large. Save an unencrypted .xlsx copy with fewer rows.'); }
  const workbook = xml(files['xl/workbook.xml']).workbook;
  const rels = arr<any>(xml(files['xl/_rels/workbook.xml.rels']).Relationships.Relationship);
  const strings = files['xl/sharedStrings.xml'] ? arr<any>(xml(files['xl/sharedStrings.xml']).sst.si).map(richText) : [];
  const styles = files['xl/styles.xml'] ? xml(files['xl/styles.xml']).styleSheet : {};
  const formats = new Map(arr<any>(styles.numFmts?.numFmt).map(f => [+f['@numFmtId'], String(f['@formatCode'])]));
  const dateStyles = arr<any>(styles.cellXfs?.xf).map(f => {
    const id = +f['@numFmtId'];
    return (id >= 14 && id <= 22) || (id >= 27 && id <= 36) || (id >= 50 && id <= 58) || /[yd]/i.test((formats.get(id) ?? '').replace(/"[^"]*"|\\.|\\[[^\]]*\\]/g, ''));
  });
  const date1904 = ['1', 'true'].includes(String(workbook.workbookPr?.['@date1904']));
  const sheets: ParsedSheet[] = [];
  for (const ws of arr<any>(workbook.sheets?.sheet)) {
    const rel = rels.find(r => r['@Id'] === ws['@r:id']);
    if (!rel || rel['@TargetMode'] === 'External') throw new Error('A sheet points outside this workbook. Save a self-contained .xlsx file.');
    const path = String(rel['@Target']).replace(/^\//, '').replace(/^xl\//, '');
    const root = xml(files[`xl/${path}`]).worksheet;
    if (!root) continue;
    const merges = arr<any>(root.mergeCells?.mergeCell).map(m => String(m['@ref']));
    const byLine = new Map<number, SourceRow>();
    let maxLine = 0, maxCol = 0;
    for (const row of arr<any>(root.sheetData?.row)) {
      const line = +row['@r'];
      if (!Number.isInteger(line) || line < 1) throw new Error('A worksheet has invalid row references. Save a fresh .xlsx export.');
      checkDimensions(line, maxCol); maxLine = Math.max(maxLine, line);
      const cells: Cell[] = [];
      for (const c of arr<any>(row.c)) {
        const address = String(c['@r']);
        const letters = address.match(/^([A-Z]+)\d+$/)?.[1];
        if (!letters) throw new Error('An Excel cell has an invalid address. Re-export the sheet.');
        const col = [...letters].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0) - 1;
        checkDimensions(line, col + 1); maxCol = Math.max(maxCol, col + 1);
        while (cells.length <= col) cells.push(blank(`${columnLetter(cells.length)}${line}`));
        const type = c['@t'], v = c.v;
        let raw: Cell['raw'] = v === undefined ? null : String(v);
        if (type === 's') raw = strings[Number(v)] ?? '';
        else if (type === 'inlineStr') raw = richText(c.is);
        else if (type === 'b') raw = String(v) === '1';
        else if (!type || type === 'n') raw = v === undefined || v === '' ? null : Number.isFinite(Number(v)) ? Number(v) : String(v);
        const formula = c.f === undefined ? undefined : typeof c.f === 'object' ? c.f['#text'] ?? '(shared formula)' : String(c.f);
        const date = typeof raw === 'number' && dateStyles[Number(c['@s'] ?? 0)] ? excelDate(raw, date1904) : type === 'd' ? String(raw) : undefined;
        cells[col] = { address, raw, display: raw === null ? '' : String(raw), ...(formula !== undefined ? { formula } : {}), ...(date ? { date } : {}) };
      }
      byLine.set(line, { line, cells });
    }
    // Preserve covered blank cells without copying merged masters into them.
    for (const range of merges) {
      const end = range.split(':').pop()!.match(/^([A-Z]+)(\d+)$/);
      if (end) { maxLine = Math.max(maxLine, +end[2]); maxCol = Math.max(maxCol, [...end[1]].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0)); }
    }
    checkDimensions(maxLine, maxCol);
    if (maxLine * maxCol > 2_000_000) throw new Error('This sheet contains too many cells to inspect safely. Export a smaller data range.');
    const rows = Array.from({ length: maxLine }, (_, i) => {
      const r = byLine.get(i + 1) ?? { line: i + 1, cells: [] };
      while (r.cells.length < maxCol) r.cells.push(blank(`${columnLetter(r.cells.length)}${r.line}`));
      return r;
    });
    sheets.push({ name: String(ws['@name']), rows, merges });
  }
  if (!sheets.length) throw new Error('No readable worksheets were found. Export a populated worksheet as CSV or .xlsx.');
  return sheets;
}
export async function parseBytes(bytes: ArrayBuffer, name: string, options: ParseOptions = {}): Promise<ImportedFile> {
  if (bytes.byteLength > MAX_BYTES) throw new Error('Choose a file smaller than 20 MB. Export a shorter date range if needed.');
  if (!bytes.byteLength) throw new Error('This file is empty. Export a file containing your production records.');
  if (/\.xlsx$/i.test(name)) {
    const sheets = readXlsx(bytes);
    return { name, kind: 'xlsx', sheets, encoding: 'Excel workbook (Unicode)', delimiter: 'Not applicable', decimal: options.decimal ?? '.', notes: ['Formula results are read only from values saved in the workbook; no formulas or macros are executed.', 'Dates are shown alongside their original Excel serial values.'], original: bytes };
  }
  if (!/\.(csv|tsv)$/i.test(name)) throw new Error('Choose a CSV or Excel .xlsx file. For older .xls files, use Save As → .xlsx in Excel.');
  const b = new Uint8Array(bytes);
  const bom = b[0] === 0xff && b[1] === 0xfe ? 'utf-16le' : b[0] === 0xfe && b[1] === 0xff ? 'utf-16be' : b[0] === 0xef && b[1] === 0xbb && b[2] === 0xbf ? 'utf-8' : '';
  const encoding = options.encoding ?? (bom || 'utf-8');
  let text: string;
  try { text = new TextDecoder(encoding, { fatal: true }).decode(bytes); }
  catch { throw new Error('The text cannot be read using this encoding. Choose an encoding override (for example Arabic Windows-1256), or export UTF-8 CSV from your spreadsheet.'); }
  if (/\u0000/.test(text)) throw new Error('The file contains unreadable zero bytes. Try UTF-16 encoding or export a fresh UTF-8 CSV.');
  if (/^\s*</.test(text) && /<(?:html|workbook|\?xml)/i.test(text.slice(0, 300))) throw new Error('This appears to contain markup, not a CSV table. Export as CSV or .xlsx.');
  const delimiter = options.delimiter ?? detectDelimiter(text);
  const rows = parseCsv(text, delimiter);
  const decimal = options.decimal ?? guessDecimal(rows);
  return { name, kind: 'csv', sheets: [{ name: 'CSV', rows, merges: [] }], encoding, delimiter, decimal, original: bytes, notes: [
    bom ? `Encoding identified by the file marker: ${bom}.` : `Encoding ${encoding} ${options.encoding ? 'was selected by you' : 'is a valid decoding, not a guarantee of the original encoding'}. Check the preview and override if needed.`,
    'CSV values are text. Type and decimal-separator guesses do not change the original values. Ambiguous thousands separators must be reviewed.',
    'CSV does not record merged cells or spreadsheet formulas. Suspicious headings are flagged, but merged cells cannot be proven from CSV.',
  ] };
}
export async function readFile(file: File, options: ParseOptions = {}): Promise<ImportedFile> {
  if (file.size > MAX_BYTES) throw new Error('Choose a file smaller than 20 MB. Export a shorter date range if needed.');
  return parseBytes(await file.arrayBuffer(), file.name, options);
}
