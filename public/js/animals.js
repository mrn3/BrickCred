const Animals = (() => {
  const MAX_EQUIPPED = 2;

  function equipped(player, catalog) {
    const owned = [...(player.inventory?.animals || [])];
    return (player.equipped?.animals || []).slice(0, MAX_EQUIPPED).map(id => {
      const index = owned.indexOf(id);
      const animal = (catalog.animals || []).find(a => a.id === id);
      if (index === -1 || !animal) return null;
      owned.splice(index, 1);
      return animal;
    }).filter(Boolean);
  }

  function draw(ctx, animal, x, y, scale = 1, phase = 0) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath();
    ctx.ellipse(0, 0, 34, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = animal.color;
    ctx.strokeStyle = '#292524';
    ctx.lineWidth = 3;
    ctx.lineJoin = 'round';
    const block = (x, y, w, h) => {
      ctx.fillRect(x, y, w, h);
      ctx.strokeRect(x, y, w, h);
    };
    [-24, -10, 10, 23].forEach((leg, i) => {
      block(leg, -19, 9, 18 + Math.sin(phase + i * Math.PI) * 3);
    });
    block(-29, -43, 57, 27);
    ctx.beginPath();
    ctx.moveTo(-28, -35);
    ctx.lineTo(-43, animal.species === 'dog' ? -55 : -30);
    ctx.stroke();
    if (animal.species === 'lion') {
      ctx.fillStyle = '#92400e';
      block(12, -64, 37, 42);
      ctx.fillStyle = animal.color;
    }
    block(20, -55, 26, 28);
    if (animal.species === 'bear') {
      [25, 41].forEach(ear => {
        ctx.beginPath();
        ctx.arc(ear, -57, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      });
    } else {
      ctx.beginPath();
      ctx.moveTo(22, -55);
      ctx.lineTo(25, -67);
      ctx.lineTo(33, -55);
      ctx.fill();
      ctx.stroke();
    }
    block(40, -41, 13, 12);
    if (animal.species === 'tiger') {
      ctx.fillStyle = '#292524';
      [-19, -3, 13].forEach(stripe => ctx.fillRect(stripe, -43, 5, 19));
    }
    if (animal.species === 'boar') {
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.moveTo(43, -30);
      ctx.lineTo(53, -46);
      ctx.lineTo(51, -29);
      ctx.fill();
    }
    ctx.fillStyle = '#111827';
    ctx.fillRect(38, -49, 4, 4);
    ctx.fillRect(50, -41, 5, 5);
    ctx.restore();
  }

  return { MAX_EQUIPPED, equipped, draw };
})();

if (typeof module !== 'undefined') module.exports = Animals;
