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
