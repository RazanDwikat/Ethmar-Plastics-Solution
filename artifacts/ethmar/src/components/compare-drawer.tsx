import { useEffect, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';

export function CompareDrawer({title,onClose,children,wide=false}:{title:string;onClose:()=>void;children:ReactNode;wide?:boolean}){
 const panel=useRef<HTMLDivElement>(null),close=useRef(onClose);close.current=onClose;
 useEffect(()=>{
  const previous=document.activeElement as HTMLElement|null,bodyOverflow=document.body.style.overflow;
  document.body.style.overflow='hidden';panel.current?.focus();
  const key=(e:KeyboardEvent)=>{
   if(e.key==='Escape'){e.preventDefault();close.current();return;}
   if(e.key!=='Tab')return;
   const nodes=Array.from(panel.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input,select,textarea,a[href],summary,[tabindex="0"]')??[]).filter(n=>n.getClientRects().length);
   const first=nodes[0],last=nodes[nodes.length-1];
   if(!first){e.preventDefault();return;}
   if(e.shiftKey&&(document.activeElement===first||document.activeElement===panel.current)){e.preventDefault();last.focus();}
   else if(!e.shiftKey&&(document.activeElement===last||document.activeElement===panel.current)){e.preventDefault();first.focus();}
  };
  document.addEventListener('keydown',key);return()=>{document.removeEventListener('keydown',key);document.body.style.overflow=bodyOverflow;previous?.focus();};
 },[]);
 return <div className="drawer-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)onClose()}}><div className={`compare-drawer ${wide?'picker-drawer':''}`} ref={panel} role="dialog" aria-modal="true" aria-label={title} tabIndex={-1}><div className="row between drawer-heading"><h2>{title}</h2><button onClick={onClose} aria-label={`Close ${title}`}><X/>Close</button></div>{children}</div></div>;
}
