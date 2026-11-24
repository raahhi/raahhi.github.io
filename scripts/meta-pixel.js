/* Meta advertising is separate from first-party analytics and is opt-in only. */
(()=>{
  if(new URLSearchParams(location.search).has('__prerender'))return;
  const PIXEL='1127806210084924',CHOICE='raahhi.ads.choice.v1',TTL=180*86400000;
  const blocked=()=>navigator.globalPrivacyControl===true||navigator.doNotTrack==='1';
  function allowed(){try{const c=JSON.parse(localStorage.getItem(CHOICE)||'null');return !blocked()&&c?.value==='allow'&&Number.isFinite(c.at)&&c.at<=Date.now()&&Date.now()-c.at<TTL;}catch{return false;}}
  let started=false,pageSent=false;
  const sent=new Set();
  function start(){
    if(!allowed())return;
    if(!started){
      if(window.fbq)return; // Do not attach to an unrelated tracker or change its configuration.
      const queue=function(){queue.callMethod?queue.callMethod.apply(queue,arguments):queue.queue.push(arguments);};
      queue.push=queue;queue.loaded=true;queue.version='2.0';queue.queue=[];
      window.fbq=window._fbq=queue;
      queue('consent','revoke');queue('set','autoConfig',false,PIXEL);queue('init',PIXEL);
      started=true;
      const script=document.createElement('script');script.async=true;script.src='https://connect.facebook.net/en_US/fbevents.js';script.referrerPolicy='no-referrer';
      document.head.append(script);
    }
    window.fbq('consent','grant');
    if(!pageSent){window.fbq('trackSingle',PIXEL,'PageView');pageSent=true;}
  }
  function setConsent(value){
    try{localStorage.setItem(CHOICE,JSON.stringify({value:value===true&&!blocked()?'allow':'decline',at:Date.now()}));}catch{return;}
    if(allowed())start();else if(started)window.fbq('consent','revoke');
  }
  function lead(reference){
    if(!allowed()||!/^RH-\d{8}-[0-9A-F]{12}$/.test(reference||'')||sent.has(reference))return;
    start();if(!started)return;
    // An opaque saved reference provides event deduplication; no enquiry fields are read.
    window.fbq('trackSingle',PIXEL,'Lead',{}, {eventID:'raahhi_'+reference});sent.add(reference);
  }
  window.raahhiMeta={setConsent,lead};
  window.addEventListener('storage',e=>{if(e.key===CHOICE){if(allowed())start();else if(started)window.fbq('consent','revoke');}});
  start();
})();
