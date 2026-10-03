import './styles.css';
import { supabase } from './supabase';

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

let profiles: Profile[] = [];
let editingId: string | null = null;
let unit: Unit = 'in';
let toastTimer = 0;
let currentSession: any = null;

async function fetchProfiles() {
  if (!currentSession) return;
  const { data, error } = await supabase.from('customers').select('*').eq('tailor_id', currentSession.user.id);
  if (error) {
    console.error('Error fetching profiles:', error);
    return;
  }
  profiles = data || [];
  renderSaved();
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
  
  if (!currentSession) {
    err.textContent = 'You must be logged in to save.';
    err.classList.remove('hide');
    return;
  }

  $('btn-save').disabled = true;
  $('btn-save').textContent = 'Saving...';

  const { error } = await supabase.from('customers').upsert({
    ...p,
    tailor_id: currentSession.user.id
  });

  $('btn-save').disabled = false;
  $('btn-save').textContent = editingId ? 'Update Profile' : 'Save Profile';

  if (error) {
    err.textContent = 'Could not save to database: ' + error.message;
    err.classList.remove('hide');
    return;
  }

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

$('tab-form').addEventListener('click', () => showView('form'));
$('tab-saved').addEventListener('click', () => showView('saved'));
$('unit-in').addEventListener('click', () => setUnit('in'));
$('unit-cm').addEventListener('click', () => setUnit('cm'));
$('btn-save').addEventListener('click', save);
$('btn-print').addEventListener('click', () => printCard(collect()));
$('btn-clear').addEventListener('click', () => fill(null));
$('search').addEventListener('input', renderSaved);

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
      const { error } = await supabase.from('customers').delete().eq('id', p.id);
      if (error) {
        toast('Could not delete: ' + error.message);
        btn.disabled = false;
        return;
      }
      profiles = profiles.filter(x => x.id !== p.id);
      renderSaved();
      toast('Profile deleted');
    }
  }
});

async function initAuth() {
  const { data: { session } } = await supabase.auth.getSession();
  updateAuthState(session);

  supabase.auth.onAuthStateChange((_event, session) => {
    updateAuthState(session);
  });

  let authMode: 'signin' | 'signup' | 'reset' = 'signin';

  const title = $('auth-title');
  const btnAction = $('btn-action');
  const btnSwitch = $('btn-switch');
  const switchText = $('switch-text');
  const wrapForgot = $('wrap-forgot');
  const wrapPassword = $('wrap-password');
  const wrapSignupFields = $('wrap-signup-fields');
  const linkForgot = $('link-forgot');
  const err = $('login-error');
  const msg = $('login-msg');

  function setMode(mode: 'signin' | 'signup' | 'reset') {
    authMode = mode;
    err.classList.add('hide');
    msg.classList.add('hide');
    
    if (mode === 'signin') {
      title.textContent = 'Tailor Login';
      btnAction.textContent = 'Sign In';
      switchText.textContent = 'New here?';
      btnSwitch.textContent = 'Create an account';
      wrapForgot.classList.remove('hide');
      wrapPassword.classList.remove('hide');
      wrapSignupFields.classList.add('hide');
    } else if (mode === 'signup') {
      title.textContent = 'Create Account';
      btnAction.textContent = 'Sign Up';
      switchText.textContent = 'Already have an account?';
      btnSwitch.textContent = 'Sign In';
      wrapForgot.classList.add('hide');
      wrapPassword.classList.remove('hide');
      wrapSignupFields.classList.remove('hide');
    } else if (mode === 'reset') {
      title.textContent = 'Reset Password';
      btnAction.textContent = 'Send Reset Link';
      switchText.textContent = 'Remembered your password?';
      btnSwitch.textContent = 'Sign In';
      wrapForgot.classList.add('hide');
      wrapPassword.classList.add('hide');
      wrapSignupFields.classList.add('hide');
    }
  }

  btnSwitch.addEventListener('click', () => {
    if (authMode === 'signin' || authMode === 'reset') setMode('signup');
    else setMode('signin');
  });

  linkForgot.addEventListener('click', () => setMode('reset'));

  const btnTogglePwd = $('btn-toggle-pwd');
  const inpPassword = $<HTMLInputElement>('l-password');
  btnTogglePwd.addEventListener('click', () => {
    if (inpPassword.type === 'password') {
      inpPassword.type = 'text';
      btnTogglePwd.textContent = 'Hide';
    } else {
      inpPassword.type = 'password';
      btnTogglePwd.textContent = 'Show';
    }
  });

  btnAction.addEventListener('click', async () => {
    const email = $<HTMLInputElement>('l-email').value;
    const password = inpPassword.value;
    err.classList.add('hide');
    msg.classList.add('hide');
    
    if (!email) {
      err.textContent = 'Please enter an email';
      err.classList.remove('hide');
      return;
    }
    
    if (authMode !== 'reset' && !password) {
      err.textContent = 'Please enter a password';
      err.classList.remove('hide');
      return;
    }

    btnAction.disabled = true;
    let error = null;

    if (authMode === 'signin') {
      const res = await supabase.auth.signInWithPassword({ email, password });
      error = res.error;
    } else if (authMode === 'signup') {
      const shop_name = $<HTMLInputElement>('l-shop').value;
      const first_name = $<HTMLInputElement>('l-first').value;
      const last_name = $<HTMLInputElement>('l-last').value;
      const phone = $<HTMLInputElement>('l-phone').value;
      
      const res = await supabase.auth.signUp({ 
        email, 
        password,
        options: {
          data: { shop_name, first_name, last_name, phone }
        }
      });
      error = res.error;
      if (!error) {
        msg.textContent = 'Check your email for the confirmation link!';
        msg.classList.remove('hide');
      }
    } else if (authMode === 'reset') {
      const res = await supabase.auth.resetPasswordForEmail(email);
      error = res.error;
      if (!error) {
        msg.textContent = 'Password reset link sent to your email.';
        msg.classList.remove('hide');
      }
    }

    if (error) {
      err.textContent = error.message;
      err.classList.remove('hide');
    }
    btnAction.disabled = false;
  });

  $('btn-logout').addEventListener('click', async () => {
    await supabase.auth.signOut();
  });
}

function updateAuthState(session: any) {
  currentSession = session;
  if (session) {
    $('app-login').classList.add('hide');
    $('app-content').classList.remove('hide');
    fetchProfiles();
  } else {
    $('app-login').classList.remove('hide');
    $('app-content').classList.add('hide');
    profiles = [];
    renderSaved();
  }
}

initAuth();
