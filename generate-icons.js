const fs = require('fs');
const { createCanvas } = require('canvas');

const sizes = [72, 96, 128, 144, 152, 192, 384, 512];

function drawIcon(ctx, size) {
  const radius = size / 8;
  ctx.fillStyle = '#030712';
  roundRect(ctx, 0, 0, size, size, radius);
  ctx.fill();

  const centerX = size / 2;
  const centerY = size / 2;
  const triangleSize = size * 0.45;
  
  ctx.fillStyle = '#ef4444';
  ctx.beginPath();
  ctx.moveTo(centerX, centerY - triangleSize);
  ctx.lineTo(centerX - triangleSize * 0.75, centerY + triangleSize * 0.5);
  ctx.lineTo(centerX + triangleSize * 0.75, centerY + triangleSize * 0.5);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#ef4444';
  ctx.beginPath();
  ctx.arc(centerX, centerY + triangleSize * 0.6, size * 0.05, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#f97316';
  ctx.beginPath();
  ctx.arc(centerX - triangleSize * 0.5, centerY - triangleSize * 0.2, size * 0.035, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#22c55e';
  ctx.beginPath();
  ctx.arc(centerX + triangleSize * 0.5, centerY - triangleSize * 0.2, size * 0.035, 0, Math.PI * 2);
  ctx.fill();
}

function roundRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

sizes.forEach(size => {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');
  drawIcon(ctx, size);
  
  const buffer = canvas.toBuffer('image/png');
  fs.writeFileSync(`public/icon-${size}.png`, buffer);
  console.log(`Generated icon-${size}.png`);
});

const canvas = createCanvas(512, 512);
const ctx = canvas.getContext('2d');
drawIcon(ctx, 512);
const buffer = canvas.toBuffer('image/png');
fs.writeFileSync('public/icon-512.png', buffer);
console.log('Generated icon-512.png');