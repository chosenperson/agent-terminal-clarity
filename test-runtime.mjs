import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {allowedTarget,localSocket,expression,apps,styleId} from './runtime.mjs';

test('only native app documents are eligible',()=>{
  for(const url of ['app://./index.html','file:///C:/Apps/ZCode/resources/app.asar/out/renderer/index.html','https://chatgpt.com/'])
    assert.equal(allowedTarget({url,type:'page'}),true);
  for(const url of ['http://127.0.0.1:5173/','https://example.com','file:///C:/project/index.html','about:blank'])
    assert.equal(allowedTarget({url,type:'page'}),false);
  assert.equal(allowedTarget({url:'app://./index.html',type:'service_worker'}),false);
});
test('WebSocket endpoints cannot leave the dedicated local port',()=>{
  assert.equal(localSocket('ws://127.0.0.1:29471/devtools/page/1',29471),'ws://127.0.0.1:29471/devtools/page/1');
  for(const url of ['ws://example.com:29471/x','ws://127.0.0.1:29472/x','wss://127.0.0.1:29471/x'])
    assert.throws(()=>localSocket(url,29471));
});
function fixture(){
  function root(){
    const elements=[];
    const r={elements,querySelector(s){return elements.find(e=>'#'+e.id===s)||null;},querySelectorAll(s){return s==='*'?elements:[{},{}];},appendChild(e){elements.push(e);e.parentNode=r;}};
    r.head=r;
    return r;
  }
  const document=root();
  document.createElement=()=>({id:'',textContent:'',remove(){const a=this.parentNode.elements;a.splice(a.indexOf(this),1);this.parentNode=null;}});
  const shadow=root();document.elements.push({shadowRoot:shadow});
  return {document,shadow};
}
test('injection updates its own style, preserves unrelated content and handles shadow roots',()=>{
  const {document,shadow}=fixture();
  const unrelated={id:'other-style'};document.elements.push(unrelated);
  const context={document};
  vm.runInNewContext(expression('strong {color:gold}',apps.codex.root),context);
  vm.runInNewContext(expression('strong {color:yellow}',apps.codex.root),context);
  assert.equal(document.elements.filter(e=>e.id===styleId).length,1);
  assert.equal(document.querySelector('#'+styleId).textContent,'strong {color:yellow}');
  assert.equal(shadow.querySelector('#'+styleId).textContent,'strong {color:yellow}');
  vm.runInNewContext(expression('',apps.codex.root,true),context);
  assert.equal(document.querySelector('#'+styleId),null);
  assert.equal(shadow.querySelector('#'+styleId),null);
  assert.ok(document.elements.includes(unrelated));
});
test('CSS is passed as data, not executable JavaScript',()=>{
  const {document}=fixture();const context={document};
  const css='/* ` ${globalThis.pwned=true} */ strong{color:gold}';
  vm.runInNewContext(expression(css,apps.codex.root),context);
  assert.equal(context.pwned,undefined);
  assert.equal(document.querySelector('#'+styleId).textContent,css);
});
test('both CSS files preserve fonts, light mode and code highlighting',async()=>{
  for(const app of Object.keys(apps)){
    const css=await readFile(new URL(`themes/${app}.css`,import.meta.url),'utf8');
    assert.match(css,/#f0c674/);assert.match(css,/#df79ef/);assert.match(css,/#e5c400/);
    assert.doesNotMatch(css,/@import|url\(|font-family:|font-size:|\.token\b|\.cm-editor/);
    assert.match(css,/\.not-prose/);assert.match(css,/contenteditable/);
    assert.match(css,/theme-variant:dark/);
  }
});
