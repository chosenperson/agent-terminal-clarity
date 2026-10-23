// Local CSS transport. No app-bundle writes, credentials or conversation reads.
import {readFile, mkdir, open, unlink} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
import {parseArgs} from 'node:util';

export const apps = {
  codex: {port: 29471, root: ':is([class*="_MarkdownContent_"], [class*="_markdownContent_"], [class*="_markdownRoot_"], [data-markdown-text-style="assistant-message"])'},
  zcode: {port: 29472, root: '[class~="size-full"][class~="text-ui-base"][class~="leading-[1.75]"]'},
};
export const styleId = 'agent-terminal-clarity-style';

// Only native application documents; never a localhost browser preview.
export function allowedTarget(target) {
  if (!['page', 'webview', 'iframe'].includes(target.type)) return false;
  let u;
  try { u = new URL(target.url); } catch { return false; }
  return ['app:', 'codex:', 'zcode:'].includes(u.protocol)
    || (u.protocol === 'file:' && /app\.asar\/(webview|out\/renderer)\//i.test(u.pathname))
    || (u.protocol === 'https:' && u.hostname === 'chatgpt.com');
}

export function localSocket(url, port) {
  const u = new URL(url);
  if (u.protocol !== 'ws:' || u.hostname !== '127.0.0.1' || Number(u.port) !== port)
    throw new Error('Refusing a non-local or different-port CDP WebSocket.');
  return u.href;
}

export function expression(css, selector, restore = false) {
  return `(() => {
    const id=${JSON.stringify(styleId)}, css=${JSON.stringify(css)}, selector=${JSON.stringify(selector)};
    let roots=0, styled=0;
    function visit(root) {
      const existing=root.querySelector('#'+id);
      if (${restore}) { if(existing) existing.remove(); }
      else {
        roots += root.querySelectorAll(selector).length;
        const style=existing || document.createElement('style');
        style.id=id;
        if(style.textContent!==css) style.textContent=css;
        if(!style.parentNode) (root.head || root).appendChild(style);
        styled++;
      }
      for(const node of root.querySelectorAll('*')) if(node.shadowRoot) visit(node.shadowRoot);
    }
    visit(document);
    return {roots,styled,restored:${restore}};
  })()`;
}

export async function connect(url, timeout = 4000) {
  const ws = new WebSocket(url);
  await new Promise((resolve,reject) => {
    const timer=setTimeout(()=>{ws.close();reject(new Error('CDP connection timed out'));},timeout);
    ws.addEventListener('open',()=>{clearTimeout(timer);resolve();},{once:true});
    ws.addEventListener('error',()=>{clearTimeout(timer);reject(new Error('CDP connection failed'));},{once:true});
  });
  let id=0;
  const pending=new Map();
  ws.addEventListener('message',event=>{
    const message=JSON.parse(event.data);
    const item=pending.get(message.id);
    if(!item)return;
    pending.delete(message.id);clearTimeout(item.timer);
    message.error ? item.reject(new Error(message.error.message)) : item.resolve(message.result);
  });
  ws.addEventListener('close',()=>{
    for(const item of pending.values()){clearTimeout(item.timer);item.reject(new Error('CDP disconnected'));}
    pending.clear();
  });
  return {
    call(method,params={}) {
      return new Promise((resolve,reject)=>{
        const request=++id;
        const timer=setTimeout(()=>{pending.delete(request);reject(new Error(method+' timed out'));},timeout);
        pending.set(request,{resolve,reject,timer});
        ws.send(JSON.stringify({id:request,method,params}));
      });
    },
    close(){ws.close();},
  };
}

export async function apply(app, css, restore = false) {
  const config=apps[app];
  if(!config)throw new Error('Choose codex or zcode.');
  const response=await fetch(`http://127.0.0.1:${config.port}/json/list`,{signal:AbortSignal.timeout(3000)});
  if(!response.ok)throw new Error('CDP target discovery failed: '+response.status);
  const targets=(await response.json()).filter(allowedTarget);
  if(!targets.length)throw new Error('No supported application document found on the dedicated port.');
  let roots=0,styled=0;
  for(const target of targets) {
    const cdp=await connect(localSocket(target.webSocketDebuggerUrl,config.port));
    try {
      const result=await cdp.call('Runtime.evaluate',{
        expression:expression(css,config.root,restore),returnByValue:true,
      });
      if(result.exceptionDetails)throw new Error('Application rejected the CSS injection.');
      if(!result.result?.value)throw new Error('No CSS application result returned.');
      roots+=result.result.value.roots;styled+=result.result.value.styled;
    } finally {cdp.close();}
  }
  return {targets:targets.length,roots,styled,restored:restore};
}

async function main() {
  const {values}=parseArgs({options:{app:{type:'string'},watch:{type:'boolean'},restore:{type:'boolean'},stop:{type:'boolean'},check:{type:'boolean'}}});
  if(!apps[values.app])throw new Error('Usage: node runtime.mjs --app codex|zcode [--watch|--restore|--stop|--check]');
  const dir=join(process.env.LOCALAPPDATA || process.env.HOME || process.cwd(),'AgentTerminalClarity');
  await mkdir(dir,{recursive:true});
  const stopFile=join(dir,values.app+'.stop');
  const lockFile=join(dir,values.app+'.lock');
  if(values.stop){await (await open(stopFile,'w')).close();console.log('Stop requested; the watcher removes CSS before exiting.');return;}
  const css=await readFile(new URL(`./themes/${values.app}.css`,import.meta.url),'utf8');
  if(values.check){console.log(JSON.stringify({app:values.app,port:apps[values.app].port,cssBytes:Buffer.byteLength(css),selector:apps[values.app].root}));return;}
  if(!values.watch){console.log(JSON.stringify(await apply(values.app,css,values.restore)));return;}
  let lock;
  try {lock=await open(lockFile,'wx');}
  catch(error) {if(error.code==='EEXIST')throw new Error('Watcher lock exists. Use RESTORE or inspect the lock before starting another watcher.');throw error;}
  await lock.writeFile(String(process.pid));
  let stopping=false,last='',failures=0;
  const stop=()=>{stopping=true;};
  process.on('SIGINT',stop);process.on('SIGTERM',stop);
  try {
    await unlink(stopFile).catch(e=>{if(e.code!=='ENOENT')throw e;});
    while(!stopping) {
      try {
        await readFile(stopFile);break;
      }catch(e){if(e.code!=='ENOENT')throw e;}
      try {
        const summary=JSON.stringify(await apply(values.app,css));failures=0;
        if(summary!==last){console.log(new Date().toISOString(),summary);last=summary;}
      }catch(e){
        failures++;
        if(failures===1)console.error(e.message);
        if(failures>=10)throw new Error('Application unavailable for 30 seconds; watcher stopped. '+e.message);
      }
      await new Promise(resolve=>setTimeout(resolve,3000));
    }
  } finally {
    try {await apply(values.app,css,true);}catch(e){console.error('CSS restore unavailable; fully exiting the app also removes all runtime CSS. '+e.message);}
    await lock.close();await unlink(lockFile);
    await unlink(stopFile).catch(e=>{if(e.code!=='ENOENT')throw e;});
  }
}
if(process.argv[1] && fileURLToPath(import.meta.url)===process.argv[1])
  main().catch(e=>{console.error(e.message);process.exitCode=1;});
