function showPurpose(name, focus = false, notify = true) {
  const tab = document.getElementById(`tab-${name}`);
  if (!tab) return;
  document.body.classList.add('panel-open');
  document.body.classList.toggle('resizable-sheet',['route','facilities'].includes(name));
  document.body.classList.remove('sheet-collapsed','sheet-minimized');
  if(['route','facilities'].includes(name))sheetController?.open(name);
  else document.body.classList.remove('sheet-tall');
  document.body.classList.toggle('school-sheet',name==='facilities');
  if(name!=='facilities'&&typeof leaveSchoolFacilities==='function')leaveSchoolFacilities();
  if(name!=='facilities')document.body.classList.remove('sheet-collapsed');
  if(notify&&name==='route'&&window.parent!==window)window.parent.postMessage({type:'knu:shell-map'},location.origin);
  document.querySelectorAll('[data-view]').forEach(button => {
    const active = button === tab;
    button.setAttribute('aria-selected', String(active)); button.tabIndex = active ? 0 : -1;
    document.getElementById(`view-${button.dataset.view}`).hidden = !active;
  });
  if (focus) tab.focus();
  document.querySelector('.route-panel').scrollTop = 0;
  if(name==='meals'&&typeof loadTodayMeals==='function')loadTodayMeals();
}
window.addEventListener('DOMContentLoaded', () => {
  const tabs = [...document.querySelectorAll('[data-view]')];
  tabs.forEach((tab, index) => {
    tab.onclick = () => showPurpose(tab.dataset.view);
    tab.onkeydown = event => {
      const next = event.key === 'ArrowRight' ? (index + 1) % tabs.length : event.key === 'ArrowLeft' ? (index + tabs.length - 1) % tabs.length : event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : null;
      if (next !== null) {event.preventDefault(); showPurpose(tabs[next].dataset.view, true);}
    };
  });
  document.querySelectorAll('[data-go-route]').forEach(button => button.onclick = () => showPurpose('route', true));
});
