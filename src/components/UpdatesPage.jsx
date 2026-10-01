import React, { useEffect, useState } from 'react';
import { Play, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { updateThumbnail } from '../lib/updates';
import { fmtDate } from '../lib/csv';
import { HeroBudi } from './MascotSplash';
import './UpdatesPage.css';

const UpdatesPage = () => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    supabase.from('app_updates').select('*').order('created_at', { ascending: false }).limit(30)
      .then(({ data, error }) => {
        if (!alive) return;
        setItems(error ? [] : (data || []));
        setLoading(false);
      });
    return () => { alive = false; };
  }, []);

  return (
    <div className="page-section animate-fade-in">
      <header className="hero saved-hero">
        <HeroBudi message="Narito ang mga bagong update ng BudgetRentPH. Panoorin mo!" />
        <div className="hero-content">
          <h2>What's New</h2>
          <p>Panoorin ang mga bagong update sa app</p>
        </div>
      </header>
      <main className="updates-list">
        {loading ? (
          <div className="text-center py-10"><Loader2 className="animate-spin text-primary mx-auto" size={36} /></div>
        ) : items.length === 0 ? (
          <div className="updates-empty">Wala pang update sa ngayon. Balik ka ulit mamaya!</div>
        ) : items.map(u => {
          const thumb = updateThumbnail(u);
          return (
            <a key={u.id} className="update-card" href={u.video_url} target="_blank" rel="noopener noreferrer">
              <div className="update-thumb">
                {thumb ? <img src={thumb} alt={u.title} loading="lazy" /> : <div className="update-thumb-empty" />}
                <span className="update-play"><Play size={26} fill="currentColor" /></span>
              </div>
              <div className="update-body">
                <h4>{u.title}</h4>
                {u.description && <p>{u.description}</p>}
                <small>{fmtDate(u.created_at)}</small>
              </div>
            </a>
          );
        })}
      </main>
    </div>
  );
};

export default UpdatesPage;
