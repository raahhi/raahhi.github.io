import test from 'node:test';
import assert from 'node:assert/strict';
import {validateRegistry,validatePublishedGraph} from './published-urls.mjs';

const registry=()=>({version:1,origin:'https://raahhi.com',pages:[
  {pageId:'home',path:'/',kind:'home',state:'live'},
  {pageId:'activity:stable-id',path:'/activities/dubai/old-name/',kind:'activity',state:'live'}
]});
const pages=()=>new Map([
  ['/',{pageId:'home',kind:'home',path:'/',robots:'index,follow',canonical:'https://raahhi.com/',ids:['main'],links:[{href:'/activities/dubai/old-name/#pickup'}]}],
  ['/activities/dubai/old-name/',{pageId:'activity:stable-id',kind:'activity',path:'/activities/dubai/old-name/',robots:'index,follow',canonical:'https://raahhi.com/activities/dubai/old-name/',ids:['pickup'],links:[{href:'/'}]}]
]);
const audit=(r=registry(),p=pages())=>validatePublishedGraph(r,p,[...p.keys()]);
test('new pages can append without changing existing identities',()=>{
  const base=registry(),next=registry();next.pages.push({pageId:'guide:new',path:'/guides/new/',kind:'guide',state:'live'});
  assert.equal(validateRegistry(next,base).size,3);
});
test('history rejects renamed, removed and reused addresses',()=>{
  const base=registry();
  for(const mutate of [r=>r.pages[1].path='/activities/dubai/new-name/',r=>r.pages.pop(),r=>r.pages[1].pageId='activity:replacement']){
    const next=registry();mutate(next);assert.throws(()=>validateRegistry(next,base));
  }
  const duplicate=registry();duplicate.pages.push({...duplicate.pages[1],pageId:'different'});assert.throws(()=>validateRegistry(duplicate),/Duplicate published path/);
});
test('connected canonical pages and real fragment links pass',()=>{
  assert.deepEqual(audit(),{registeredPages:2,internalEdges:2,checkedFragments:1,maxHomepageDepth:1,orphans:0});
});
test('wrong canonicals, hidden indexability and broken targets block release',()=>{
  for(const mutate of [p=>p.get('/').canonical='https://raahhi.com/other/',p=>p.get('/').robots='noindex,follow',p=>p.get('/').links=[{href:'/missing/'}],p=>p.get('/').links=[{href:'/activities/dubai/old-name/#absent'}],p=>p.get('/').links=[]]){
    const p=pages();mutate(p);assert.throws(()=>audit(registry(),p));
  }
});
test('unknown entity, unregistered route and missing sitemap entry block release',()=>{
  const p=pages();p.get('/').pageId='different';assert.throws(()=>audit(registry(),p),/Unregistered/);
  assert.throws(()=>validatePublishedGraph(registry(),pages(),['/']),/sitemap-eligible/);
  const r=registry();r.pages.pop();assert.throws(()=>audit(r,pages()),/every generated route/);
});
test('a connected but excessively deep page is rejected',()=>{
  const r=registry(),p=pages();let previous='/activities/dubai/old-name/';
  for(let i=2;i<=4;i++){
    const path='/layer-'+i+'/';r.pages.push({pageId:'layer:'+i,path,kind:'guide',state:'live'});
    p.get(previous).links.push({href:path});p.set(path,{pageId:'layer:'+i,path,kind:'guide',canonical:'https://raahhi.com'+path,robots:'index',ids:[],links:[{href:'/'}]});previous=path;
  }
  assert.throws(()=>audit(r,p),/beyond three clicks/);
});
