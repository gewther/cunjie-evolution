// Sync the v5.9.5 original-event text into the active touch engines only.
const fs = require('fs');
const cp = require('child_process');
const decode = s => JSON.parse(s.slice(s.indexOf('=') + 1).trim().replace(/;$/, ''));
const old = decode(cp.execFileSync('git', ['show', '58e7f02:dist/data/03-original.js'], {encoding:'utf8'}));
const current = decode(fs.readFileSync('dist/data/03-original.js', 'utf8'));
for (const [file,key] of [['dist/data/touch-v1-free.js','freeLegacy'],['dist/data/touch-v1-impact.js','storyLegacy']]) {
  let html = decode(fs.readFileSync(file,'utf8'));
  let count = 0;
  for (let stage=0;stage<3;stage++) for (const event of Object.keys(old.stages[stage].events)) {
    const a=old.stages[stage].events[event].lines, b=current.stages[stage].events[event].lines;
    if(a.length!==b.length) throw Error('Line count mismatch');
    for(let i=0;i<a.length;i++) {
      if(html.split(a[i]).length!==2) throw Error(`Ambiguous old line: ${stage}/${event}/${i}`);
      html=html.replace(a[i],b[i]); count++;
    }
  }
  if(count!==180) throw Error(`Unexpected count: ${count}`);
  fs.writeFileSync(file, `DATA[${JSON.stringify(key)}]=${JSON.stringify(html).replace(/</g,'\\u003c')};\n`);
  console.log(`${file}: ${count} slots updated`);
}
