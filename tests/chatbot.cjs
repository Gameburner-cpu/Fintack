/* ==========================================================================
   tests/chatbot.cjs
   End-to-end routing test for the AI assistant.

   Boots the real module graph (Brain -> intent -> decision -> manager ->
   formatter) inside jsdom with a stubbed API, then asserts each message
   reaches the module that should own it.

   Requires jsdom:  npm install --no-save jsdom
   Run with:        node tests/chatbot.cjs

   This suite exists because module collisions are invisible to unit tests:
   the trip module used to claim any message starting with "add ", so
   "Add ₹500 spent on food today" silently became a trip member.
========================================================================== */

(async()=>{
const {JSDOM}=require('jsdom');const fs=require('fs');
const dom=new JSDOM(fs.readFileSync(require('path').join(__dirname,'..','index.html'),'utf8'),{runScripts:'outside-only',url:'http://localhost:5500/'});
global.window=dom.window; global.document=dom.window.document;
global.localStorage=dom.window.localStorage; global.CustomEvent=dom.window.CustomEvent;
global.requestAnimationFrame=cb=>setTimeout(cb,0);
console.log = (...a)=>{}; // silence module debug logs
const out=[];
const log=(...a)=>out.push(a.join(' '));

localStorage.setItem('user',JSON.stringify({id:'u1',full_name:'Test User'}));
localStorage.setItem('token','fake');

const today=new Date().toISOString().slice(0,10);
const y=new Date(Date.now()-864e5).toISOString().slice(0,10);
const month=new Date().toISOString().slice(0,8);
let TX=[
 {id:'t1',title:'Lunch',amount:400,type:'expense',category:'Food',date:today},
 {id:'t2',title:'Salary',amount:80000,type:'income',category:'Salary',date:month+'01'},
 {id:'t3',title:'Rent',amount:20000,type:'expense',category:'Rent',date:month+'02'},
 {id:'t4',title:'Coffee',amount:500,type:'expense',category:'Food',date:y}
];
const calls=[];
global.fetch=async(url,opts={})=>{
  const u=String(url); calls.push((opts.method||'GET')+' '+u.replace(/^https?:\/\/[^/]+/,''));
  let body={success:true};
  if(u.includes('/api/transactions/')&&!opts.method) body={success:true,transactions:TX};
  if(u.includes('/api/transactions')&&opts.method==='POST') body={success:true,transaction:{id:'new',...JSON.parse(opts.body)}};
  if(u.includes('/api/transactions/')&&opts.method==='PUT') body={success:true,transaction:{id:'t4',title:'Coffee',amount:700,type:'expense',category:'Food',date:y},previous:TX[3],changes:['amount']};
  if(u.includes('/api/ai/ask')) body={success:false,message:'AI offline in test'};
  if(u.includes('/api/goals/')) body={success:true,goals:[]};
  return {ok:true,status:200,text:async()=>JSON.stringify(body),json:async()=>body};
};
dom.window.fetch=global.fetch;

const {default:FinTackAI}=await import(require('url').pathToFileURL(require('path').join(__dirname,'..','js/ai/FinTackAI.js')).href);

const cases=[
 ['add ₹500 spent on food today','transactions'],
 ['yes','transactions'],
 ['how much did I spend this month','finance'],
 ['what is my highest spending category','finance'],
 ['and last month?','finance'],
 ['can I afford a ₹60,000 laptop','finance'],
 ["change yesterday's food expense from ₹500 to ₹700",'transactions'],
 ['no','transactions'],
 ['what is a SIP','knowledge'],
 ['explain emergency funds','knowledge'],
 ['how does compounding work','knowledge'],
 ['show my recent transactions','transactions'],
 ['hello there','knowledge']
];

let pass=0, fail=0;
for(const [q,expected] of cases){
  try{
    const r=await FinTackAI.ask(q);
    const resp=r?.responses?.[0];
    const mod=resp?.module||'none';
    const ok = mod===expected;
    ok?pass++:fail++;
    log((ok?'  ok  ':'  FAIL'), mod.padEnd(13), JSON.stringify(q).padEnd(50), '|', (resp?.message||'').replace(/\s+/g,' ').slice(0,60));
  }catch(e){ fail++; log('  ERR ', q, e.message.split('\n')[0]); }
}
log('');
log(`  ${pass} routed correctly, ${fail} wrong`);
log('  API calls made: '+[...new Set(calls)].join(' , '));
process.stdout.write(out.join('\n')+'\n');
process.exit(fail===0?0:1);
})();
