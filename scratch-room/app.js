(() => {
  const record = document.querySelector('#record');
  const needle = document.querySelector('#needle');
  const fader = document.querySelector('#fader');
  const faderValue = document.querySelector('#fader-value');
  const meter = document.querySelector('#meter');
  const status = document.querySelector('#status');
  const startButton = document.querySelector('#audio-start');
  const beatButton = document.querySelector('#beat-toggle');
  const stopButton = document.querySelector('#stop');
  let context, processor, source;
  let position = 0, speed = 0, targetSpeed = 0, gain = 0, targetGain = 1;
  let activePointer = null, lastX = 0, lastTime = 0, beatOn = true, sampleClock = 0, routine = 0;
  let peak = 0;

  function originalVoice(rate) {
    const length = Math.round(rate * 0.72), data = new Float32Array(length);
    let noise = 0x12345678;
    for (let i = 0; i < length; i++) {
      const t = i / rate;
      noise = (1664525 * noise + 1013904223) >>> 0;
      const n = (noise / 0xffffffff) * 2 - 1;
      const attack = Math.min(1, t / 0.008), release = Math.min(1, (length - i) / (rate * 0.11));
      const vowel = Math.sin(2*Math.PI*185*t)*.5 + Math.sin(2*Math.PI*555*t)*.22 + Math.sin(2*Math.PI*1110*t)*.13;
      const consonant = n * Math.exp(-t * 70) * .38;
      data[i] = (vowel + consonant) * attack * release * .62;
    }
    return data;
  }

  function beatSample(t) {
    if (!beatOn) return 0;
    const quarter = t % .5, eighth = t % .25;
    const kick = quarter < .14 ? Math.sin(2*Math.PI*(86-260*quarter)*quarter)*Math.exp(-quarter*28)*.34 : 0;
    const hat = eighth < .035 ? Math.sin(2*Math.PI*7200*t)*Math.exp(-eighth*95)*.07 : 0;
    return kick + hat;
  }

  async function ensureAudio() {
    if (!context) {
      context = new (window.AudioContext || window.webkitAudioContext)({latencyHint:'interactive'});
      source = originalVoice(context.sampleRate);
      processor = context.createScriptProcessor(256, 0, 2);
      processor.onaudioprocess = event => {
        const left = event.outputBuffer.getChannelData(0), right = event.outputBuffer.getChannelData(1);
        const faderStep = 1 / Math.max(1, context.sampleRate * .002);
        for (let i = 0; i < left.length; i++) {
          speed += (targetSpeed - speed) * .025;
          gain += Math.max(-faderStep, Math.min(faderStep, targetGain - gain));
          const lo = Math.max(0, Math.min(source.length - 1, Math.floor(position)));
          const hi = Math.min(source.length - 1, lo + 1), mix = position - lo;
          const carrier = source[lo] + (source[hi] - source[lo]) * mix;
          const motion = Math.min(1, Math.abs(speed) * 2.5);
          const scratch = carrier * gain * motion * .7;
          const value = Math.max(-.98, Math.min(.98, scratch + beatSample(sampleClock / context.sampleRate)));
          left[i] = right[i] = value;
          peak = Math.max(peak * .997, Math.abs(value));
          position += speed;
          if (position <= 0) { position = 0; if (speed < 0) targetSpeed = 0; }
          if (position >= source.length - 1) { position = source.length - 1; if (speed > 0) targetSpeed = 0; }
          sampleClock++;
        }
      };
      processor.connect(context.destination);
    }
    await context.resume();
    startButton.textContent = '音声準備OK';
    status.textContent = '円盤を左右・上下へ動かしてください';
  }

  function setFader(value) {
    targetGain = Math.max(0, Math.min(1, Number(value)));
    fader.value = String(targetGain);
    faderValue.value = `${Math.round(targetGain * 100)}%`;
  }
  fader.addEventListener('input', () => setFader(fader.value));
  startButton.addEventListener('click', ensureAudio);
  beatButton.addEventListener('click', async () => {
    await ensureAudio(); beatOn = !beatOn; beatButton.textContent = beatOn ? 'BEAT ON' : 'BEAT OFF'; beatButton.setAttribute('aria-pressed', String(beatOn));
  });

  record.addEventListener('pointerdown', async event => {
    await ensureAudio(); routine++; activePointer = event.pointerId; record.setPointerCapture(event.pointerId);
    lastX = event.clientX; lastTime = event.timeStamp; setFader(1 - event.offsetY / record.clientHeight); status.textContent = 'MANUAL SCRATCH';
  });
  record.addEventListener('pointermove', event => {
    if (event.pointerId !== activePointer) return;
    const dt = Math.max(1, event.timeStamp - lastTime), dx = event.clientX - lastX;
    targetSpeed = Math.max(-4, Math.min(4, dx * 1000 / dt / 420));
    const rect = record.getBoundingClientRect(); setFader(1 - (event.clientY - rect.top) / rect.height);
    lastX = event.clientX; lastTime = event.timeStamp;
  });
  function release(event) { if (event.pointerId !== activePointer) return; activePointer = null; targetSpeed = 0; setFader(0); status.textContent = '停止 — テクニックか円盤を選べます'; }
  record.addEventListener('pointerup', release); record.addEventListener('pointercancel', release);

  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
  async function technique(name) {
    await ensureAudio(); const token = ++routine; position = 0; status.textContent = name.toUpperCase();
    const unit = 125, steps = [];
    if (name === 'baby') for (let n=0;n<4;n++) steps.push([unit,1.18,1],[unit,-1.18,1]);
    if (name === 'chirp') for (let n=0;n<4;n++) steps.push([78,1.3,1],[30,1.1,0],[78,-1.3,1],[30,-1.1,0]);
    if (name === 'transform') for (let n=0;n<8;n++) { const s=Math.floor(n/2)%2===0?.92:-.92; steps.push([65,s,1],[60,s,0]); }
    for (const [duration,s,g] of steps) { if (token !== routine) return; targetSpeed=s;setFader(g);await wait(duration); }
    if (token === routine) { targetSpeed=0;setFader(0);status.textContent='もう一度、または手で演奏できます'; }
  }
  document.querySelectorAll('[data-technique]').forEach(button => button.addEventListener('click', () => technique(button.dataset.technique)));
  stopButton.addEventListener('click', () => { routine++;activePointer=null;targetSpeed=0;setFader(0);beatOn=false;beatButton.textContent='BEAT OFF';beatButton.setAttribute('aria-pressed','false');status.textContent='ALL STOP'; });

  function draw() { const ratio = source ? position / Math.max(1,source.length-1) : 0; needle.style.transform=`rotate(${ratio*720-90}deg)`;meter.style.width=`${Math.round(peak*100)}%`;requestAnimationFrame(draw); }
  setFader(1); draw();
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('service-worker.js');
})();
