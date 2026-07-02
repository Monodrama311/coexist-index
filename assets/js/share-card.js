// share-card.js
// snapDOM (MIT, zumerlab) — renders the DOM via SVG foreignObject.
// Replaces html2canvas (unmaintained since 2022): ~150x faster,
// pixel-exact with the page's loaded CJK fonts, correct blend modes.
// Falls back to html2canvas if the CDN import fails.

export async function exportShareCard(elementSelector, filename = 'coexist-result.png') {
  const el = document.querySelector(elementSelector);
  if (!el) return;

  try {
    const { snapdom } = await import('https://cdn.jsdelivr.net/npm/@zumer/snapdom@2/dist/snapdom.mjs');
    const result = await snapdom(el, {
      scale: 2,
      backgroundColor: '#F6F1EB',
      embedFonts: true
    });
    await result.download({ format: 'png', filename: filename.replace(/\.png$/, '') });
    return;
  } catch (err) {
    console.warn('snapdom failed, falling back to html2canvas:', err);
  }

  // Fallback: html2canvas
  const html2canvas = (await import('https://cdn.jsdelivr.net/npm/html2canvas@1/+esm')).default;
  const canvas = await html2canvas(el, {
    scale: 2,
    backgroundColor: '#F6F1EB',
    useCORS: true,
    logging: false
  });
  canvas.toBlob(blob => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, 'image/png');
}
