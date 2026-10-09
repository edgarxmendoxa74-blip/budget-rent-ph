import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, XCircle, Clock, Percent, Loader2, RotateCcw } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { HeroBudi } from './MascotSplash';
import './BookingAnalytics.css';

const peso = (n) => `₱${Number(n || 0).toLocaleString()}`;
const monthKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

// Analytics ng landlord: ilang booking ang successful at cancelled (galing sa mga buttons sa booking chat)
const BookingAnalytics = ({ session, properties }) => {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState('');
  const [resetAt, setResetAt] = useState(null);
  const [resetting, setResetting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [kind, setKind] = useState('staycation');

  const myProps = useMemo(() => properties.filter((p) => p.user_id === session?.user?.id), [properties, session?.user?.id]);

  useEffect(() => {
    let alive = true;
    // Kasama pati ang mga na-delete sa Bookings list (dismissed), para kumpleto ang bilang
    supabase.from('booking_requests')
      .select('id, property_id, status, outcome, outcome_at, created_at, kind, total_price')
      .order('created_at', { ascending: false })
      .limit(1000)
      .then(({ data, error: err }) => {
        if (!alive) return;
        if (err) { setError('Could not load analytics. Please try again.'); setRows([]); return; }
        setRows(data || []);
      });
    supabase.from('analytics_resets').select('reset_at').maybeSingle()
      .then(({ data }) => { if (alive && data?.reset_at) setResetAt(new Date(data.reset_at)); });
    return () => { alive = false; };
  }, []);

  // Binabawasan lang ang bilang; hindi nabubura ang mga booking
  const resetData = async () => {
    if (resetting) return;
    setResetting(true);
    const now = new Date();
    const { error: err } = await supabase.from('analytics_resets').upsert({ user_id: session.user.id, reset_at: now.toISOString() });
    setResetting(false);
    setConfirmOpen(false);
    if (err) return alert('Could not reset. Please try again.');
    setResetAt(now);
  };

  const stats = useMemo(() => {
    const ids = new Set(myProps.map((p) => p.id));
    const mine = (rows || []).filter((r) => ids.has(r.property_id) && (r.kind || 'staycation') === kind);
    const afterReset = (r) => !resetAt || new Date(r.outcome_at || r.created_at) > resetAt;
    const successful = mine.filter((r) => r.outcome === 'successful' && afterReset(r));
    const cancelled = mine.filter((r) => r.outcome === 'cancelled' && afterReset(r));
    const open = mine.filter((r) => !r.outcome && r.status !== 'declined');
    const decided = successful.length + cancelled.length;

    const now = new Date();
    const months = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
      return { key: monthKey(d), label: d.toLocaleDateString('en-PH', { month: 'short' }), ok: 0, no: 0 };
    });
    const byKey = new Map(months.map((m) => [m.key, m]));
    [...successful, ...cancelled].forEach((r) => {
      const m = byKey.get(monthKey(new Date(r.outcome_at || r.created_at)));
      if (m) { if (r.outcome === 'successful') m.ok += 1; else m.no += 1; }
    });

    const perProperty = myProps.map((p) => {
      const list = mine.filter((r) => r.property_id === p.id && (!r.outcome || afterReset(r)));
      return {
        id: p.id,
        name: p.name || p.title || p.location?.split(',')[0] || 'Listing',
        ok: list.filter((r) => r.outcome === 'successful').length,
        no: list.filter((r) => r.outcome === 'cancelled').length
      };
    }).filter((p) => p.ok + p.no > 0).sort((a, b) => (b.ok + b.no) - (a.ok + a.no));

    return {
      successful: successful.length,
      cancelled: cancelled.length,
      open: open.length,
      rate: decided ? Math.round((successful.length / decided) * 100) : null,
      value: successful.reduce((sum, r) => sum + Number(r.total_price || 0), 0),
      months,
      peak: Math.max(1, ...months.map((m) => Math.max(m.ok, m.no))),
      perProperty
    };
  }, [rows, myProps, resetAt, kind]);

  return (
    <div className="page-section animate-fade-in bookings-page analytics-page">
      <header className="hero branding-hero an-hero">
        {rows !== null && !error && (
          <button type="button" className="an-reset" onClick={() => setConfirmOpen(true)} disabled={resetting}>
            {resetting ? <Loader2 size={11} className="animate-spin" /> : <RotateCcw size={11} />} Reset data
          </button>
        )}
        <HeroBudi message={stats.successful > 0 ? `${stats.successful} successful booking${stats.successful > 1 ? 's' : ''} so far! 🎉` : 'Your booking results will show up here. 📊'} />
        <div className="hero-content">
          <span className="branding-kicker">Landlord</span>
          <h2>Analytics</h2>
          <p>Successful and cancelled bookings</p>
        </div>
      </header>

      {rows === null && <p className="bookings-empty"><Loader2 size={18} className="animate-spin" /></p>}
      {error && <p className="bookings-empty">{error}</p>}

      {rows !== null && !error && (
        <>
          <div className="an-tabs" role="tablist">
            <button type="button" role="tab" data-kind="staycation" aria-selected={kind === 'staycation'} className={kind === 'staycation' ? 'active' : ''} onClick={() => setKind('staycation')}>Staycation</button>
            <button type="button" role="tab" data-kind="rent" aria-selected={kind === 'rent'} className={kind === 'rent' ? 'active' : ''} onClick={() => setKind('rent')}>Find Rent</button>
          </div>

          <div className="an-cards">
            <div className="an-card ok"><CheckCircle2 size={20} /><strong>{stats.successful}</strong><span>Successful bookings</span></div>
            <div className="an-card no"><XCircle size={20} /><strong>{stats.cancelled}</strong><span>Cancelled bookings</span></div>
            <div className="an-card"><Percent size={20} /><strong>{stats.rate === null ? '—' : stats.rate}</strong><span>Success rate</span></div>
            <div className="an-card"><Clock size={20} /><strong>{stats.open}</strong><span>Still open</span></div>
          </div>

          {stats.value > 0 && <p className="an-value">Total value of successful {kind === 'rent' ? 'rent' : 'staycation'} bookings: <strong>{peso(stats.value)}</strong></p>}

          <section className="an-section">
            <h3>Last 6 months</h3>
            <div className="an-legend"><span className="ok">Successful</span><span className="no">Cancelled</span></div>
            <div className="an-chart" role="img" aria-label="Successful and cancelled bookings for the last 6 months">
              {stats.months.map((m) => (
                <div key={m.key} className="an-col">
                  <div className="an-bars">
                    <i className="ok" style={{ height: `${(m.ok / stats.peak) * 100}%` }} title={`${m.ok} successful`} />
                    <i className="no" style={{ height: `${(m.no / stats.peak) * 100}%` }} title={`${m.no} cancelled`} />
                  </div>
                  <small>{m.label}</small>
                  <em>{m.ok}/{m.no}</em>
                </div>
              ))}
            </div>
          </section>

          <section className="an-section">
            <h3>By listing</h3>
            {stats.perProperty.length === 0 && <p className="an-empty">No finished bookings yet. Tap “Successful booking” or “Cancelled booking” inside a {kind === 'rent' ? 'rent' : 'staycation'} booking chat.</p>}
            {stats.perProperty.map((p) => (
              <div key={p.id} className="an-row">
                <span>{p.name}</span>
                <b className="ok">{p.ok} ✓</b>
                <b className="no">{p.no} ✕</b>
              </div>
            ))}
          </section>
        </>
      )}
      {confirmOpen && (
        <div className="modal-overlay centered" style={{ zIndex: 3000 }} onClick={() => !resetting && setConfirmOpen(false)}>
          <div className="an-confirm animate-fade-in" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <span className="an-confirm-icon"><RotateCcw size={22} /></span>
            <h3>Reset analytics?</h3>
            <p>Counts will start again from zero. Your bookings and chats will not be deleted.</p>
            <div className="an-confirm-actions">
              <button type="button" className="cancel" onClick={() => setConfirmOpen(false)} disabled={resetting}>Cancel</button>
              <button type="button" className="danger" onClick={resetData} disabled={resetting}>
                {resetting ? <Loader2 size={14} className="animate-spin" /> : 'Reset'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BookingAnalytics;
