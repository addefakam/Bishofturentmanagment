const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const outDir = path.join(__dirname, '..', 'public', 'guest');

// SVG source - green circle with white house
const svgIcon = `
<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <circle cx="256" cy="256" r="256" fill="#059669"/>
  <g transform="translate(256,280) scale(1.1)">
    <!-- Roof -->
    <path d="M-120,0 L0,-100 L120,0 Z" fill="white"/>
    <!-- House body -->
    <rect x="-90" y="0" width="180" height="120" rx="4" fill="white"/>
    <!-- Door -->
    <rect x="-18" y="45" width="36" height="75" rx="3" fill="#059669"/>
    <!-- Windows -->
    <rect x="-70" y="20" width="35" height="30" rx="3" fill="#059669" opacity="0.7"/>
    <rect x="35" y="20" width="35" height="30" rx="3" fill="#059669" opacity="0.7"/>
  </g>
</svg>`;

async function generate() {
  const sizes = [192, 512];
  for (const size of sizes) {
    const svg = svgIcon.replace(/512/g, String(size)).replace(/translate\(256,280\)/, `translate(${size/2},${size*0.55})`).replace(/scale\(1.1\)/, `scale(${size/512*1.1})`);
    
    const buffer = await sharp(Buffer.from(svgIcon))
      .resize(size, size)
      .png()
      .toBuffer();
    
    fs.writeFileSync(path.join(outDir, `icon-${size}.png`), buffer);
    console.log(`Generated icon-${size}.png (${buffer.length} bytes)`);
  }
}

generate().catch(console.error);
