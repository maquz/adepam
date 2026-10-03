import './styles.css';

type Unit = 'in' | 'cm';

interface Profile {
  id: string;
  date: string;
  name: string;
  contact: string;
  charge: string;
  unit: Unit;
  m: Record<string, string>;
  material: string;
  notes: string;
}

const GROUPS: { title: string; items: [string, string][] }[] = [
  {
    title: 'Body & Shoulders',
    items: [
      ['bust', 'Bust'],
      ['waist', 'Waist'],
      ['hip', 'Hip'],
      ['shoulder', 'Shoulder'],
      ['shoulderToShoulder', 'Shoulder to shoulder'],
    ],
  },
  {
    title: 'Chest & Vertical Points',
    items: [
      ['shouldToNipple', 'Should to Nipple'],
      ['shouldToWaist', 'Should to Waist'],
      ['shoulderToHip', 'Shoulder to Hip'],
      ['shoulderToUnderBreast', 'Shoulder to under breast'],
      ['nippleToNipple', 'Nipple to Nipple'],
      ['tipToTip', 'Tip to Tip'],
      ['acrossChest', 'Across Chest'],
    ],
  },
  {
    title: 'Lengths & Arms',
    items: [
      ['kabaLength', 'Kaba length'],
      ['sleeveLength', 'Sleeve length'],
      ['aroundArm', 'Around Arm'],
      ['acrossBack', 'Across Back'],
      ['slitLength', 'Slit Length'],
      ['blouseLength', 'Blouse Length'],
      ['skirtLength', 'Skirt Length'],
      ['dressLength', 'Dress Length'],
    ],
  },
];

const STORE_KEY = 'tailor.profiles.v1';
const $ = <T extends HTMLElement>(id: string): T =>
  document.getElementById(id) as T;

function load(): Profile[] {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    return raw ? (JSON.parse(raw) as Profile[]) : [];
  } catch {
    return [];
  }
}

function persist(): boolean {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(profiles));
    return true;
  } catch {
    return false;
  }
}

let profiles: Profile[] = load();
let editingId: string | null = null;
let unit: Unit = 'in';
let toastTimer = 0;

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function today(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
}

function fmtDate(s: string): string {
  if (!s) return '';
  return new Date(s + 'T00:00:00').toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function toast(msg: string): void {
  const t = $('toast');
  t.textContent = msg;
  t.classList.add('show');
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => t.classList.remove('show'), 2200);
}

function renderGroups(): void {
  $('measure-groups').innerHTML = GROUPS.map(
    g =>
      '<div class="card"><h2 class="group-title">' +
      g.title +
      '</h2><div class="grid-fields">' +
      g.items
        .map(
          ([k, l]) =>
            '<label class="field"><span>' +
            l +
            '</span><div class="suffix"><input id="m-' +
            k +
            '" data-key="' +
            k +
            '" type="number" inputmode="decimal" min="0" step="0.1" placeholder="0"><em class="unit-tag">in</em></div></label>'
        )
        .join('') +
      '</div></div>'
  ).join('');
}

function setUnit(u: Unit): void {
  unit = u;
  $('unit-in').classList.toggle('active', u === 'in');
  $('unit-cm').classList.toggle('active', u === 'cm');
  $('unit-note').textContent = u === 'in' ? 'inches' : 'centimetres';
  document.querySelectorAll('.unit-tag').forEach(el => {
    el.textContent = u;
  });
}

function collect(): Profile {
  const m: Record<string, string> = {};
  document.querySelectorAll<HTMLInputElement>('.suffix input').forEach(i => {
    m[i.dataset.key as string] = i.value.trim();
  });
  return {
    id:
      editingId ||
      'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    date: $<HTMLInputElement>('f-date').value,
    name: $<HTMLInputElement>('f-name').value.trim(),
    contact: $<HTMLInputElement>('f-contact').value.trim(),
    charge: $<HTMLInputElement>('f-charge').value.trim(),
    unit,
    m,
    material: $<HTMLTextAreaElement>('f-material').value.trim(),
    notes: $<HTMLTextAreaElement>('f-notes').value.trim(),
  };
}

function fill(p: Profile | null): void {
  editingId = p ? p.id : null;
  $<HTMLInputElement>('f-date').value = p ? p.date : today();
  $<HTMLInputElement>('f-name').value = p ? p.name : '';
  $<HTMLInputElement>('f-contact').value = p ? p.contact : '';
  $<HTMLInputElement>('f-charge').value = p ? p.charge : '';
  $<HTMLTextAreaElement>('f-material').value = p ? p.material : '';
  $<HTMLTextAreaElement>('f-notes').value = p ? p.notes : '';
  document.querySelectorAll<HTMLInputElement>('.suffix input').forEach(i => {
    i.value = p ? p.m[i.dataset.key as string] || '' : '';
  });
  setUnit(p ? p.unit : unit);
  $('btn-save').textContent = p ? 'Update Profile' : 'Save Profile';
  $('form-error').classList.add('hide');
}

function showView(v: 'form' | 'saved'): void {
  $('view-form').classList.toggle('hide', v !== 'form');
  $('view-saved').classList.toggle('hide', v !== 'saved');
  $('tab-form').classList.toggle('active', v === 'form');
  $('tab-saved').classList.toggle('active', v === 'saved');
  if (v === 'saved') renderSaved();
  window.scrollTo(0, 0);
}

function renderSaved(): void {
  $('count').textContent = String(profiles.length);
  const q = $<HTMLInputElement>('search').value.trim().toLowerCase();
  const list = profiles
    .filter(
      p =>
        !q ||
        p.name.toLowerCase().includes(q) ||
        p.contact.toLowerCase().includes(q)
    )
    .sort((a, b) => a.name.localeCompare(b.name));
  $('saved-list').innerHTML = list
    .map(p => {
      const filled = Object.values(p.m).filter(v => v).length;
      return (
        '<div class="client"><h3>' +
        esc(p.name) +
        '</h3><p class="meta">' +
        esc(p.contact || 'No contact') +
        '<br>' +
        fmtDate(p.date) +
        ' · ' +
        filled +
        ' measurements (' +
        p.unit +
        ')' +
        (p.charge ? ' · ₵' + esc(p.charge) : '') +
        '</p><div class="row">' +
        '<button class="btn sm" data-act="edit" data-id="' +
        p.id +
        '">Edit</button>' +
        '<button class="btn sm" data-act="print" data-id="' +
        p.id +
        '">Print</button>' +
        '<button class="btn sm danger" data-act="delete" data-id="' +
        p.id +
        '">Delete</button></div></div>'
      );
    })
    .join('');
  const empty = $('empty');
  empty.classList.toggle('hide', list.length > 0);
  empty.textContent = profiles.length
    ? 'No clients match your search.'
    : 'No saved clients yet.';
}

function printCard(p: Profile): void {
  const meas = GROUPS.flatMap(g => g.items)
    .map(
      ([k, l]) =>
        '<div class="m"><span>' +
        l +
        '</span><b>' +
        (p.m[k] ? esc(p.m[k]) + ' ' + p.unit : '') +
        '</b></div>'
    )
    .join('');
  $('print-sheet').innerHTML =
    '<div class="ps"><h1>Measurement Card</h1><p class="sub">Tailor\'s Atelier</p>' +
    '<div class="info"><div><b>Name:</b> ' +
    esc(p.name) +
    '</div><div><b>Date:</b> ' +
    fmtDate(p.date) +
    '</div>' +
    '<div><b>Address / Tel:</b> ' +
    esc(p.contact) +
    '</div><div><b>Charge:</b> ' +
    (p.charge ? '₵' + esc(p.charge) : '') +
    '</div></div>' +
    '<div class="meas">' +
    meas +
    '</div>' +
    '<div class="box"><b>Type of Material</b><p>' +
    esc(p.material) +
    '</p></div>' +
    '<div class="box"><b>Notes / Special Instructions</b><p>' +
    esc(p.notes) +
    '</p></div></div>';
  window.print();
}

function save(): void {
  const p = collect();
  const err = $('form-error');
  if (!p.name) {
    err.textContent = "Please enter the customer's name before saving.";
    err.classList.remove('hide');
    $('f-name').focus();
    return;
  }
  err.classList.add('hide');
  const idx = profiles.findIndex(x => x.id === p.id);
  if (idx >= 0) profiles[idx] = p;
  else profiles.push(p);
  if (!persist()) {
    err.textContent = 'Could not save: browser storage is unavailable.';
    err.classList.remove('hide');
    return;
  }
  $('count').textContent = String(profiles.length);
  toast('Saved ' + p.name);
  fill(null);
}

renderGroups();
fill(null);
$('count').textContent = String(profiles.length);

$('tab-form').addEventListener('click', () => showView('form'));
$('tab-saved').addEventListener('click', () => showView('saved'));
$('unit-in').addEventListener('click', () => setUnit('in'));
$('unit-cm').addEventListener('click', () => setUnit('cm'));
$('btn-save').addEventListener('click', save);
$('btn-print').addEventListener('click', () => printCard(collect()));
$('btn-clear').addEventListener('click', () => fill(null));
$('search').addEventListener('input', renderSaved);

$('saved-list').addEventListener('click', e => {
  const btn = (e.target as HTMLElement).closest<HTMLButtonElement>(
    'button[data-act]'
  );
  if (!btn) return;
  const p = profiles.find(x => x.id === btn.dataset.id);
  if (!p) return;
  if (btn.dataset.act === 'edit') {
    fill(p);
    showView('form');
  } else if (btn.dataset.act === 'print') {
    printCard(p);
  } else if (btn.dataset.act === 'delete') {
    if (window.confirm('Delete ' + p.name + '? This cannot be undone.')) {
      profiles = profiles.filter(x => x.id !== p.id);
      persist();
      renderSaved();
      toast('Profile deleted');
    }
  }
});
