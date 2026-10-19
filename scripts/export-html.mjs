import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const read=file=>readFile(resolve(root,file),'utf8');
let html=await read('index.html');
const css=await read('style.css');
html=html.replace('<link rel="stylesheet" href="style.css">',()=>`<style>\n${css}\n</style>`);
const bundle=(await read('game.js')).replace(/<\/script/gi,text=>text.replace('/','\\/'));
// Function replacements preserve literal $&, $` and $' in the generated code.
html=html.replace('<script src="game.js"></script>',()=>`<script>\n${bundle}\n</script>`);
const image=await readFile(resolve(root,'assets/reference-car.avif'));
html=html.replace('src="assets/reference-car.avif"',`src="data:image/avif;base64,${image.toString('base64')}"`);
html+=`\n<!-- Three.js third-party notice\n${await read('THIRD_PARTY_LICENSES.txt')}\n-->\n`;
const output=resolve(process.argv[2]||'/workspace/library-files/tesla-night-flight.html');
await mkdir(dirname(output),{recursive:true});await writeFile(output,html);
console.log(`Exported ${output} (${Buffer.byteLength(html).toLocaleString()} bytes)`);
