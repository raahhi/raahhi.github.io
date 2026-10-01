// Injected into the published runtime only. The single-file authoring preview stays synchronous.
export const SEARCH_LOADER_SOURCE = `
let activitySearchLoad = null;
function loadActivitySearch(){
  const data = window.RAAHHI_CATALOGUE;
  if(data.searchReady) return Promise.resolve();
  if(activitySearchLoad) return activitySearchLoad;
  activitySearchLoad = new Promise((resolve, reject)=>{
    const script = document.createElement("script");
    script.src = data.searchUrl;
    script.onload = ()=>{
      const index = window.RAAHHI_SEARCH_OTHER;
      if(!index || ACTIVITY_SEARCH_INDEX.some(e=>!Array.isArray(index[e.t.id]))){
        activitySearchLoad = null; script.remove(); reject(new Error("Search data unavailable")); return;
      }
      ACTIVITY_SEARCH_INDEX.forEach(e=>{ e.other = index[e.t.id]; });
      data.searchReady = true;
      resolve();
    };
    script.onerror = ()=>{ activitySearchLoad = null; script.remove(); reject(new Error("Search data unavailable")); };
    document.head.append(script);
  });
  return activitySearchLoad;
}
`;
