import {mkdir,writeFile} from 'node:fs/promises';
import {apps} from './runtime.mjs';

// Only Markdown reading surfaces, never UI chrome, editors or syntax tokens.
export function themeCss(root) {
  const exclude=':not(pre *, .not-prose *, [contenteditable="true"] *)';
  const rules=[
    ['', 'color:#c8c8c8!important;'],
    [` :is(h1,h2,h3,h4,h5,h6)${exclude}`, 'color:#e5c400!important;'],
    [` :is(strong,b)${exclude}`, 'color:#f0c674!important;'],
    [` :is(h1,h2,h3,h4,h5,h6) :is(strong,b)${exclude}`, 'color:inherit!important;'],
    [` :is(a,[class*="_TextLink_"])${exclude}`, 'color:#df79ef!important;text-decoration-color:#844d8d!important;'],
    [` :is(a,[class*="_TextLink_"]):hover${exclude}`, 'color:#f1adff!important;'],
    [` :is(code,[class*="_InlineCode_"],[data-markdown-copy="inline-code"])${exclude}`, 'color:#df79ef!important;background:transparent!important;box-shadow:none!important;'],
    [` li${exclude}::marker`, 'color:#df79ef!important;'],
    [` blockquote${exclude}`, 'border-inline-start:2px solid #df79ef!important;color:#c8c8c8!important;'],
    [` blockquote${exclude}::before`, 'background:#df79ef!important;'],
    [` table${exclude}`, 'border-collapse:collapse!important;'],
    [` :is(th,td)${exclude}`, 'border:1px solid #737373!important;padding:7px 10px!important;background:transparent!important;'],
  ];
  const guarded=rules.map(([tail,style])=>
    `:is(.dark,.theme-zai-dark,[data-theme="dark"]) ${root}${tail},\n:host([data-theme="dark"]) ${root}${tail}{${style}}`).join('\n');
  const container=rules.map(([tail,style])=>`${root}${tail}{${style}}`).join('\n');
  return `/* Agent Terminal Clarity 1.0.0 — semantic emphasis, dark mode only. */\n${guarded}\n@container style(--theme-variant:dark){\n${container}\n}\n`;
}
await mkdir(new URL('./themes/',import.meta.url),{recursive:true});
for(const [app,{root}] of Object.entries(apps))
  await writeFile(new URL(`./themes/${app}.css`,import.meta.url),themeCss(root));
