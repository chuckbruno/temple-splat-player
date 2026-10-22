// Print duration and root/pelvis translation range for each GLB clip.
import { readFileSync } from 'node:fs';
for (const file of process.argv.slice(2)) {
  const buf = readFileSync(file);
  const jsonLen = buf.readUInt32LE(12);
  const gltf = JSON.parse(buf.subarray(20, 20 + jsonLen).toString());
  const binStart = 20 + jsonLen + 8;
  const read = (ai) => {
    const a = gltf.accessors[ai], bv = gltf.bufferViews[a.bufferView];
    const n = { SCALAR: 1, VEC3: 3, VEC4: 4 }[a.type];
    return new Float32Array(buf.buffer.slice(buf.byteOffset + binStart + (bv.byteOffset || 0) + (a.byteOffset || 0)), 0, a.count * n);
  };
  const anim = gltf.animations[0];
  let dur = 0; const out = [];
  for (const ch of anim.channels) {
    const s = anim.samplers[ch.sampler];
    const t = read(s.input); dur = Math.max(dur, t[t.length - 1]);
    const name = gltf.nodes[ch.target.node].name;
    if (ch.target.path === 'translation' && /^(root|pelvis)$/i.test(name)) {
      const v = read(s.output), k = v.length / 3;
      const f = (i) => [v[i*3], v[i*3+1], v[i*3+2]].map(x => x.toFixed(3)).join(',');
      out.push(`${name}: first(${f(0)}) last(${f(k-1)})`);
    }
  }
  console.log(file.split(/[\/]/).pop(), 'dur', dur.toFixed(2) + 's', '|', out.join(' | '));
}
