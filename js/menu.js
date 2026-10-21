/* Menú lateral compartido: funciona en móvil y escritorio. */
(function () {
  'use strict';
  function sidebar() { return document.querySelector('.sidebar'); }
  function overlays() { return Array.from(document.querySelectorAll('.menu-overlay')); }
  window.toggleMenu = function () {
    const nav = sidebar();
    if (!nav) return;
    const abrir = !nav.classList.contains('abierto');
    nav.classList.toggle('abierto', abrir);
    overlays().forEach(el => el.classList.toggle('activo', abrir));
    document.querySelectorAll('.menu-toggle').forEach(btn => btn.setAttribute('aria-expanded', String(abrir)));
  };
  window.cerrarMenu = function () {
    const nav = sidebar();
    nav?.classList.remove('abierto');
    overlays().forEach(el => el.classList.remove('activo'));
    document.querySelectorAll('.menu-toggle').forEach(btn => btn.setAttribute('aria-expanded', 'false'));
  };
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') window.cerrarMenu();
  });
})();
