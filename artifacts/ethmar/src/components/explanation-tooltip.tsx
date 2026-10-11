import { cloneElement, isValidElement, useEffect, useId, useRef, useState, type ReactElement, type ReactNode } from 'react';
import './explanation-tooltip.css';

/** Inline host keeps focus inside drawers. Capture Escape before their document listeners. */
export function ExplanationTooltip({text,children,onAction,interactive=false}:{text:string;children:ReactNode;onAction?:()=>void;interactive?:boolean}){
 const [open,setOpen]=useState(false),[position,setPosition]=useState({left:12,top:12,above:false,maxHeight:240});
 const host=useRef<HTMLSpanElement>(null),id=useId(),touch=useRef(false),armed=useRef(false),leaveTimer=useRef<ReturnType<typeof setTimeout>|undefined>(undefined);
 const show=()=>{const r=host.current?.getBoundingClientRect();if(r){const below=window.innerHeight-r.bottom-20,above=r.top-20,useAbove=below<180&&above>below;setPosition({left:Math.max(12,Math.min(r.left,window.innerWidth-372)),top:useAbove?r.top-8:r.bottom+8,above:useAbove,maxHeight:Math.max(40,useAbove?above:below)});setOpen(true)}};
 useEffect(()=>{if(!open)return;
  const dismiss=()=>{setOpen(false);armed.current=false};
  const key=(e:KeyboardEvent)=>{if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();dismiss()}};
  const outside=(e:PointerEvent)=>{if(!host.current?.contains(e.target as Node))dismiss()};
  document.addEventListener('keydown',key,true);document.addEventListener('pointerdown',outside,true);
  const scroll=(e:Event)=>{if(!(e.target instanceof Element&&e.target.closest('[role=tooltip]'))){if(host.current?.contains(document.activeElement))show();else dismiss()}};
  window.addEventListener('scroll',scroll,true);window.addEventListener('resize',dismiss);
  return()=>{document.removeEventListener('keydown',key,true);document.removeEventListener('pointerdown',outside,true);window.removeEventListener('scroll',scroll,true);window.removeEventListener('resize',dismiss);clearTimeout(leaveTimer.current)};
 },[open]);
 return <span ref={host} className="explanation-trigger" tabIndex={interactive?undefined:0} role={onAction?'button':undefined} aria-describedby={open?id:undefined} aria-haspopup={onAction?'dialog':undefined} aria-description={onAction?'See all issue details; on touch tap once for explanation, again for details':undefined}
  onPointerEnter={e=>{clearTimeout(leaveTimer.current);if(e.pointerType==='mouse'){touch.current=false;show()}}} onMouseLeave={()=>{if(!touch.current)leaveTimer.current=setTimeout(()=>setOpen(false),180)}} onFocus={show} onBlur={e=>{if(!e.currentTarget.contains(e.relatedTarget))setOpen(false)}}
  onPointerDownCapture={e=>{touch.current=e.pointerType==='touch'}}
  onClickCapture={e=>{if((e.target as HTMLElement).closest('[role=tooltip]')){e.preventDefault();e.stopPropagation();return}if(touch.current&&!armed.current){e.preventDefault();e.stopPropagation();armed.current=true;show();return}armed.current=false;if(onAction){e.preventDefault();e.stopPropagation();setOpen(false);onAction()}else if(touch.current)setOpen(false)}}
  onKeyDown={e=>{if(e.key!=='Enter'&&e.key!==' ')return;if(onAction){e.preventDefault();e.stopPropagation();setOpen(false);onAction()}else if(!interactive){const summary=host.current?.closest('summary');if(summary){e.preventDefault();e.stopPropagation();setOpen(false);summary.click()}}}}>
  {interactive&&isValidElement(children)?cloneElement(children as ReactElement<{'aria-describedby'?:string}>,{'aria-describedby':open?id:undefined}):children}{open&&<span id={id} role="tooltip" className="explanation-tip" style={{left:position.left,top:position.top,maxHeight:position.maxHeight,transform:position.above?'translateY(-100%)':undefined}}>{text}</span>}
 </span>;
}
