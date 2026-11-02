// Local/CI browser tests only. These mocks prevent real enquiries or external messages.
export async function mockEnquiryDelivery(page, options={}) {
  const submissions=[];
  await page.addInitScript(()=>{
    window.turnstile={render(_mount,config){setTimeout(()=>config.callback('test-only-verification'),0);return 'test-widget';},remove(){}};
  });
  await page.route('https://raahhi-enquiries.asif-772.workers.dev/api/enquiries',async route=>{
    if(route.request().method()==='OPTIONS')return route.fulfill({status:204,headers:{'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'Content-Type','Access-Control-Allow-Methods':'POST, OPTIONS'}});
    const payload=route.request().postDataJSON();submissions.push(payload);
    if(options.delay)await new Promise(r=>setTimeout(r,options.delay));
    if(options.handler){const response=await options.handler(payload);return route.fulfill({status:response.status,contentType:'application/json',headers:{'Access-Control-Allow-Origin':'*'},body:await response.text()});}
    const failure=typeof options.failure==='function'?options.failure(submissions.length):options.failure;
    await route.fulfill({status:failure?503:201,contentType:'application/json',headers:{'Access-Control-Allow-Origin':'*'},body:JSON.stringify(failure?{error:'temporarily_unavailable'}:{saved:true,reference:'RH-20261102-ABCDEF123456'})});
  });
  return submissions;
}
