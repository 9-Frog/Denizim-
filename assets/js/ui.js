// Dropdown: tıklayınca aç/kapat; dışarı tıklandığında kapanır.
document.addEventListener('click', (e)=>{
  const isBtn = e.target.matches('[data-dropdown-button]');
  document.querySelectorAll('[data-dropdown].open')
    .forEach(d => (!d.contains(e.target)) && d.classList.remove('open'));
  if(isBtn){ e.target.closest('[data-dropdown]').classList.toggle('open'); }
});
