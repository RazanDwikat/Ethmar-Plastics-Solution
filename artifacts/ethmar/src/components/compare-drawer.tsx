import { useEffect, useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

export function CompareDrawer({title,onClose,children,wide=false}:{title:string;onClose:()=>void;children:ReactNode;wide?:boolean}){
 const panel=useRef<HTMLDivElement>(null),host=useRef<HTMLDivElement>(null),close=useRef(onClose),headingId=useId();close.current=onClose;
 useEffect(()=>{
  const previous=document.activeElement as HTMLElement|null,bodyOverflow=document.body.style.overflow;
   const backgrounds=Array.from(document.body.children).filter((node):node is HTMLElement=>node instanceof HTMLElement&&node!==host.current);
   const previousInert=backgrounds.map(node=>node.inert);
   backgrounds.forEach(node=>{node.inert=true});
  document.body.style.overflow='hidden';panel.current?.focus();
  const key=(e:KeyboardEvent)=>{
   if(e.key==='Escape'){e.preventDefault();close.current();return;}
   if(e.key!=='Tab')return;
    const nodes=Array.from(panel.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),a[href],summary,[tabindex="0"]')??[]).filter(n=>n.getClientRects().length&&!n.closest('[inert]'));
   const first=nodes[0],last=nodes[nodes.length-1];
   if(!first){e.preventDefault();return;}
   if(e.shiftKey&&(document.activeElement===first||document.activeElement===panel.current)){e.preventDefault();last.focus();}
   else if(!e.shiftKey&&(document.activeElement===last||document.activeElement===panel.current)){e.preventDefault();first.focus();}
  };
   const contain=(e:FocusEvent)=>{if(e.target instanceof Node&&!panel.current?.contains(e.target))panel.current?.focus()};
   document.addEventListener('focusin',contain);
   document.addEventListener('keydown',key);return()=>{document.removeEventListener('keydown',key);document.removeEventListener('focusin',contain);backgrounds.forEach((node,i)=>{node.inert=previousInert[i]});document.body.style.overflow=bodyOverflow;if(previous?.isConnected)previous.focus();};
 },[]);
 return createPortal(<div className="eu" ref={host} style={{minHeight:0}}><div className="drawer-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)onClose()}}><div className={`compare-drawer ${wide?'picker-drawer':''}`} ref={panel} role="dialog" aria-modal="true" aria-labelledby={headingId} tabIndex={-1}><div className="row between drawer-heading"><h2 id={headingId}>{title}</h2><button onClick={onClose} aria-label={`Close ${title}`}><X/>Close</button></div>{children}</div></div></div>,document.body);
}
