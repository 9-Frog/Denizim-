// Gate (site kilidi) — şifre: 20061016
// Doğruysa 2000ms loader, sonra açılır. Aynı oturumda tekrar sormaz.

(function(){
  const PASS = "20061016";
  const LOADER_MS = 2000;

  const gate = document.getElementById('gate-overlay');
  const form = document.getElementById('gate-form');
  const input = document.getElementById('gate-input');
  const hint = document.getElementById('gate-hint');
  const loader = document.getElementById('loader-overlay');

  if (!gate || !form || !input) return;

  const opened = sessionStorage.getItem('gate_opened') === '1';
  if (opened) { unlock(); return; }

  setTimeout(()=> input.focus(), 100);

  form.addEventListener('submit', (e)=>{
    e.preventDefault();
    const val = (input.value || '').trim();
    if (!val) return showError('Şifreyi yazmalısın.');
    if (val !== PASS) {
      showError('Şifre yanlış. Tekrar dene.');
      shakeCard(); input.value=''; input.focus(); return;
    }
    showLoader(true);
    sessionStorage.setItem('gate_opened','1');
    setTimeout(()=>{ showLoader(false); unlock(); }, LOADER_MS);
  });

  function showError(msg){
    if (!hint) return;
    hint.textContent = msg;
    hint.classList.add('error');
    setTimeout(()=> hint.classList.remove('error'), 1200);
  }
  function shakeCard(){
    const card = gate.querySelector('.gate-card');
    if (!card) return;
    card.classList.add('shake');
    setTimeout(()=> card.classList.remove('shake'), 500);
  }
  function showLoader(show){
    if (!loader) return;
    loader.classList.toggle('hidden', !show);
    loader.setAttribute('aria-hidden', show ? 'false' : 'true');
  }
  function unlock(){
    gate.setAttribute('aria-hidden','true');
    gate.classList.add('hide');
    setTimeout(()=> { gate.style.display='none'; }, 320);
  }
})();
