// Store coarse technical metadata only, never the complete User-Agent header.
export function networkAddress(value){
  if(typeof value!=='string'||value.length>45)return '';
  if(value.includes(':')){
    if(!/^[0-9a-f:.]+$/i.test(value))return '';
    try{return new URL('http://['+value+']/').hostname.slice(1,-1);}catch{return '';}
  }
  const parts=value.split('.');
  return parts.length===4&&parts.every(p=>/^\d{1,3}$/.test(p)&&Number(p)<=255)?parts.map(Number).join('.'):'';
}
export function deviceInfo(header){
  const ua=typeof header==='string'?header.slice(0,1500):'';
  const rules=[['Edge',/(?:Edg|EdgA|EdgiOS)\/([0-9]{1,4})/],['Opera',/(?:OPR|Opera|OPiOS)\/([0-9]{1,4})/],['Samsung Internet',/SamsungBrowser\/([0-9]{1,4})/],['Firefox',/(?:Firefox|FxiOS)\/([0-9]{1,4})/],['Chrome',/(?:Chrome|CriOS)\/([0-9]{1,4})/],['Safari',/Version\/([0-9]{1,4}).*Safari\//]];
  let browser='Other / unknown',major='';for(const [name,re] of rules){const match=ua.match(re);if(match){browser=name;major=match[1];break;}}
  const os=/iPhone|iPad|iPod/.test(ua)?'iOS':/Android/.test(ua)?'Android':/Windows/.test(ua)?'Windows':/CrOS/.test(ua)?'ChromeOS':/Macintosh|Mac OS X/.test(ua)?'macOS':/Linux/.test(ua)?'Linux':'Other / unknown';
  const device=/iPad|Tablet|Android(?!.*Mobile)/.test(ua)?'tablet':/Mobile|iPhone|iPod/.test(ua)?'mobile':os!=='Other / unknown'?'desktop':null;
  return {browser,major,os,device};
}
export function describeDevice(session){
  const os=session.operating_system||'Unknown',architecture=['arm','x86'].includes(session.cpu_architecture)?session.cpu_architecture:'';
  let family='Unknown device family',confidence='Unknown',reason='The browser has not supplied enough information to estimate a device family.';
  if(os==='macOS'){
    family='Mac — processor family unknown';confidence='Limited';reason='The browser reports macOS, but architecture is unavailable. The exact hardware is not verified.';
    if(architecture==='arm'){family='Apple Silicon Mac';confidence='Moderate';reason='Inferred from browser-reported macOS and ARM architecture. This does not establish the Mac model, chip generation or verified hardware.';}
    if(architecture==='x86'){family='Mac — Intel or Apple Silicon with an x86 browser';reason='An x86 browser report alone cannot reliably identify the physical Mac processor. The word Intel in a standard browser string is not proof of an Intel Mac.';}
  }else if(['Windows','Android','iOS','ChromeOS','Linux'].includes(os)){
    family=({Windows:architecture==='arm'?'Windows ARM device':'Windows computer',Android:session.device==='tablet'?'Android tablet':'Android device',iOS:'Apple iOS device',ChromeOS:'ChromeOS device',Linux:'Linux device'})[os];
    confidence=architecture?'Moderate':'Limited';reason='Estimated from the browser-reported operating system'+(architecture?' and architecture':'')+'. Manufacturer, exact model and physical hardware are not verified.';
  }
  return {detected:[os,session.browser?(session.browser+(session.browser_major?' '+session.browser_major:'')):'Browser unknown',session.device||'Device category unknown'].join(' · '),family,exactModel:'Unknown',confidence,reason,architecture:architecture==='arm'?'ARM (browser-reported)':architecture==='x86'?'x86 (browser-reported)':'Unavailable'};
}
