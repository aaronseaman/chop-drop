const fs = require('fs');

// pull the game script out of the HTML and load it headlessly
const html = fs.readFileSync('/home/claude/index.html', 'utf8');
const m = html.match(/<script>([\s\S]*?)<\/script>/);
fs.writeFileSync('/tmp/game.js', m[1]);
const G = require('/tmp/game.js');

let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name + (extra ? '  -> ' + extra : '')); }
}
function near(a, b, e) { return Math.abs(a - b) < (e || 1e-6); }

console.log('\n--- geometry ---');
const sq = G.rect(0, 0, 1, 1);
ok('unit square area = 1', near(G.polyArea(sq), 1));

// vertical cut down the middle
const L = G.clipHalf(sq, 0.5, 0, 0, 1, 1);
const R = G.clipHalf(sq, 0.5, 0, 0, 1, -1);
ok('vertical cut halves both sides', near(G.polyArea(L), 0.5) && near(G.polyArea(R), 0.5),
   G.polyArea(L) + ' / ' + G.polyArea(R));
ok('cut conserves area', near(G.polyArea(L) + G.polyArea(R), 1));

// diagonal cut corner to corner
const D1 = G.clipHalf(sq, 0, 0, 1, 1, 1);
const D2 = G.clipHalf(sq, 0, 0, 1, 1, -1);
ok('diagonal cut conserves area', near(G.polyArea(D1) + G.polyArea(D2), 1, 1e-4),
   G.polyArea(D1) + ' + ' + G.polyArea(D2));

// a line that misses entirely
const MISS = G.clipHalf(sq, 5, 0, 0, 1, -1);
const KEEP = G.clipHalf(sq, 5, 0, 0, 1, 1);
ok('line that misses: empty on the far side', MISS.length === 0);
ok('line that misses: shape intact on the near side', near(G.polyArea(KEEP), 1));

// profile of a 2x1 rect
{
  const top = new Float64Array(G.SUBW).fill(Infinity);
  const bot = new Float64Array(G.SUBW).fill(-Infinity);
  const has = new Uint8Array(G.SUBW);
  G.partProfile(G.rect(2, 3, 2, 1), top, bot, has);
  let cnt = 0;
  for (let i = 0; i < G.SUBW; i++) if (has[i]) cnt++;
  ok('2-wide piece covers 16 sub-columns', cnt === 16, 'got ' + cnt);
  ok('profile top/bot correct', near(top[16 + 1], 3) && near(bot[16 + 1], 4));
}

console.log('\n--- the exploit: can cutting alone clear a block? ---');
G.reset();
G.W.bodies = [G.makeBody(0, [G.rect(2, 11, 1, 1)])];
G.W.bodies[0].settled = true;
// slice the same block many times
for (let i = 0; i < 12; i++) {
  G.W.blade = 3;
  G.cut(2 + (i % 9) * 0.1, 0, 0, 1, 0);
  G.physics(0.05);
  G.weld(99999);
  G.resolveClears();
}
const totalArea = G.W.bodies.reduce((s, b) => s + b.area, 0);
ok('repeated cutting never clears the block', G.W.cleared === 0, 'cleared=' + G.W.cleared);
ok('area only shrinks via dust, never grows', totalArea <= 1 + 1e-6, 'area=' + totalArea);
console.log('        (12 cuts on one 1x1 block -> cleared ' + G.W.cleared +
            ', dust ' + G.W.dust + ', area left ' + totalArea.toFixed(3) + ')');

console.log('\n--- welding and clearing ---');
G.reset();
// four 1x1 same-colour blocks in a row on the floor
G.W.bodies = [
  G.makeBody(1, [G.rect(0, 11, 1, 1)]),
  G.makeBody(1, [G.rect(1, 11, 1, 1)]),
  G.makeBody(1, [G.rect(2, 11, 1, 1)]),
  G.makeBody(1, [G.rect(3, 11, 1, 1)])
];
G.W.bodies.forEach(b => { b.settled = true; });
G.weld(99999);
ok('four touching same-colour blocks weld into one', G.W.bodies.length === 1,
   'bodies=' + G.W.bodies.length);
ok('welded area = 4', G.W.bodies.length === 1 && near(G.W.bodies[0].area, 4, 1e-3));
const didClear = G.resolveClears();
ok('4.0 cells clears', didClear && G.W.bodies.length === 0);
ok('clear refunds blade', G.W.blade > 0);

console.log('\n--- three is not enough ---');
G.reset();
G.W.bodies = [
  G.makeBody(2, [G.rect(0, 11, 1, 1)]),
  G.makeBody(2, [G.rect(1, 11, 1, 1)]),
  G.makeBody(2, [G.rect(2, 11, 1, 1)])
];
G.W.bodies.forEach(b => { b.settled = true; });
G.weld(99999);
ok('three welds but does not clear', !G.resolveClears() && G.W.bodies.length === 1);

console.log('\n--- different colours do not weld ---');
G.reset();
G.W.bodies = [
  G.makeBody(0, [G.rect(0, 11, 1, 1)]),
  G.makeBody(1, [G.rect(1, 11, 1, 1)])
];
G.W.bodies.forEach(b => { b.settled = true; });
G.weld(99999);
ok('two colours stay separate', G.W.bodies.length === 2);

console.log('\n--- hot edges block welding ---');
G.reset();
G.W.bodies = [G.makeBody(3, [G.rect(2, 11, 1, 1)])];
G.W.bodies[0].settled = true;
G.W.blade = 3;
G.cut(2.5, 0, 0, 1, 1000);        // vertical cut at now=1000
G.W.bodies.forEach(b => { b.settled = true; });
G.weld(1100);                      // 100ms later, still hot
ok('halves stay apart while hot', G.W.bodies.length === 2, 'bodies=' + G.W.bodies.length);
G.weld(1500);                      // after the hot window
ok('halves re-weld once cool', G.W.bodies.length === 1, 'bodies=' + G.W.bodies.length);

console.log('\n--- slivers turn to dust ---');
G.reset();
G.W.bodies = [G.makeBody(4, [G.rect(2, 11, 1, 1)])];
G.W.bodies[0].settled = true;
G.W.blade = 3;
G.cut(2.05, 0, 0, 1, 0);           // shave a 0.05-wide strip
const after = G.W.bodies.reduce((s, b) => s + b.area, 0);
ok('sliver removed, remainder kept', G.W.dust === 1 && near(after, 0.95, 0.02),
   'dust=' + G.W.dust + ' area=' + after);

console.log('\n--- gravity ---');
G.reset();
G.W.bodies = [G.makeBody(0, [G.rect(2, 0, 1, 1)])];
for (let i = 0; i < 400 && !G.W.bodies[0].settled; i++) G.physics(0.016);
ok('a piece falls and settles on the floor',
   G.W.bodies[0].settled && near(G.W.bodies[0].maxY, G.ROWS, 0.02),
   'y=' + G.W.bodies[0].maxY);

G.reset();
G.W.bodies = [
  G.makeBody(0, [G.rect(2, 11, 1, 1)]),
  G.makeBody(1, [G.rect(2, 2, 1, 1)])
];
G.W.bodies[0].settled = true;
for (let i = 0; i < 400 && !G.W.bodies[1].settled; i++) G.physics(0.016);
ok('a piece stacks on top of another',
   G.W.bodies[1].settled && near(G.W.bodies[1].maxY, 11, 0.03),
   'y=' + G.W.bodies[1].maxY);

console.log('\n--- soak: 90 seconds of simulated play ---');
G.reset();
let t = 0, frames = 0, maxBodies = 0, err = null;
try {
  while (t < 90 && G.W.running !== false) {
    t += 0.016; frames++;
    if (frames % 60 === 0) G.spawn();
    G.W.blade = Math.min(3, G.W.blade + 0.016 * 1000 / 1400);
    if (frames % 40 === 0 && G.W.blade >= 1) {
      G.cut(Math.random() * 6, Math.random() * 12,
            Math.random() - 0.5, Math.random() - 0.5, frames * 16);
    }
    const landed = G.physics(0.016);
    if (landed) G.weld(frames * 16);
    G.resolveClears();
    maxBodies = Math.max(maxBodies, G.W.bodies.length);
    if (G.W.bodies.some(b => !isFinite(b.area) || isNaN(b.minY))) {
      throw new Error('non-finite body at frame ' + frames);
    }
  }
} catch (e) { err = e; }
ok('90s of random play with no NaN or crash', !err, err && err.message);
console.log('        frames=' + frames + '  peak bodies=' + maxBodies +
            '  score=' + G.W.score + '  clears=' + G.W.cleared + '  dust=' + G.W.dust);
ok('body count stays under the 120 cap', maxBodies <= 120, 'peak=' + maxBodies);

console.log('\n' + pass + ' passed, ' + fail + ' failed\n');
process.exit(fail ? 1 : 0);
