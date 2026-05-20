const fs = require('fs');
const path = require('path');

// Create a simple 512x512 PNG icon (blue gradient with white text placeholder)
// Using a minimal PNG structure

// For simplicity, create a 1x1 pixel PNG and note that user should replace it
const minimalPNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64'
);

const iconPath = path.join(__dirname, 'assets', 'images', 'icon.png');
const adaptiveIconPath = path.join(__dirname, 'assets', 'images', 'adaptive-icon.png');

fs.writeFileSync(iconPath, minimalPNG);
fs.writeFileSync(adaptiveIconPath, minimalPNG);

console.log('Placeholder icons created at:');
console.log('  -', iconPath);
console.log('  -', adaptiveIconPath);
console.log('\nNote: These are 1x1 placeholder icons.');
console.log('Please replace with actual 512x512 icons for production.');
