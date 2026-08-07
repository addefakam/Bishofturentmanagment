const { createCanvas } = require('canvas');
const fs = require('fs');
const path = require('path');

const sizes = [192, 512];
const outDir = path.join(__dirname, '..', 'public', 'guest');

sizes.forEach((size) => {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');

  // Background circle
  ctx.fillStyle = '#059669';
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
  ctx.fill();

  // House icon (simple)
  const s = size * 0.35;
  const cx = size / 2;
  const baseY = size / 2 + s * 0.2;

  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(cx - s, baseY);
  ctx.lineTo(cx, baseY - s * 0.8);
  ctx.lineTo(cx + s, baseY);
  ctx.closePath();
  ctx.fill();

  // House body
  ctx.fillRect(cx - s * 0.7, baseY, s * 1.4, s * 0.8);

  // Door
  ctx.fillStyle = '#059669';
  ctx.fillRect(cx - s * 0.15, baseY + s * 0.3, s * 0.3, s * 0.5);

  const buffer = canvas.toBuffer('image/png');
  fs.writeFileSync(path.join(outDir, `icon-${size}.png`), buffer);
  console.log(`Generated icon-${size}.png`);
});
