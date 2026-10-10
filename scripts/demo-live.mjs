import { chromium } from '@playwright/test';
import path from 'node:path';
import { writeFile, mkdir } from 'node:fs/promises';
const root=path.resolve(import.meta.dirname,'..');
await mkdir(root+'/eval/demo-workflows',{recursive:true});
const output=root+'/eval/demo-workflows/live-delivery-003-'+new Date().toISOString().replaceAll(':','-')+'.json';
const report={startedAt:new Date().toISOString(),provenance:'Live browser-generated workflow and real agent calls on organiser delivery-003 escalation evidence. Replies are explicit simulated demo events, not live customer or carrier actions.',steps:[],error:null};
const browser=await chromium.launch({...(process.env.DEMO_BROWSER_PATH ? {executablePath:process.env.DEMO_BROWSER_PATH} : {}),headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1000}});
page.setDefaultTimeout(60000);
try {
 await page.goto('http://localhost:3000/?tab=workflows&workflow=demo-delivery-recovery');
 await page.getByRole('button',{name:'New playbook',exact:true}).click();
 const prompt='A residential parcel courier serving gated buildings. Drivers wait outside when access is unavailable. The desk contacts only the verified recipient via the order callback route to arrange intercom admission or meeting at the gate. Never request permanent gate codes or leave a parcel unattended. If the recipient is unavailable, ask Dispatch for feasible alternatives matching recipient availability and the driver wait deadline. Confirm completion only from an actual driver handover record. Build a granular executable incident workflow with missing-evidence and conflicting-evidence checks, safety gates, specific human holds, verification and an unfamiliar-case fallback. Put these requirements in planner policies. Use existing incident nodes only and about 30 to 40 nodes; no watch, learner or route replanning nodes.';
 await page.getByPlaceholder('Describe your delivery business').fill(prompt);
 const builtResponse=page.waitForResponse(r=>r.url().endsWith('/api/console/architect')&&r.request().method()==='POST', {timeout:300000});
 await page.getByRole('button',{name:'Make it',exact:true}).click();
 console.log('Live Architect prompt submitted');
 const built=await(await builtResponse).json();
 report.steps.push({label:'live Architect generation',prompt,result:built});
 await writeFile(output,JSON.stringify(report,null,2)+'\n');
 if(!built.flow||built.problems?.length)throw new Error('Architect did not produce a valid workflow');
 console.log('Architect returned '+built.flow.nodes.length+' nodes');
 const [saveResponse]=await Promise.all([page.waitForResponse(r=>r.url().includes('/api/console/workflows/')&&r.request().method()==='PUT'), page.getByRole('complementary').getByRole('button',{name:'Use this playbook',exact:true}).click()]);
 const saved=await saveResponse.json();
 report.steps.push({label:'save live workflow',workflow:saved.workflow});
 await page.getByRole('button',{name:'Run a case',exact:true}).click();
 await page.getByRole('button',{name:'Delivery 003: locked gate',exact:true}).click();
 await page.screenshot({path:'/private/tmp/dwell-live-003-input.png'});
 const intakeResponse=page.waitForResponse(r=>r.url().endsWith('/api/console/intake')&&r.request().method()==='POST');
 await page.getByRole('button',{name:'Run it',exact:true}).click();
 const intake=await(await intakeResponse).json();
 console.log('Live delivery-003 sample submitted: '+intake.executionId);
 await page.getByRole('button',{name:'Add a reply',exact:true}).waitFor({state:'visible'});
 for(let i=0;i<150;i++) {
  if(await page.getByRole('button',{name:'Add a reply',exact:true}).isEnabled())break;
  if(i===149)throw new Error('Initial run did not finish');
  await page.waitForTimeout(2000);
 }
 const initial=(await(await page.request.get('http://localhost:3000/api/console/executions/'+intake.executionId)).json()).execution;
 report.steps.push({label:'initial locked-gate decision',execution:initial});
 await writeFile(output,JSON.stringify(report,null,2)+'\n');
 console.log('Initial decision: '+initial.outcome);
 await page.screenshot({path:'/private/tmp/dwell-live-003-result.png'});
 for(const label of ['Recipient can admit driver','Driver confirms handover']) {
  await page.getByRole('button',{name:'Add a reply',exact:true}).click();
  await page.getByRole('button',{name:label,exact:true}).click();
  const replyResponse=page.waitForResponse(r=>r.url().endsWith('/api/console/execute')&&r.request().method()==='POST',{timeout:330000});
  await page.getByRole('button',{name:'Continue this case',exact:true}).click();
  const body=await(await replyResponse).json();
  report.steps.push({label,execution:body.execution});
  await writeFile(output,JSON.stringify(report,null,2)+'\n');
  if(body.execution?.status!=='success')throw new Error(body.error??body.execution?.error??'Follow-up failed');
  console.log(label+': '+body.execution.outcome);
  await page.getByRole('button',{name:'Add a reply',exact:true}).waitFor();
  await page.waitForFunction(()=>Array.from(document.querySelectorAll('button')).some(b=>b.textContent.trim()==='Add a reply'&&!b.disabled));
 }
 await page.getByTitle('Practise on real cases and improve',{exact:true}).click();
 await page.getByText('Learn from a human correction',{exact:true}).waitFor();
 await page.screenshot({path:'/private/tmp/dwell-live-003-feedback.png'});
}catch(e){report.error=e.message;process.exitCode=1;console.error(e.message);}
finally{report.finishedAt=new Date().toISOString();await mkdir(root+'/eval/demo-workflows',{recursive:true});await writeFile(output,JSON.stringify(report,null,2)+'\n');await browser.close();console.log('Live browser evidence: '+output);}
