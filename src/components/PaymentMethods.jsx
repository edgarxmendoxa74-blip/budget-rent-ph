import { createPortal } from 'react-dom';
import { useCallback, useEffect, useState } from 'react';
import { Plus, Trash2, Loader2, Info, ImagePlus, Pencil } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { ikImage } from '../lib/imagekit';
import { HeroBudi } from './MascotSplash';
import './PaymentMethods.css';

const MAX_METHODS = 2;
const MAX_QR_BYTES = 5 * 1024 * 1024;
const PROVIDERS = ['GCash', 'Maya', 'GoTyme', 'ShopeePay', 'Bank transfer', 'Other'];
const EMPTY_FORM = { provider: 'GCash', otherName: '', account_name: '', account_number: '' };

// Landlord: dito nilalagay ang GCash / e-wallet / bank details na makikita ng tenant sa chat (hanggang 2, may QR)
const PaymentMethods = ({ session }) => {
  const userId = session?.user?.id;
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState(EMPTY_FORM);
  const [qrFile, setQrFile] = useState(null);
  const [qrPreview, setQrPreview] = useState('');
  const [editing, setEditing] = useState(null); // { id, provider, otherName, account_name, account_number, qr_url }
  const [editQr, setEditQr] = useState(null); // bagong File
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState('');
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const full = items.length >= MAX_METHODS;

  const load = useCallback(async () => {
    if (!userId) return;
    const { data } = await supabase.from('payment_methods').select('*').eq('user_id', userId).order('created_at');
    setItems(data || []);
    setLoading(false);
  }, [userId]);
  useEffect(() => { const t = setTimeout(load, 0); return () => clearTimeout(t); }, [load]);

  const clearQr = () => {
    setQrFile(null);
    setQrPreview((old) => { if (old) URL.revokeObjectURL(old); return ''; });
  };

  const pickQr = (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) return setError('Please choose an image file.');
    if (file.size > MAX_QR_BYTES) return setError('QR image must be 5MB or smaller.');
    setError('');
    setQrFile(file);
    setQrPreview((old) => { if (old) URL.revokeObjectURL(old); return URL.createObjectURL(file); });
  };

  const add = async (e) => {
    e.preventDefault();
    if (full) return setError(`You can add up to ${MAX_METHODS} payment methods only.`);
    const provider = form.provider === 'Other' ? form.otherName.trim() : form.provider;
    const account_name = form.account_name.trim();
    const account_number = form.account_number.trim();
    if (!provider || !account_name || !account_number) return setError('Fill in the provider, account name and number.');
    setSaving(true);
    setError('');
    let qr_url = null;
    if (qrFile) {
      const ext = (qrFile.name.split('.').pop() || 'png').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 5) || 'png';
      const path = `payment-qr/${userId}-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from('avatars').upload(path, qrFile, { contentType: qrFile.type });
      if (upErr) { setSaving(false); return setError('Could not upload the QR image. Please try again.'); }
      qr_url = supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl;
    }
    const { error: err } = await supabase.from('payment_methods').insert({
      user_id: userId, provider: provider.slice(0, 40), account_name: account_name.slice(0, 80),
      account_number: account_number.slice(0, 40), qr_url
    });
    setSaving(false);
    if (err) {
      const msg = err.message || '';
      return setError(/Maximum of 2/.test(msg) ? `You can add up to ${MAX_METHODS} payment methods only.`
        : /payment_methods/.test(msg) ? 'Payment methods are not set up yet. Please run the add_payment_methods migration.'
        : 'Could not save. Please try again.');
    }
    setForm(EMPTY_FORM);
    clearQr();
    load();
  };

  const remove = async (id) => {
    if (!window.confirm('Remove this payment method?')) return;
    await supabase.from('payment_methods').delete().eq('id', id);
    load();
  };

  const startEdit = (it) => {
    const known = PROVIDERS.includes(it.provider) && it.provider !== 'Other';
    setEditing({ id: it.id, provider: known ? it.provider : 'Other', otherName: known ? '' : it.provider, account_name: it.account_name, account_number: it.account_number, qr_url: it.qr_url || null });
    setEditQr(null);
    setEditError('');
  };
  const setE = (k, v) => setEditing((f) => ({ ...f, [k]: v }));
  const pickEditQr = (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) return setEditError('Please choose an image file.');
    if (file.size > MAX_QR_BYTES) return setEditError('QR image must be 5MB or smaller.');
    setEditError('');
    setEditQr(file);
  };
  const editQrSrc = editQr ? URL.createObjectURL(editQr) : editing?.qr_url ? ikImage(editing.qr_url, 240) : '';

  const saveEdit = async (e) => {
    e.preventDefault();
    const provider = editing.provider === 'Other' ? editing.otherName.trim() : editing.provider;
    const account_name = editing.account_name.trim();
    const account_number = editing.account_number.trim();
    if (!provider || !account_name || !account_number) return setEditError('Fill in the provider, account name and number.');
    setEditSaving(true);
    setEditError('');
    let qr_url = editing.qr_url;
    if (editQr) {
      const ext = (editQr.name.split('.').pop() || 'png').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 5) || 'png';
      const path = `payment-qr/${userId}-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from('avatars').upload(path, editQr, { contentType: editQr.type });
      if (upErr) { setEditSaving(false); return setEditError('Could not upload the QR image. Please try again.'); }
      qr_url = supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl;
    }
    const { error: err } = await supabase.from('payment_methods').update({
      provider: provider.slice(0, 40), account_name: account_name.slice(0, 80), account_number: account_number.slice(0, 40), qr_url
    }).eq('id', editing.id);
    setEditSaving(false);
    if (err) return setEditError('Could not save. Please try again.');
    setEditing(null);
    setEditQr(null);
    load();
  };

  return (
    <div className="page-section animate-fade-in">
    <header className="hero branding-hero">
      <HeroBudi message="Add your GCash or bank details here so tenants know where to pay. 💸" />
      <div className="hero-content">
        <span className="branding-kicker">Landlord Tools</span>
        <h2>Payment Methods</h2>
      </div>
    </header>
    <div className="pm-container">
      <p className="pm-sub">Add up to {MAX_METHODS} GCash, e-wallet or bank accounts (with QR code if you have one). Tenants can view them in the booking chat with the <strong>Payment</strong> button.</p>

      {full ? (
        <p className="pm-limit">🎉 Congratulations! You have completed your {MAX_METHODS} payment methods. Remove one if you want to add another.</p>
      ) : (
        <form className="pm-card" onSubmit={add}>
          <label>
            Provider
            <select value={form.provider} onChange={(e) => set('provider', e.target.value)}>
              {PROVIDERS.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </label>
          {form.provider === 'Other' && (
            <label>
              Provider name
              <input type="text" maxLength={40} placeholder="e.g. PayPal, BDO" value={form.otherName} onChange={(e) => set('otherName', e.target.value)} />
            </label>
          )}
          <label>
            Account name
            <input type="text" maxLength={80} placeholder="Juan Dela Cruz" value={form.account_name} onChange={(e) => set('account_name', e.target.value)} />
          </label>
          <label>
            Number / account no.
            <input type="text" inputMode="numeric" maxLength={40} placeholder="09171234567" value={form.account_number} onChange={(e) => set('account_number', e.target.value)} />
          </label>
          <div className="pm-qr">
            <span>QR code (optional)</span>
            {qrPreview ? (
              <div className="pm-qr-preview">
                <img src={qrPreview} alt="QR preview" />
                <button type="button" onClick={clearQr}><Trash2 size={14} /> Remove</button>
              </div>
            ) : (
              <label className="pm-qr-pick">
                <ImagePlus size={18} /> Upload QR image
                <input type="file" accept="image/*" onChange={pickQr} hidden />
              </label>
            )}
          </div>
          {error && <p className="pm-error"><Info size={14} /> {error}</p>}
          <button type="submit" className="pm-add" disabled={saving}>
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />} Add payment method
          </button>
        </form>
      )}
      {full && error && <p className="pm-error"><Info size={14} /> {error}</p>}

      <h3 className="pm-list-title">Your payment methods ({items.length}/{MAX_METHODS})</h3>
      {loading ? <Loader2 size={20} className="animate-spin" /> : items.length === 0 ? (
        <p className="pm-empty">None yet.</p>
      ) : (
        <ul className="pm-list">
          {items.map((it) => (
            <li key={it.id}>
              <div className="pm-item-head">
                <strong>{it.provider}</strong>
                <div className="pm-item-actions">
                  <button type="button" className="pm-edit" aria-label="Edit" onClick={() => startEdit(it)}><Pencil size={14} /></button>
                  <button type="button" aria-label="Remove" onClick={() => remove(it.id)}><Trash2 size={14} /></button>
                </div>
              </div>
              <div className="pm-item-body">
                <span>{it.account_name}</span>
                <b>{it.account_number}</b>
              </div>
              {it.qr_url && <img className="pm-qr-thumb" src={ikImage(it.qr_url, 240)} alt={`${it.provider} QR`} />}
            </li>
          ))}
        </ul>
      )}
    </div>
    {editing && createPortal(
      <div className="modal-overlay centered" style={{ zIndex: 3000 }} onClick={() => !editSaving && setEditing(null)}>
        <form className="pm-card pm-edit-modal animate-fade-in" onSubmit={saveEdit} onClick={(e) => e.stopPropagation()}>
          <h3>Edit payment method</h3>
          <label>
            Provider
            <select value={editing.provider} onChange={(e) => setE('provider', e.target.value)}>
              {PROVIDERS.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </label>
          {editing.provider === 'Other' && (
            <label>
              Provider name
              <input type="text" maxLength={40} value={editing.otherName} onChange={(e) => setE('otherName', e.target.value)} />
            </label>
          )}
          <label>
            Account name
            <input type="text" maxLength={80} value={editing.account_name} onChange={(e) => setE('account_name', e.target.value)} />
          </label>
          <label>
            Number / account no.
            <input type="text" inputMode="numeric" maxLength={40} value={editing.account_number} onChange={(e) => setE('account_number', e.target.value)} />
          </label>
          <div className="pm-qr">
            <span>QR code (optional)</span>
            {editQrSrc ? (
              <div className="pm-qr-preview">
                <img src={editQrSrc} alt="QR preview" />
                <button type="button" onClick={() => { setEditQr(null); setE('qr_url', null); }}><Trash2 size={14} /> Remove</button>
              </div>
            ) : null}
            <label className="pm-qr-pick">
              <ImagePlus size={18} /> {editQrSrc ? 'Change QR image' : 'Upload QR image'}
              <input type="file" accept="image/*" onChange={pickEditQr} hidden />
            </label>
          </div>
          {editError && <p className="pm-error"><Info size={14} /> {editError}</p>}
          <div className="pm-edit-actions">
            <button type="button" className="cancel" onClick={() => setEditing(null)} disabled={editSaving}>Cancel</button>
            <button type="submit" className="pm-add" disabled={editSaving}>{editSaving ? <Loader2 size={16} className="animate-spin" /> : 'Save'}</button>
          </div>
        </form>
      </div>,
      document.body
    )}
    </div>
  );
};

export default PaymentMethods;
