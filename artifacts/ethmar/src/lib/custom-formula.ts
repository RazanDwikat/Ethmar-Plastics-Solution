import type {Measurement,Setup} from './setup';
export type FormulaBinding={kind:'total'|'count'|'measurement';id:string};
type Node={type:'number';value:number}|{type:'ref';name:string}|{type:'unary';op:string;child:Node}|{type:'binary';op:string;left:Node;right:Node};
export function parseFormula(text:string):Node{
 if(text.length>4000)throw new Error('Formula is too long. Use fewer than 4,000 characters.');
 const tokens:{text:string;type:string}[]=[];let i=0;
 while(i<text.length){
  if(/\s/.test(text[i])){i++;continue;}
  if(tokens.length>=256)throw new Error('Formula has too many parts. Use fewer than 256 parts.');
  if(text[i]==='['){const end=text.indexOf(']',i+1);if(end<0)throw new Error('Missing closing bracket ] after a source name.');const name=text.slice(i+1,end);if(!name.trim())throw new Error('Choose a source inside the brackets.');tokens.push({type:'ref',text:name});i=end+1;continue;}
  const number=text.slice(i).match(/^(?:\d+(?:\.\d*)?|\.\d+)/);
  if(number){tokens.push({type:'number',text:number[0]});i+=number[0].length;continue;}
  if('+-*/()×÷x−'.includes(text[i])){tokens.push({type:'op',text:({'×':'*','x':'*','÷':'/','−':'-'} as Record<string,string>)[text[i]]??text[i]});i++;continue;}
  throw new Error(`Unknown name or symbol near “${text.slice(i,i+25)}”. Insert a source in [brackets]; only numbers, + − × / and parentheses are allowed.`);
 }
 let p=0;
 const atom=(depth:number):Node=>{
  if(depth>48)throw new Error('Too many nested parentheses. Simplify this formula.');
  const t=tokens[p++];if(!t)throw new Error('The formula is incomplete. Add a number or source.');
  if(t.text==='+'||t.text==='-')return {type:'unary',op:t.text,child:atom(depth+1)};
  if(t.text==='('){const value=expression(depth+1);if(tokens[p++]?.text!==')')throw new Error('Missing closing parenthesis ).');return value;}
  if(t.type==='number'){const n=Number(t.text);if(!Number.isFinite(n))throw new Error('A number is too large.');return {type:'number',value:n};}
  if(t.type==='ref')return {type:'ref',name:t.text};
  throw new Error(t.text===')'?'Unexpected closing parenthesis ).':'Add a number or source after the operator.');
 };
 const term=(depth:number):Node=>{let n=atom(depth);while(['*','/'].includes(tokens[p]?.text)){const op=tokens[p++].text;n={type:'binary',op,left:n,right:atom(depth)};}return n;};
 const expression=(depth:number):Node=>{let n=term(depth);while(['+','-'].includes(tokens[p]?.text)){const op=tokens[p++].text;n={type:'binary',op,left:n,right:term(depth)};}return n;};
 if(!tokens.length)throw new Error('Enter a formula or insert a source to begin.');
 const ast=expression(0);if(p!==tokens.length)throw new Error(tokens[p].text===')'?'Unexpected closing parenthesis ).':'An operator is missing between two parts.');return ast;
}
export function formulaNames(ast:Node):string[]{return [...new Set(ast.type==='ref'?[ast.name]:ast.type==='binary'?[...formulaNames(ast.left),...formulaNames(ast.right)]:ast.type==='unary'?formulaNames(ast.child):[])];}
export function evaluateFormula(ast:Node,resolve:(name:string)=>number):number{
 let n:number;
 switch(ast.type){
  case 'number':n=ast.value;break;
  case 'ref':n=resolve(ast.name);break;
  case 'unary':n=evaluateFormula(ast.child,resolve)*(ast.op==='-'?-1:1);break;
  case 'binary':{
   const a=evaluateFormula(ast.left,resolve),b=evaluateFormula(ast.right,resolve);
   if(ast.op==='/'&&b===0)throw new Error('divisor is zero');
   n=ast.op==='+'?a+b:ast.op==='-'?a-b:ast.op==='*'?a*b:a/b;break;
  }
 }
 if(!Number.isFinite(n))throw new Error('The result is outside the supported numeric range.');return n;
}
export function formulaOptions(s:Setup,m:Measurement){
 const options=[
  ...s.events.flatMap(e=>[
   {name:`${e.label} total`,kind:'total' as const,id:e.id,example:e.id==='material'?1000:e.id==='good'?950:e.kind==='timed'?(e.id==='downtime'?.75:4):50},
   {name:`${e.label} count`,kind:'count' as const,id:e.id,example:1}
  ]),
  ...s.measurements.map(v=>({name:`${v.label} measurement`,kind:'measurement' as const,id:v.id,example:v.exampleA}))
 ];
 return options.map((o,index)=>{
  const existing=Object.entries(m.formulaBindings??{}).find(([,b])=>b.kind===o.kind&&b.id===o.id)?.[0];
  const name=o.name.replace(/[[\]]/g,'');
  return {...o,name:existing??(options.filter(x=>x.name===o.name).length>1?`${name} ${index+1}`:name)};
 });
}
export function bindFormula(text:string,s:Setup,m:Measurement):Record<string,FormulaBinding>{
 const known=new Map(formulaOptions(s,m).map(o=>[o.name,o]));
 const names=[...text.matchAll(/\[([^\]]+)\]/g)].map(x=>x[1]);
 return Object.fromEntries([...new Set(names)].flatMap(name=>{
  const old=Object.hasOwn(m.formulaBindings??{},name)?m.formulaBindings![name]:undefined,o=old??known.get(name);
  return o?[[name,{kind:o.kind,id:o.id}]]:[];
 }));
}
export function formulaReferences(m:Measurement,s:Setup){
 const ast=parseFormula(m.formula??''),bindings=bindFormula(m.formula??'',s,m);
 const references=formulaNames(ast).map(name=>{
  const b=bindings[name];if(!b)throw new Error(`Unknown name “${name}”. Choose it from Insert.`);
  if(!(b.kind==='measurement'?s.measurements:s.events).some(e=>e.id===b.id))throw new Error(`Source “${name}” was removed. Choose a replacement.`);
  return {name,...b};
 });
 return {ast,references};
}
export function formulaProblems(s:Setup):string[]{
 const errors:string[]=[],visiting=new Set<string>(),done=new Set<string>();
 if(new Set(s.measurements.map(m=>m.id)).size!==s.measurements.length||new Set(s.events.map(e=>e.id)).size!==s.events.length)return ['Sources and measurements need unique identities. This setup contains repeated identities.'];
 const visit=(m:Measurement)=>{
  if(visiting.size>64)throw new Error('Too many linked measurements. Simplify the chain of references.');
  if(visiting.has(m.id))throw new Error(`Circular reference involving “${m.label}”. Measurements cannot depend on themselves, directly or through another measurement.`);
  if(done.has(m.id))return;
  visiting.add(m.id);
  if(m.template==='Custom formula'){
   const {ast,references}=formulaReferences(m,s);
   for(const ref of references)if(ref.kind==='measurement')visit(s.measurements.find(v=>v.id===ref.id)!);
   if(!references.length)evaluateFormula(ast,()=>0);
   if(m.outputUnit!==undefined&&!['percent','quantity','hours','minutes','number'].includes(m.outputUnit))throw new Error('Choose a valid output unit.');
   if(m.decimals!==undefined&&(!Number.isInteger(m.decimals)||m.decimals<0||m.decimals>6))throw new Error('Choose 0 to 6 decimal places.');
   if(Object.values(m.formulaExamples??{}).some(v=>!Number.isFinite(v)))throw new Error('Enter valid numbers for the illustrative values.');
  }
  visiting.delete(m.id);done.add(m.id);
 };
 for(const m of s.measurements){try{visit(m);}catch(e){errors.push(`${m.label}: ${(e as Error).message}`);visiting.clear();}}
 return [...new Set(errors)];
}
/** Recursive leaf dependencies used by Required checks, evidence, and issue tooltips. */
export function measurementDependencies(m:Measurement,s:Setup,seen=new Set<string>()):{id:string;countOnly:boolean}[]{
 if(seen.has(m.id))return [];const next=new Set(seen).add(m.id);
 if(m.template!=='Custom formula')return [m.a,...(['Ratio','Difference','Rate per hour'].includes(m.template)?[m.b]:[])].map(id=>({id,countOnly:m.template==='Count'}));
 try{return formulaReferences(m,s).references.flatMap(r=>r.kind==='measurement'?measurementDependencies(s.measurements.find(v=>v.id===r.id)!,s,next):[{id:r.id,countOnly:r.kind==='count'}]);}catch{return [];}
}
export function previewFormula(m:Measurement,s:Setup):{value:number|null;formula:string;error?:string;parts:{name:string;value:number}[]}{
 let parts:{name:string;value:number}[]=[];
 try{
  const {ast,references}=formulaReferences(m,s),options=formulaOptions(s,m);
  parts=references.map(r=>({name:r.name,value:m.formulaExamples?.[r.name]??options.find(o=>o.name===r.name)!.example}));
  const errors=formulaProblems(s);if(errors.length)throw new Error(errors.join(' '));
  const values=new Map(parts.map(p=>[p.name,p.value]));
  const value=evaluateFormula(ast,n=>values.get(n)!);
  return {value,formula:(m.formula??'').replace(/\[([^\]]+)\]/g,(_,n)=>String(values.get(n))),parts};
 }catch(e){return {value:null,formula:m.formula??'',error:(e as Error).message,parts};}
}
