// Bounded, procedural effects. No network, media, flashing, or audio.
// One 24fps loop, paused when hidden, static under reduced motion.
export class Ambient {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.effect = 'none';
    this.enabled = true;
    this.motion = matchMedia('(prefers-reduced-motion: reduce)');
    this.frame = 0;
    this.lastTime = 0;
    this.elapsed = 0;
    this.resize = () => {
      const dpr = Math.min(devicePixelRatio || 1, 1.5);
      this.width = innerWidth;
      this.height = innerHeight;
      canvas.width = Math.round(this.width * dpr);
      canvas.height = Math.round(this.height * dpr);
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      this.paint(this.elapsed);
    };
    this.refresh = () => {
      cancelAnimationFrame(this.frame);
      this.lastTime = 0;
      this.paint(this.elapsed);
      if (this.effect !== 'none' && this.enabled && !this.motion.matches && !document.hidden) {
        this.frame = requestAnimationFrame(time => this.loop(time));
      }
    };
    addEventListener('resize', this.resize);
    document.addEventListener('visibilitychange', this.refresh);
    this.motion.addEventListener('change', this.refresh);
    this.resize();
  }
  update(effect, enabled, color, light) {
    Object.assign(this, { effect, enabled, color, light });
    this.refresh();
  }
  loop(time) {
    const delta = this.lastTime ? time - this.lastTime : 42;
    if (delta >= 1000 / 24) {
      this.elapsed += Math.min(delta, 100) / 1000;
      this.lastTime = time;
      this.paint(this.elapsed);
    }
    this.frame = requestAnimationFrame(t => this.loop(t));
  }
  paint(t) {
    const c = this.ctx, w = this.width, h = this.height;
    if (!c || !w || !h) return;
    c.clearRect(0, 0, w, h);
    if (!this.enabled || this.effect === 'none') return;
    c.fillStyle = this.color || '#8bca81';
    c.strokeStyle = this.color || '#8bca81';
    c.globalAlpha = 1;
    if (this.effect === 'rain') {
      c.font = '14px "Timescreen Mono", monospace';
      const glyphs = '01アイウエオカキクケコサシスセソ';
      for (let x = 16, col = 0; x < w; x += 30, col++) {
        const head = ((t * (24 + col % 7 * 5) + col * 97) % (h + 400)) - 100;
        for (let j = 0; j < 16; j++) {
          const y = head - j * 22;
          if (y < 0 || y > h) continue;
          c.globalAlpha = (1 - j / 16) * .33;
          c.fillText(glyphs[(col * 7 + j * 11 + Math.floor(t * 2)) % glyphs.length], x, y);
        }
      }
    } else if (this.effect === 'scan') {
      c.globalAlpha = .045;
      for (let y = 0; y < h; y += 5) c.fillRect(0, y, w, 1);
      c.globalAlpha = .05;
      c.fillRect(0, (t * 18) % (h + 100) - 100, w, 80);
    } else if (this.effect === 'grid') {
      const horizon = h * .60;
      c.globalAlpha = .28; c.lineWidth = 1;
      for (let i = -15; i <= 15; i++) {
        c.beginPath(); c.moveTo(w / 2 + i * 10, horizon); c.lineTo(w / 2 + i * w / 9, h); c.stroke();
      }
      for (let i = 0; i < 18; i++) {
        const p = ((i + t * .18) % 18) / 18;
        const y = horizon + p * p * (h - horizon);
        c.beginPath(); c.moveTo(0, y); c.lineTo(w, y); c.stroke();
      }
      const radius = Math.min(w * .18, h * .23);
      const g = c.createLinearGradient(0, horizon - radius * 2, 0, horizon);
      g.addColorStop(0, '#ffb44f'); g.addColorStop(1, '#ee4288');
      c.fillStyle = g; c.globalAlpha = .7;
      c.beginPath(); c.arc(w / 2, horizon - radius * .5, radius, Math.PI, 0); c.fill();
      c.clearRect(0, horizon - radius * .18, w, 4);
      c.clearRect(0, horizon - radius * .36, w, 6);
    } else if (['aurora','waves','canopy','dunes','chrome'].includes(this.effect)) {
      const desert = this.effect === 'dunes';
      const base = desert ? .76 : this.effect === 'canopy' ? .15 : .62;
      for (let i = 0; i < 6; i++) {
        c.beginPath();
        for (let x = -10; x <= w + 10; x += 8) {
          const y = h * base + i * h * .055 + Math.sin(x / (w * .30) + t * .12 + i * .6) * h * .10
            + Math.cos(x / (w * .17) - t * .08 + i) * h * .04;
          if (x === -10) c.moveTo(x, y); else c.lineTo(x, y);
        }
        if (desert || this.effect === 'canopy') {
          c.lineTo(w + 10, h); c.lineTo(-10, h); c.closePath();
          c.globalAlpha = desert ? .075 : .025; c.fill();
        } else {
          c.lineWidth = this.effect === 'aurora' ? 18 + i * 12 : 1 + i * .5;
          c.globalAlpha = this.effect === 'aurora' ? .035 : .13;
          c.stroke();
        }
      }
    } else if (this.effect === 'radar') {
      const x = w > h ? w * .72 : w / 2, y = h * .47, r = Math.min(w * .32, h * .32);
      c.globalAlpha = .13; c.lineWidth = 1;
      for (let i = 1; i < 5; i++) {
        c.beginPath(); c.arc(x, y, r * i / 4, 0, Math.PI * 2); c.stroke();
      }
      c.globalAlpha = .1;
      c.beginPath(); c.moveTo(x, y);
      c.arc(x, y, r, t * .28 - .45, t * .28); c.closePath(); c.fill();
    } else if (this.effect === 'eclipse' || this.effect === 'flare') {
      const r = Math.min(w * .30, h * .35);
      const x = w / 2, y = h * .48;
      const flare = this.effect === 'flare';
      for (let i = 0; i < 7; i++) {
        c.globalAlpha = (flare ? .20 : .15) / (i + 1);
        c.lineWidth = 1 + i * (flare ? 8 : 4);
        c.beginPath();
        c.arc(x, y, r + Math.sin(t * .25 + i) * 3 + i * 2, 0, Math.PI * 2);
        c.stroke();
      }
    } else if (this.effect === 'confetti' || this.effect === 'pixels') {
      const pixels = this.effect === 'pixels';
      c.globalAlpha = pixels ? .18 : .15;
      for (let i = 0; i < 65; i++) {
        const x = ((i * 139.7) % w), y = (i * 71.3 + (pixels ? t * 3 : 0)) % h;
        if (pixels) c.fillRect(Math.round(x / 8) * 8, Math.round(y / 8) * 8, 4, 4);
        else {
          c.save(); c.translate(x, y); c.rotate(i);
          c.fillRect(0, 0, i % 3 ? 3 : 16, i % 3 ? 15 : 3);
          c.restore();
        }
      }
    }
    c.globalAlpha = 1;
  }
}
