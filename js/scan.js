// Barcode scanning with the camera (1.9). Uses ZXing (Apache-2.0, vendor/zxing.min.js),
// loaded only when the scanner opens. Nothing is recorded or stored: frames are read live.
import { overlay, esc } from './ui.js';

let lib = null;
function loadZXing() {
  if (window.ZXing) return Promise.resolve(window.ZXing);
  return lib ||= new Promise((ok, fail) => {
    const s = document.createElement('script');
    s.src = 'vendor/zxing.min.js';
    s.onload = () => window.ZXing ? ok(window.ZXing) : fail(new Error('scanner'));
    s.onerror = () => { lib = null; fail(new Error('scanner')); };
    document.head.append(s);
  });
}

// UPC-E (the short code on small packages) written out as the full UPC-A it stands for.
export function upcEtoA(code) {
  const c = String(code).replace(/\D/g, '');
  if (c.length !== 8) return c;
  const [ns, d1, d2, d3, d4, d5, d6, check] = c;
  const mid = d6 <= '2' ? `${d1}${d2}${d6}0000${d3}${d4}${d5}` : d6 === '3' ? `${d1}${d2}${d3}00000${d4}${d5}`
    : d6 === '4' ? `${d1}${d2}${d3}${d4}00000${d5}` : `${d1}${d2}${d3}${d4}${d5}0000${d6}`;
  return ns + mid + check;
}

// Resolves with the scanned digits, or null if closed.
export function scanBarcode() {
  return new Promise(resolve => {
    let reader = null, done = false;
    const { el, close } = overlay(`<div class="row"><h1 style="text-align:left">Scan a barcode</h1><button class="cta2" id="x" data-close>Close</button></div>
      <p class="sub" style="text-align:center">Hold the barcode inside the box, about a hand's length away.</p>
      <div class="scanbox"><video id="cam" playsinline muted autoplay></video><span class="aim" aria-hidden="true"></span></div>
      <p class="msg" id="sm" role="status"></p>
      <label class="f" style="margin-top:8px"><span>Or type the numbers under the barcode</span><input id="code" inputmode="numeric" maxlength="14" autocomplete="off"></label>
      <button class="cta2" id="go" style="width:100%;margin-top:8px">Look it up</button>`, { label: 'Scan a barcode' });
    const finish = v => { if (done) return; done = true; try { reader?.reset(); } catch { /* already stopped */ } close(); resolve(v); };
    el.addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.id === 'x') finish(null);
      if (b.id === 'go') { const v = el.querySelector('#code').value.replace(/\D/g, ''); if (v.length >= 6) finish(v.length === 8 && /^[01]/.test(v) ? v + ',' + upcEtoA(v) : v); else el.querySelector('#sm').textContent = 'Type at least 6 digits.'; }
    });
    loadZXing().then(Z => {
      if (done) return;
      const hints = new Map([[Z.DecodeHintType.POSSIBLE_FORMATS, [Z.BarcodeFormat.EAN_13, Z.BarcodeFormat.UPC_A, Z.BarcodeFormat.UPC_E, Z.BarcodeFormat.EAN_8]]]);
      reader = new Z.BrowserMultiFormatReader(hints);
      return reader.decodeFromConstraints({ video: { facingMode: 'environment' } }, el.querySelector('#cam'), res => {
        if (!res) return;
        const fmt = res.getBarcodeFormat?.();
        finish(fmt === Z.BarcodeFormat.UPC_E ? upcEtoA(res.getText()) : res.getText());
      }).then(() => { if (done) reader.reset(); }); // closed while the camera was still starting
    }).catch(err => {
      if (done) return;
      el.querySelector('#sm').innerHTML = esc(err?.name === 'NotAllowedError' ? 'Camera access is off. Allow it for Goku in Settings, or type the numbers below.'
        : 'The camera isn’t available here. Type the numbers below instead.');
    });
  });
}
