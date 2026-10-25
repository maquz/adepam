import './styles.css';
import { api, getStoredUser, User, Design, AdminTailor, AdminStats } from './api';

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


const $ = <T extends HTMLElement>(id: string): T =>
  document.getElementById(id) as T;

let profiles: Profile[] = [];
let editingId: string | null = null;
let unit: Unit = 'in';
let toastTimer = 0;
let currentUser: User | null = null;

async function fetchProfiles() {
  if (!currentUser) return;
  try {
    const data = await api.getCustomers();
    profiles = data.map(c => ({
      ...c,
      charge: String(c.charge || '')
    }));
    renderSaved();
  } catch (error) {
    console.error('Error fetching profiles:', error);
  }
}

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
    id: editingId || crypto.randomUUID(),
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

let designs: Design[] = [];
let activeGender = 'All';
let activeAge = 'All';
let activeCategory = 'All';
let designSearchQuery = '';

let adminTailors: AdminTailor[] = [];
let adminSearchQuery = '';

async function fetchDesigns() {
  if (!currentUser) return;
  try {
    designs = await api.getDesigns();
    renderDesigns();
  } catch (err) {
    console.error('Error fetching designs:', err);
  }
}

function renderDesigns() {
  const badge = $('design-count-badge');
  const container = $('designs-grid');
  const empty = $('designs-empty');
  if (!container || !empty) return;
  
  const filtered = designs.filter(d => {
    if (activeGender !== 'All' && d.gender !== activeGender) return false;
    if (activeAge !== 'All' && d.target_group !== activeAge) return false;
    if (activeCategory !== 'All' && d.category !== activeCategory) return false;
    if (designSearchQuery) {
      const q = designSearchQuery.toLowerCase();
      const match = d.title.toLowerCase().includes(q) || 
                    (d.description && d.description.toLowerCase().includes(q)) ||
                    d.category.toLowerCase().includes(q);
      if (!match) return false;
    }
    return true;
  });
  
  if (badge) badge.textContent = String(filtered.length);

  if (filtered.length === 0) {
    container.innerHTML = '';
    empty.classList.remove('hide');
    return;
  }
  
  empty.classList.add('hide');
  container.innerHTML = filtered.map(d => `
    <div class="card" style="padding: 0; overflow: hidden; display: flex; flex-direction: column; transition: transform 0.2s; box-shadow: 0 2px 8px rgba(0,0,0,0.04); position: relative;">
      <div style="position: relative; cursor: pointer; aspect-ratio: 1/1; overflow: hidden; background: #eee;" data-act="lightbox" data-id="${d.id}">
        <img src="${esc(d.image_url)}" alt="${esc(d.title)}" style="width: 100%; height: 100%; object-fit: cover; display: block;" loading="lazy" />
        <div style="position: absolute; top: 10px; left: 10px; display: flex; flex-direction: column; gap: 4px; align-items: flex-start;">
          <span style="background: rgba(0,0,0,0.7); color: #fff; font-size: 11px; padding: 2px 8px; border-radius: 6px; font-weight: 500; backdrop-filter: blur(4px);">
            ${d.gender === 'Men' ? '👔 Men' : d.gender === 'Women' ? '👗 Women' : '🚻 Unisex'} • ${d.target_group === 'Children' ? '🧒 Kids' : '🧑 Adults'}
          </span>
          <span style="background: var(--accent); color: #fff; font-size: 10px; padding: 2px 6px; border-radius: 4px; font-weight: 500;">${esc(d.category)}</span>
        </div>
        ${d.is_global ? '<span style="position: absolute; top: 10px; right: 10px; background: #e65100; color: #fff; font-size: 11px; padding: 2px 8px; border-radius: 6px; font-weight: 600; box-shadow: 0 2px 6px rgba(0,0,0,0.2);">⭐ Platform Style</span>' : ''}
      </div>
      <div style="padding: 14px; flex: 1; display: flex; flex-direction: column; justify-content: space-between;">
        <div>
          <h4 style="font-size: 18px; margin: 0 0 4px; font-family: 'Cormorant Garamond', Georgia, serif; font-weight: 600;">${esc(d.title)}</h4>
          ${d.description ? `<p style="font-size: 13px; color: var(--muted); margin: 0 0 8px; line-height: 1.4;">${esc(d.description)}</p>` : ''}
        </div>
        <div style="display: flex; align-items: center; justify-content: space-between; margin-top: 10px; border-top: 1px solid var(--line); padding-top: 10px;">
          <div style="font-weight: 700; color: var(--accent); font-size: 15px;">
            ${d.price_estimate ? `₵ ${Number(d.price_estimate).toFixed(2)}` : '<span style="font-size: 12px; color: var(--muted); font-weight: normal;">Custom Order</span>'}
          </div>
          <div style="display: flex; gap: 6px;">
            <button type="button" class="btn ghost sm" data-act="view-full" data-id="${d.id}" style="padding: 0 8px; height: 32px; min-height: 32px; font-size: 12px;">Zoom</button>
            ${d.is_owner ? `<button type="button" class="btn ghost sm" data-act="delete-design" data-id="${d.id}" style="padding: 0 8px; height: 32px; min-height: 32px; color: #b3261e; font-size: 12px;">Delete</button>` : ''}
          </div>
        </div>
      </div>
    </div>
  `).join('');
}

async function fetchAdminData() {
  if (!currentUser?.is_admin) return;
  try {
    const [stats, tailors] = await Promise.all([
      api.getAdminStats(),
      api.getAdminTailors()
    ]);
    adminTailors = tailors;
    
    $('admin-stat-tailors').textContent = String(stats.total_tailors);
    $('admin-stat-clients').textContent = String(stats.total_customers);
    $('admin-stat-global').textContent = String(stats.global_designs);
    $('admin-stat-designs').textContent = String(stats.total_designs);
    
    renderAdminTailors();
  } catch (err: any) {
    console.error('Error fetching admin data:', err);
    toast('Admin error: ' + err.message);
  }
}

function renderAdminTailors() {
  const tbody = $('admin-tailors-tbody');
  if (!tbody) return;
  
  const q = adminSearchQuery.trim().toLowerCase();
  const filtered = adminTailors.filter(t => 
    !q || 
    t.shop_name.toLowerCase().includes(q) ||
    t.full_name.toLowerCase().includes(q) ||
    t.email.toLowerCase().includes(q) ||
    t.phone.toLowerCase().includes(q)
  );

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="padding: 24px; text-align: center; color: var(--muted);">No tailor shops found matching "${esc(q)}".</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(t => `
    <tr style="border-bottom: 1px solid var(--line);">
      <td style="padding: 12px;">
        <div style="font-weight: 600; color: var(--ink);">${esc(t.shop_name)}</div>
        <div style="font-size: 12px; color: var(--muted);">${esc(t.full_name)}</div>
      </td>
      <td style="padding: 12px;">
        <div>${esc(t.email)}</div>
        <div style="font-size: 12px; color: var(--muted);">${esc(t.phone || 'No phone')}</div>
      </td>
      <td style="padding: 12px; text-align: center; font-weight: 600; color: var(--accent);">${t.client_count}</td>
      <td style="padding: 12px; text-align: center;">${t.custom_designs}</td>
      <td style="padding: 12px;">
        <span style="font-size: 11px; padding: 2px 8px; border-radius: 6px; font-weight: 600; background: ${t.is_admin ? '#fbe9e7; color: #d84315;' : '#e8f5e9; color: #2e7d32;'}">
          ${t.is_admin ? 'Admin' : 'Tailor Shop'}
        </span>
      </td>
      <td style="padding: 12px; font-size: 12px; color: var(--muted);">${t.created_at ? t.created_at.substring(0, 10) : ''}</td>
    </tr>
  `).join('');
}

function showView(v: 'dashboard' | 'form' | 'saved' | 'profile' | 'designs' | 'appointments' | 'admin'): void {
  $('view-dashboard').classList.toggle('hide', v !== 'dashboard');
  $('view-form').classList.toggle('hide', v !== 'form');
  $('view-saved').classList.toggle('hide', v !== 'saved');
  $('view-my-profile').classList.toggle('hide', v !== 'profile');
  $('view-designs').classList.toggle('hide', v !== 'designs');
  $('view-appointments').classList.toggle('hide', v !== 'appointments');
  $('view-admin').classList.toggle('hide', v !== 'admin');
  
  $('tab-dashboard').classList.toggle('active', v === 'dashboard');
  $('tab-form').classList.toggle('active', v === 'form');
  $('tab-saved').classList.toggle('active', v === 'saved');
  $('tab-profile').classList.toggle('active', v === 'profile');
  $('tab-admin').classList.toggle('active', v === 'admin');
  
  if (v === 'saved') renderSaved();
  if (v === 'designs') fetchDesigns();
  if (v === 'admin') fetchAdminData();
  if (v === 'profile' || v === 'dashboard') renderProfile(); // Re-use renderProfile to update stats
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

function renderProfile(): void {
  if (!currentUser) return;
  const shop = currentUser.shop_name || 'My Shop';
  const name = currentUser.full_name || 'Tailor Name';
  
  $('header-title').textContent = `Welcome, ${shop}`;
  
  // Dashboard
  $('dash-total-clients').textContent = String(profiles.length);
  const totalMeas = profiles.reduce((acc, p) => acc + Object.keys(p.m).filter(k => p.m[k]).length, 0);
  $('dash-total-meas').textContent = String(totalMeas);
  
  // Profile View
  $('p-shop-name').textContent = shop;
  $('p-full-name').textContent = name;
  $('p-avatar').textContent = shop.charAt(0).toUpperCase();
  
  $<HTMLInputElement>('p-input-shop').value = shop;
  $<HTMLInputElement>('p-input-name').value = name;
  $<HTMLInputElement>('p-input-phone').value = currentUser.phone || '';
  $<HTMLInputElement>('p-input-email').value = currentUser.email || '';
  
  $('p-stat-clients').textContent = String(profiles.length);
  $('p-stat-meas').textContent = String(totalMeas);
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

async function save(): Promise<void> {
  const p = collect();
  const err = $('form-error');
  if (!p.name) {
    err.textContent = "Please enter the customer's name before saving.";
    err.classList.remove('hide');
    $('f-name').focus();
    return;
  }
  err.classList.add('hide');
  
  if (!currentUser) {
    err.textContent = 'You must be logged in to save.';
    err.classList.remove('hide');
    return;
  }

  $<HTMLButtonElement>('btn-save').disabled = true;
  $('btn-save').textContent = 'Saving...';

  try {
    await api.saveCustomer({
      ...p,
      charge: parseFloat(p.charge) || 0,
    });
  } catch (error: any) {
    $<HTMLButtonElement>('btn-save').disabled = false;
    $('btn-save').textContent = editingId ? 'Update Profile' : 'Save Profile';
    err.textContent = 'Could not save to database: ' + error.message;
    err.classList.remove('hide');
    return;
  }

  $<HTMLButtonElement>('btn-save').disabled = false;
  $('btn-save').textContent = editingId ? 'Update Profile' : 'Save Profile';

  const idx = profiles.findIndex(x => x.id === p.id);
  if (idx >= 0) profiles[idx] = p;
  else profiles.push(p);

  $('count').textContent = String(profiles.length);
  toast('Saved ' + p.name);
  fill(null);
}

renderGroups();
fill(null);
$('count').textContent = String(profiles.length);

$('tab-dashboard').addEventListener('click', () => showView('dashboard'));
$('btn-dash-new').addEventListener('click', () => { fill(null); showView('form'); });
$('btn-dash-saved').addEventListener('click', () => showView('saved'));
$('btn-dash-designs').addEventListener('click', () => showView('designs'));
$('btn-dash-appointments').addEventListener('click', () => showView('appointments'));
$('btn-back-designs').addEventListener('click', () => showView('dashboard'));
$('btn-back-appointments').addEventListener('click', () => showView('dashboard'));

// Style Designs interactions
$('btn-open-upload-design').addEventListener('click', () => {
  $('panel-upload-design').classList.remove('hide');
  $<HTMLInputElement>('input-design-title').focus();
});

$('btn-close-upload-design').addEventListener('click', () => {
  $('panel-upload-design').classList.add('hide');
  resetDesignForm();
});

$('btn-cancel-design').addEventListener('click', () => {
  $('panel-upload-design').classList.add('hide');
  resetDesignForm();
});

const dropZone = $('drop-zone-design');
const fileInput = $<HTMLInputElement>('input-design-file');
const previewBox = $('preview-design-box');
const previewImg = $<HTMLImageElement>('preview-design-img');
const dropPrompt = $('drop-zone-prompt');

dropZone.addEventListener('click', () => fileInput.click());

fileInput.addEventListener('change', () => {
  if (fileInput.files && fileInput.files[0]) {
    const file = fileInput.files[0];
    const reader = new FileReader();
    reader.onload = e => {
      previewImg.src = e.target?.result as string;
      previewBox.classList.remove('hide');
      dropPrompt.classList.add('hide');
    };
    reader.readAsDataURL(file);
  }
});

function resetDesignForm() {
  $<HTMLFormElement>('form-upload-design').reset();
  fileInput.value = '';
  previewImg.src = '';
  previewBox.classList.add('hide');
  dropPrompt.classList.remove('hide');
  $('error-upload-design').classList.add('hide');
}

$<HTMLFormElement>('form-upload-design').addEventListener('submit', async e => {
  e.preventDefault();
  const err = $('error-upload-design');
  err.classList.add('hide');

  const file = fileInput.files && fileInput.files[0];
  if (!file) {
    err.textContent = 'Please select a photo for this design.';
    err.classList.remove('hide');
    return;
  }

  const title = $<HTMLInputElement>('input-design-title').value.trim();
  const category = $<HTMLSelectElement>('input-design-category').value;
  const gender = $<HTMLSelectElement>('input-design-gender').value;
  const age = $<HTMLSelectElement>('input-design-age').value;
  const price = $<HTMLInputElement>('input-design-price').value.trim();
  const desc = $<HTMLInputElement>('input-design-desc').value.trim();
  const isGlobal = currentUser?.is_admin && $<HTMLInputElement>('input-design-global')?.checked;

  const btn = $<HTMLButtonElement>('btn-submit-design');
  btn.disabled = true;
  btn.textContent = 'Uploading...';

  try {
    const formData = new FormData();
    formData.append('image', file);
    formData.append('title', title);
    formData.append('category', category);
    formData.append('gender', gender);
    formData.append('target_group', age);
    formData.append('price_estimate', price);
    formData.append('description', desc);
    if (isGlobal) {
      formData.append('is_global', '1');
    }

    const res = await api.saveDesign(formData);
    if (res.design) {
      designs.unshift(res.design);
      renderDesigns();
      toast(isGlobal ? 'Preloaded platform style added!' : 'Design added to catalog!');
      $('panel-upload-design').classList.add('hide');
      resetDesignForm();
    }
  } catch (error: any) {
    err.textContent = error.message || 'Upload failed.';
    err.classList.remove('hide');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Upload to Catalog';
  }
});

// Search designs input
$('search-designs').addEventListener('input', () => {
  designSearchQuery = $<HTMLInputElement>('search-designs').value.trim();
  renderDesigns();
});

// 1. Gender Filter buttons
$('filter-gender-group').addEventListener('click', e => {
  const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('.filter-gender-btn');
  if (!btn) return;
  document.querySelectorAll('.filter-gender-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  activeGender = btn.dataset.gender || 'All';
  renderDesigns();
});

// 2. Age Group Filter buttons
$('filter-age-group').addEventListener('click', e => {
  const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('.filter-age-btn');
  if (!btn) return;
  document.querySelectorAll('.filter-age-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  activeAge = btn.dataset.age || 'All';
  renderDesigns();
});

// 3. Clothing Category Filter pills
$('design-category-filters').addEventListener('click', e => {
  const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('.design-filter-btn');
  if (!btn) return;
  document.querySelectorAll('.design-filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  activeCategory = btn.dataset.category || 'All';
  renderDesigns();
});

// Admin listeners
$('tab-admin').addEventListener('click', () => showView('admin'));

$('btn-admin-preload-style')?.addEventListener('click', () => {
  showView('designs');
  $('panel-upload-design').classList.remove('hide');
  const checkGlobal = $<HTMLInputElement>('input-design-global');
  if (checkGlobal) checkGlobal.checked = true;
  $('upload-panel-title').textContent = '⭐ Preload Platform Style (For All Tailors)';
  $<HTMLInputElement>('input-design-title').focus();
});

$('search-admin-tailors')?.addEventListener('input', () => {
  adminSearchQuery = $<HTMLInputElement>('search-admin-tailors').value;
  renderAdminTailors();
});

// Designs grid actions (Zoom / Delete)
$('designs-grid').addEventListener('click', async e => {
  const target = e.target as HTMLElement;
  const actBtn = target.closest<HTMLElement>('[data-act]');
  if (!actBtn) return;
  const act = actBtn.dataset.act;
  const id = Number(actBtn.dataset.id);
  const design = designs.find(d => d.id === id);
  if (!design) return;

  if (act === 'lightbox' || act === 'view-full') {
    $<HTMLImageElement>('lightbox-img').src = design.image_url;
    $('lightbox-title').textContent = design.title + (design.price_estimate ? ` - ₵ ${Number(design.price_estimate).toFixed(2)}` : '');
    $('lightbox-desc').textContent = `${design.category}${design.description ? ' • ' + design.description : ''}`;
    $('modal-lightbox').classList.remove('hide');
  } else if (act === 'delete-design') {
    if (window.confirm(`Delete design "${design.title}"?`)) {
      try {
        await api.deleteDesign(design.id);
        designs = designs.filter(d => d.id !== design.id);
        renderDesigns();
        toast('Design removed');
      } catch (error: any) {
        toast('Error: ' + error.message);
      }
    }
  }
});

// Lightbox close
$('btn-close-lightbox').addEventListener('click', () => {
  $('modal-lightbox').classList.add('hide');
});
$('modal-lightbox').addEventListener('click', e => {
  if (e.target === $('modal-lightbox')) {
    $('modal-lightbox').classList.add('hide');
  }
});

$('tab-form').addEventListener('click', () => showView('form'));
$('tab-saved').addEventListener('click', () => showView('saved'));
$('tab-profile').addEventListener('click', () => showView('profile'));
$('unit-in').addEventListener('click', () => setUnit('in'));
$('unit-cm').addEventListener('click', () => setUnit('cm'));
$('btn-save').addEventListener('click', save);
$('btn-print').addEventListener('click', () => printCard(collect()));
$('btn-clear').addEventListener('click', () => fill(null));
$('search').addEventListener('input', renderSaved);

$('btn-update-profile').addEventListener('click', async () => {
  const btn = $<HTMLButtonElement>('btn-update-profile');
  const shop_name = $<HTMLInputElement>('p-input-shop').value;
  const full_name = $<HTMLInputElement>('p-input-name').value;
  const phone = $<HTMLInputElement>('p-input-phone').value;
  
  btn.disabled = true;
  btn.textContent = 'Updating...';
  
  try {
    const user = await api.updateProfile({ shop_name, full_name, phone });
    currentUser = user;
    renderProfile();
    toast('Profile updated');
  } catch (error: any) {
    toast('Error: ' + error.message);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Update Profile';
  }
});

$('btn-update-password').addEventListener('click', async () => {
  const btn = $<HTMLButtonElement>('btn-update-password');
  const pwd = $<HTMLInputElement>('p-input-pwd').value;
  const confirm = $<HTMLInputElement>('p-input-confirm').value;
  
  if (!pwd) {
    toast('Please enter a password');
    return;
  }
  if (pwd !== confirm) {
    toast('Passwords do not match');
    return;
  }
  
  btn.disabled = true;
  btn.textContent = 'Updating...';
  
  try {
    await api.updatePassword(pwd);
    toast('Password updated');
    $<HTMLInputElement>('p-input-pwd').value = '';
    $<HTMLInputElement>('p-input-confirm').value = '';
  } catch (error: any) {
    toast('Error: ' + error.message);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Update Password';
  }
});

$('saved-list').addEventListener('click', async e => {
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
      btn.disabled = true;
      try {
        await api.deleteCustomer(p.id);
        profiles = profiles.filter(x => x.id !== p.id);
        renderSaved();
        toast('Profile deleted');
      } catch (error: any) {
        toast('Could not delete: ' + error.message);
        btn.disabled = false;
      }
    }
  }
});

async function initAuth() {
  const stored = getStoredUser();
  if (stored) {
    updateAuthState(stored);
  }
  api.getMe().then(user => {
    if (user) {
      updateAuthState(user);
    } else if (stored) {
      updateAuthState(null);
    }
  });

  let authMode: 'signin' | 'signup1' | 'signup2' | 'reset' = 'signin';

  const title = $('auth-title');
  const subtitle = $('auth-subtitle');
  const btnSwitch = $<HTMLButtonElement>('btn-switch');
  const switchText = $('switch-text');
  
  const stepIndicator = $('step-indicator');
  const step1Circle = $('step-1-circle');
  const step2Circle = $('step-2-circle');
  
  const wrapStep1 = $('wrap-step-1');
  const wrapStep2 = $('wrap-step-2');
  const signupFields1 = $('signup-fields-1');
  const signupFields2 = $('signup-fields-2');
  const signupFields3 = $('signup-fields-3');
  const wrapForgot = $('wrap-forgot');
  const linkForgot = $('link-forgot');
  const emailLabel = $('l-email-label');

  const btnSignin = $<HTMLButtonElement>('btn-signin');
  const btnNext = $<HTMLButtonElement>('btn-next');
  const btnBack = $<HTMLButtonElement>('btn-back');
  const btnSignup = $<HTMLButtonElement>('btn-signup');
  const btnReset = $<HTMLButtonElement>('btn-reset');
  
  const actionSignin = $('action-signin');
  const actionSignup1 = $('action-signup-1');
  const actionSignup2 = $('action-signup-2');
  const actionReset = $('action-reset');

  const err = $('login-error');
  const msg = $('login-msg');
  const inpPassword = $<HTMLInputElement>('l-password');

  function setMode(mode: 'signin' | 'signup1' | 'signup2' | 'reset') {
    authMode = mode;
    err.classList.add('hide');
    msg.classList.add('hide');
    
    // Reset display
    stepIndicator.classList.add('hide');
    wrapStep1.classList.add('hide');
    wrapStep2.classList.add('hide');
    signupFields1.classList.add('hide');
    signupFields2.classList.add('hide');
    signupFields3.classList.add('hide');
    wrapForgot.classList.add('hide');
    actionSignin.classList.add('hide');
    actionSignup1.classList.add('hide');
    actionSignup2.classList.add('hide');
    actionReset.classList.add('hide');
    
    if (mode === 'signin') {
      title.textContent = 'Tailor Login';
      subtitle.textContent = '';
      switchText.textContent = 'New here?';
      btnSwitch.textContent = 'Create an account';
      wrapStep1.classList.remove('hide');
      wrapStep2.classList.remove('hide');
      wrapForgot.classList.remove('hide');
      actionSignin.classList.remove('hide');
      emailLabel.textContent = 'Email';
    } else if (mode === 'signup1') {
      title.textContent = 'Create Account';
      subtitle.textContent = 'Join Adepam today!';
      switchText.textContent = 'Already have an account?';
      btnSwitch.textContent = 'Sign In';
      stepIndicator.classList.remove('hide');
      step1Circle.style.background = 'var(--accent)';
      step1Circle.style.color = 'white';
      step2Circle.style.background = 'var(--line)';
      step2Circle.style.color = 'var(--muted)';
      wrapStep1.classList.remove('hide');
      signupFields1.classList.remove('hide');
      signupFields2.classList.remove('hide');
      actionSignup1.classList.remove('hide');
      emailLabel.textContent = 'Email Address *';
    } else if (mode === 'signup2') {
      title.textContent = 'Create Account';
      subtitle.textContent = 'Secure your account';
      switchText.textContent = 'Already have an account?';
      btnSwitch.textContent = 'Sign In';
      stepIndicator.classList.remove('hide');
      step1Circle.style.background = 'var(--accent-soft)';
      step1Circle.style.color = 'var(--accent)';
      step2Circle.style.background = 'var(--accent)';
      step2Circle.style.color = 'white';
      wrapStep2.classList.remove('hide');
      signupFields3.classList.remove('hide');
      actionSignup2.classList.remove('hide');
    } else if (mode === 'reset') {
      title.textContent = 'Reset Password';
      subtitle.textContent = 'We will send you a reset link.';
      switchText.textContent = 'Remembered your password?';
      btnSwitch.textContent = 'Sign In';
      wrapStep1.classList.remove('hide');
      actionReset.classList.remove('hide');
      emailLabel.textContent = 'Email';
    }
  }

  btnSwitch.addEventListener('click', () => {
    if (authMode === 'signin' || authMode === 'reset') setMode('signup1');
    else setMode('signin');
  });

  linkForgot.addEventListener('click', () => setMode('reset'));
  btnBack.addEventListener('click', () => setMode('signup1'));

  const btnTogglePwd = $('btn-toggle-pwd');
  btnTogglePwd.addEventListener('click', () => {
    if (inpPassword.type === 'password') {
      inpPassword.type = 'text';
      btnTogglePwd.textContent = 'Hide';
    } else {
      inpPassword.type = 'password';
      btnTogglePwd.textContent = 'Show';
    }
  });

  btnNext.addEventListener('click', () => {
    err.classList.add('hide');
    const shop = $<HTMLInputElement>('l-shop').value;
    const name = $<HTMLInputElement>('l-name').value;
    const email = $<HTMLInputElement>('l-email').value;
    if (!shop || !name || !email) {
      err.textContent = 'Shop Name, Full Name, and Email are required.';
      err.classList.remove('hide');
      return;
    }
    setMode('signup2');
  });

  btnSignin.addEventListener('click', async () => {
    const email = $<HTMLInputElement>('l-email').value;
    const password = inpPassword.value;
    err.classList.add('hide');
    if (!email || !password) {
      err.textContent = 'Please enter email and password';
      err.classList.remove('hide');
      return;
    }
    btnSignin.disabled = true;
    try {
      const res = await api.login({ email, password });
      updateAuthState(res.user);
    } catch (error: any) {
      err.textContent = error.message;
      err.classList.remove('hide');
    } finally {
      btnSignin.disabled = false;
    }
  });

  btnSignup.addEventListener('click', async () => {
    err.classList.add('hide');
    const email = $<HTMLInputElement>('l-email').value;
    const password = inpPassword.value;
    const confirm = $<HTMLInputElement>('l-confirm-password').value;
    if (!password || password !== confirm) {
      err.textContent = 'Passwords do not match';
      err.classList.remove('hide');
      return;
    }
    btnSignup.disabled = true;
    const shop_name = $<HTMLInputElement>('l-shop').value;
    const full_name = $<HTMLInputElement>('l-name').value;
    const phone = $<HTMLInputElement>('l-phone').value;
    
    try {
      const res = await api.signup({ shop_name, full_name, email, phone, password });
      updateAuthState(res.user);
    } catch (error: any) {
      err.textContent = error.message;
      err.classList.remove('hide');
    } finally {
      btnSignup.disabled = false;
    }
  });

  btnReset.addEventListener('click', () => {
    msg.textContent = 'Please update your password in Profile Settings once logged in, or contact administrator.';
    msg.classList.remove('hide');
  });

  $('btn-logout').addEventListener('click', () => {
    api.logout();
    updateAuthState(null);
  });
}

function updateAuthState(user: User | null) {
  currentUser = user;
  if (user) {
    $('app-login').classList.add('hide');
    $('app-content').classList.remove('hide');
    
    // Toggle Admin tab & global preloading controls
    const tabAdmin = $('tab-admin');
    if (tabAdmin) {
      tabAdmin.classList.toggle('hide', !user.is_admin);
    }
    const wrapGlobal = $('wrap-design-global');
    if (wrapGlobal) {
      wrapGlobal.classList.toggle('hide', !user.is_admin);
    }

    fetchProfiles().then(() => showView('dashboard'));
  } else {
    $('app-login').classList.remove('hide');
    $('app-content').classList.add('hide');
    profiles = [];
    renderSaved();
  }
}

initAuth();
