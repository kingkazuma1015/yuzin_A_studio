// Lifecycle regression checks; real rendering and pointer feel require browser QA.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const {setup} = require('./dom_environment.cjs');
const tree = JSON.parse(fs.readFileSync(0, 'utf8'));
const code = fs.readFileSync(path.join(__dirname, '../motion.js'), 'utf8');
const q = (env, selector) => env.doc.querySelector(selector);
function boot(options = {}, supported = true) {
  const env = setup(tree, options);
  env.doc.hasFocus = () => true;
  const recorded = [];
  Object.getPrototypeOf(env.doc).animate = supported ? function() {
    let reject;
    const animation = {state:'running', finished:new Promise((_, no) => {reject = no;}),
      play() {this.state = 'running';}, pause() {this.state = 'paused';},
      cancel() {this.state = 'cancelled'; reject(new Error('cancelled'));}};
    recorded.push(animation);
    return animation;
  } : undefined;
  // The existing DOM double stores text separately. Supply only the text-node
  // operations needed by the decorative counter, without changing other suites.
  env.doc.querySelectorAll('.about-figures strong').forEach(strong => {
    Object.defineProperty(strong, 'firstChild', {get:() => ({nodeType:3, textContent:strong._text,
      replaceWith(value) {strong._text = ''; strong.prepend(value);}})});
  });
  env.run(code);
  return Object.assign(env, {recorded});
}
(async () => {
  const env = boot();
  const root = env.doc.documentElement;
  const hero = q(env, '.hero');
  const row = q(env, '.price-row:not(.price-head)');
  assert.ok(root.classList.contains('studio-motion'));
  env.intersect(row, true);
  const first = env.recorded.length;
  assert.ok(first > 0);
  env.intersect(row, false); env.intersect(row, true);
  assert.equal(env.recorded.length, first, 'Entry animation plays once');
  env.intersect(hero, true); hero._top = -500;
  await env.frame();
  assert.equal(hero.style['--photo-y'], '27.5px');
  assert.equal(env.frames.size, 0, 'Scroll effects do not create an idle render loop');
  const button = q(env, '.button');
  await env.doc.emit('pointermove', {target:button, pointerType:'touch', clientX:100, clientY:100});
  assert.equal(button.style['--button-x'], undefined, 'Touch keeps stationary controls');
  await env.doc.emit('pointermove', {target:button, pointerType:'mouse', clientX:10000, clientY:10000});
  assert.equal(button.style['--button-x'], '3px');
  await env.window.emit('blur');
  assert.ok(root.classList.contains('motion-paused'));
  assert.equal(button.style['--button-x'], undefined);
  assert.ok(env.recorded.every(x => x.state === 'paused'));
  assert.equal(env.frames.size, 0);
  await env.window.emit('focus');
  assert.ok(env.recorded.every(x => x.state === 'running'));
  const strong = q(env, '.about-figures strong');
  env.intersect(strong, true); await env.frame(100);
  const value = strong.children[0];
  assert.notEqual(value.textContent, '11');
  const dialog = q(env, '#mail-modal'); dialog.open = true;
  await env.doc.emit('studio:dialogchange');
  assert.ok(root.classList.contains('motion-paused'));
  assert.equal(value.textContent, '11', 'Interrupted counters always restore the exact published value');
  assert.equal(env.frames.size, 0);
  dialog.open = false; await env.doc.emit('studio:dialogchange');
  env.doc.hidden = true; await env.doc.emit('visibilitychange');
  assert.equal(env.frames.size, 0);
  env.doc.hidden = false; await env.doc.emit('visibilitychange');
  await env.queries.motion.set(true);
  assert.ok(!root.classList.contains('studio-motion'));
  assert.ok(env.recorded.every(x => x.state === 'cancelled'));
  assert.equal(env.frames.size, 0);
  await env.queries.motion.set(false);
  await env.queries.mobile.set(true); await env.frame();
  assert.equal(hero.style['--photo-y'], '12px', 'Mobile parallax is bounded');
  const flow = q(env, '.flow-section'); const step = q(env, '.flow-list li');
  env.intersect(flow, true); step._top = 0; await env.frame();
  assert.equal(step.style['--step-progress'], '1.000');
  step._top = 800; await env.window.emit('scroll'); await env.frame();
  assert.equal(step.style['--step-progress'], '0.000', 'Flow line also reverses with native scrolling');
  assert.ok(!step.classList.contains('motion-step-active'));
  for (const options of [{reduced:true}, {observers:false}]) {
    const fallback = boot(options);
    assert.equal(fallback.recorded.length, 0);
    assert.equal(fallback.frames.size, 0);
  }
  const unsupported = boot({}, false);
  assert.equal(unsupported.frames.size, 0);
  assert.ok(!unsupported.doc.documentElement.classList.contains('studio-motion'));
  console.log('PASS: one-shot entries; event-bound parallax; mobile/touch limits; focus/visibility/dialog pause; exact counter restoration; live reduced-motion cleanup; reversible flow; missing-API fallback');
})().catch(error => {console.error(error); process.exitCode = 1;});
