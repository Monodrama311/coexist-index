// share-card.js
export async function exportShareCard(elementSelector, filename = 'coexist-result.png') {
  const html2canvas = (await import('https://cdn.jsdelivr.net/npm/html2canvas@1/+esm')).default;
  const el = document.querySelector(elementSelector);
  if (!el) return;

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
