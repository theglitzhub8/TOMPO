import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { Store, type Kind, type Event } from './store.js';
import { askClaude, type AiSection } from './ai.js';
const port=Number(process.env.PORT||'8787');
const json=(res:ServerResponse,status:number,data:unknown)=>{res.writeHead(status,{'content-type':'application/json'});res.end(JSON.stringify(data));};
async function body(req:IncomingMessage){let s='';for await(const c of req)s+=c;return s?JSON.parse(s):{};}
function userId(req:IncomingMessage){return String(req.headers['x-tempo-user']||'local-user');}
const validKinds=new Set<Kind>(['task','project','routine','preferences']);
const store=new Store();
const server=createServer(async(req,res)=>{try{const url=new URL(req.url||'/',`http://${req.headers.host||'localhost'}`); if(req.method==='GET'&&url.pathname==='/health')return json(res,200,{ok:true,service:'tempo-server'}); const uid=await store.user(userId(req));
if(req.method==='GET'&&url.pathname==='/v1/sync'){return json(res,200,{changes:await store.changes(uid,Number(url.searchParams.get('after')||0))});}
if(req.method==='DELETE'&&url.pathname.startsWith('/v1/')){const [, , kind, entityId]=url.pathname.split('/');if(!validKinds.has(kind as Kind)||!entityId)return json(res,400,{error:'Invalid resource'});await store.remove(uid,kind as Kind,entityId);return json(res,200,{deleted:true});}
if(req.method==='POST'&&url.pathname==='/v1/ai'){const b=await body(req);if(!['task-extraction','priority-ranking','daily-plan','rescheduling','accountability','performance-review'].includes(b.section))return json(res,400,{error:'Invalid AI section'});return json(res,200,await askClaude(b.section as AiSection,b.input));}
if(req.method==='GET'&&url.pathname.startsWith('/v1/')){const kind=url.pathname.split('/')[2] as Kind;if(!validKinds.has(kind))return json(res,404,{error:'Unknown resource'});return json(res,200,{data:await store.list(uid,kind)});}
if(req.method==='POST'&&url.pathname==='/v1/sync'){const b=await body(req);if(!Array.isArray(b.events)||b.events.length>100)return json(res,400,{error:'events must be an array of at most 100 items'});const events:Event[]=b.events.map((e:any)=>({kind:e.kind,entityId:String(e.entityId),payload:e.payload,revision:0}));if(events.some(e=>!validKinds.has(e.kind)||!e.entityId))return json(res,400,{error:'Invalid sync event'});return json(res,200,{acknowledged:await store.save(uid,events)});}
if(req.method==='POST'&&url.pathname==='/v1/ai/daily-plan'){const b=await body(req);if(!Array.isArray(b.tasks))return json(res,400,{error:'tasks must be an array'});return json(res,200,{proposal:{tasks:b.tasks.map((t:any,i:number)=>({...t,scheduledAt:t.scheduledAt||null,order:i})),protectedRoutineIds:b.protectedRoutineIds||[],requiresConfirmation:true},simulation:true});}
return json(res,404,{error:'Not found'});
}catch(e){console.error(e);return json(res,500,{error:'Internal server error'});}});
if(process.env.DATABASE_URL){store.migrate().then(()=>server.listen(port,()=>console.log(`Tempo server listening on ${port}`))).catch(e=>{console.error(e);process.exit(1)});}else{console.error('DATABASE_URL is required');process.exitCode=1;}
