// Code uploads can precede propagation to the public edge. Retry the read-only probe briefly.
let last='No response';
for(let attempt=0;attempt<8;attempt++){
  try{
    const response=await fetch('https://raahhi-enquiries.asif-772.workers.dev/health',{cache:'no-store',signal:AbortSignal.timeout(5000)});
    const data=await response.json();
    if(response.ok&&data.ready&&data.visitorActivity&&data.visitorNetworkDetails&&data.visitorDeviceInference){console.log('Enquiry, visitor activity and device inference APIs are ready.');process.exit(0);}
    last='HTTP '+response.status+'; ready='+Boolean(data.ready)+'; deviceInference='+Boolean(data.visitorDeviceInference);
  }catch{last='Readiness request failed';}
  if(attempt<7)await new Promise(resolve=>setTimeout(resolve,3000));
}
throw Error('Public API did not become ready after deployment. '+last);
