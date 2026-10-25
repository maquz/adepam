import './styles.css';
import { api, getStoredUser, User, Design, AdminTailor, Customer } from './api';

type Unit = 'in' | 'cm';

interface Profile {
  id: string;
  date: string;
  name: string;
  contact: string;
  charge: string;
  style_id?: number | null;
  style_name?: string;
  style_image?: string;
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
      charge: String(c.charge || ''),
      style_id: c.style_id ?? null,
      style_name: c.style_name || '',
      style_image: c.style_image || ''
    }));
    renderSaved();
  } catch (error) {
    console.error('Error fetching profiles:', error);
  }
}

function esc(s: string): string {
  if (!s) return '';
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

function setAttachedStyle(style: { id: number | null; name: string; image: string; category?: string; gender?: string; target_group?: string; price?: number | null } | null) {
  const wrap = $('wrap-attached-style');
  const empty = $('wrap-no-style');
  
  if (style && (style.name || style.image)) {
    wrap.classList.remove('hide');
    empty.classList.add('hide');
    
    $<HTMLImageElement>('attached-style-img').src = style.image || '/logo.jpg';
    $('attached-style-title').textContent = style.name || 'Custom Style';
    $('attached-style-category').textContent = style.category || 'General';
    $('attached-style-meta').textContent = `${style.gender || 'Unisex'} • ${style.target_group || 'Adults'}`;
    $('attached-style-price').textContent = style.price ? `₵ ${Number(style.price).toFixed(2)}` : 'Custom Order';
    
    $<HTMLInputElement>('f-style-id').value = style.id ? String(style.id) : '';
    $<HTMLInputElement>('f-style-name').value = style.name || '';
    $<HTMLInputElement>('f-style-image').value = style.image || '';
  } else {
    wrap.classList.add('hide');
    empty.classList.remove('hide');
    $<HTMLInputElement>('f-style-id').value = '';
    $<HTMLInputElement>('f-style-name').value = '';
    $<HTMLInputElement>('f-style-image').value = '';
  }
}

function collect(): Profile {
  const m: Record<string, string> = {};
  document.querySelectorAll<HTMLInputElement>('.suffix input').forEach(i => {
    m[i.dataset.key as string] = i.value.trim();
  });
  
  const styleIdStr = $<HTMLInputElement>('f-style-id').value;
  const styleId = styleIdStr ? parseInt(styleIdStr, 10) : null;
  const styleName = $<HTMLInputElement>('f-style-name').value.trim();
  const styleImage = $<HTMLInputElement>('f-style-image').value.trim();

  return {
    id: editingId || crypto.randomUUID(),
    date: $<HTMLInputElement>('f-date').value,
    name: $<HTMLInputElement>('f-name').value.trim(),
    contact: $<HTMLInputElement>('f-contact').value.trim(),
    charge: $<HTMLInputElement>('f-charge').value.trim(),
    style_id: styleId,
    style_name: styleName,
    style_image: styleImage,
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

  if (p && (p.style_name || p.style_image)) {
    // Find matching design in catalog if exists
    const match = designs.find(d => d.id === p.style_id || d.title === p.style_name);
    setAttachedStyle({
      id: p.style_id ?? null,
      name: p.style_name || '',
      image: p.style_image || match?.image_url || '',
      category: match?.category || 'Custom Style',
      gender: match?.gender || 'Unisex',
      target_group: match?.target_group || 'Adults',
      price: match?.price_estimate ?? null
    });
  } else {
    setAttachedStyle(null);
  }

  $('btn-save').textContent = p ? 'Update Profile' : 'Save Profile';
  $('form-error').classList.add('hide');
}

// Designs Catalog Management
let designs: Design[] = [];
let activeGender = 'All';
let activeAge = 'All';
let activeCategory = 'All';
let designSearchQuery = '';

let adminTailors: AdminTailor[] = [];
let adminSearchQuery = '';
let currentLightboxDesign: Design | null = null;

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
        <div>
          <div style="display: flex; align-items: center; justify-content: space-between; margin-top: 10px; border-top: 1px solid var(--line); padding-top: 10px;">
            <div style="font-weight: 700; color: var(--accent); font-size: 15px;">
              ${d.price_estimate ? `₵ ${Number(d.price_estimate).toFixed(2)}` : '<span style="font-size: 12px; color: var(--muted); font-weight: normal;">Custom Order</span>'}
            </div>
            <div style="display: flex; gap: 6px;">
              <button type="button" class="btn ghost sm" data-act="view-full" data-id="${d.id}" style="padding: 0 8px; height: 32px; min-height: 32px; font-size: 12px;">Zoom</button>
              ${d.is_owner ? `<button type="button" class="btn ghost sm" data-act="delete-design" data-id="${d.id}" style="padding: 0 8px; height: 32px; min-height: 32px; color: #b3261e; font-size: 12px;">Delete</button>` : ''}
            </div>
          </div>
          <button type="button" class="btn primary sm" data-act="select-for-client" data-id="${d.id}" style="width: 100%; margin-top: 10px; font-size: 13px; height: 36px; min-height: 36px;">
            ✨ Select for Client
          </button>
        </div>
      </div>
    </div>
  `).join('');
}

// Client-side image compression utility
async function compressImage(file: File, maxWidth = 1200, maxHeight = 1200, quality = 0.85): Promise<string> {
  // If already SVG or very small, return as DataURL directly
  if (file.type === 'image/svg+xml') {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = e => resolve(e.target?.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = event => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        let width = img.width;
        let height = img.height;
        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(event.target?.result as string);
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = reject;
    };
    reader.onerror = reject;
  });
}

// Admin Management Functions
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
    tbody.innerHTML = `<tr><td colspan="7" style="padding: 24px; text-align: center; color: var(--muted);">No tailor shops found matching "${esc(q)}".</td></tr>`;
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
      <td style="padding: 12px; text-align: center;">
        <div style="display: flex; gap: 6px; justify-content: center;">
          <button type="button" class="btn ghost sm" data-admin-act="edit-tailor" data-id="${t.id}" style="padding: 0 10px; height: 32px; font-size: 12px; color: var(--accent);">
            ✏️ Edit
          </button>
          ${currentUser?.id !== t.id ? `
            <button type="button" class="btn ghost sm danger" data-admin-act="delete-tailor" data-id="${t.id}" style="padding: 0 8px; height: 32px; font-size: 12px;">
              🗑️
            </button>
          ` : ''}
        </div>
      </td>
    </tr>
  `).join('');
}

function openEditTailorModal(tailor: AdminTailor) {
  $<HTMLInputElement>('a-edit-id').value = String(tailor.id);
  $<HTMLInputElement>('a-edit-shop').value = tailor.shop_name;
  $<HTMLInputElement>('a-edit-name').value = tailor.full_name;
  $<HTMLInputElement>('a-edit-email').value = tailor.email;
  $<HTMLInputElement>('a-edit-phone').value = tailor.phone || '';
  $<HTMLSelectElement>('a-edit-role').value = tailor.is_admin ? '1' : '0';
  $<HTMLInputElement>('a-edit-password').value = '';
  $('error-admin-edit').classList.add('hide');
  $('modal-admin-edit-tailor').classList.remove('hide');
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
  if (v === 'profile' || v === 'dashboard') renderProfile();
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
      const hasStyle = p.style_name || p.style_image;
      return (
        '<div class="client">' +
        '<h3>' + esc(p.name) + '</h3>' +
        '<p class="meta">' +
        esc(p.contact || 'No contact') + '<br>' +
        fmtDate(p.date) + ' · ' + filled + ' measurements (' + p.unit + ')' +
        (p.charge ? ' · ₵' + esc(p.charge) : '') +
        '</p>' +
        (hasStyle ? 
          `<div style="display: flex; align-items: center; gap: 8px; margin: 6px 0 10px; background: var(--accent-soft); padding: 5px 10px; border-radius: 8px; font-size: 13px; color: var(--accent); font-weight: 500;">
             ${p.style_image ? `<img src="${esc(p.style_image)}" style="width: 24px; height: 24px; border-radius: 4px; object-fit: cover;" />` : '👗'}
             <span>Style: <strong>${esc(p.style_name || 'Attached Style')}</strong></span>
           </div>` : '') +
        '<div class="row">' +
        '<button class="btn sm" data-act="view" data-id="' + p.id + '" style="font-weight: 600;">👁️ View</button>' +
        '<button class="btn sm" data-act="edit" data-id="' + p.id + '">Edit</button>' +
        '<button class="btn sm" data-act="print" data-id="' + p.id + '">Print</button>' +
        '<button class="btn sm danger" data-act="delete" data-id="' + p.id + '">Delete</button>' +
        '</div>' +
        '</div>'
      );
    })
    .join('');
  const empty = $('empty');
  empty.classList.toggle('hide', list.length > 0);
  empty.textContent = profiles.length
    ? 'No clients match your search.'
    : 'No saved clients yet.';
}

function openClientViewModal(p: Profile) {
  $('modal-c-name').textContent = p.name;
  $('modal-c-contact').textContent = p.contact || 'No contact provided';
  $('modal-c-date').textContent = fmtDate(p.date) || 'Not dated';
  $('modal-c-charge').textContent = p.charge ? `₵ ${Number(p.charge).toFixed(2)}` : '₵ 0.00';
  $('modal-c-unit').textContent = p.unit;

  const styleBox = $('modal-c-style-box');
  if (p.style_name || p.style_image) {
    styleBox.classList.remove('hide');
    $<HTMLImageElement>('modal-c-style-img').src = p.style_image || '/logo.jpg';
    $('modal-c-style-title').textContent = p.style_name || 'Custom Design';
    const match = designs.find(d => d.id === p.style_id);
    $('modal-c-style-desc').textContent = match 
      ? `${match.gender} • ${match.target_group} • ${match.category}`
      : 'Tailor Selected Design';
  } else {
    styleBox.classList.add('hide');
  }

  // Populate measurement badges
  const measContainer = $('modal-c-measurements');
  const items: string[] = [];
  GROUPS.forEach(g => {
    g.items.forEach(([k, label]) => {
      const val = p.m[k];
      if (val) {
        items.push(`
          <div style="background: var(--bg); border: 1px solid var(--line); border-radius: 8px; padding: 6px 10px;">
            <div style="font-size: 11px; color: var(--muted);">${label}</div>
            <div style="font-size: 14px; font-weight: 600; color: var(--ink);">${esc(val)} <span style="font-size: 11px; font-weight: normal; color: var(--muted);">${p.unit}</span></div>
          </div>
        `);
      }
    });
  });

  if (items.length > 0) {
    measContainer.innerHTML = items.join('');
  } else {
    measContainer.innerHTML = '<div style="color: var(--muted); font-size: 13px; grid-column: 1 / -1;">No measurements recorded for this client.</div>';
  }

  $('modal-c-material').textContent = p.material || 'None specified.';
  $('modal-c-notes').textContent = p.notes || 'No extra instructions.';

  // Wire action buttons inside modal
  $('btn-modal-c-edit').onclick = () => {
    $('modal-client-view').classList.add('hide');
    fill(p);
    showView('form');
  };

  $('btn-modal-c-print').onclick = () => {
    printCard(p);
  };

  $('modal-client-view').classList.remove('hide');
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
    '<div class="ps"><h1>Measurement Card</h1><p class="sub">' + esc(currentUser?.shop_name || "Tailor's Atelier") + '</p>' +
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
    (p.style_name ? `<div class="box" style="margin-bottom: 12px;"><b>Attached Style Design</b><p>${esc(p.style_name)}</p></div>` : '') +
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
      style_id: p.style_id,
      style_name: p.style_name,
      style_image: p.style_image
    } as Customer);
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
  showView('saved');
}

// Open Style Picker Modal
function openStylePicker() {
  const modal = $('modal-style-picker');
  const grid = $('picker-designs-grid');
  if (!modal || !grid) return;

  if (designs.length === 0) {
    grid.innerHTML = '<div style="color: var(--muted); grid-column: 1 / -1; text-align: center; padding: 24px;">No designs available in catalog yet.</div>';
  } else {
    grid.innerHTML = designs.map(d => `
      <div class="card" style="padding: 10px; cursor: pointer; display: flex; flex-direction: column; justify-content: space-between; border: 1px solid var(--line);" data-pick-id="${d.id}">
        <img src="${esc(d.image_url)}" alt="${esc(d.title)}" style="width: 100%; aspect-ratio: 1/1; object-fit: cover; border-radius: 8px; margin-bottom: 8px;" />
        <div>
          <strong style="font-size: 14px; display: block; margin-bottom: 2px;">${esc(d.title)}</strong>
          <div style="font-size: 11px; color: var(--muted);">${d.gender} • ${d.target_group}</div>
          <div style="font-size: 12px; font-weight: 600; color: var(--accent); margin-top: 4px;">${d.price_estimate ? `₵ ${Number(d.price_estimate).toFixed(2)}` : 'Custom'}</div>
        </div>
        <button type="button" class="btn primary sm" style="margin-top: 8px; width: 100%; height: 32px; font-size: 12px;">Choose Style</button>
      </div>
    `).join('');
  }

  modal.classList.remove('hide');
}

// Initialize View and Render groups
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

// Style Attachment Events
$('btn-browse-styles')?.addEventListener('click', openStylePicker);
$('btn-attach-catalog')?.addEventListener('click', openStylePicker);
$('btn-close-style-picker')?.addEventListener('click', () => $('modal-style-picker').classList.add('hide'));
$('modal-style-picker')?.addEventListener('click', e => {
  if (e.target === $('modal-style-picker')) $('modal-style-picker').classList.add('hide');
});

$('picker-designs-grid')?.addEventListener('click', e => {
  const card = (e.target as HTMLElement).closest<HTMLElement>('[data-pick-id]');
  if (!card) return;
  const id = Number(card.dataset.pickId);
  const design = designs.find(d => d.id === id);
  if (design) {
    setAttachedStyle({
      id: design.id,
      name: design.title,
      image: design.image_url,
      category: design.category,
      gender: design.gender,
      target_group: design.target_group,
      price: design.price_estimate
    });
    $('modal-style-picker').classList.add('hide');
    toast(`Attached "${design.title}"`);
  }
});

$('btn-remove-style')?.addEventListener('click', () => {
  setAttachedStyle(null);
  toast('Style removed');
});

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
  btn.textContent = 'Optimizing & Uploading...';

  try {
    // Compress image client-side to ensure it never exceeds PHP upload limits
    const compressedDataUrl = await compressImage(file, 1200, 1200, 0.85);

    const formData = new FormData();
    formData.append('image_data', compressedDataUrl);
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
      toast(isGlobal ? '⭐ Preloaded platform style added!' : 'Design added to catalog!');
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

// Admin Tab & Actions
$('tab-admin').addEventListener('click', () => showView('admin'));

$('btn-admin-preload-style')?.addEventListener('click', () => {
  showView('designs');
  $('panel-upload-design').classList.remove('hide');
  const checkGlobal = $<HTMLInputElement>('input-design-global');
  if (checkGlobal) checkGlobal.checked = true;
  $('upload-panel-title').textContent = '⭐ Preload Platform Style (For All Tailors)';
  $<HTMLInputElement>('input-design-title').focus();
});

$('btn-admin-add-tailor')?.addEventListener('click', () => {
  $('error-admin-create').classList.add('hide');
  $<HTMLFormElement>('form-admin-create-tailor').reset();
  $('modal-admin-create-tailor').classList.remove('hide');
});

$('btn-close-create-tailor')?.addEventListener('click', () => $('modal-admin-create-tailor').classList.add('hide'));
$('btn-cancel-create-tailor')?.addEventListener('click', () => $('modal-admin-create-tailor').classList.add('hide'));

$<HTMLFormElement>('form-admin-create-tailor')?.addEventListener('submit', async e => {
  e.preventDefault();
  const err = $('error-admin-create');
  err.classList.add('hide');

  const shop_name = $<HTMLInputElement>('a-create-shop').value.trim();
  const full_name = $<HTMLInputElement>('a-create-name').value.trim();
  const email = $<HTMLInputElement>('a-create-email').value.trim();
  const phone = $<HTMLInputElement>('a-create-phone').value.trim();
  const password = $<HTMLInputElement>('a-create-password').value;
  const is_admin = $<HTMLSelectElement>('a-create-role').value === '1';

  const btn = $<HTMLButtonElement>('btn-submit-create-tailor');
  btn.disabled = true;
  btn.textContent = 'Creating...';

  try {
    await api.adminCreateTailor({ shop_name, full_name, email, phone, password, is_admin });
    toast(`Shop "${shop_name}" registered!`);
    $('modal-admin-create-tailor').classList.add('hide');
    fetchAdminData();
  } catch (error: any) {
    err.textContent = error.message;
    err.classList.remove('hide');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Create Account';
  }
});

$('btn-close-edit-tailor')?.addEventListener('click', () => $('modal-admin-edit-tailor').classList.add('hide'));
$('btn-cancel-edit-tailor')?.addEventListener('click', () => $('modal-admin-edit-tailor').classList.add('hide'));

$<HTMLFormElement>('form-admin-edit-tailor')?.addEventListener('submit', async e => {
  e.preventDefault();
  const err = $('error-admin-edit');
  err.classList.add('hide');

  const id = Number($<HTMLInputElement>('a-edit-id').value);
  const shop_name = $<HTMLInputElement>('a-edit-shop').value.trim();
  const full_name = $<HTMLInputElement>('a-edit-name').value.trim();
  const email = $<HTMLInputElement>('a-edit-email').value.trim();
  const phone = $<HTMLInputElement>('a-edit-phone').value.trim();
  const is_admin = $<HTMLSelectElement>('a-edit-role').value === '1';
  const password = $<HTMLInputElement>('a-edit-password').value.trim();

  const btn = $<HTMLButtonElement>('btn-save-edit-tailor');
  btn.disabled = true;
  btn.textContent = 'Saving...';

  try {
    await api.adminUpdateTailor({ id, shop_name, full_name, email, phone, is_admin, password: password || undefined });
    toast(`Shop "${shop_name}" updated successfully!`);
    $('modal-admin-edit-tailor').classList.add('hide');
    fetchAdminData();
  } catch (error: any) {
    err.textContent = error.message;
    err.classList.remove('hide');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Save Changes';
  }
});

// Admin table row actions (Edit / Delete)
$('admin-tailors-tbody')?.addEventListener('click', async e => {
  const target = e.target as HTMLElement;
  const btn = target.closest<HTMLButtonElement>('[data-admin-act]');
  if (!btn) return;
  const act = btn.dataset.adminAct;
  const id = Number(btn.dataset.id);
  const tailor = adminTailors.find(t => t.id === id);
  if (!tailor) return;

  if (act === 'edit-tailor') {
    openEditTailorModal(tailor);
  } else if (act === 'delete-tailor') {
    if (window.confirm(`Are you sure you want to delete tailor shop "${tailor.shop_name}"? All associated data will be removed.`)) {
      try {
        await api.adminDeleteTailor(tailor.id);
        toast(`Shop "${tailor.shop_name}" removed`);
        fetchAdminData();
      } catch (err: any) {
        toast('Error: ' + err.message);
      }
    }
  }
});

$('search-admin-tailors')?.addEventListener('input', () => {
  adminSearchQuery = $<HTMLInputElement>('search-admin-tailors').value;
  renderAdminTailors();
});

// Designs grid actions (Zoom / Delete / Select for Client)
$('designs-grid').addEventListener('click', async e => {
  const target = e.target as HTMLElement;
  const actBtn = target.closest<HTMLElement>('[data-act]');
  if (!actBtn) return;
  const act = actBtn.dataset.act;
  const id = Number(actBtn.dataset.id);
  const design = designs.find(d => d.id === id);
  if (!design) return;

  if (act === 'lightbox' || act === 'view-full') {
    currentLightboxDesign = design;
    $<HTMLImageElement>('lightbox-img').src = design.image_url;
    $('lightbox-title').textContent = design.title + (design.price_estimate ? ` - ₵ ${Number(design.price_estimate).toFixed(2)}` : '');
    $('lightbox-desc').textContent = `${design.category}${design.description ? ' • ' + design.description : ''}`;
    $('modal-lightbox').classList.remove('hide');
  } else if (act === 'select-for-client') {
    fill(null);
    setAttachedStyle({
      id: design.id,
      name: design.title,
      image: design.image_url,
      category: design.category,
      gender: design.gender,
      target_group: design.target_group,
      price: design.price_estimate
    });
    showView('form');
    toast(`Selected "${design.title}" for client`);
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

// Lightbox "Select for Client"
$('btn-lightbox-select')?.addEventListener('click', () => {
  if (currentLightboxDesign) {
    fill(null);
    setAttachedStyle({
      id: currentLightboxDesign.id,
      name: currentLightboxDesign.title,
      image: currentLightboxDesign.image_url,
      category: currentLightboxDesign.category,
      gender: currentLightboxDesign.gender,
      target_group: currentLightboxDesign.target_group,
      price: currentLightboxDesign.price_estimate
    });
    $('modal-lightbox').classList.add('hide');
    showView('form');
    toast(`Selected "${currentLightboxDesign.title}" for client`);
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

// Client View Modal Close
$('btn-close-client-view')?.addEventListener('click', () => $('modal-client-view').classList.add('hide'));
$('btn-modal-c-close')?.addEventListener('click', () => $('modal-client-view').classList.add('hide'));
$('modal-client-view')?.addEventListener('click', e => {
  if (e.target === $('modal-client-view')) $('modal-client-view').classList.add('hide');
});

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

// Saved list item actions (View / Edit / Print / Delete)
$('saved-list').addEventListener('click', async e => {
  const btn = (e.target as HTMLElement).closest<HTMLButtonElement>(
    'button[data-act]'
  );
  if (!btn) return;
  const p = profiles.find(x => x.id === btn.dataset.id);
  if (!p) return;

  if (btn.dataset.act === 'view') {
    openClientViewModal(p);
  } else if (btn.dataset.act === 'edit') {
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

// Authentication System
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
      emailLabel.textContent = 'Email or Username';
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
      emailLabel.textContent = 'Email or Username *';
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
      emailLabel.textContent = 'Email or Username';
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
    const shop = $<HTMLInputElement>('l-shop').value.trim();
    const name = $<HTMLInputElement>('l-name').value.trim();
    const email = $<HTMLInputElement>('l-email').value.trim();
    if (!shop || !name || !email) {
      err.textContent = 'Shop Name, Full Name, and Email/Username are required.';
      err.classList.remove('hide');
      return;
    }
    setMode('signup2');
  });

  btnSignin.addEventListener('click', async () => {
    const email = $<HTMLInputElement>('l-email').value.trim();
    const password = inpPassword.value;
    err.classList.add('hide');
    if (!email || !password) {
      err.textContent = 'Please enter email/username and password';
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
    const email = $<HTMLInputElement>('l-email').value.trim();
    const password = inpPassword.value;
    const confirm = $<HTMLInputElement>('l-confirm-password').value;
    if (!password || password !== confirm) {
      err.textContent = 'Passwords do not match';
      err.classList.remove('hide');
      return;
    }
    btnSignup.disabled = true;
    const shop_name = $<HTMLInputElement>('l-shop').value.trim();
    const full_name = $<HTMLInputElement>('l-name').value.trim();
    const phone = $<HTMLInputElement>('l-phone').value.trim();
    
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

    Promise.all([fetchProfiles(), fetchDesigns()]).then(() => showView('dashboard'));
  } else {
    $('app-login').classList.remove('hide');
    $('app-content').classList.add('hide');
    profiles = [];
    designs = [];
    renderSaved();
  }
}

initAuth();
