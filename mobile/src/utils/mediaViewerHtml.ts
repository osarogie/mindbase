export function pdfViewerHtml(base64: string): string {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=5"/>
<style>
  html, body { margin: 0; padding: 0; background: #111; height: 100%; }
  #wrap { overflow: auto; height: 100%; padding: 12px; box-sizing: border-box; }
  canvas { display: block; margin: 0 auto 16px; max-width: 100%; height: auto; background: #fff; }
  #status { color: #ccc; font: 14px -apple-system, system-ui, sans-serif; text-align: center; padding: 24px; }
</style>
</head>
<body>
<div id="wrap"><div id="status">Loading PDF…</div></div>
<script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.min.mjs" type="module"></script>
<script type="module">
  import * as pdfjsLib from 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.min.mjs';
  pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.worker.min.mjs';
  const b64 = ${JSON.stringify(base64)};
  const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
  const wrap = document.getElementById('wrap');
  wrap.innerHTML = '';
  pdfjsLib.getDocument({ data: bytes }).promise.then(async (pdf) => {
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const viewport = page.getViewport({ scale: 1.35 });
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      wrap.appendChild(canvas);
      await page.render({ canvasContext: ctx, viewport }).promise;
    }
  }).catch((err) => {
    wrap.innerHTML = '<div id="status">Could not render PDF.</div>';
    console.error(err);
  });
</script>
</body>
</html>`;
}

export function epubViewerHtml(base64: string, title: string): string {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1"/>
<style>
  html, body { margin: 0; height: 100%; background: #f6f2e8; font-family: Literata, Georgia, serif; }
  #toolbar { display: flex; gap: 8px; padding: 10px 12px; background: #fff; border-bottom: 1px solid #ddd; position: sticky; top: 0; z-index: 2; }
  button { border: 1px solid #ccc; background: #fff; border-radius: 8px; padding: 8px 12px; font-size: 14px; }
  #title { flex: 1; font-size: 14px; font-weight: 600; align-self: center; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  #viewer { height: calc(100% - 52px); overflow: hidden; }
  #area { height: 100%; padding: 16px; box-sizing: border-box; }
  #status { padding: 24px; text-align: center; color: #666; }
</style>
</head>
<body>
<div id="toolbar">
  <button id="prev" type="button">Prev</button>
  <div id="title">${title.replace(/</g, '&lt;')}</div>
  <button id="next" type="button">Next</button>
</div>
<div id="viewer"><div id="area"><div id="status">Loading EPUB…</div></div></div>
<script src="https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/epub.js/0.3.93/epub.min.js"></script>
<script>
  const b64 = ${JSON.stringify(base64)};
  const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
  const blob = new Blob([bytes], { type: 'application/epub+zip' });
  const url = URL.createObjectURL(blob);
  const book = ePub(url);
  const rendition = book.renderTo('area', { width: '100%', height: '100%', flow: 'paginated' });
  document.getElementById('prev').onclick = () => rendition.prev();
  document.getElementById('next').onclick = () => rendition.next();
  book.ready.then(() => rendition.display()).catch(() => {
    document.getElementById('status').textContent = 'Could not open EPUB.';
  });
</script>
</body>
</html>`;
}
