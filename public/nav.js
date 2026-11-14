// Site navigation: marks the current page and runs the phone menu.
const header = document.querySelector('.topbar');
if (header) {
  const path = location.pathname.replace(/\/$/, '') || '/';
  header.querySelectorAll('.topnav a:not(.topnav-cta)').forEach((link) => {
    if (link.getAttribute('href') === path) link.setAttribute('aria-current', 'page');
  });
  const toggle = header.querySelector('.menu-toggle');
  const setOpen = (open) => {
    header.classList.toggle('menu-open', open);
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    document.body.classList.toggle('menu-locked', open);
  };
  toggle.addEventListener('click', () => setOpen(!header.classList.contains('menu-open')));
  header.querySelectorAll('.topnav a').forEach((link) => link.addEventListener('click', () => setOpen(false)));
  document.addEventListener('keydown', (event) => { if (event.key === 'Escape' && header.classList.contains('menu-open')) { setOpen(false); toggle.focus(); } });
  window.matchMedia('(min-width: 861px)').addEventListener('change', (query) => { if (query.matches) setOpen(false); });
  const onScroll = () => header.classList.toggle('scrolled', window.scrollY > 8);
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });
}
