// Hand-drawn canvas art for every beast. Each drawer works in a 200-unit space:
// (0, 0) is the ground under the beast, negative y is up, and beasts face left.
const Beasts = (() => {
  const TAU = Math.PI * 2;

  function ell(c, x, y, rx, ry, fill, rot) {
    c.beginPath();
    c.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot || 0, 0, TAU);
    c.fillStyle = fill;
    c.fill();
  }

  function poly(c, pts, fill) {
    c.beginPath();
    c.moveTo(pts[0], pts[1]);
    for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]);
    c.closePath();
    c.fillStyle = fill;
    c.fill();
  }

  function line(c, x0, y0, x1, y1) {
    c.beginPath();
    c.moveTo(x0, y0);
    c.lineTo(x1, y1);
    c.stroke();
  }

  function lin(c, x0, y0, x1, y1, stops) {
    const g = c.createLinearGradient(x0, y0, x1, y1);
    stops.forEach((s, i) => g.addColorStop(i / (stops.length - 1), s));
    return g;
  }

  function rad(c, x, y, r, stops) {
    const g = c.createRadialGradient(x - r * 0.3, y - r * 0.35, r * 0.1, x, y, r);
    stops.forEach((s, i) => g.addColorStop(i / (stops.length - 1), s));
    return g;
  }

  function eye(c, x, y, r, iris) {
    ell(c, x, y, r, r, '#fff');
    ell(c, x - r * 0.2, y, r * 0.6, r * 0.6, iris);
    ell(c, x - r * 0.25, y, r * 0.28, r * 0.28, '#000');
    ell(c, x - r * 0.45, y - r * 0.3, r * 0.15, r * 0.15, '#fff');
  }

  function glow(c, x, y, r, color, blur) {
    c.save();
    c.shadowColor = color;
    c.shadowBlur = blur || 14;
    ell(c, x, y, r, r * 0.75, color);
    c.restore();
  }

  function flame(c, x, y, r, t) {
    const f = 1 + Math.sin(t * 12) * 0.15;
    c.save();
    c.shadowColor = '#f97316';
    c.shadowBlur = 16;
    c.fillStyle = '#f97316';
    c.beginPath();
    c.moveTo(x - r, y);
    c.quadraticCurveTo(x - r, y - r * 2 * f, x, y - r * 3 * f);
    c.quadraticCurveTo(x + r, y - r * 2 * f, x + r, y);
    c.arc(x, y, r, 0, Math.PI);
    c.fill();
    c.fillStyle = '#fde047';
    c.beginPath();
    c.moveTo(x - r * 0.5, y);
    c.quadraticCurveTo(x - r * 0.5, y - r * f, x, y - r * 1.8 * f);
    c.quadraticCurveTo(x + r * 0.5, y - r * f, x + r * 0.5, y);
    c.arc(x, y, r * 0.5, 0, Math.PI);
    c.fill();
    c.restore();
  }

  function bolt(c, x0, y0, x1, y1) {
    c.beginPath();
    c.moveTo(x0, y0);
    for (let i = 1; i < 5; i++) {
      const u = i / 5;
      c.lineTo(x0 + (x1 - x0) * u + (i % 2 ? 10 : -10), y0 + (y1 - y0) * u);
    }
    c.lineTo(x1, y1);
    c.stroke();
  }

  function rock(c, x, y, r, rot, light, dark) {
    c.save();
    c.translate(x, y);
    c.rotate(rot);
    c.beginPath();
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * TAU;
      const rr = r * (0.82 + ((i * 37) % 10) / 45);
      c.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
    }
    c.closePath();
    c.fillStyle = rad(c, 0, 0, r, [light || '#a8a29e', dark || '#57534e']);
    c.fill();
    c.strokeStyle = '#1c1917';
    c.lineWidth = 3;
    c.stroke();
    c.restore();
  }

  function stroke(c, w, col) {
    c.lineWidth = w;
    c.strokeStyle = col || '#111827';
    c.stroke();
  }

  function limb(c, x0, y0, x1, y1, w, col) {
    c.strokeStyle = col;
    c.lineWidth = w;
    line(c, x0, y0, x1, y1);
  }

  // Cartoon eye whose pupil rolls around.
  function googly(c, x, y, r, t, k) {
    ell(c, x, y, r, r, '#fff');
    stroke(c, Math.max(1.5, r * 0.16));
    const a = t * 4 + (k || 0);
    ell(c, x + Math.cos(a) * r * 0.35, y + Math.abs(Math.sin(a * 1.3)) * r * 0.35, r * 0.48, r * 0.48, '#111827');
  }

  function smile(c, x, y, w, h, col) {
    c.beginPath();
    c.moveTo(x - w, y);
    c.quadraticCurveTo(x, y + h, x + w, y);
    stroke(c, 3, col);
  }

  function mouth(c, x, y, w, h, teeth) {
    c.beginPath();
    c.moveTo(x - w, y);
    c.quadraticCurveTo(x, y + h * 2, x + w, y);
    c.closePath();
    c.fillStyle = '#7f1d1d';
    c.fill();
    stroke(c, 2.5);
    if (teeth) {
      c.fillStyle = '#fff';
      c.fillRect(x - w * 0.45, y, w * 0.35, h * 0.45);
      c.fillRect(x + w * 0.1, y, w * 0.35, h * 0.45);
    }
  }

  function fangs(c, x, y, w, len, col) {
    poly(c, [x - w, y, x - w + 5, y + len, x - w + 10, y], col || '#f8fafc');
    poly(c, [x + w - 10, y, x + w - 5, y + len, x + w, y], col || '#f8fafc');
  }

  function brows(c, x, y, gap, w, tilt) {
    c.strokeStyle = '#111827';
    c.lineWidth = 4;
    line(c, x - gap - w, y - tilt, x - gap + w, y + tilt);
    line(c, x + gap - w, y + tilt, x + gap + w, y - tilt);
  }

  function sparkle(c, x, y, r, col) {
    const q = r * 0.25;
    poly(c, [x, y - r, x + q, y - q, x + r, y, x + q, y + q, x, y + r, x - q, y + q, x - r, y, x - q, y - q], col);
  }

  function topHat(c, x, y, w, h, col, band) {
    c.fillStyle = col;
    c.fillRect(x - w * 0.8, y - 4, w * 1.6, 6);
    c.fillRect(x - w / 2, y - h, w, h);
    if (band) {
      c.fillStyle = band;
      c.fillRect(x - w / 2, y - 11, w, 6);
    }
  }

  function crown(c, x, y, w, col) {
    poly(c, [x - w, y, x - w, y - w * 0.8, x - w * 0.5, y - w * 0.35, x, y - w, x + w * 0.5, y - w * 0.35, x + w, y - w * 0.8, x + w, y], col);
    stroke(c, 2.5, '#92400e');
    ell(c, x, y - w * 0.3, w * 0.14, w * 0.14, '#ef4444');
    ell(c, x - w * 0.6, y - w * 0.25, w * 0.1, w * 0.1, '#3b82f6');
    ell(c, x + w * 0.6, y - w * 0.25, w * 0.1, w * 0.1, '#22c55e');
  }

  function partyHat(c, x, y, w, h, col, stripe) {
    poly(c, [x - w, y, x + w, y, x, y - h], col);
    stroke(c, 2);
    c.strokeStyle = stripe;
    c.lineWidth = 4;
    line(c, x - w * 0.66, y - h * 0.33, x + w * 0.66, y - h * 0.33);
    line(c, x - w * 0.33, y - h * 0.66, x + w * 0.33, y - h * 0.66);
    ell(c, x, y - h, w * 0.3, w * 0.3, stripe);
  }

  // Thick wavy tentacle from (x, y) toward (x + dx, y + dy).
  function tentacle(c, x, y, dx, dy, w, t, k, col) {
    const n = 10;
    for (let i = 0; i < n; i++) {
      const u0 = i / n, u1 = (i + 1) / n;
      const wob = u => Math.sin(t * 3 + k + u * 5) * 16 * u;
      c.strokeStyle = col;
      c.lineWidth = Math.max(2, w * (1 - u0 * 0.8));
      line(c, x + dx * u0 + wob(u0), y + dy * u0, x + dx * u1 + wob(u1), y + dy * u1);
    }
  }

  // Flapping membrane wing; dir = -1 for left, 1 for right.
  function batWing(c, x, y, span, flap, col, dir) {
    const s = dir;
    poly(c, [
      x, y,
      x + s * span * 0.45, y - 50 - flap,
      x + s * span, y - 30 - flap,
      x + s * span * 0.85, y + 10 - flap * 0.4,
      x + s * span * 0.62, y - 4 - flap * 0.4,
      x + s * span * 0.45, y + 18 - flap * 0.2,
      x + s * span * 0.25, y + 4,
      x, y + 20
    ], col);
    c.strokeStyle = 'rgba(0,0,0,0.45)';
    c.lineWidth = 2;
    line(c, x, y, x + s * span, y - 30 - flap);
    line(c, x + s * span * 0.45, y - 50 - flap, x + s * span * 0.45, y + 18 - flap * 0.2);
  }

  const DRAW = {
    // ---------- Levels 1-19: goofy critters ----------
    'Wobbly Jelly Bean'(c, t) {
      const s = Math.sin(t * 6) * 0.08;
      ell(c, -14, -4, 10, 5, '#9d174d');
      ell(c, 14, -4, 10, 5, '#9d174d');
      c.save();
      c.translate(0, -50);
      c.scale(1 + s, 1 - s);
      c.rotate(Math.sin(t * 3) * 0.12);
      ell(c, 0, 0, 34, 44, rad(c, 0, 0, 46, ['#fbcfe8', '#ec4899', '#9d174d']));
      stroke(c, 3, '#831843');
      ell(c, -12, -22, 7, 13, 'rgba(255,255,255,0.55)', -0.4);
      googly(c, -12, -8, 11, t, 0);
      googly(c, 10, -10, 8, t, 2);
      smile(c, -2, 14, 10, 8);
      ell(c, -24, 6, 5, 3, 'rgba(244,63,94,0.6)');
      c.restore();
    },

    'Sock Puppet Pete'(c, t) {
      const flap = (Math.sin(t * 7) + 1) * 5;
      const up = -flap * 0.5;
      c.save();
      c.rotate(Math.sin(t * 2) * 0.06);
      c.beginPath();
      c.rect(-28, -108, 56, 108);
      c.fillStyle = '#f1f5f9';
      c.fill();
      stroke(c, 3);
      c.fillStyle = '#ef4444';
      for (let y = -96; y < -6; y += 24) c.fillRect(-26, y, 52, 10);
      ell(c, -24, -112, 18, 3 + flap, '#450a0a');
      ell(c, -4, -96 - up, 40, 12, '#e2e8f0');
      stroke(c, 2.5);
      ell(c, -28, -108 - up * 0.3, 10, 4, '#f472b6');
      ell(c, -6, -130 + up, 44, 20, '#f8fafc');
      stroke(c, 3);
      ell(c, -18, -138 + up, 7, 7, '#2563eb');
      stroke(c, 2);
      ell(c, 4, -140 + up, 6, 6, '#16a34a');
      stroke(c, 2);
      c.fillStyle = '#f8fafc';
      [[-20, -140], [-16, -136], [2, -142], [6, -138]].forEach(([x, y]) => c.fillRect(x - 1, y + up - 1, 2, 2));
      c.strokeStyle = '#f97316';
      c.lineWidth = 3;
      [-6, 2, 10].forEach((x, i) => {
        c.beginPath();
        c.moveTo(x, -148 + up);
        c.quadraticCurveTo(x + 8, -164 + up, x + (i - 1) * 7, -172 + up);
        c.stroke();
      });
      c.restore();
    },

    'Grumpy Toast'(c, t) {
      const b = -Math.abs(Math.sin(t * 4)) * 8;
      limb(c, -16, -30 + b, -20, -4, 5, '#78350f');
      limb(c, 16, -30 + b, 20, -4, 5, '#78350f');
      ell(c, -24, -3, 9, 4, '#111827');
      ell(c, 24, -3, 9, 4, '#111827');
      limb(c, -40, -72 + b, -62, -52 + Math.sin(t * 8) * 10 + b, 5, '#78350f');
      limb(c, 40, -72 + b, 60, -92 + b, 5, '#78350f');
      const slice = (w, bottom, col) => {
        c.beginPath();
        c.moveTo(-w, bottom + b);
        c.lineTo(-w, -96 + b);
        c.arc(-w / 2, -96 + b, w / 2, Math.PI, 0);
        c.arc(w / 2, -96 + b, w / 2, Math.PI, 0);
        c.lineTo(w, bottom + b);
        c.closePath();
        c.fillStyle = col;
        c.fill();
      };
      slice(44, -26, '#92400e');
      stroke(c, 3);
      slice(36, -34, '#fcd34d');
      [[-18, -50], [14, -44], [22, -88], [-22, -100], [0, -104]].forEach(([x, y]) => ell(c, x, y + b, 3, 2, 'rgba(146,64,14,0.4)'));
      c.fillStyle = '#fef08a';
      c.fillRect(-12, -126 + b, 24, 10);
      ell(c, -13, -76 + b, 6, 5, '#111827');
      ell(c, 13, -76 + b, 6, 5, '#111827');
      brows(c, 0, -90 + b, 13, 9, 5);
      c.beginPath();
      c.moveTo(-14, -48 + b);
      c.quadraticCurveTo(0, -62 + b, 14, -48 + b);
      stroke(c, 3);
      const puff = (t * 1.5) % 1;
      c.globalAlpha = 1 - puff;
      ell(c, 30 + puff * 10, -130 + b - puff * 30, 6 + puff * 6, 5 + puff * 5, '#e5e7eb');
      c.globalAlpha = 1;
    },

    'Derpy Pigeon'(c, t) {
      const bob = Math.sin(t * 6) * 8;
      limb(c, -2, -28, -8, -2, 4, '#f97316');
      limb(c, 16, -28, 18, -2, 4, '#f97316');
      poly(c, [44, -60, 76, -78, 70, -46], '#475569');
      ell(c, 8, -52, 40, 30, rad(c, 8, -52, 42, ['#cbd5e1', '#64748b']));
      stroke(c, 3);
      ell(c, 22, -54, 24, 14, '#94a3b8', 0.3);
      stroke(c, 2, '#475569');
      ell(c, -18 + bob * 0.5, -82, 18, 20, rad(c, -18, -82, 22, ['#6ee7b7', '#7c3aed']));
      const hx = -26 + bob, hy = -110;
      ell(c, hx, hy, 22, 20, '#94a3b8');
      stroke(c, 3);
      poly(c, [hx - 18, hy - 2, hx - 40, hy + 6, hx - 18, hy + 8], '#f59e0b');
      stroke(c, 2);
      ell(c, hx - 6, hy - 6, 9, 9, '#fff');
      stroke(c, 2);
      ell(c, hx - 2, hy - 5, 4, 4, '#111827');
      ell(c, hx + 10, hy - 8, 7, 7, '#fff');
      stroke(c, 2);
      ell(c, hx + 13, hy - 11 + Math.sin(t * 9) * 2, 3, 3, '#111827');
      if ((t % 2) < 0.6) {
        c.fillStyle = '#fff';
        c.font = 'bold 16px sans-serif';
        c.textAlign = 'center';
        c.fillText('coo?', hx - 30, hy - 30);
      }
    },

    'Disco Potato'(c, t) {
      const g = Math.sin(t * 6);
      c.strokeStyle = '#94a3b8';
      c.lineWidth = 2;
      line(c, 40, -220, 40, -196);
      ell(c, 40, -182, 16, 16, rad(c, 40, -182, 18, ['#f8fafc', '#64748b']));
      c.strokeStyle = 'rgba(30,41,59,0.45)';
      c.lineWidth = 1;
      [-8, 0, 8].forEach(o => line(c, 26, -182 + o, 54, -182 + o));
      [-8, 0, 8].forEach(o => line(c, 40 + o, -196, 40 + o, -168));
      ['#f472b6', '#60a5fa', '#facc15', '#34d399'].forEach((col, i) => {
        const a = t * 2 + i * TAU / 4;
        sparkle(c, 40 + Math.cos(a) * 70, -150 + Math.sin(a) * 30, 7, col);
      });
      limb(c, -14, -24, -20 + g * 6, -2, 7, '#a16207');
      limb(c, 14, -24, 20 - g * 6, -2, 7, '#a16207');
      limb(c, -38, -80, -70, -120 - g * 20, 7, '#a16207');
      limb(c, 38, -70, 62, -48 + g * 10, 7, '#a16207');
      c.save();
      c.translate(0, -66);
      c.rotate(g * 0.12);
      ell(c, 0, 0, 44, 50, rad(c, 0, 0, 52, ['#e7c28f', '#a16207']));
      stroke(c, 3, '#713f12');
      [[-22, 22], [18, 28], [26, -18], [-8, -34]].forEach(([x, y]) => ell(c, x, y, 3, 2, '#713f12'));
      c.fillStyle = '#111827';
      c.fillRect(-30, -18, 26, 14);
      c.fillRect(2, -18, 26, 14);
      c.fillRect(-6, -14, 10, 3);
      c.fillStyle = 'rgba(255,255,255,0.5)';
      c.fillRect(-26, -16, 6, 4);
      c.fillRect(6, -16, 6, 4);
      mouth(c, -2, 10, 16, 8, true);
      c.restore();
    },

    'Sir Snailsworth'(c, t) {
      const s = Math.sin(t * 2) * 4;
      c.fillStyle = 'rgba(186,230,253,0.55)';
      c.fillRect(20, -5, 100, 5);
      ell(c, s * 0.5, -14, 72, 14, '#a3e635');
      stroke(c, 3, '#3f6212');
      ell(c, -52 + s, -50, 16, 40, '#a3e635');
      stroke(c, 3, '#3f6212');
      ell(c, 20, -66, 46, 46, rad(c, 20, -66, 48, ['#fdba74', '#c2410c']));
      stroke(c, 3, '#7c2d12');
      c.beginPath();
      for (let a = 0; a < TAU * 2.5; a += 0.2) {
        const r = 3 + a * 2.6;
        c.lineTo(20 + Math.cos(a) * r, -66 + Math.sin(a) * r);
      }
      stroke(c, 3, '#7c2d12');
      limb(c, -58 + s, -86, -68 + s, -114, 4, '#65a30d');
      limb(c, -46 + s, -86, -40 + s, -116, 4, '#65a30d');
      googly(c, -68 + s, -118, 7, t, 0);
      googly(c, -40 + s, -120, 7, t, 1.5);
      c.beginPath();
      c.arc(-40 + s, -120, 10, 0, TAU);
      stroke(c, 2, '#eab308');
      c.strokeStyle = '#eab308';
      c.lineWidth = 1.5;
      line(c, -32 + s, -114, -30 + s, -70);
      topHat(c, -54 + s, -92, 18, 22, '#111827', '#7c3aed');
      smile(c, -58 + s, -60, 8, 6);
    },

    'Mustache Muffin'(c, t) {
      const b = -Math.abs(Math.sin(t * 3)) * 5;
      poly(c, [-38, -4, 38, -4, 48, -62, -48, -62], '#60a5fa');
      stroke(c, 3, '#1e3a8a');
      c.strokeStyle = '#2563eb';
      c.lineWidth = 3;
      for (let x = -36; x <= 36; x += 12) line(c, x, -6, x * 1.25, -60);
      ell(c, 0, -72 + b, 58, 40, rad(c, 0, -80 + b, 60, ['#e0b07a', '#92400e']));
      stroke(c, 3, '#451a03');
      [[-34, -84], [-10, -100], [22, -92], [36, -70], [-40, -62]].forEach(([x, y]) => ell(c, x, y + b, 5, 4, '#3f1d0b'));
      ell(c, -14, -80 + b, 5, 6, '#111827');
      ell(c, 12, -80 + b, 5, 6, '#111827');
      c.strokeStyle = '#111827';
      c.lineWidth = 3;
      line(c, -20, -94 + b, -8, -96 + b);
      line(c, 6, -96 + b, 18, -94 + b);
      const w = Math.sin(t * 5) * 0.15;
      ell(c, -15, -64 + b, 16, 7, '#1f2937', 0.3 + w);
      ell(c, 15, -64 + b, 16, 7, '#1f2937', -0.3 - w);
      ell(c, -30, -70 + b, 5, 5, '#1f2937');
      ell(c, 30, -70 + b, 5, 5, '#1f2937');
      c.save();
      c.translate(12, -108 + b);
      c.rotate(0.2);
      topHat(c, 0, 0, 26, 30, '#111827', '#dc2626');
      c.restore();
    },

    'Rubber Ducky of Doom'(c, t) {
      c.save();
      c.translate(0, Math.sin(t * 3) * 5);
      c.rotate(Math.sin(t * 3) * 0.06);
      poly(c, [62, -62, 88, -90, 72, -44], '#facc15');
      stroke(c, 2.5, '#a16207');
      ell(c, 10, -46, 62, 40, rad(c, 10, -46, 64, ['#fef08a', '#eab308']));
      stroke(c, 3, '#a16207');
      ell(c, 24, -50, 26, 16, '#fde047', -0.3);
      stroke(c, 2, '#a16207');
      ell(c, -30, -104, 34, 32, rad(c, -30, -104, 36, ['#fef9c3', '#facc15']));
      stroke(c, 3, '#a16207');
      poly(c, [-42, -134, -36, -152, -28, -134], '#dc2626');
      poly(c, [-18, -136, -8, -152, -6, -130], '#dc2626');
      ell(c, -62, -94, 20, 8, '#f97316');
      stroke(c, 2);
      eye(c, -40, -112, 8, '#dc2626');
      eye(c, -16, -114, 7, '#dc2626');
      brows(c, -28, -124, 12, 8, 4);
      c.restore();
    },

    'Tickle Octopus'(c, t) {
      const b = Math.sin(t * 3) * 6;
      for (let i = 0; i < 6; i++) {
        const x = -40 + i * 16;
        tentacle(c, x, -66 + b, (x) * 0.6, 62 - b, 12, t, i, '#c026d3');
      }
      tentacle(c, -40, -96 + b, -50, -40, 11, t * 2, 0, '#c026d3');
      const fx = -90 + Math.sin(t * 6) * 10, fy = -140 + b;
      ell(c, fx, fy, 22, 7, '#f472b6', -0.8 + Math.sin(t * 12) * 0.3);
      ell(c, fx, fy, 12, 3, '#fbcfe8', -0.8 + Math.sin(t * 12) * 0.3);
      ell(c, 0, -106 + b, 50, 52, rad(c, 0, -106 + b, 54, ['#f5d0fe', '#a21caf']));
      stroke(c, 3, '#701a75');
      [[24, -130], [-28, -140], [30, -96]].forEach(([x, y]) => ell(c, x, y + b, 6, 5, 'rgba(112,26,117,0.35)'));
      c.strokeStyle = '#111827';
      c.lineWidth = 3.5;
      c.beginPath();
      c.arc(-16, -110 + b, 8, Math.PI * 1.1, Math.PI * 1.9);
      c.stroke();
      c.beginPath();
      c.arc(16, -110 + b, 8, Math.PI * 1.1, Math.PI * 1.9);
      c.stroke();
      ell(c, -26, -96 + b, 7, 4, 'rgba(244,114,182,0.7)');
      ell(c, 26, -96 + b, 7, 4, 'rgba(244,114,182,0.7)');
      mouth(c, 0, -94 + b, 14, 8 + Math.abs(Math.sin(t * 10)) * 4);
      if ((t % 1.6) < 0.8) {
        c.fillStyle = '#fff';
        c.font = 'bold 16px sans-serif';
        c.textAlign = 'center';
        c.fillText('hee hee!', 40, -170 + b);
      }
    },

    'King Wobbles the Gelatin'(c, t) {
      const s = Math.sin(t * 5) * 0.07;
      ell(c, 0, -6, 100, 12, '#e2e8f0');
      stroke(c, 3, '#94a3b8');
      c.save();
      c.translate(0, -10);
      c.scale(1 + s, 1 - s);
      c.beginPath();
      c.moveTo(-88, 0);
      c.lineTo(-72, -148);
      c.quadraticCurveTo(0, -180, 72, -148);
      c.lineTo(88, 0);
      c.closePath();
      c.fillStyle = lin(c, 0, -170, 0, 0, ['rgba(190,242,100,0.9)', 'rgba(101,163,13,0.9)']);
      c.fill();
      stroke(c, 3, '#365314');
      c.strokeStyle = 'rgba(255,255,255,0.3)';
      c.lineWidth = 6;
      [-50, -18, 18, 50].forEach(x => line(c, x * 1.15, -4, x, -150));
      [[-50, -40, '#ef4444'], [40, -30, '#f97316'], [-20, -60, '#ef4444'], [56, -80, '#a855f7']].forEach(([x, y, col]) => ell(c, x, y, 8, 8, col));
      ell(c, -44, -120, 10, 22, 'rgba(255,255,255,0.45)', 0.3);
      googly(c, -26, -110, 16, t, 0);
      googly(c, 22, -112, 14, t, 2.2);
      mouth(c, 0, -74, 32, 14, true);
      crown(c, 0, -162, 38, '#facc15');
      c.restore();
    },

    'Sneezy Cactus'(c, t) {
      const cyc = t % 3;
      const pre = cyc < 2.4 ? cyc / 2.4 : 0;
      const sneeze = cyc >= 2.4 ? (cyc - 2.4) / 0.6 : 0;
      const lean = sneeze ? -0.2 * Math.sin(sneeze * Math.PI) : pre * 0.06;
      poly(c, [-36, 0, 36, 0, 44, -40, -44, -40], '#c2410c');
      stroke(c, 3, '#7c2d12');
      c.fillStyle = '#ea580c';
      c.fillRect(-48, -48, 96, 10);
      c.save();
      c.translate(0, -44);
      c.rotate(lean);
      limb(c, -20, -60, -52, -60, 18, '#15803d');
      limb(c, -52, -60, -52, -100, 18, '#15803d');
      limb(c, 20, -44, 50, -44, 16, '#15803d');
      limb(c, 50, -44, 50, -80, 16, '#15803d');
      ell(c, 0, -66, 30, 66, lin(c, -30, 0, 30, 0, ['#16a34a', '#4ade80', '#15803d']));
      stroke(c, 3, '#14532d');
      c.strokeStyle = '#fef9c3';
      c.lineWidth = 1.5;
      [[-26, -30], [24, -50], [-24, -100], [22, -110], [-58, -90], [56, -70]].forEach(([x, y]) => {
        line(c, x, y, x - 5, y - 4);
        line(c, x, y, x + 5, y - 4);
      });
      [0, 1, 2, 3, 4].forEach(i => {
        const a = (i / 5) * TAU;
        ell(c, Math.cos(a) * 10, -134 + Math.sin(a) * 6, 8, 5, '#f472b6', a);
      });
      ell(c, 0, -134, 5, 5, '#facc15');
      const squint = sneeze ? 0.15 : 1 - pre * 0.75;
      ell(c, -12, -92, 6, 6 * squint, '#111827');
      ell(c, 12, -92, 6, 6 * squint, '#111827');
      ell(c, 0, -80, 5, 4, '#166534');
      if (sneeze) ell(c, 0, -66, 9, 10, '#450a0a');
      else smile(c, 0, -66, 10, -4 * pre);
      c.restore();
      if (sneeze) {
        for (let i = 0; i < 9; i++) {
          const d = sneeze * 130 * (0.5 + i / 12);
          ell(c, -40 - d, -130 + Math.sin(i * 2.3) * 24 * sneeze, 5, 3, 'rgba(190,242,100,0.85)');
        }
        c.fillStyle = '#fff';
        c.font = 'bold 20px sans-serif';
        c.textAlign = 'center';
        c.fillText('ACHOO!', -90, -170);
      }
    },

    'Chompy Lunchbox'(c, t) {
      const open = (Math.sin(t * 6) + 1) * 0.22;
      const b = -Math.abs(Math.sin(t * 6)) * 4;
      limb(c, -30, -10 + b, -34, -2, 8, '#111827');
      limb(c, 30, -10 + b, 34, -2, 8, '#111827');
      c.fillStyle = '#450a0a';
      c.fillRect(-52, -88 + b, 104, 20);
      c.beginPath();
      c.rect(-54, -84 + b, 108, 74);
      c.fillStyle = '#dc2626';
      c.fill();
      stroke(c, 3, '#450a0a');
      c.fillStyle = '#fef3c7';
      c.fillRect(-40, -56 + b, 80, 22);
      c.fillStyle = '#b91c1c';
      c.font = 'bold 14px sans-serif';
      c.textAlign = 'center';
      c.fillText('LUNCH', 0, -40 + b);
      for (let x = -48; x < 48; x += 16) poly(c, [x, -84 + b, x + 8, -98 + b, x + 16, -84 + b], '#fff');
      c.save();
      c.translate(54, -84 + b);
      c.rotate(open);
      c.beginPath();
      c.rect(-108, -30, 108, 30);
      c.fillStyle = '#ef4444';
      c.fill();
      stroke(c, 3, '#450a0a');
      for (let x = -104; x < -4; x += 16) poly(c, [x, 0, x + 8, 14, x + 16, 0], '#fff');
      c.beginPath();
      c.arc(-54, -30, 18, Math.PI, 0);
      stroke(c, 6, '#1f2937');
      googly(c, -84, -15, 9, t, 0);
      googly(c, -60, -15, 9, t, 1.7);
      brows(c, -72, -26, 12, 7, 3);
      c.restore();
    },

    'Cranky Crab'(c, t) {
      const snap = Math.abs(Math.sin(t * 5)) * 0.5;
      c.save();
      c.translate(Math.sin(t * 4) * 8, 0);
      for (let i = 0; i < 3; i++) {
        const k = Math.sin(t * 12 + i) * 4;
        [-1, 1].forEach(s => {
          limb(c, s * (20 + i * 12), -40, s * (50 + i * 14), -30 + k, 6, '#b91c1c');
          limb(c, s * (50 + i * 14), -30 + k, s * (58 + i * 14), 0, 6, '#b91c1c');
        });
      }
      ell(c, 0, -48, 56, 32, rad(c, 0, -48, 58, ['#fca5a5', '#dc2626']));
      stroke(c, 3, '#7f1d1d');
      const claw = (x, y, rot) => {
        c.save();
        c.translate(x, y);
        c.rotate(rot);
        ell(c, 0, 0, 20, 15, '#ef4444');
        stroke(c, 2.5, '#7f1d1d');
        c.save();
        c.rotate(-snap);
        poly(c, [-6, -4, -42, -12, -8, -14], '#f87171');
        stroke(c, 2.5, '#7f1d1d');
        c.restore();
        c.save();
        c.rotate(snap);
        poly(c, [-6, 4, -38, 8, -8, 12], '#f87171');
        stroke(c, 2.5, '#7f1d1d');
        c.restore();
        c.restore();
      };
      limb(c, -40, -58, -66, -80, 9, '#dc2626');
      limb(c, 40, -58, 58, -92, 9, '#dc2626');
      claw(-76, -86, -0.3);
      claw(56, -108, 0.9);
      limb(c, -14, -74, -18, -104, 4, '#b91c1c');
      limb(c, 10, -74, 14, -106, 4, '#b91c1c');
      googly(c, -18, -108, 8, t, 0);
      googly(c, 14, -110, 8, t, 2);
      brows(c, -2, -122, 16, 6, 4);
      c.beginPath();
      c.moveTo(-14, -40);
      c.quadraticCurveTo(0, -50, 14, -40);
      stroke(c, 3);
      c.restore();
    },

    'Angry Garden Gnome'(c, t) {
      const stomp = Math.abs(Math.sin(t * 5));
      ell(c, -16, -6 - stomp * 8, 14, 7, '#78350f');
      ell(c, 16, -6, 14, 7, '#78350f');
      poly(c, [-34, -12, 34, -12, 24, -72, -24, -72], '#2563eb');
      stroke(c, 3, '#1e3a8a');
      c.fillStyle = '#111827';
      c.fillRect(-30, -34, 60, 8);
      c.fillStyle = '#facc15';
      c.fillRect(-6, -35, 12, 10);
      limb(c, -24, -62, -50, -94 + Math.sin(t * 12) * 6, 10, '#2563eb');
      ell(c, -52, -98 + Math.sin(t * 12) * 6, 8, 8, '#fcd9b6');
      limb(c, 24, -62, 40, -36, 10, '#2563eb');
      ell(c, 0, -88, 24, 22, '#fcd9b6');
      poly(c, [-26, -86, 26, -86, 0, -30], '#f8fafc');
      [[-18, -70], [18, -70], [-8, -50], [8, -50], [0, -80]].forEach(([x, y]) => ell(c, x, y, 10, 9, '#f8fafc'));
      ell(c, -4, -88, 7, 6, '#f87171');
      ell(c, -12, -96, 3, 3, '#111827');
      ell(c, 8, -96, 3, 3, '#111827');
      brows(c, -2, -103, 10, 6, 3);
      poly(c, [-28, -104, 28, -104, -10, -186], '#dc2626');
      stroke(c, 3, '#7f1d1d');
      if (stomp > 0.7) {
        c.globalAlpha = (stomp - 0.7) / 0.3;
        ell(c, -34, -110, 7, 5, '#e5e7eb');
        ell(c, 34, -110, 7, 5, '#e5e7eb');
        c.globalAlpha = 1;
      }
    },

    'Moldy Cheese Wheel'(c, t) {
      const b = Math.sin(t * 2) * 3;
      limb(c, -40, -12, -44, -2, 7, '#a16207');
      limb(c, 40, -12, 44, -2, 7, '#a16207');
      poly(c, [-78, -50 + b, 60, -90 + b, 80, -76 + b, -60, -38 + b], '#fde68a');
      poly(c, [-78, -50 + b, -60, -38 + b, -60, -10, -78, -20], '#eab308');
      poly(c, [-60, -38 + b, 80, -76 + b, 80, -10, -60, -10], '#facc15');
      stroke(c, 3, '#a16207');
      [[-30, -24, 9], [10, -40, 7], [50, -28, 10], [30, -60, 6], [62, -54, 5]].forEach(([x, y, r]) => ell(c, x, y + b * 0.5, r, r * 0.8, '#ca8a04'));
      [[-50, -30], [40, -70], [70, -20], [-10, -60]].forEach(([x, y], i) => {
        ell(c, x, y + b * 0.5, 12, 8, '#65a30d');
        ell(c, x + 3, y - 2 + b * 0.5, 4, 3, '#a3e635');
        ell(c, x - 5, y + 2 + b * 0.5, 3, 2, '#bef264');
      });
      googly(c, -22, -54 + b, 10, t, 0);
      ell(c, 8, -60 + b, 8, 4, '#111827');
      smile(c, -8, -34 + b, 14, 6);
      c.fillStyle = '#fff';
      c.fillRect(-6, -32 + b, 6, 6);
      c.strokeStyle = 'rgba(132,204,22,0.7)';
      c.lineWidth = 3;
      for (let i = 0; i < 3; i++) {
        const x = -30 + i * 34, rise = (t * 30 + i * 20) % 60;
        c.beginPath();
        for (let y = 0; y < 40; y += 4) c.lineTo(x + Math.sin((y + rise) / 6) * 5, -96 - y - rise * 0.5 + b);
        c.stroke();
      }
      for (let i = 0; i < 3; i++) {
        const a = t * 4 + i * 2.1;
        const fx = Math.cos(a) * 70, fy = -130 + Math.sin(a * 1.4) * 20;
        ell(c, fx, fy, 3, 3, '#111827');
        ell(c, fx - 3, fy - 4, 3, 2, 'rgba(255,255,255,0.7)');
        ell(c, fx + 3, fy - 4, 3, 2, 'rgba(255,255,255,0.7)');
      }
    },

    'Bouncy Mushroom Bro'(c, t) {
      const ph = (t * 2.2) % 1;
      const hop = Math.sin(ph * Math.PI) * 40;
      const sq = ph < 0.1 || ph > 0.9 ? 0.12 : 0;
      c.save();
      c.translate(0, -hop);
      c.scale(1 + sq, 1 - sq);
      ell(c, -14, -4, 12, 6, '#78350f');
      ell(c, 14, -4, 12, 6, '#78350f');
      limb(c, -26, -46, -48, -70, 6, '#fde68a');
      limb(c, 26, -46, 48, -70, 6, '#fde68a');
      ell(c, -50, -74, 6, 6, '#fde68a');
      ell(c, 50, -74, 6, 6, '#fde68a');
      ell(c, 0, -40, 28, 38, '#fef3c7');
      stroke(c, 3, '#a16207');
      c.fillStyle = '#3b82f6';
      c.fillRect(-28, -76, 56, 8);
      googly(c, -10, -52, 8, t, 0);
      googly(c, 10, -52, 8, t, 1);
      mouth(c, 0, -34, 12, 7, true);
      c.beginPath();
      c.ellipse(0, -78, 66, 48, 0, Math.PI, 0);
      c.closePath();
      c.fillStyle = rad(c, 0, -100, 70, ['#fca5a5', '#dc2626', '#991b1b']);
      c.fill();
      stroke(c, 3, '#7f1d1d');
      [[-38, -98, 10], [0, -114, 13], [36, -96, 9], [-14, -88, 6], [52, -84, 5]].forEach(([x, y, r]) => ell(c, x, y, r, r * 0.8, '#fff'));
      c.restore();
    },

    'Haunted Vacuum'(c, t) {
      const sh = Math.sin(t * 20) * 1.5;
      for (let i = 0; i < 5; i++) {
        const a = t * 5 + i * 1.3, r = 30 + ((t * 40 + i * 13) % 40);
        ell(c, -86 + Math.cos(a) * r * 0.4, -124 + Math.sin(a) * r * 0.4, 7, 5, 'rgba(148,163,184,0.6)');
      }
      ell(c, -30, -10, 10, 10, '#111827');
      ell(c, 30, -10, 10, 10, '#111827');
      c.fillStyle = '#6b7280';
      c.fillRect(-56, -28, 112, 18);
      c.fillStyle = '#1f2937';
      for (let x = -52; x < 52; x += 8) c.fillRect(x, -10, 4, 6);
      c.fillStyle = '#7c3aed';
      c.fillRect(-8 + sh, -150, 34, 124);
      ell(c, 8 + sh, -92, 32, 46, '#ede9fe');
      stroke(c, 3, '#4c1d95');
      const m = 6 + Math.abs(Math.sin(t * 6)) * 6;
      ell(c, -2 + sh, -106, 6, 9, '#111827');
      ell(c, 18 + sh, -106, 6, 9, '#111827');
      ell(c, 8 + sh, -80, 7, m, '#111827');
      limb(c, 12 + sh, -150, 30, -198, 6, '#4b5563');
      limb(c, 24, -198, 40, -198, 8, '#111827');
      const nx = -80, ny = -120 + Math.sin(t * 4) * 20;
      c.beginPath();
      c.moveTo(-8, -60);
      c.bezierCurveTo(-60, -40, -40, ny + 40, nx, ny);
      stroke(c, 10, '#9ca3af');
      c.save();
      c.translate(nx, ny);
      c.rotate(-0.6);
      c.fillStyle = '#374151';
      c.fillRect(-20, -8, 24, 16);
      c.restore();
      c.globalAlpha = 0.35 + Math.sin(t * 3) * 0.15;
      ell(c, 8, -170 - ((t * 20) % 30), 14, 20, '#f8fafc');
      c.globalAlpha = 1;
    },

    'Party Llama'(c, t) {
      const bob = Math.sin(t * 4) * 4;
      const w = Math.sin(t * 6) * 6;
      [[-10, w], [8, -w], [42, -w], [58, w]].forEach(([x, k]) => limb(c, x, -56, x + k, -2, 9, '#fde68a'));
      ell(c, 24, -74, 50, 30, '#fef3c7');
      stroke(c, 3, '#a16207');
      [[-10, -92], [20, -100], [52, -92], [68, -74]].forEach(([x, y]) => ell(c, x, y, 14, 10, '#fef3c7'));
      c.fillStyle = '#ec4899';
      c.fillRect(0, -92, 50, 22);
      c.fillStyle = '#22d3ee';
      c.fillRect(0, -84, 50, 6);
      limb(c, -14, -84, -32, -146 + bob, 24, '#fef3c7');
      const hx = -38, hy = -158 + bob;
      poly(c, [hx - 4, hy - 14, hx - 10, hy - 34, hx + 2, hy - 16], '#fde68a');
      poly(c, [hx + 12, hy - 14, hx + 14, hy - 36, hx + 20, hy - 12], '#fde68a');
      ell(c, hx, hy, 22, 16, '#fef3c7');
      stroke(c, 2.5, '#a16207');
      ell(c, hx - 18, hy + 6, 14, 10, '#fde68a');
      stroke(c, 2, '#a16207');
      ell(c, hx - 22, hy + 16 + Math.sin(t * 8) * 2, 5, 8, '#f472b6');
      googly(c, hx - 8, hy - 4, 7, t, 0);
      googly(c, hx + 8, hy - 6, 7, t, 3);
      c.save();
      c.translate(hx + 6, hy - 14);
      c.rotate(0.25);
      partyHat(c, 0, 0, 14, 40, '#8b5cf6', '#facc15');
      c.restore();
      const cols = ['#ef4444', '#22c55e', '#3b82f6', '#facc15', '#ec4899'];
      for (let i = 0; i < 14; i++) {
        const x = ((i * 53) % 220) - 110;
        const y = -220 + ((t * 60 + i * 37) % 220);
        c.save();
        c.translate(x, y);
        c.rotate(t * 3 + i);
        c.fillStyle = cols[i % cols.length];
        c.fillRect(-3, -2, 6, 4);
        c.restore();
      }
    },

    // ---------- Levels 20-35: getting meaner ----------
    'Brick Muncher Rat'(c, t) {
      const chew = Math.abs(Math.sin(t * 10)) * 4;
      c.beginPath();
      c.moveTo(70, -34);
      c.bezierCurveTo(120, -30, 110, -90, 90 + Math.sin(t * 3) * 10, -110);
      stroke(c, 5, '#f9a8d4');
      [[-10, 0], [50, 0]].forEach(([x]) => limb(c, x, -24, x - 6, -2, 8, '#f9a8d4'));
      ell(c, 22, -50, 60, 36, rad(c, 22, -50, 62, ['#9ca3af', '#374151']));
      stroke(c, 3, '#111827');
      ell(c, -44, -66, 36, 24, '#6b7280', -0.2);
      stroke(c, 3, '#111827');
      ell(c, -30, -94, 16, 16, '#6b7280');
      stroke(c, 2.5, '#111827');
      ell(c, -30, -94, 9, 9, '#f9a8d4');
      ell(c, -80, -58, 6, 5, '#f472b6');
      glow(c, -52, -74, 5, '#ef4444', 12);
      c.fillStyle = '#fef9c3';
      c.fillRect(-76, -50, 7, 12 + chew);
      c.fillRect(-68, -50, 7, 12 + chew);
      c.strokeStyle = '#d1d5db';
      c.lineWidth = 1.5;
      [-6, 0, 6].forEach(o => line(c, -74, -58, -104, -60 + o * 2));
      const by = -38 + chew;
      c.fillStyle = '#dc2626';
      c.fillRect(-108, by, 32, 20);
      c.fillRect(-104, by - 6, 8, 6);
      c.fillRect(-90, by - 6, 8, 6);
      c.fillStyle = '#374151';
      c.beginPath();
      c.arc(-78, by + 2, 8, 0, TAU);
      c.fill();
      c.fillStyle = '#dc2626';
      for (let i = 0; i < 3; i++) {
        const f = (t * 1.8 + i / 3) % 1;
        c.fillRect(-84 + i * 6, by + 20 + f * 30, 3, 3);
      }
    },

    'Thornback Boar'(c, t) {
      const b = Math.sin(t * 3) * 2;
      [-30, -6, 34, 58].forEach((x, i) => limb(c, x, -44, x + (i % 2 ? 4 : -4), -2, 12, '#44200c'));
      ell(c, 12, -70 + b, 68, 42, rad(c, 12, -70 + b, 70, ['#92400e', '#451a03']));
      stroke(c, 3, '#1c0a00');
      for (let i = 0; i < 9; i++) {
        const x = -34 + i * 12, top = -108 - Math.sin((i / 8) * Math.PI) * 14 + b;
        poly(c, [x - 6, top + 14, x, top - 18, x + 6, top + 14], '#365314');
        ell(c, x, top - 16, 2.5, 2.5, '#dc2626');
      }
      ell(c, -54, -72 + b, 34, 30, rad(c, -54, -72 + b, 36, ['#a16207', '#451a03']));
      stroke(c, 3, '#1c0a00');
      ell(c, -86, -62 + b, 13, 14, '#7c2d12');
      ell(c, -90, -64 + b, 3, 4, '#111827');
      ell(c, -84, -58 + b, 3, 4, '#111827');
      poly(c, [-78, -52 + b, -96, -80 + b, -86, -50 + b], '#fef3c7');
      poly(c, [-66, -50 + b, -80, -76 + b, -72, -48 + b], '#fef3c7');
      glow(c, -60, -86 + b, 5, '#f97316', 14);
      poly(c, [-40, -96 + b, -30, -116 + b, -26, -94 + b], '#451a03');
      const puff = (t * 2) % 1;
      c.globalAlpha = 1 - puff;
      ell(c, -104 - puff * 20, -56 + b, 6 + puff * 8, 4 + puff * 5, '#e5e7eb');
      c.globalAlpha = 1;
    },

    'Gloom Bat'(c, t) {
      const h = Math.sin(t * 4) * 10;
      const flap = Math.sin(t * 10) * 24;
      const y = -130 + h;
      ell(c, 0, y, 110, 70, rad(c, 0, y, 110, ['rgba(88,28,135,0.45)', 'rgba(88,28,135,0)']));
      batWing(c, -18, y - 10, 100, flap, '#3b0764', -1);
      batWing(c, 18, y - 10, 100, flap, '#3b0764', 1);
      ell(c, 0, y, 26, 36, rad(c, 0, y, 38, ['#6b21a8', '#1e0536']));
      poly(c, [-20, y - 26, -14, y - 58, -4, y - 30], '#2e1065');
      poly(c, [20, y - 26, 14, y - 58, 4, y - 30], '#2e1065');
      glow(c, -9, y - 14, 5, '#ef4444', 16);
      glow(c, 9, y - 14, 5, '#ef4444', 16);
      c.fillStyle = '#1e0536';
      c.fillRect(-10, y + 2, 20, 6);
      fangs(c, 0, y + 6, 10, 9);
      limb(c, -8, y + 34, -12, y + 48, 3, '#1e0536');
      limb(c, 8, y + 34, 12, y + 48, 3, '#1e0536');
    },

    'Magma Scorpion'(c, t) {
      const b = Math.sin(t * 3) * 2;
      for (let i = 0; i < 4; i++) {
        const x = -20 + i * 18, k = Math.sin(t * 8 + i) * 4;
        limb(c, x, -36, x - 16, -18 + k, 6, '#1c1917');
        limb(c, x - 16, -18 + k, x - 20, 0, 5, '#1c1917');
        limb(c, x, -36, x + 16, -18 - k, 6, '#1c1917');
        limb(c, x + 16, -18 - k, x + 20, 0, 5, '#1c1917');
      }
      [-30, -6, 18, 40].forEach((x, i) => ell(c, x, -42 + b, 22 - i * 2, 16, rad(c, x, -42 + b, 22, ['#57534e', '#1c1917'])));
      c.save();
      c.shadowColor = '#f97316';
      c.shadowBlur = 10;
      c.strokeStyle = '#fb923c';
      c.lineWidth = 2.5;
      c.beginPath();
      c.moveTo(-44, -44 + b); c.lineTo(-24, -36 + b); c.lineTo(-10, -48 + b); c.lineTo(12, -38 + b); c.lineTo(34, -48 + b);
      c.stroke();
      c.restore();
      let px = 50, py = -46 + b;
      for (let i = 0; i < 6; i++) {
        const a = -0.6 - i * 0.42 + Math.sin(t * 2) * 0.1;
        const nx = px + Math.cos(a) * 26, ny = py + Math.sin(a) * 26;
        rock(c, nx, ny, 13 - i, a, '#78716c', '#1c1917');
        px = nx; py = ny;
      }
      poly(c, [px - 6, py, px - 26, py + 20, px + 4, py + 8], '#fb923c');
      glow(c, px - 18, py + 14, 6, '#fde047', 20);
      const claw = (x, y, s) => {
        limb(c, -40, -48 + b, x + 18, y + 6, 8, '#292524');
        rock(c, x, y, 16, 0.2, '#78716c', '#1c1917');
        poly(c, [x - 8, y - 6, x - 38, y - 18 - s, x - 12, y - 16], '#44403c');
        poly(c, [x - 8, y + 6, x - 36, y + 12 + s, x - 12, y + 14], '#44403c');
      };
      const snap = Math.abs(Math.sin(t * 5)) * 8;
      claw(-80, -62 + b, snap);
      claw(-70, -30 + b, snap);
      [[-50, -54], [-44, -58], [-50, -60]].forEach(([x, y]) => glow(c, x, y + b, 2.5, '#f97316', 10));
    },

    'Hexed Knight'(c, t) {
      const b = Math.sin(t * 2) * 2;
      const wave = Math.sin(t * 3) * 8;
      poly(c, [-22, -150 + b, 22, -150 + b, 44 + wave, -10, 30 + wave, -22, 18 + wave, -6, 0 + wave, -20, -14 + wave, -4, -36 + wave, -18], '#4c1d95');
      c.fillStyle = '#374151';
      c.fillRect(-26, -64, 20, 62);
      c.fillRect(6, -64, 20, 62);
      poly(c, [-36, -64 + b, 36, -64 + b, 30, -146 + b, -30, -146 + b], lin(c, -36, 0, 36, 0, ['#4b5563', '#9ca3af', '#374151']));
      stroke(c, 3, '#111827');
      c.strokeStyle = 'rgba(168,85,247,0.8)';
      c.lineWidth = 2;
      line(c, -10, -140 + b, 6, -110 + b);
      line(c, 6, -110 + b, -4, -84 + b);
      ell(c, 0, -172 + b, 24, 26, lin(c, -24, 0, 24, 0, ['#6b7280', '#d1d5db', '#4b5563']));
      stroke(c, 3, '#111827');
      c.fillStyle = '#111827';
      c.fillRect(-20, -178 + b, 36, 8);
      c.save();
      c.shadowColor = '#a855f7';
      c.shadowBlur = 16;
      c.fillStyle = '#c084fc';
      c.fillRect(-18, -176 + b, 32, 4);
      c.restore();
      poly(c, [4, -196 + b, 14, -214 + b, 10, -194 + b], '#7c3aed');
      ell(c, 38, -96 + b, 22, 30, '#1f2937');
      stroke(c, 3, '#6b7280');
      c.strokeStyle = '#a855f7';
      c.lineWidth = 2;
      line(c, 30, -116 + b, 44, -80 + b);
      limb(c, -30, -134 + b, -58, -110 + b, 12, '#4b5563');
      c.save();
      c.translate(-60, -108 + b);
      c.rotate(-0.5 + Math.sin(t * 2) * 0.1);
      c.fillStyle = '#78350f';
      c.fillRect(-4, -4, 8, 24);
      c.fillStyle = '#9ca3af';
      c.fillRect(-18, -8, 36, 6);
      c.save();
      c.shadowColor = '#a855f7';
      c.shadowBlur = 18;
      poly(c, [-5, -8, 5, -8, 3, -110, 0, -120, -3, -110], '#e5e7eb');
      c.fillStyle = '#a855f7';
      for (let i = 0; i < 5; i++) c.fillRect(-1.5, -24 - i * 18, 3, 8);
      c.restore();
      c.restore();
      for (let i = 0; i < 5; i++) {
        const a = t * 1.5 + i * TAU / 5;
        glow(c, Math.cos(a) * 70, -110 + Math.sin(a) * 50 + b, 3, '#c084fc', 12);
      }
    },

    // ---------- Levels 36-50: nightmares ----------
    'Abyssal Kraken'(c, t) {
      const b = Math.sin(t * 1.5) * 4;
      for (let i = 0; i < 8; i++) {
        const x = -56 + i * 16;
        tentacle(c, x, -90 + b, (x) * 1.3, 88 - b, 16, t, i * 0.9, i % 2 ? '#134e4a' : '#115e59');
      }
      ell(c, 0, -150 + b, 58, 74, rad(c, 0, -150 + b, 76, ['#2dd4bf', '#0f766e', '#042f2e']));
      stroke(c, 3, '#022c22');
      [[-30, -190], [26, -200], [-8, -212], [40, -160], [-44, -150], [10, -176]].forEach(([x, y], i) =>
        glow(c, x, y + b, 3 + (i % 2), '#67e8f9', 10 + Math.sin(t * 3 + i) * 6));
      [-22, 22].forEach(x => {
        ell(c, x, -118 + b, 14, 11, '#facc15');
        ell(c, x, -118 + b, 3, 10, '#111827');
      });
      poly(c, [-10, -96 + b, 10, -96 + b, 0, -80 + b], '#1c1917');
    },

    'Blood Moon Stalker'(c, t) {
      const b = Math.sin(t * 2.5) * 3;
      ell(c, 40, -176, 60, 60, rad(c, 40, -176, 62, ['#fca5a5', '#b91c1c', '#450a0a']));
      c.save();
      c.globalAlpha = 0.35;
      ell(c, 40, -176, 90, 90, rad(c, 40, -176, 90, ['rgba(220,38,38,0.8)', 'rgba(220,38,38,0)']));
      c.restore();
      limb(c, -20, -70, -34, -38, 16, '#1c1917');
      limb(c, -34, -38, -24, -4, 12, '#1c1917');
      limb(c, 26, -70, 40, -38, 16, '#1c1917');
      limb(c, 40, -38, 30, -4, 12, '#1c1917');
      poly(c, [-40, -70 + b, 44, -76 + b, 30, -150 + b, -24, -160 + b], '#292524');
      for (let i = 0; i < 7; i++) poly(c, [-24 + i * 9, -156 + b + i, -20 + i * 9, -176 + b + i * 2, -14 + i * 9, -152 + b + i], '#1c1917');
      const reach = Math.sin(t * 3) * 10;
      limb(c, -20, -144 + b, -64 - reach, -110 + b, 13, '#292524');
      limb(c, -64 - reach, -110 + b, -86 - reach, -80 + b, 11, '#292524');
      [-8, 0, 8].forEach(o => poly(c, [-86 - reach + o, -82 + b, -100 - reach + o, -64 + b, -90 - reach + o, -80 + b], '#e7e5e4'));
      limb(c, 26, -144 + b, 46, -100 + b, 12, '#292524');
      const hx = -36, hy = -176 + b;
      ell(c, hx, hy, 28, 24, '#292524');
      poly(c, [hx - 20, hy - 6, hx - 62, hy + 8, hx - 18, hy + 18], '#1c1917');
      poly(c, [hx - 4, hy - 18, hx + 4, hy - 46, hx + 12, hy - 16], '#1c1917');
      poly(c, [hx + 10, hy - 16, hx + 22, hy - 42, hx + 24, hy - 10], '#1c1917');
      fangs(c, hx - 42, hy + 10, 12, 8);
      glow(c, hx - 14, hy - 4, 4, '#ef4444', 16);
      glow(c, hx - 2, hy - 6, 4, '#ef4444', 16);
      const drip = (t * 1.2) % 1;
      ell(c, hx - 46, hy + 20 + drip * 30, 2, 4, 'rgba(226,232,240,0.7)');
    },

    'Iron Colossus'(c, t) {
      const b = Math.sin(t * 1.2) * 2;
      const pulse = 0.6 + Math.sin(t * 4) * 0.4;
      c.fillStyle = '#374151';
      c.fillRect(-50, -70, 34, 70);
      c.fillRect(16, -70, 34, 70);
      c.fillStyle = '#1f2937';
      c.fillRect(-56, -10, 46, 10);
      c.fillRect(10, -10, 46, 10);
      poly(c, [-70, -66 + b, 70, -66 + b, 84, -190 + b, -84, -190 + b], lin(c, -84, 0, 84, 0, ['#4b5563', '#9ca3af', '#4b5563']));
      stroke(c, 3, '#111827');
      for (let i = 0; i < 6; i++) {
        ell(c, -72 + i * 29, -182 + b, 3, 3, '#1f2937');
        ell(c, -64 + i * 26, -74 + b, 3, 3, '#1f2937');
      }
      c.save();
      c.shadowColor = '#22d3ee';
      c.shadowBlur = 30 * pulse;
      ell(c, 0, -130 + b, 24, 24, rad(c, 0, -130 + b, 24, ['#ecfeff', '#22d3ee', '#0e7490']));
      c.restore();
      ell(c, -100, -178 + b, 30, 24, '#6b7280');
      stroke(c, 3, '#111827');
      ell(c, 100, -178 + b, 30, 24, '#6b7280');
      stroke(c, 3, '#111827');
      const lift = Math.sin(t * 2) * 12;
      limb(c, -100, -170 + b, -118, -110 + b - lift, 22, '#4b5563');
      c.beginPath();
      c.rect(-138, -110 + b - lift, 40, 36);
      c.fillStyle = '#374151';
      c.fill();
      stroke(c, 3, '#111827');
      limb(c, 100, -170 + b, 112, -96 + b, 22, '#4b5563');
      c.beginPath();
      c.rect(94, -96 + b, 38, 34);
      c.fillStyle = '#374151';
      c.fill();
      stroke(c, 3, '#111827');
      c.beginPath();
      c.rect(-26, -226 + b, 52, 38);
      c.fillStyle = '#6b7280';
      c.fill();
      stroke(c, 3, '#111827');
      c.save();
      c.shadowColor = '#f43f5e';
      c.shadowBlur = 14;
      c.fillStyle = '#fb7185';
      c.fillRect(-20, -212 + b, 40, 6);
      c.restore();
      const puff = (t * 1.3) % 1;
      c.globalAlpha = 0.6 * (1 - puff);
      ell(c, -60, -200 + b - puff * 40, 8 + puff * 10, 6 + puff * 8, '#e5e7eb');
      ell(c, 60, -200 + b - puff * 40, 8 + puff * 10, 6 + puff * 8, '#e5e7eb');
      c.globalAlpha = 1;
    },

    'Chaos Chimera'(c, t) {
      const b = Math.sin(t * 2.5) * 3;
      const flap = Math.sin(t * 5) * 14;
      batWing(c, 10, -120 + b, 100, flap, '#7f1d1d', 1);
      [-34, -12, 36, 58].forEach((x, i) => limb(c, x, -56, x + (i % 2 ? 4 : -4), -2, 13, '#a16207'));
      ell(c, 14, -80 + b, 66, 38, rad(c, 14, -80 + b, 68, ['#eab308', '#854d0e']));
      stroke(c, 3, '#422006');
      c.beginPath();
      c.moveTo(76, -82 + b);
      c.bezierCurveTo(120, -70, 120, -150, 96 + Math.sin(t * 3) * 8, -168);
      stroke(c, 10, '#15803d');
      ell(c, 92 + Math.sin(t * 3) * 8, -176, 12, 9, '#16a34a');
      glow(c, 86 + Math.sin(t * 3) * 8, -178, 2.5, '#fde047', 8);
      c.strokeStyle = '#dc2626';
      c.lineWidth = 2;
      line(c, 80 + Math.sin(t * 3) * 8, -172, 70 + Math.sin(t * 3) * 8, -168 + Math.sin(t * 20) * 3);
      limb(c, 20, -110 + b, 24, -150 + b, 16, '#78716c');
      ell(c, 22, -160 + b, 16, 14, '#a8a29e');
      c.beginPath();
      c.arc(30, -172 + b, 12, Math.PI, TAU * 0.95);
      stroke(c, 5, '#44403c');
      c.beginPath();
      c.arc(14, -172 + b, 12, Math.PI * 1.05, TAU);
      stroke(c, 5, '#44403c');
      glow(c, 16, -160 + b, 2.5, '#ef4444', 10);
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * TAU;
        ell(c, -58 + Math.cos(a) * 34, -110 + b + Math.sin(a) * 34, 16, 12, i % 2 ? '#92400e' : '#78350f', a);
      }
      ell(c, -58, -108 + b, 28, 26, rad(c, -58, -108 + b, 30, ['#fbbf24', '#b45309']));
      stroke(c, 2.5, '#422006');
      ell(c, -80, -98 + b, 12, 9, '#fcd34d');
      glow(c, -66, -116 + b, 4, '#f97316', 14);
      glow(c, -48, -116 + b, 4, '#f97316', 14);
      c.fillStyle = '#450a0a';
      c.fillRect(-90, -94 + b, 20, 8);
      fangs(c, -80, -94 + b, 10, 8);
    },

    'Ruin Wyrm'(c, t) {
      const pts = [];
      for (let i = 0; i < 12; i++) {
        const u = i / 11;
        pts.push([90 - u * 150 + Math.sin(u * 7 + t * 1.5) * 18, -14 - u * 180 + Math.cos(u * 5 + t) * 10]);
      }
      pts.forEach(([x, y], i) => {
        rock(c, x, y, 26 - i * 0.9, i * 0.6, '#a8a29e', '#44403c');
        if (i % 2 === 0) {
          c.save();
          c.shadowColor = '#4ade80';
          c.shadowBlur = 10;
          c.fillStyle = '#86efac';
          c.fillRect(x - 4, y - 2, 8, 3);
          c.fillRect(x - 1, y - 6, 3, 10);
          c.restore();
        }
        if (i % 3 === 1) ell(c, x + 6, y - 14, 8, 4, '#4d7c0f');
      });
      const [hx, hy] = pts[pts.length - 1];
      const jaw = Math.abs(Math.sin(t * 2)) * 10;
      poly(c, [hx + 10, hy - 20, hx - 60, hy - 8, hx - 56, hy + 4, hx + 14, hy + 12], '#78716c');
      stroke(c, 3, '#1c1917');
      poly(c, [hx + 6, hy + 8, hx - 50, hy + 8 + jaw, hx - 48, hy + 18 + jaw, hx + 10, hy + 22], '#57534e');
      stroke(c, 3, '#1c1917');
      poly(c, [hx, hy - 18, hx + 20, hy - 50, hx + 12, hy - 14], '#44403c');
      poly(c, [hx - 14, hy - 16, hx - 6, hy - 46, hx - 2, hy - 14], '#44403c');
      glow(c, hx - 24, hy - 6, 5, '#4ade80', 18);
      fangs(c, hx - 36, hy + 6, 12, 7, '#d6d3d1');
    },

    'Titan of the Wastes'(c, t) {
      const b = Math.sin(t * 1.5) * 3;
      for (let i = 0; i < 10; i++) {
        const u = (t * 0.3 + i / 10) % 1;
        ell(c, -120 + u * 240, -20 - Math.sin(u * Math.PI) * 40 - (i % 3) * 20, 10, 6, 'rgba(214,211,209,0.35)');
      }
      limb(c, -30, -90, -36, -4, 30, '#c2956b');
      limb(c, 30, -90, 36, -4, 30, '#c2956b');
      poly(c, [-44, -96 + b, 44, -96 + b, 34, -60, -34, -60], '#78350f');
      poly(c, [-56, -96 + b, 56, -96 + b, 66, -200 + b, -66, -200 + b], rad(c, 0, -150 + b, 90, ['#e7b98d', '#a0673f']));
      stroke(c, 3, '#422006');
      c.strokeStyle = '#7c2d12';
      c.lineWidth = 3;
      line(c, -30, -170 + b, -6, -130 + b);
      line(c, 20, -180 + b, 36, -150 + b);
      for (let i = 0; i < 7; i++) ell(c, -36 + i * 12, -192 + b + Math.sin(i / 6 * Math.PI) * 14, 4, 7, '#f5f5f4');
      ell(c, 0, -226 + b, 30, 30, rad(c, 0, -226 + b, 32, ['#e7b98d', '#a0673f']));
      stroke(c, 3, '#422006');
      ell(c, -6, -232 + b, 12, 10, '#fff');
      glow(c, -8, -232 + b, 5, '#dc2626', 14);
      brows(c, -6, -246 + b, 0, 14, 5);
      c.fillStyle = '#422006';
      c.fillRect(-14, -212 + b, 22, 5);
      limb(c, 56, -190 + b, 80, -140 + b, 20, '#c2956b');
      const swing = Math.sin(t * 2) * 0.3;
      c.save();
      c.translate(-60, -186 + b);
      c.rotate(-0.6 + swing);
      limb(c, 0, 0, -30, 20, 20, '#c2956b');
      c.fillStyle = '#78350f';
      c.fillRect(-40, -80, 12, 110);
      rock(c, -34, -96, 32, t * 0.2, '#a8a29e', '#57534e');
      c.restore();
    },

    'Eclipse Dragon'(c, t) {
      const b = Math.sin(t * 2) * 4;
      const flap = Math.sin(t * 4) * 20;
      c.save();
      c.shadowColor = '#fbbf24';
      c.shadowBlur = 40;
      ell(c, 30, -180, 66, 66, '#fbbf24');
      c.restore();
      ell(c, 30, -180, 60, 60, '#0a0a0a');
      batWing(c, 0, -140 + b, 120, flap, '#1e1b4b', -1);
      batWing(c, 20, -140 + b, 120, flap, '#1e1b4b', 1);
      c.beginPath();
      c.moveTo(40, -60);
      c.bezierCurveTo(100, -40, 110, -10, 120 + Math.sin(t * 2) * 10, -20);
      stroke(c, 12, '#18181b');
      [-24, 0, 30, 50].forEach(x => limb(c, x, -60, x - 4, -2, 14, '#18181b'));
      ell(c, 14, -90 + b, 62, 40, rad(c, 14, -90 + b, 64, ['#4c1d95', '#18181b']));
      stroke(c, 3, '#000');
      limb(c, -30, -110 + b, -60, -170 + b, 22, '#18181b');
      const hx = -70, hy = -180 + b;
      poly(c, [hx + 20, hy - 20, hx - 44, hy - 4, hx - 44, hy + 8, hx + 20, hy + 20], '#27272a');
      stroke(c, 3, '#000');
      poly(c, [hx + 10, hy - 16, hx + 36, hy - 50, hx + 22, hy - 10], '#52525b');
      poly(c, [hx - 4, hy - 16, hx + 12, hy - 48, hx + 8, hy - 12], '#52525b');
      glow(c, hx - 12, hy - 6, 5, '#fde68a', 20);
      fangs(c, hx - 28, hy + 8, 12, 8);
      if ((t % 2.5) < 1) flame(c, hx - 60, hy + 4, 12, t);
    },

    'Sludge Goblin'(c, t) {
      const b = Math.sin(t * 3) * 3;
      c.fillStyle = '#3f6212';
      c.fillRect(-30, -42, 18, 42);
      c.fillRect(12, -42, 18, 42);
      ell(c, -24, -3, 17, 7, '#365314');
      ell(c, 24, -3, 17, 7, '#365314');
      ell(c, 0, -72 + b, 46, 42, rad(c, 0, -72 + b, 52, ['#a3e635', '#4d7c0f']));
      poly(c, [-40, -46 + b, 40, -46 + b, 26, -20, -26, -20], '#78350f');
      c.strokeStyle = '#65a30d';
      c.lineWidth = 12;
      line(c, -40, -85 + b, -66, -52 + b);
      line(c, 40, -85 + b, 62, -56 + b);
      poly(c, [-66, -52 + b, -104, -78 + b, -72, -44 + b], '#cbd5e1');
      c.fillStyle = '#78350f';
      c.fillRect(-72, -56 + b, 10, 12);
      const hy = -128 + b;
      poly(c, [-28, hy - 6, -84, hy - 34, -34, hy + 12], '#84cc16');
      poly(c, [28, hy - 6, 84, hy - 34, 34, hy + 12], '#84cc16');
      ell(c, 0, hy, 36, 32, rad(c, 0, hy, 40, ['#bef264', '#65a30d']));
      eye(c, -14, hy - 6, 9, '#facc15');
      eye(c, 14, hy - 6, 9, '#facc15');
      c.fillStyle = '#1a2e05';
      c.beginPath();
      c.ellipse(0, hy + 13, 17, 8, 0, 0, Math.PI);
      c.fill();
      poly(c, [-9, hy + 13, -5, hy + 21, -1, hy + 13], '#fef9c3');
      poly(c, [4, hy + 13, 8, hy + 20, 12, hy + 13], '#fef9c3');
      for (let i = 0; i < 4; i++) {
        const drip = 8 + ((t * 18 + i * 13) % 22);
        ell(c, -30 + i * 20, -44 + drip * 0.5 + b, 4, drip * 0.5, 'rgba(132,204,22,0.85)');
      }
    },

    'Rock Golem'(c, t) {
      const b = Math.sin(t * 1.5) * 2;
      rock(c, -32, -26, 28, 0.2);
      rock(c, 32, -26, 28, -0.3);
      rock(c, 0, -98 + b, 62, 0.1);
      rock(c, -76, -112 + b, 30, 0.5);
      rock(c, 76, -112 + b, 30, -0.4);
      rock(c, -88, -60 + b, 27, 1);
      rock(c, 88, -60 + b, 27, 0.3);
      rock(c, 0, -170 + b, 32, 0.3);
      c.save();
      c.shadowColor = '#f97316';
      c.shadowBlur = 12;
      c.strokeStyle = '#fb923c';
      c.lineWidth = 3;
      c.beginPath();
      c.moveTo(-22, -125 + b); c.lineTo(-6, -104 + b); c.lineTo(-16, -84 + b); c.lineTo(4, -66 + b);
      c.moveTo(26, -120 + b); c.lineTo(14, -98 + b); c.lineTo(30, -80 + b);
      c.stroke();
      ell(c, -12, -172 + b, 7, 4, '#fdba74');
      ell(c, 12, -172 + b, 7, 4, '#fdba74');
      c.fillStyle = '#fb923c';
      c.fillRect(-10, -156 + b, 20, 3);
      c.restore();
      ell(c, -4, -198 + b, 18, 6, '#4d7c0f');
      ell(c, 44, -136 + b, 11, 4, '#4d7c0f');
      ell(c, -60, -128 + b, 9, 4, '#65a30d');
    },

    'Shadow Wolf'(c, t) {
      const b = Math.sin(t * 4) * 2;
      for (let i = 0; i < 6; i++) {
        const a = (t * 0.8 + i / 6) % 1;
        c.globalAlpha = 0.45 * (1 - a);
        ell(c, 70 - i * 22 + Math.sin(i + t) * 8, -70 - a * 90, 10 + a * 12, 10 + a * 12, '#7c3aed');
      }
      c.globalAlpha = 1;
      c.fillStyle = '#1e1b4b';
      c.beginPath();
      c.moveTo(62, -88 + b);
      c.quadraticCurveTo(128, -118 + Math.sin(t * 3) * 10, 112, -152);
      c.quadraticCurveTo(104, -104, 56, -70 + b);
      c.fill();
      poly(c, [40, -64, 62, -64, 66, 0, 46, 0], '#1e1b4b');
      poly(c, [18, -58, 38, -58, 34, 0, 20, 0], '#312e81');
      poly(c, [-52, -64, -32, -64, -36, 0, -54, 0], '#1e1b4b');
      poly(c, [-30, -62, -14, -62, -18, 0, -32, 0], '#312e81');
      ell(c, 6, -80 + b, 72, 34, lin(c, 0, -115, 0, -45, ['#3730a3', '#0f0a2e']));
      for (let i = 0; i < 5; i++) poly(c, [-30 + i * 20, -108 + b, -20 + i * 20, -124 + b, -12 + i * 20, -108 + b], '#1e1b4b');
      poly(c, [-56, -100 + b, -74, -52 + b, -40, -64 + b], '#312e81');
      const hx = -72, hy = -110 + b;
      ell(c, hx, hy, 32, 26, '#1e1b4b');
      poly(c, [hx - 18, hy - 8, hx - 72, hy + 6, hx - 68, hy + 20, hx - 14, hy + 24], '#1e1b4b');
      poly(c, [hx - 4, hy - 20, hx + 6, hy - 58, hx + 18, hy - 18], '#312e81');
      poly(c, [hx + 12, hy - 18, hx + 30, hy - 52, hx + 32, hy - 8], '#1e1b4b');
      ell(c, hx - 70, hy + 8, 6, 5, '#000');
      for (let i = 0; i < 4; i++) poly(c, [hx - 62 + i * 11, hy + 20, hx - 58 + i * 11, hy + 31, hx - 54 + i * 11, hy + 20], '#e5e7eb');
      glow(c, hx - 20, hy - 5, 6, '#ef4444', 18);
    },

    'Iron Bandit'(c, t) {
      const b = Math.sin(t * 2) * 2;
      c.fillStyle = '#374151';
      c.fillRect(-30, -72, 22, 72);
      c.fillRect(8, -72, 22, 72);
      c.fillStyle = '#111827';
      c.fillRect(-34, -12, 28, 12);
      c.fillRect(6, -12, 28, 12);
      c.fillStyle = lin(c, -45, 0, 45, 0, ['#6b7280', '#e5e7eb', '#6b7280']);
      c.fillRect(-45, -152 + b, 90, 86);
      c.strokeStyle = '#374151';
      c.lineWidth = 3;
      c.strokeRect(-45, -152 + b, 90, 86);
      [[-38, -145], [38, -145], [-38, -74], [38, -74]].forEach(([x, y]) => ell(c, x, y + b, 3, 3, '#374151'));
      c.strokeStyle = '#92400e';
      c.lineWidth = 8;
      line(c, -40, -148 + b, 40, -84 + b);
      c.fillStyle = '#78350f';
      c.fillRect(-46, -82 + b, 92, 10);
      c.fillStyle = '#facc15';
      c.fillRect(-8, -84 + b, 16, 14);
      c.fillStyle = '#9ca3af';
      c.fillRect(-66, -148 + b, 20, 62);
      c.fillRect(46, -148 + b, 20, 62);
      ell(c, -56, -150 + b, 17, 12, '#6b7280');
      ell(c, 56, -150 + b, 17, 12, '#6b7280');
      c.fillStyle = '#1f2937';
      c.fillRect(-100, -96 + b, 44, 10);
      c.fillRect(-66, -90 + b, 8, 20);
      c.fillStyle = '#78350f';
      c.fillRect(-104, -100 + b, 8, 18);
      const hy = -184 + b;
      c.fillStyle = lin(c, -28, 0, 28, 0, ['#4b5563', '#e5e7eb', '#4b5563']);
      c.beginPath();
      c.roundRect(-28, hy - 30, 56, 60, [26, 26, 6, 6]);
      c.fill();
      poly(c, [-29, hy + 5, 29, hy + 5, 26, hy + 30, 0, hy + 40, -26, hy + 30], '#dc2626');
      poly(c, [26, hy + 8, 50, hy + 20 + Math.sin(t * 5) * 5, 40, hy + 32], '#b91c1c');
      c.fillStyle = '#111';
      c.fillRect(-22, hy - 9, 44, 9);
      glow(c, -10, hy - 4, 3, '#fde047');
      glow(c, 10, hy - 4, 3, '#fde047');
      c.fillStyle = '#6b7280';
      c.fillRect(-3, hy - 40, 6, 12);
    },

    'Swamp Troll'(c, t) {
      const b = Math.sin(t * 1.8) * 3;
      c.fillStyle = '#4d5a2a';
      c.fillRect(-46, -62, 30, 62);
      c.fillRect(16, -62, 30, 62);
      ell(c, -31, -3, 23, 8, '#3f4a22');
      ell(c, 31, -3, 23, 8, '#3f4a22');
      ell(c, 0, -108 + b, 72, 64, rad(c, 0, -108 + b, 76, ['#8fae62', '#3f5a2a']));
      ell(c, 0, -92 + b, 44, 38, '#a3b77a');
      c.strokeStyle = '#5f7a3a';
      c.lineWidth = 24;
      line(c, -60, -134 + b, -92, -72 + b);
      line(c, 60, -134 + b, 82, -62 + b);
      c.save();
      c.translate(-94, -72 + b);
      c.rotate(-0.5 + Math.sin(t * 1.8) * 0.12);
      poly(c, [-6, 0, 6, 0, 14, -88, -14, -88], '#78350f');
      ell(c, 0, -96, 21, 17, '#92400e');
      for (let i = 0; i < 5; i++) poly(c, [-18 + i * 9, -106, -14 + i * 9, -122, -10 + i * 9, -106], '#d6d3d1');
      c.restore();
      const hy = -180 + b;
      ell(c, 0, hy, 40, 32, '#6b8a45');
      ell(c, -14, hy - 6, 7, 6, '#fde68a');
      ell(c, 14, hy - 6, 7, 6, '#fde68a');
      ell(c, -15, hy - 6, 3, 3, '#000');
      ell(c, 13, hy - 6, 3, 3, '#000');
      c.fillStyle = '#4d5a2a';
      c.fillRect(-26, hy - 19, 52, 7);
      ell(c, 0, hy + 4, 10, 7, '#556b2f');
      c.fillStyle = '#1c1917';
      c.fillRect(-20, hy + 14, 40, 8);
      poly(c, [-18, hy + 20, -12, hy + 2, -7, hy + 20], '#fef3c7');
      poly(c, [7, hy + 20, 12, hy + 2, 18, hy + 20], '#fef3c7');
      ell(c, -18, hy - 30, 18, 7, '#365314');
      ell(c, 42, -154 + b, 14, 6, '#365314');
      ell(c, -48, -80 + b, 10, 4, '#365314');
      for (let i = 0; i < 3; i++) ell(c, 30 + i * 10, -150 + b + ((t * 25 + i * 9) % 30), 2.5, 4, '#4d7c0f');
    },

    'Fire Imp'(c, t) {
      const y0 = -96 + Math.sin(t * 4) * 8;
      flame(c, 72, y0 - 18, 11, t + 1);
      c.fillStyle = '#7f1d1d';
      [-1, 1].forEach(s => {
        const flap = Math.sin(t * 10) * 10;
        c.beginPath();
        c.moveTo(s * 15, y0 - 20);
        c.quadraticCurveTo(s * 80, y0 - 84 + flap, s * 88, y0 - 10);
        c.lineTo(s * 66, y0 - 24);
        c.lineTo(s * 56, y0);
        c.lineTo(s * 40, y0 - 14);
        c.closePath();
        c.fill();
      });
      const sw = Math.sin(t * 3) * 10;
      c.strokeStyle = '#dc2626';
      c.lineWidth = 5;
      c.beginPath();
      c.moveTo(10, y0 + 25);
      c.quadraticCurveTo(52, y0 + 58, 40 + sw, y0 + 80);
      c.stroke();
      poly(c, [32 + sw, y0 + 78, 52 + sw, y0 + 82, 40 + sw, y0 + 96], '#dc2626');
      ell(c, 0, y0 + 10, 26, 30, rad(c, 0, y0 + 10, 32, ['#f87171', '#b91c1c']));
      c.strokeStyle = '#b91c1c';
      c.lineWidth = 7;
      line(c, -10, y0 + 35, -16, y0 + 56);
      line(c, 10, y0 + 35, 16, y0 + 56);
      c.lineWidth = 6;
      line(c, -20, y0, -38, y0 + 6);
      ell(c, 0, y0 - 30, 26, 24, rad(c, 0, y0 - 30, 28, ['#fca5a5', '#dc2626']));
      poly(c, [-18, y0 - 44, -32, y0 - 80, -8, y0 - 50], '#fbbf24');
      poly(c, [18, y0 - 44, 32, y0 - 80, 8, y0 - 50], '#fbbf24');
      glow(c, -9, y0 - 32, 5, '#fde047');
      glow(c, 9, y0 - 32, 5, '#fde047');
      c.strokeStyle = '#450a0a';
      c.lineWidth = 3;
      c.beginPath();
      c.arc(0, y0 - 24, 10, 0.2, Math.PI - 0.2);
      c.stroke();
      flame(c, -42, y0 + 4, 10, t * 1.3);
    },

    'Storm Serpent'(c, t) {
      const pts = [];
      for (let i = 0; i <= 24; i++) {
        const u = i / 24;
        pts.push([92 - u * 150, -20 - u * 140 + Math.sin(u * 9 - t * 3) * 20 * (1 - u * 0.5)]);
      }
      pts.forEach(([x, y], i) => {
        const r = 8 + i * 0.9;
        ell(c, x, y, r, r, i % 2 ? '#1d4ed8' : '#2563eb');
        if (i % 3 === 0) poly(c, [x - 4, y - r, x, y - r - 12, x + 6, y - r], '#7dd3fc');
      });
      pts.forEach(([x, y], i) => {
        if (i % 2) return;
        const r = 8 + i * 0.9;
        ell(c, x, y + r * 0.45, r * 0.6, r * 0.3, '#93c5fd');
      });
      const [hx, hy] = pts[pts.length - 1];
      poly(c, [hx + 4, hy - 14, hx + 32, hy - 46, hx + 22, hy - 8], '#7dd3fc');
      poly(c, [hx - 6, hy - 18, hx + 10, hy - 52, hx + 8, hy - 14], '#38bdf8');
      ell(c, hx - 12, hy, 34, 22, rad(c, hx - 12, hy, 36, ['#3b82f6', '#1e3a8a']));
      poly(c, [hx - 40, hy + 4, hx - 58, hy + 14, hx - 24, hy + 18], '#1e3a8a');
      poly(c, [hx - 42, hy + 6, hx - 38, hy + 14, hx - 34, hy + 6], '#fff');
      poly(c, [hx - 30, hy + 8, hx - 26, hy + 16, hx - 22, hy + 8], '#fff');
      glow(c, hx - 24, hy - 7, 5, '#fef08a', 18);
      if (Math.sin(t * 7) > 0.3) {
        c.save();
        c.strokeStyle = '#fef08a';
        c.shadowColor = '#fef08a';
        c.shadowBlur = 12;
        c.lineWidth = 3;
        bolt(c, hx + 40, hy - 60, hx + 8, hy - 6);
        bolt(c, 50, -150, 64, -60);
        c.restore();
      }
    },

    'Bone Reaper'(c, t) {
      const b = Math.sin(t * 2) * 5;
      c.strokeStyle = '#57534e';
      c.lineWidth = 6;
      line(c, -72, -8 + b, -42, -212 + b);
      c.fillStyle = lin(c, -150, -200, -40, -200, ['#94a3b8', '#f1f5f9']);
      c.beginPath();
      c.moveTo(-40, -212 + b);
      c.quadraticCurveTo(-122, -224 + b, -152, -160 + b);
      c.quadraticCurveTo(-112, -196 + b, -46, -196 + b);
      c.closePath();
      c.fill();
      c.fillStyle = lin(c, 0, -170, 0, 0, ['#27272a', '#09090b']);
      c.beginPath();
      c.moveTo(-30, -160 + b);
      c.lineTo(30, -160 + b);
      c.lineTo(60, -10);
      for (let i = 0; i < 5; i++) c.lineTo(48 - i * 24, (i % 2 ? -22 : 0) + Math.sin(t * 4 + i) * 4);
      c.lineTo(-60, -10);
      c.closePath();
      c.fill();
      c.strokeStyle = '#d6d3d1';
      c.lineWidth = 3;
      for (let i = 0; i < 4; i++) {
        c.beginPath();
        c.arc(0, -128 + b + i * 10, 16 - i * 2, Math.PI * 0.15, Math.PI * 0.85);
        c.stroke();
      }
      ell(c, 0, -168 + b, 34, 40, '#18181b');
      ell(c, -4, -164 + b, 20, 22, '#f5f5f4');
      ell(c, -11, -168 + b, 6, 7, '#000');
      ell(c, 4, -168 + b, 6, 7, '#000');
      glow(c, -11, -168 + b, 2.5, '#22d3ee', 16);
      glow(c, 4, -168 + b, 2.5, '#22d3ee', 16);
      poly(c, [-4, -158 + b, -1, -152 + b, -8, -152 + b], '#000');
      c.fillStyle = '#000';
      for (let i = 0; i < 5; i++) c.fillRect(-14 + i * 5, -148 + b, 3, 6);
      c.strokeStyle = '#f5f5f4';
      c.lineWidth = 4;
      line(c, -26, -118 + b, -58, -108 + b);
      line(c, -26, -104 + b, -62, -70 + b);
      ell(c, -60, -108 + b, 6, 5, '#f5f5f4');
      ell(c, -64, -70 + b, 6, 5, '#f5f5f4');
    },

    'Void Wraith'(c, t) {
      const y0 = -124 + Math.sin(t * 2) * 10;
      c.save();
      c.shadowColor = '#a855f7';
      c.shadowBlur = 30;
      c.fillStyle = lin(c, 0, y0 - 75, 0, y0 + 100, ['#3b2f8f', '#1e1b4b', 'rgba(30,27,75,0.1)']);
      c.beginPath();
      c.moveTo(0, y0 - 76);
      c.bezierCurveTo(56, y0 - 76, 60, y0 - 10, 56, y0 + 40);
      for (let i = 0; i <= 6; i++) c.lineTo(56 - (i * 112) / 6, y0 + 70 + (i % 2 ? -22 : 14) + Math.sin(t * 5 + i) * 10);
      c.bezierCurveTo(-60, y0 - 10, -56, y0 - 76, 0, y0 - 76);
      c.fill();
      c.restore();
      c.strokeStyle = '#312e81';
      c.lineWidth = 10;
      const reach = Math.sin(t * 3) * 10;
      c.beginPath();
      c.moveTo(-40, y0 - 8);
      c.quadraticCurveTo(-82, y0 - 30, -102, y0 + reach);
      c.stroke();
      c.strokeStyle = '#c4b5fd';
      c.lineWidth = 3;
      for (let i = -1; i <= 1; i++) line(c, -102, y0 + reach, -118, y0 + reach + i * 9);
      c.save();
      c.translate(0, y0 + 12);
      c.rotate(t * 2);
      ['#c084fc', '#7c3aed', '#e9d5ff'].forEach((col, i) => {
        c.strokeStyle = col;
        c.lineWidth = 3;
        c.beginPath();
        c.arc(0, 0, 8 + i * 7, i, i + Math.PI * 1.3);
        c.stroke();
      });
      c.restore();
      glow(c, -16, y0 - 40, 8, '#e879f9', 22);
      glow(c, 12, y0 - 40, 8, '#e879f9', 22);
      ell(c, -2, y0 - 16, 10, 6 + Math.sin(t * 3) * 3, '#0b0620');
    },

    'Toxic Slime'(c, t) {
      const sq = Math.sin(t * 3);
      const w = 86 + sq * 8, h = 82 - sq * 8;
      ell(c, 0, 0, w + 20, 10, 'rgba(132,204,22,0.55)');
      c.save();
      c.shadowColor = '#84cc16';
      c.shadowBlur = 22;
      c.fillStyle = rad(c, 0, -h * 0.6, w, ['#d9f99d', '#84cc16', '#3f6212']);
      c.beginPath();
      c.moveTo(-w, 0);
      c.bezierCurveTo(-w, -h * 1.6, w, -h * 1.6, w, 0);
      c.closePath();
      c.fill();
      c.restore();
      c.globalAlpha = 0.35;
      ell(c, 26, -42, 16, 14, '#fff');
      c.fillRect(19, -32, 14, 8);
      ell(c, 20, -44, 4, 4, '#000');
      ell(c, 32, -44, 4, 4, '#000');
      c.globalAlpha = 1;
      for (let i = 0; i < 6; i++) {
        const u = (t * 0.4 + i / 6) % 1;
        const r = 3 + (i % 3) * 2;
        ell(c, -50 + i * 20 + Math.sin(t + i) * 5, -10 - u * h * 1.05, r, r, `rgba(236,252,203,${0.8 * (1 - u)})`);
      }
      eye(c, -26, -h * 0.95, 13, '#be123c');
      eye(c, 6, -h * 1.02, 10, '#be123c');
      c.fillStyle = '#1a2e05';
      c.beginPath();
      c.ellipse(-12, -h * 0.55, 22, 11, 0, 0, Math.PI);
      c.fill();
      poly(c, [-26, -h * 0.55, -22, -h * 0.55 + 7, -18, -h * 0.55], '#ecfccb');
      poly(c, [-4, -h * 0.55, 0, -h * 0.55 + 6, 4, -h * 0.55], '#ecfccb');
    },

    'Rogue Drone'(c, t) {
      const y0 = -124 + Math.sin(t * 3) * 8;
      ell(c, 0, y0 + 46, 22, 6, 'rgba(56,189,248,0.5)');
      c.strokeStyle = '#475569';
      c.lineWidth = 8;
      line(c, -72, y0 - 30, 72, y0 - 30);
      [-76, 76].forEach(x => {
        c.fillStyle = '#334155';
        c.fillRect(x - 6, y0 - 42, 12, 16);
        const spin = Math.abs(Math.sin(t * 40)) * 36 + 6;
        ell(c, x, y0 - 45, spin, 4, 'rgba(203,213,225,0.75)');
      });
      c.fillStyle = lin(c, 0, y0 - 40, 0, y0 + 36, ['#94a3b8', '#334155']);
      c.beginPath();
      c.roundRect(-46, y0 - 36, 92, 66, 18);
      c.fill();
      c.save();
      c.beginPath();
      c.rect(-46, y0 + 18, 92, 10);
      c.clip();
      for (let i = 0; i < 7; i++) poly(c, [-50 + i * 16, y0 + 28, -42 + i * 16, y0 + 18, -34 + i * 16, y0 + 18, -42 + i * 16, y0 + 28], '#facc15');
      c.restore();
      ell(c, -10, y0 - 4, 21, 21, '#0f172a');
      glow(c, -13, y0 - 4, 9, '#ef4444', 24);
      ell(c, -16, y0 - 8, 3, 3, '#fecaca');
      c.strokeStyle = '#64748b';
      c.lineWidth = 3;
      line(c, 22, y0 - 36, 32, y0 - 66);
      ell(c, 32, y0 - 68, 4, 4, Math.sin(t * 6) > 0 ? '#ef4444' : '#7f1d1d');
      c.fillStyle = '#1e293b';
      c.fillRect(-64, y0 + 30, 52, 10);
      c.fillRect(-22, y0 + 28, 14, 16);
    },

    'Frost Yeti'(c, t) {
      const b = Math.sin(t * 1.6) * 3;
      ell(c, -32, -26, 24, 30, '#e2e8f0');
      ell(c, 32, -26, 24, 30, '#e2e8f0');
      ell(c, 0, -112 + b, 70, 70, rad(c, 0, -112 + b, 74, ['#ffffff', '#cbd5e1']));
      for (let i = 0; i < 9; i++) {
        const a = Math.PI * 0.6 + (i / 8) * Math.PI * 1.8;
        const x = Math.cos(a) * 68, y = -112 + b + Math.sin(a) * 68;
        poly(c, [x - 8, y, x + Math.cos(a) * 14, y + Math.sin(a) * 14, x + 8, y], '#f1f5f9');
      }
      ell(c, -74, -96 + b, 21, 50, '#f1f5f9', 0.3);
      ell(c, 74, -96 + b, 21, 50, '#f1f5f9', -0.3);
      [-1, 0, 1].forEach(i => {
        poly(c, [-90 + i * 8, -52 + b, -86 + i * 8, -38 + b, -82 + i * 8, -52 + b], '#475569');
        poly(c, [90 + i * 8, -52 + b, 86 + i * 8, -38 + b, 82 + i * 8, -52 + b], '#475569');
      });
      const hy = -188 + b;
      c.strokeStyle = '#64748b';
      c.lineWidth = 9;
      [-1, 1].forEach(s => {
        c.beginPath();
        c.moveTo(s * 28, hy - 20);
        c.quadraticCurveTo(s * 64, hy - 28, s * 52, hy - 62);
        c.stroke();
      });
      ell(c, 0, hy, 42, 38, '#f8fafc');
      ell(c, 0, hy + 6, 28, 24, '#7dd3fc');
      ell(c, -10, hy, 5, 5, '#0c4a6e');
      ell(c, 10, hy, 5, 5, '#0c4a6e');
      poly(c, [-28, hy - 10, 0, hy - 4, 28, hy - 10, 28, hy - 18, -28, hy - 18], '#e2e8f0');
      c.fillStyle = '#0c4a6e';
      c.beginPath();
      c.ellipse(0, hy + 14, 14, 9, 0, 0, Math.PI);
      c.fill();
      poly(c, [-10, hy + 14, -7, hy + 22, -4, hy + 14], '#fff');
      poly(c, [4, hy + 14, 7, hy + 22, 10, hy + 14], '#fff');
      [[-40, -44], [-20, -44], [30, -44], [50, -44]].forEach(([x, y]) => poly(c, [x - 4, y + b, x, y + 14 + b, x + 4, y + b], '#bae6fd'));
      for (let i = 0; i < 10; i++) {
        ell(c, ((i * 47 + t * 18) % 240) - 120, ((i * 31 + t * 40) % 240) - 230, 2, 2, '#fff');
      }
    },

    'Sand Viper'(c, t) {
      const sway = Math.sin(t * 2) * 8;
      for (let i = 0; i < 3; i++) {
        const cy = -18 - i * 22, rx = 82 - i * 18;
        ell(c, 0, cy, rx, 22, i % 2 ? '#d6a35c' : '#c28a45');
        for (let j = -2; j <= 2; j++) {
          const x = j * rx * 0.35;
          poly(c, [x - 7, cy, x, cy - 8, x + 7, cy, x, cy + 8], '#7c4a1c');
        }
      }
      c.strokeStyle = '#c28a45';
      c.lineWidth = 28;
      c.beginPath();
      c.moveTo(0, -74);
      c.quadraticCurveTo(44, -124 + sway, -20 + sway, -168);
      c.stroke();
      const hx = -24 + sway, hy = -176;
      ell(c, hx, hy + 12, 42, 52, '#b07535');
      ell(c, hx, hy + 18, 22, 38, '#f5deb3');
      ell(c, hx - 26, hy, 6, 8, '#3f2a14');
      ell(c, hx + 26, hy, 6, 8, '#3f2a14');
      ell(c, hx - 10, hy - 36, 26, 18, '#c28a45');
      ell(c, hx - 20, hy - 42, 6, 6, '#facc15');
      ell(c, hx - 20, hy - 42, 1.5, 5, '#000');
      c.fillStyle = '#3f1d0b';
      c.beginPath();
      c.moveTo(hx - 34, hy - 34);
      c.lineTo(hx - 58, hy - 30);
      c.lineTo(hx - 34, hy - 22);
      c.closePath();
      c.fill();
      poly(c, [hx - 40, hy - 34, hx - 38, hy - 22, hx - 36, hy - 33], '#fff');
      if (Math.sin(t * 5) > 0) {
        c.strokeStyle = '#dc2626';
        c.lineWidth = 3;
        line(c, hx - 50, hy - 30, hx - 72, hy - 30);
        line(c, hx - 72, hy - 30, hx - 80, hy - 36);
        line(c, hx - 72, hy - 30, hx - 80, hy - 24);
      }
    },

    'Molten Brute'(c, t) {
      const b = Math.sin(t * 2) * 3;
      c.fillStyle = '#1c1917';
      c.fillRect(-48, -64, 34, 64);
      c.fillRect(14, -64, 34, 64);
      poly(c, [-82, -172 + b, 82, -172 + b, 52, -62, -52, -62], '#292524');
      c.strokeStyle = '#1c1917';
      c.lineWidth = 30;
      line(c, -74, -160 + b, -98, -84 + b);
      line(c, 74, -160 + b, 96, -84 + b);
      ell(c, -100, -70 + b, 32, 28, '#1c1917');
      ell(c, 98, -70 + b, 30, 26, '#1c1917');
      c.save();
      c.shadowColor = '#f97316';
      c.shadowBlur = 14;
      c.strokeStyle = '#fb923c';
      c.lineWidth = 4;
      c.beginPath();
      c.moveTo(-50, -160 + b); c.lineTo(-20, -130 + b); c.lineTo(-34, -100 + b); c.lineTo(-10, -72 + b);
      c.moveTo(40, -165 + b); c.lineTo(18, -128 + b); c.lineTo(36, -96 + b);
      c.moveTo(-86, -160 + b); c.lineTo(-96, -100 + b);
      c.stroke();
      [-114, -100, -86].forEach(x => ell(c, x, -62 + b, 4, 3, '#fdba74'));
      c.restore();
      ell(c, 0, -190 + b, 28, 25, '#1c1917');
      flame(c, 0, -208 + b, 18, t);
      glow(c, -10, -192 + b, 5, '#fde047', 18);
      glow(c, 10, -192 + b, 5, '#fde047', 18);
      c.save();
      c.shadowColor = '#f97316';
      c.shadowBlur = 10;
      c.fillStyle = '#f97316';
      c.fillRect(-12, -178 + b, 24, 4);
      c.restore();
      for (let i = 0; i < 3; i++) {
        const d = (t * 40 + i * 20) % 60;
        ell(c, -112 + i * 12, -44 + b + d, 3, 4, `rgba(249,115,22,${1 - d / 60})`);
      }
    },

    'Crystal Spider'(c, t) {
      const b = Math.sin(t * 3) * 3;
      poly(c, [36, -60 + b, 68, -118 + b, 116, -90 + b, 108, -40 + b, 62, -28 + b], lin(c, 40, -120, 110, -30, ['#cffafe', '#22d3ee', '#0e7490']));
      c.strokeStyle = 'rgba(255,255,255,0.6)';
      c.lineWidth = 2;
      line(c, 68, -118 + b, 76, -60 + b);
      line(c, 76, -60 + b, 116, -90 + b);
      line(c, 76, -60 + b, 62, -28 + b);
      c.strokeStyle = '#0e7490';
      c.lineWidth = 7;
      [-1, 1].forEach(s => {
        for (let i = 0; i < 4; i++) {
          const step = Math.sin(t * 6 + i + (s > 0 ? 1.5 : 0)) * 5;
          c.beginPath();
          c.moveTo(s * 18 - 10, -64 + b + i * 5);
          c.lineTo(s * (52 + i * 14) - 10, -124 + i * 12 + b + step);
          c.lineTo(s * (74 + i * 22) - 10, 0);
          c.stroke();
        }
      });
      ell(c, -10, -66 + b, 40, 30, rad(c, -10, -66 + b, 42, ['#a5f3fc', '#0891b2', '#164e63']));
      [[-20, -92, 12], [0, -96, 16], [18, -88, 11]].forEach(([x, y, h]) => poly(c, [x - 6, y + b, x, y - h + b, x + 6, y + b], 'rgba(103,232,249,0.9)'));
      [[-38, -76], [-30, -80], [-40, -66], [-30, -68], [-22, -74], [-24, -64]].forEach(([x, y], i) => glow(c, x, y + b, i < 2 ? 4 : 3, '#e879f9', 10));
      poly(c, [-44, -48 + b, -40, -32 + b, -36, -48 + b], '#e0f2fe');
      poly(c, [-30, -46 + b, -28, -30 + b, -24, -46 + b], '#e0f2fe');
      for (let i = 0; i < 4; i++) {
        const a = (t * 1.5 + i * 0.7) % 1;
        c.globalAlpha = 1 - a;
        const sx = -60 + i * 45, sy = -150 + i * 20;
        poly(c, [sx, sy - 6, sx + 2, sy, sx, sy + 6, sx - 2, sy], '#fff');
        poly(c, [sx - 6, sy, sx, sy - 2, sx + 6, sy, sx, sy + 2], '#fff');
      }
      c.globalAlpha = 1;
    },

    'Grimjaw the Cruel'(c, t) {
      const b = Math.sin(t * 1.5) * 3;
      c.fillStyle = '#4b3f52';
      c.fillRect(-56, -70, 40, 70);
      c.fillRect(16, -70, 40, 70);
      ell(c, 0, -120 + b, 90, 76, rad(c, 0, -120 + b, 92, ['#8b7a94', '#4b3f52']));
      c.fillStyle = '#44403c';
      c.fillRect(-90, -84 + b, 180, 16);
      [-1, 1].forEach(s => {
        ell(c, s * 78, -170 + b, 32, 22, '#71717a');
        for (let i = 0; i < 3; i++) poly(c, [s * (60 + i * 16), -186 + b, s * (66 + i * 16), -216 + b, s * (72 + i * 16), -186 + b], '#d4d4d8');
      });
      c.strokeStyle = '#6b5b73';
      c.lineWidth = 30;
      line(c, 70, -150 + b, 98, -80 + b);
      line(c, -70, -150 + b, -96, -100 + b);
      const swing = Math.sin(t * 2.2) * 0.5;
      const fx = -96 + Math.cos(Math.PI * 0.75 + swing) * 70, fy = -100 + b - Math.sin(Math.PI * 0.75 + swing) * 70;
      c.strokeStyle = '#a1a1aa';
      c.lineWidth = 4;
      c.setLineDash([6, 4]);
      line(c, -96, -100 + b, fx, fy);
      c.setLineDash([]);
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * TAU + t;
        poly(c, [fx + Math.cos(a - 0.3) * 18, fy + Math.sin(a - 0.3) * 18, fx + Math.cos(a) * 32, fy + Math.sin(a) * 32, fx + Math.cos(a + 0.3) * 18, fy + Math.sin(a + 0.3) * 18], '#9ca3af');
      }
      ell(c, fx, fy, 20, 20, rad(c, fx, fy, 22, ['#a1a1aa', '#3f3f46']));
      const hy = -206 + b;
      ell(c, 0, hy, 46, 36, '#7c6a85');
      c.fillStyle = '#5b4a63';
      c.beginPath();
      c.roundRect(-54, hy + 4, 108, 44, 18);
      c.fill();
      for (let i = 0; i < 5; i++) poly(c, [-44 + i * 20, hy + 10, -38 + i * 20, hy - 2 - (i % 2) * 4, -32 + i * 20, hy + 10], '#d4d4d8');
      poly(c, [-50, hy + 8, -44, hy - 14, -36, hy + 8], '#fef3c7');
      poly(c, [36, hy + 8, 44, hy - 14, 50, hy + 8], '#fef3c7');
      c.strokeStyle = '#2e2533';
      c.lineWidth = 6;
      line(c, -30, hy - 34, -6, hy - 26);
      line(c, 30, hy - 34, 6, hy - 26);
      glow(c, -16, hy - 20, 5, '#ef4444', 20);
      glow(c, 16, hy - 20, 5, '#ef4444', 20);
      c.strokeStyle = '#fca5a5';
      c.lineWidth = 3;
      line(c, 20, hy - 34, 34, hy + 2);
      for (let i = -1; i <= 1; i++) line(c, 22 + i * 0, hy - 26 + i * 10, 34, hy - 30 + i * 10);
    },

    'Obsidian Warlord'(c, t) {
      const b = Math.sin(t * 1.6) * 2;
      const wave = Math.sin(t * 3) * 8;
      c.fillStyle = lin(c, 0, -190, 0, 0, ['#991b1b', '#450a0a']);
      c.beginPath();
      c.moveTo(-50, -178 + b);
      c.lineTo(50, -178 + b);
      c.quadraticCurveTo(90 + wave, -90, 80 + wave, -6);
      c.lineTo(-40 + wave, -6);
      c.closePath();
      c.fill();
      c.fillStyle = '#18181b';
      c.fillRect(-40, -76, 30, 76);
      c.fillRect(10, -76, 30, 76);
      c.fillStyle = lin(c, -55, 0, 55, 0, ['#09090b', '#52525b', '#09090b']);
      poly(c, [-58, -180 + b, 58, -180 + b, 44, -76 + b, -44, -76 + b], c.fillStyle);
      [-1, 1].forEach(s => {
        ell(c, s * 66, -176 + b, 28, 20, '#27272a');
        poly(c, [s * 56, -190 + b, s * 90, -214 + b, s * 80, -178 + b], '#3f3f46');
      });
      c.save();
      c.shadowColor = '#ef4444';
      c.shadowBlur = 12;
      c.strokeStyle = '#f87171';
      c.lineWidth = 3;
      c.beginPath();
      c.moveTo(0, -168 + b); c.lineTo(-14, -140 + b); c.lineTo(0, -112 + b); c.lineTo(14, -140 + b); c.closePath();
      c.moveTo(0, -112 + b); c.lineTo(0, -86 + b);
      c.stroke();
      c.restore();
      c.save();
      c.translate(-70, -120 + b);
      c.rotate(-0.55 + Math.sin(t * 1.6) * 0.08);
      c.fillStyle = '#78350f';
      c.fillRect(-5, -10, 10, 40);
      c.fillStyle = '#a16207';
      c.fillRect(-24, -14, 48, 8);
      c.shadowColor = '#dc2626';
      c.shadowBlur = 14;
      poly(c, [-12, -14, 12, -14, 8, -150, 0, -170, -8, -150], lin(c, -12, 0, 12, 0, ['#18181b', '#71717a', '#18181b']));
      c.restore();
      c.strokeStyle = '#27272a';
      c.lineWidth = 20;
      line(c, -54, -166 + b, -70, -120 + b);
      const hy = -214 + b;
      c.strokeStyle = '#d4d4d8';
      c.lineWidth = 8;
      [-1, 1].forEach(s => {
        c.beginPath();
        c.moveTo(s * 22, hy - 16);
        c.quadraticCurveTo(s * 70, hy - 20, s * 60, hy - 64);
        c.stroke();
      });
      c.fillStyle = lin(c, -30, 0, 30, 0, ['#09090b', '#3f3f46', '#09090b']);
      c.beginPath();
      c.roundRect(-30, hy - 32, 60, 66, [28, 28, 10, 10]);
      c.fill();
      c.save();
      c.shadowColor = '#ef4444';
      c.shadowBlur = 18;
      c.fillStyle = '#ef4444';
      c.fillRect(-22, hy - 6, 44, 6);
      c.fillRect(-3, hy - 6, 6, 26);
      c.restore();
    },

    'The Hollow King'(c, t) {
      const b = Math.sin(t * 1.8) * 6;
      c.fillStyle = lin(c, 0, -180, 0, 0, ['#581c87', '#2e1065']);
      c.beginPath();
      c.moveTo(-34, -168 + b);
      c.lineTo(34, -168 + b);
      c.lineTo(76, -6);
      for (let i = 0; i < 6; i++) c.lineTo(62 - i * 26, (i % 2 ? -16 : 0) + Math.sin(t * 3 + i) * 4);
      c.lineTo(-76, -6);
      c.closePath();
      c.fill();
      c.strokeStyle = '#facc15';
      c.lineWidth = 5;
      line(c, -34, -168 + b, -76, -6);
      line(c, 34, -168 + b, 76, -6);
      ell(c, 0, -118 + b, 26, 44, '#0b0616');
      ell(c, 0, -176 + b, 40, 44, '#3b0764');
      ell(c, 0, -170 + b, 28, 32, '#05020a');
      glow(c, -11, -174 + b, 6, '#38bdf8', 24);
      glow(c, 11, -174 + b, 6, '#38bdf8', 24);
      for (let i = 0; i < 5; i++) {
        const a = (t * 0.7 + i / 5) % 1;
        c.globalAlpha = 1 - a;
        ell(c, -11 + Math.sin(t * 3 + i) * 4, -180 + b - a * 30, 3 - a * 2, 5 - a * 3, '#7dd3fc');
      }
      c.globalAlpha = 1;
      const cy = -236 + b + Math.sin(t * 2.5) * 5;
      c.save();
      c.shadowColor = '#fde047';
      c.shadowBlur = 16;
      poly(c, [-32, cy + 14, -32, cy - 8, -18, cy + 2, -8, cy - 18, 0, cy, 8, cy - 18, 18, cy + 2, 32, cy - 8, 32, cy + 14], '#facc15');
      c.restore();
      ell(c, -16, cy + 6, 4, 4, '#dc2626');
      ell(c, 0, cy + 6, 4, 4, '#2563eb');
      ell(c, 16, cy + 6, 4, 4, '#16a34a');
      c.strokeStyle = '#78716c';
      c.lineWidth = 6;
      line(c, -72, -6, -72, -200 + b);
      c.save();
      c.shadowColor = '#38bdf8';
      c.shadowBlur = 20;
      ell(c, -72, -210 + b, 12, 12, '#7dd3fc');
      c.restore();
      c.strokeStyle = '#e7e5e4';
      c.lineWidth = 4;
      line(c, -34, -130 + b, -68, -118 + b);
      [-6, 0, 6].forEach(o => line(c, -68, -118 + b, -76, -120 + b + o));
    },

    'Emberclaw Prime'(c, t) {
      const b = Math.sin(t * 2) * 4;
      const flap = Math.sin(t * 3) * 14;
      c.fillStyle = lin(c, 0, -230, 0, -80, ['#7f1d1d', '#b91c1c']);
      [1, -1].forEach(s => {
        c.beginPath();
        c.moveTo(s * 10 + 20, -140 + b);
        c.lineTo(s * 70 + 30, -230 + b - flap);
        c.lineTo(s * 120 + 30, -200 + b - flap);
        c.quadraticCurveTo(s * 100 + 30, -160 + b, s * 110 + 30, -110 + b);
        c.quadraticCurveTo(s * 80 + 30, -130 + b, s * 70 + 30, -100 + b);
        c.quadraticCurveTo(s * 50 + 30, -120 + b, s * 20 + 20, -100 + b);
        c.closePath();
        c.fill();
      });
      c.strokeStyle = '#991b1b';
      c.lineWidth = 16;
      c.beginPath();
      c.moveTo(60, -60 + b);
      c.quadraticCurveTo(120, -30, 110 + Math.sin(t * 2) * 10, -2);
      c.stroke();
      poly(c, [100, -4, 126, 4, 112, -22], '#fbbf24');
      c.fillStyle = '#7f1d1d';
      c.fillRect(-10, -60, 26, 60);
      c.fillRect(40, -60, 26, 60);
      ell(c, 20, -96 + b, 66, 48, rad(c, 20, -96 + b, 70, ['#ef4444', '#7f1d1d']));
      ell(c, 6, -84 + b, 38, 30, '#fbbf24');
      for (let i = 0; i < 4; i++) {
        c.strokeStyle = '#d97706';
        c.lineWidth = 2;
        line(c, -24 + i * 4, -96 + b + i * 8, 34 - i * 4, -96 + b + i * 8);
      }
      c.strokeStyle = '#b91c1c';
      c.lineWidth = 26;
      c.beginPath();
      c.moveTo(-10, -120 + b);
      c.quadraticCurveTo(-40, -170 + b, -60, -178 + b);
      c.stroke();
      for (let i = 0; i < 5; i++) poly(c, [30 - i * 18, -140 + b - i * 6, 22 - i * 18, -160 + b - i * 6, 14 - i * 18, -140 + b - i * 6], '#fbbf24');
      const hx = -74, hy = -182 + b;
      ell(c, hx, hy, 34, 24, rad(c, hx, hy, 36, ['#f87171', '#991b1b']));
      poly(c, [hx - 20, hy - 10, hx - 70, hy - 2, hx - 66, hy + 12, hx - 18, hy + 18], '#b91c1c');
      poly(c, [hx + 8, hy - 18, hx + 42, hy - 46, hx + 22, hy - 12], '#fbbf24');
      poly(c, [hx - 6, hy - 20, hx + 18, hy - 52, hx + 8, hy - 16], '#f59e0b');
      glow(c, hx - 18, hy - 8, 5, '#fde047', 18);
      for (let i = 0; i < 4; i++) poly(c, [hx - 62 + i * 11, hy + 10, hx - 58 + i * 11, hy + 20, hx - 54 + i * 11, hy + 10], '#fff');
      if (Math.sin(t * 2.5) > 0.2) {
        const len = 30 + Math.sin(t * 20) * 6;
        for (let i = 0; i < 3; i++) flame(c, hx - 80 - i * 16, hy + 14 + (i % 2) * 4, 10 - i * 2 + len * 0.05, t + i);
      }
      c.strokeStyle = '#991b1b';
      c.lineWidth = 12;
      line(c, -30, -90 + b, -52, -56 + b);
      [-8, 0, 8].forEach(o => poly(c, [-56 + o, -58 + b, -62 + o, -42 + b, -50 + o, -56 + b], '#fef3c7'));
    },

    'Nyx, Devourer of Light'(c, t) {
      const cy = -130 + Math.sin(t * 1.4) * 6;
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * TAU + t * 0.3;
        c.strokeStyle = i % 2 ? '#1e1b4b' : '#312e81';
        c.lineWidth = 12;
        c.beginPath();
        c.moveTo(Math.cos(a) * 50, cy + Math.sin(a) * 50);
        const r1 = 90, r2 = 125;
        c.quadraticCurveTo(
          Math.cos(a + Math.sin(t * 2 + i) * 0.5) * r1, cy + Math.sin(a + Math.sin(t * 2 + i) * 0.5) * r1,
          Math.cos(a + 0.4) * r2, cy + Math.sin(a + 0.4) * r2
        );
        c.stroke();
      }
      for (let i = 0; i < 14; i++) {
        const u = (t * 0.35 + i / 14) % 1;
        const a = i * 2.4;
        const r = 150 * (1 - u) + 20;
        c.globalAlpha = u;
        ell(c, Math.cos(a) * r, cy + Math.sin(a) * r, 2.5, 2.5, '#fef9c3');
      }
      c.globalAlpha = 1;
      c.save();
      c.shadowColor = '#7c3aed';
      c.shadowBlur = 40;
      ell(c, 0, cy, 72, 72, rad(c, 0, cy, 76, ['#1e1b4b', '#020617']));
      c.restore();
      c.save();
      c.beginPath();
      c.arc(0, cy, 70, 0, TAU);
      c.clip();
      for (let i = 0; i < 24; i++) {
        const sx = ((i * 53) % 140) - 70, sy = cy + ((i * 37) % 140) - 70;
        ell(c, sx, sy, 1.2, 1.2, `rgba(255,255,255,${0.4 + 0.6 * Math.abs(Math.sin(t * 2 + i))})`);
      }
      c.restore();
      const blink = Math.max(0.1, Math.abs(Math.sin(t * 0.6)) > 0.97 ? 0.1 : 1);
      ell(c, 0, cy, 42, 26 * blink, '#fef3c7');
      c.save();
      c.shadowColor = '#a855f7';
      c.shadowBlur = 20;
      ell(c, -6, cy, 18, 18 * blink, rad(c, -6, cy, 18, ['#e879f9', '#7c3aed', '#2e1065']));
      c.restore();
      ell(c, -8, cy, 5, 14 * blink, '#000');
      c.strokeStyle = '#c4b5fd';
      c.lineWidth = 2;
      c.beginPath();
      c.arc(0, cy, 80 + Math.sin(t * 3) * 4, 0, TAU);
      c.stroke();
    }
  };

  function drawFallback(c, t, name) {
    let h = 0;
    for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    const hue = h % 360;
    const b = Math.sin(t * 2) * 3;
    c.fillStyle = `hsl(${hue},40%,25%)`;
    c.fillRect(-40, -60, 28, 60);
    c.fillRect(12, -60, 28, 60);
    ell(c, 0, -110 + b, 70, 60, rad(c, 0, -110 + b, 72, [`hsl(${hue},55%,55%)`, `hsl(${hue},50%,25%)`]));
    poly(c, [-40, -160 + b, -60, -220 + b, -20, -170 + b], '#e5e7eb');
    poly(c, [40, -160 + b, 60, -220 + b, 20, -170 + b], '#e5e7eb');
    glow(c, -20, -130 + b, 7, '#fde047');
    glow(c, 20, -130 + b, 7, '#fde047');
  }

  function draw(ctx, name, x, y, size, opts) {
    opts = opts || {};
    const t = opts.t || 0;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(size / 200, size / 200);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ell(ctx, 0, 0, 95, 14, 'rgba(0,0,0,0.35)');
    if (opts.boss) {
      ctx.save();
      ctx.globalAlpha = 0.35 + Math.sin(t * 3) * 0.1;
      ell(ctx, 0, -110, 130, 130, rad(ctx, 0, -110, 130, ['rgba(239,68,68,0.9)', 'rgba(239,68,68,0)']));
      ctx.restore();
    }
    (DRAW[name] || drawFallback)(ctx, t, name);
    ctx.restore();
  }

  const thumbCache = {};
  function thumbnail(name, boss) {
    const key = name + (boss ? ':boss' : '');
    if (!thumbCache[key]) {
      const cv = document.createElement('canvas');
      cv.width = 96;
      cv.height = 96;
      draw(cv.getContext('2d'), name, 50, 90, 74, { boss, t: 0.4 });
      thumbCache[key] = cv.toDataURL();
    }
    return thumbCache[key];
  }

  return { draw, thumbnail };
})();
