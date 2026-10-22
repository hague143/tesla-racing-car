import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,copyFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import vm from 'node:vm';

test('standalone export preserves JavaScript replacement tokens and escapes closing script tags',async()=>{
  const root=await mkdtemp(join(tmpdir(),'tesla-export-'));
  try{
    await mkdir(join(root,'scripts'));await mkdir(join(root,'public'));await mkdir(join(root,'public/assets'));
    await copyFile(new URL('../scripts/export-html.mjs',import.meta.url),join(root,'scripts/export-html.mjs'));
    const tokens=['$&','$`',"$'",'</script>','</ScRiPt>'];
    const css='body::before{content:"$& $`"}';
    await writeFile(join(root,'public/index.html'),'<script type="module" crossorigin src="./assets/game.js"></script><link rel="stylesheet" crossorigin href="./assets/style.css">');
    await writeFile(join(root,'public/assets/style.css'),css);
    await writeFile(join(root,'public/assets/game.js'),`globalThis.tokens=${JSON.stringify(tokens)};`);
    await writeFile(join(root,'THIRD_PARTY_LICENSES.txt'),'test notice');
    const output=join(root,'play.html');
    const run=spawnSync(process.execPath,[join(root,'scripts/export-html.mjs'),output],{encoding:'utf8'});
    assert.equal(run.status,0,run.stderr);
    const html=await readFile(output,'utf8');
    assert.equal((html.match(/<\/script>/gi)||[]).length,1);
    assert(html.includes(css));
    const script=html.match(/<script type="module">([\s\S]*?)<\/script>/i)?.[1];assert(script);
    const sandbox={};vm.runInNewContext(script,sandbox);
    assert.deepEqual(Array.from(sandbox.tokens),tokens);
  }finally{await rm(root,{recursive:true,force:true});}
});
