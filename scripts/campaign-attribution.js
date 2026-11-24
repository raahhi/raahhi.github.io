/* First-party campaign labels only. No Meta click IDs, customer fields or raw URLs. */
(()=>{
  const KEY='raahhi.campaign.v1',CHOICE='raahhi.analytics.choice.v3',TTL=30*60000;
  const permitted=()=>{
    if(navigator.globalPrivacyControl===true||navigator.doNotTrack==='1')return false;
    try{const c=JSON.parse(localStorage.getItem(CHOICE)||'null');return c?.value==='allow'&&Date.now()-c.at<180*86400000;}catch{return false;}
  };
  function clean(value){
    if(!value||!['Instagram','Facebook'].includes(value.platform)||!/^dubai_holiday_launch(?:_\d{6})?$/.test(value.campaign)||value.medium!=='paid_social')return null;
    const result={platform:value.platform,medium:'paid_social',campaign:value.campaign};
    if(/^dubai_quote_v[1-9]$/.test(value.creative||''))result.creative=value.creative;
    for(const key of ['campaignId','adSetId','adId'])if(/^\d{5,25}$/.test(value[key]||''))result[key]=value[key];
    return result;
  }
  function get(){
    if(!permitted()){try{sessionStorage.removeItem(KEY);}catch{}return null;}
    const p=new URLSearchParams(location.search),platform={ig:'Instagram',instagram:'Instagram',fb:'Facebook',facebook:'Facebook'}[p.get('utm_source')];
    const current=clean({platform,medium:p.get('utm_medium'),campaign:p.get('utm_campaign'),creative:p.get('utm_content'),campaignId:p.get('utm_id'),adSetId:p.get('utm_term'),adId:p.get('ad_id')});
    if(current){try{sessionStorage.setItem(KEY,JSON.stringify({...current,at:Date.now()}));}catch{}return current;}
    try{const saved=JSON.parse(sessionStorage.getItem(KEY)||'null');if(saved&&Number.isFinite(saved.at)&&Date.now()-saved.at>=0&&Date.now()-saved.at<TTL)return clean(saved);sessionStorage.removeItem(KEY);}catch{}
    return null;
  }
  window.raahhiCampaign={get,details(){const c=get();return c?Object.entries(c).map(([key,value])=>['Campaign '+key,value]):[];}};
})();
