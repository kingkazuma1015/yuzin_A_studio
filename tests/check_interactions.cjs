// DOM doubles exercise script logic; these do not replace browser/device QA.
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const path = require('node:path');
let doc, track, gallery;
class Target {
  constructor(){this.listeners={};}
  addEventListener(name,fn){(this.listeners[name]??=[]).push(fn);}
  async emit(name,event={}){ event.target??=this; for(const fn of this.listeners[name]??[]) await fn(event); }
}
class Element extends Target {
  constructor(data){super();this.tag=data.tag;this.attrs={...data.attrs};this.children=[];this.textContent=data.text??'';this.style={overflow:''};this.dataset={};this.hidden=false;this.disabled=false;this.open=false;this._scrollLeft=0;this.value=this.attrs.value??this.textContent;
    for(const [k,v] of Object.entries(this.attrs))if(k.startsWith('data-')) this.dataset[k.slice(5).replace(/-([a-z])/g,(_,c)=>c.toUpperCase())]=v??'';
    const set=new Set((this.attrs.class??'').split(' ').filter(Boolean));this.classList={add:c=>set.add(c),remove:c=>set.delete(c),contains:c=>set.has(c),toggle:c=>{if(set.has(c)){set.delete(c);return false;}set.add(c);return true;}};
    this.classes=set; for(const child of data.children??[])this.appendChild(new Element(child));
  }
  matches(s){if(s.startsWith('.'))return this.classes.has(s.slice(1));if(s.startsWith('#'))return this.attrs.id===s.slice(1);if(s.startsWith('[')){const k=s.slice(1,-1);return k.startsWith('data-')?Object.hasOwn(this.dataset,k.slice(5).replace(/-([a-z])/g,(_,c)=>c.toUpperCase())):Object.hasOwn(this.attrs,k);}return this.tag===s;}
  querySelectorAll(s){return this.children.flatMap(c=>[...(c.matches(s)?[c]:[]),...c.querySelectorAll(s)]);}
  querySelector(s){return this.querySelectorAll(s)[0]??null;}
  setAttribute(k,v){this.attrs[k]=v;}
  getAttribute(k){return this.attrs[k];}
  appendChild(c){c.parent=this;this.children.push(c);return c;}
  append(c){if(c.tag==='fragment')c.children.slice().forEach(n=>this.appendChild(n));else this.appendChild(c);}
  prepend(c){for(const n of c.children.slice().reverse()){n.parent=this;this.children.unshift(n);}}
  remove(){this.parent.children=this.parent.children.filter(c=>c!==this);}
  cloneNode(){return new Element({tag:this.tag,attrs:{...this.attrs,class:[...this.classes].join(' ')},text:this.textContent,children:this.children.map(c=>c.serialize())});}
  serialize(){return {tag:this.tag,attrs:this.attrs,text:this.textContent,children:this.children.map(c=>c.serialize())};}
  contains(other){return this===other||this.children.some(c=>c.contains(other));}
  focus(){doc.activeElement=this;}
  select(){this.selected=true;}
  setSelectionRange(a,b){this.selection=[a,b];}
  showModal(){this.open=true;}
  close(){this.open=false;this.emit('close');}
  getBoundingClientRect(){return {left:10,top:10,right:610,bottom:610};}
  get offsetLeft(){return (this.parent?.children.indexOf(this)??0)*318+18;}
  get offsetWidth(){return 300;}
  get clientWidth(){return this.viewportWidth??740;}
  get scrollWidth(){return this===gallery?track.children.length*318+36:0;}
  get scrollLeft(){return this._scrollLeft;}
  set scrollLeft(v){this._scrollLeft=Math.max(0,Math.min(v, Math.max(0,this.scrollWidth-this.clientWidth)));}
  scrollBy({left}){this.scrollLeft+=left;this.emit('scroll');}
  setPointerCapture(id){this.capture=id;}
  hasPointerCapture(id){return this.capture===id;}
  releasePointerCapture(){this.capture=null;}
  get elements(){return {namedItem:name=>this.querySelectorAll('input').concat(this.querySelectorAll('textarea')).find(x=>x.attrs.name===name)};}
}
(async()=>{
  doc=new Element(JSON.parse(fs.readFileSync(0,'utf8')));doc.body=doc.querySelector('body');doc.activeElement=doc.body;doc.hidden=false;doc.createDocumentFragment=()=>new Element({tag:'fragment',attrs:{}});
  gallery=doc.querySelector('.works-marquee');track=doc.querySelector('.works-track');
  class Query extends Target{constructor(matches){super();this.matches=matches;}async set(v){this.matches=v;await this.emit('change',{matches:v});}}
  const mobile=new Query(false),motion=new Query(false),pointer=new Query(true);
  const window=new Target();const frames=new Map();let nextId=0;
  Object.assign(window,{matchMedia:s=>s.includes('max-width')?mobile:s.includes('reduced-motion')?motion:pointer,requestAnimationFrame:fn=>{frames.set(++nextId,fn);return nextId;},cancelAnimationFrame:id=>frames.delete(id),location:{href:''}});
  const copied=[];const navigator={clipboard:{writeText:async s=>copied.push(s)}};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../script.js'),'utf8'),{window,document:doc,navigator,Date,console});
  assert.equal(track.children.length,21);assert.equal(frames.size,1);
  for(let n=0;n<3;n++){await mobile.set(true);assert.equal(track.children.length,7);assert.equal(frames.size,0);await mobile.set(false);assert.equal(track.children.length,21);assert.equal(frames.size,1);}
  gallery.viewportWidth=3000;await window.emit("resize");assert.equal(track.children.length,7);assert.equal(frames.size,0);gallery.viewportWidth=740;await window.emit("resize");assert.equal(track.children.length,21);
  await motion.set(true);assert.equal(track.children.length,7);assert.equal(frames.size,0);await motion.set(false);
  await pointer.set(false);assert.equal(track.children.length,7);await pointer.set(true);assert.equal(track.children.length,21);
  await gallery.emit('focusin');assert.equal(frames.size,0);await gallery.emit('focusout',{relatedTarget:doc.body});assert.equal(frames.size,1);
  await gallery.emit('mouseenter');assert.equal(frames.size,0);await gallery.emit('mouseleave');assert.equal(frames.size,1);
  doc.hidden=true;await doc.emit('visibilitychange');assert.equal(frames.size,0);doc.hidden=false;await doc.emit('visibilitychange');assert.equal(frames.size,1);
  const pause=doc.querySelector('[data-works-pause]');await pause.emit('click');assert.equal(frames.size,0);assert.equal(pause.getAttribute('aria-pressed'),'true');await pause.emit('click');assert.equal(frames.size,1);
  await mobile.set(true);const next=doc.querySelector('[data-works-next]');await next.emit('click');assert.ok(gallery.scrollLeft>0);
  const menu=doc.querySelector('.menu-toggle');await menu.emit('click');assert.equal(menu.getAttribute('aria-expanded'),'true');await mobile.set(false);assert.equal(menu.getAttribute('aria-expanded'),'false');
  let prevented=false;await gallery.emit('click',{detail:1,preventDefault(){prevented=true;}});assert.equal(prevented,false);
  const open=doc.querySelector('[data-open-mail]'),dialog=doc.querySelector('#mail-modal'),form=doc.querySelector('.mail-form'),status=doc.querySelector('.mail-status');
  const subject=form.elements.namedItem('subject'),body=form.elements.namedItem('body');
  for(let n=0;n<3;n++){await open.emit('click');assert.equal(dialog.open,true);assert.equal(doc.activeElement,subject);assert.equal(doc.body.style.overflow,'hidden');await dialog.querySelector('[data-close-mail]').emit('click');assert.equal(dialog.open,false);assert.equal(doc.activeElement,open);assert.equal(doc.body.style.overflow,'');}
  await open.emit('click');body.value='日本語 & ?\n現在の本文';
  for(const button of dialog.querySelectorAll('[data-copy-mail]'))await button.emit('click');
  assert.deepEqual(copied,['yuzinamix@gmail.com','MIX依頼の相談',body.value]);
  navigator.clipboard.writeText=async()=>{throw new Error('Permission denied');};await dialog.querySelectorAll('[data-copy-mail]')[2].emit('click');assert.equal(body.selected,true);assert.match(status.textContent,/自動コピーが使えません/);
  subject.value='日本語 & ?';await form.emit('submit',{preventDefault(){}});
  assert.match(window.location.href,/^mailto:yuzinamix@gmail.com\?subject=/);const params=new URLSearchParams(window.location.href.split('?')[1]);assert.equal(params.get('subject'),subject.value);assert.equal(params.get('body'),'日本語 & ?\r\n現在の本文');
  console.log('PASS: JS state tests (desktop/mobile/reduced/coarse transitions, single animation, pause/hover/focus/hidden, buttons, native link click, menu reset, repeat dialog open/close, copy success/failure, encoded mailto)');
})().catch(error=>{console.error(error);process.exit(1);});
