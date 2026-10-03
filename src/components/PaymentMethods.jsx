import { useCallback, useEffect, useState } from 'react';
import { Wallet, Plus, Trash2, Loader2, Info } from 'lucide-react';
import { supabase } from '../lib/supabase';
import './PaymentMethods.css';

const PROVIDERS = ['GCash', 'Maya', 'GoTyme', 'ShopeePay', 'Bank transfer', 'Other'];

// Landlord: dito nilalagay ang GCash / e-wallet / bank details na makikita ng tenant sa chat
const PaymentMethods = ({ session }) => {
  const userId = session?.user?.id;
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ provider: 'GCash', otherName: '', account_name: '', account_number: '', notes: '' });
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const load = useCallback(async () => {
    if (!userId) return;
    const { data } = await supabase.from('payment_methods').select('*').eq('user_id', userId).order('created_at');
    setItems(data || []);
    setLoading(false);
  }, [userId]);
  useEffect(() => { const t = setTimeout(load, 0); return () => clearTimeout(t); }, [load]);

  const add = async (e) => {
    e.preventDefault();
    const provider = form.provider === 'Other' ? form.otherName.trim() : form.provider;
    const account_name = form.account_name.trim();
    const account_number = form.account_number.trim();
    if (!provider || !account_name || !account_number) return setError('Fill in the provider, account name and number.');
    setSaving(true);
    setError('');
    const { error: err } = await supabase.from('payment_methods').insert({
      user_id: userId, provider: provider.slice(0, 40), account_name: account_name.slice(0, 80),
      account_number: account_number.slice(0, 40), notes: form.notes.trim().slice(0, 200) || null
    });
    setSaving(false);
    if (err) return setError(/payment_methods/.test(err.message || '') ? 'Payment methods are not set up yet. Please run the add_payment_methods migration.' : 'Could not save. Please try again.');
    setForm({ provider: 'GCash', otherName: '', account_name: '', account_number: '', notes: '' });
    load();
  };

  const remove = async (id) => {
    if (!window.confirm('Remove this payment method?')) return;
    await supabase.from('payment_methods').delete().eq('id', id);
    load();
  };

  return (
    <div className="pm-container animate-fade-in">
      <h2 className="pm-title"><Wallet size={22} /> Payment Methods</h2>
      <p className="pm-sub">Add your GCash or other e-wallet / bank details. Tenants can view them in the booking chat with the <strong>Show payment method</strong> button.</p>

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
        <label>
          Note (optional)
          <input type="text" maxLength={200} placeholder="e.g. Send screenshot after paying" value={form.notes} onChange={(e) => set('notes', e.target.value)} />
        </label>
        {error && <p className="pm-error"><Info size={14} /> {error}</p>}
        <button type="submit" className="pm-add" disabled={saving}>
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />} Add payment method
        </button>
      </form>

      <h3 className="pm-list-title">Your payment methods</h3>
      {loading ? <Loader2 size={20} className="animate-spin" /> : items.length === 0 ? (
        <p className="pm-empty">None yet.</p>
      ) : (
        <ul className="pm-list">
          {items.map((it) => (
            <li key={it.id}>
              <div>
                <strong>{it.provider}</strong>
                <span>{it.account_name}</span>
                <b>{it.account_number}</b>
                {it.notes && <em>{it.notes}</em>}
              </div>
              <button type="button" aria-label="Remove" onClick={() => remove(it.id)}><Trash2 size={16} /></button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default PaymentMethods;
