export type AiSection = 'task-extraction'|'priority-ranking'|'daily-plan'|'rescheduling'|'accountability'|'performance-review';
const schemas: Record<AiSection,string> = {
 'task-extraction':'Return {"tasks":[{"title":string,"duration":number,"projectId":string|null}]}',
 'priority-ranking':'Return {"items":[{"id":string,"priority":number,"reason":string}]}',
 'daily-plan':'Return {"tasks":[{"id":string,"scheduledAt":string|null}],"notes":string}',
 'rescheduling':'Return {"changes":[{"id":string,"scheduledAt":string|null}],"reason":string}',
 'accountability':'Return {"message":string,"nextAction":string}',
 'performance-review':'Return {"summary":string,"wins":string[],"focusNext":string}'
};
export async function askClaude(section:AiSection,input:unknown){
 const key=process.env.ANTHROPIC_API_KEY; if(!key) return {simulation:true,section,content:localFallback(section,input),requiresConfirmation:true};
 const response=await fetch('https://api.anthropic.com/v1/messages',{method:'POST',headers:{'content-type':'application/json','x-api-key':key,'anthropic-version':'2023-06-01'},body:JSON.stringify({model:process.env.ANTHROPIC_MODEL||'claude-haiku-4-5-20251001',max_tokens:1200,system:`You are Tempo, a disciplined productivity assistant. ${schemas[section]} Never modify protected routines or confirmed appointments without explicit permission. Return JSON only.`,messages:[{role:'user',content:JSON.stringify(input)}]})});
 if(!response.ok) throw new Error(`AI provider error ${response.status}`); const data:any=await response.json(); const text=data.content?.find((x:any)=>x.type==='text')?.text||'{}'; let content; try{content=JSON.parse(text)}catch{throw new Error('AI returned invalid JSON')} return {simulation:false,section,content,requiresConfirmation:true};
}
function localFallback(section:string,input:any){if(section==='accountability')return {message:'Let’s choose one concrete next step.',nextAction:Array.isArray(input?.tasks)&&input.tasks[0]?.title||'Review your plan'};return {items:[],tasks:[],changes:[],notes:'Simulation: configure ANTHROPIC_API_KEY for Claude proposals.'};}
