import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, useLocation } from 'wouter';
import { ChartNoAxesCombined, LogOut, SlidersHorizontal, Info } from 'lucide-react';
import './demo-session.css';

type DemoRole = 'analyst' | 'manager';
const key = 'ethmar-demo-role';
const SessionContext = createContext<{role:DemoRole}>({role:'analyst'});
export const useDemoSession = () => useContext(SessionContext);
function readRole(): DemoRole|null {
  try {
    // Opener-created tabs receive a copy of sessionStorage, but have their own
    // browsing-context name. Bind the demo choice to this context, not the copy.
    const owner=sessionStorage.getItem(`${key}-tab`);
    if(!owner||window.name!==owner){
      const tab=`ethmar-demo-${crypto.randomUUID()}`;
      window.name=tab;
      sessionStorage.setItem(`${key}-tab`,tab);
      sessionStorage.removeItem(key);
      return null;
    }
    const value=sessionStorage.getItem(key); return value==='analyst'||value==='manager'?value:null;
  }
  catch { return null; }
}
export function DemoSession({children}:{children:ReactNode}) {
  const [role,setRole]=useState(readRole);
  const [lastRole,setLastRole]=useState<DemoRole>(role??'analyst');
  const [opened,setOpened]=useState(!!role);
  const [message,setMessage]=useState('');
  const [storageNote,setStorageNote]=useState('');
  const [path,navigate]=useLocation();
  const bar=useRef<HTMLDivElement>(null);
  const knownPath=path==='/'||/^\/(setup|compare)(?:\/|$)/.test(path);
  useEffect(()=>{
    const observer=new ResizeObserver(()=>{
      document.documentElement.style.setProperty('--demo-bar-height',`${bar.current?.getBoundingClientRect().height??0}px`);
    });
    if(bar.current)observer.observe(bar.current);
    return ()=>{observer.disconnect();document.documentElement.style.removeProperty('--demo-bar-height');};
  },[]);
  const denied=role==='manager'&&/^\/setup(?:\/|$)/.test(path);
  useEffect(()=>{
    if(denied){setMessage('That area is for analysts');navigate('/compare',{replace:true});}
  },[denied,navigate]);
  function signIn(next:DemoRole) {
    try { sessionStorage.setItem(key,next);setStorageNote(''); }
    catch { setStorageNote('This browser cannot remember your demo role. Refreshing will ask you to sign in again.'); }
    setRole(next);setLastRole(next);setOpened(true);
    setMessage(next==='manager'&&/^\/setup(?:\/|$)/.test(path)?'That area is for analysts':'');
    navigate(next==='manager'?'/compare':'/setup',{replace:true});
  }
  function signOut() {
    try { sessionStorage.removeItem(key); }
    catch { /* The role is still cleared in memory when tab storage is unavailable. */ }
    setRole(null);setMessage('');navigate('/',{replace:true});
  }
  return <SessionContext.Provider value={{role:lastRole}}>
    <div className="demo-session-bar" ref={bar}>
      <p><Info size={16} aria-hidden="true"/><span>Demo sign-in, not real security. Real accounts come with the server version.</span></p>
      {role&&<div className="demo-session-actions"><strong data-testid="current-role">{role==='analyst'?'Analyst':'Manager'}</strong><button onClick={signOut}><LogOut size={16} aria-hidden="true"/>Sign out</button></div>}
    </div>
    {storageNote&&<p className="demo-session-message" role="status">{storageNote}</p>}
    {role&&message&&<p className="demo-session-message" role="status">{message}</p>}
    {!role&&<div className="eu"><main className="demo-sign-in">
      <div className="brand"><span className="mark">e</span><strong>ethmar</strong></div>
      <div className="eyebrow">Your demo workspace</div><h1>How will you use Ethmar?</h1>
      <p>Choose your role to get started. No username or password needed.</p>
      <div className="demo-role-cards">
        <button onClick={()=>signIn('analyst')} data-testid="signin-analyst"><SlidersHorizontal aria-hidden="true"/><strong>Analyst</strong><span>Prepare setups and map columns</span><small>Open Setup →</small></button>
        <button onClick={()=>signIn('manager')} data-testid="signin-manager"><ChartNoAxesCombined aria-hidden="true"/><strong>Manager</strong><span>Compare runs and check the numbers</span><small>Open Compare →</small></button>
      </div>
      <p className="demo-data-note">Signing out never deletes your saved setups or imported data. “Delete my data” is a separate action.</p>
    </main></div>}
    {/* Keep the workspace mounted while signed out so even unsaved manager uploads survive. */}
    {role&&!knownPath&&<div className="eu"><main><section className="panel stack"><h1>Page not found</h1><p>Return to your workspace.</p><Link href={role==='manager'?'/compare':'/setup'}>Back to {role==='manager'?'Compare':'Setup'}</Link></section></main></div>}
    {opened&&<div hidden={!role||!knownPath} inert={!role||!knownPath}>{children}</div>}
  </SessionContext.Provider>;
}
