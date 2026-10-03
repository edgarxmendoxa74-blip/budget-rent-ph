import React, { useEffect, useState } from 'react';
import { Play, Loader2, Trash2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { updateThumbnail } from '../lib/updates';
import { fmtDate } from '../lib/csv';
import { HeroBudi } from './MascotSplash';
import './UpdatesPage.css';
import { ikImage } from '../lib/imagekit';
import { isAdminEmail } from '../lib/admin';

const UpdatesPage = () => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setIsAdmin(isAdminEmail(data?.user?.email)));
  }, []);

  const removeUpdate = async (e, u) => {
    e.preventDefault();
    e.stopPropagation();
    if (!window.confirm(`I-delete ang "${u.title}"? Mawawala ito sa Updates tab ng lahat ng users.`)) return;
    const { error } = await supabase.from('app_updates').delete().eq('id', u.id);
    if (error) return alert('Hindi na-delete: ' + error.message);
    setItems((list) => list.filter((x) => x.id !== u.id));
  };

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
        <HeroBudi message="Here are the latest BudgetRentPH updates. Check them out!" />
        <div className="hero-content">
          <h2>What's New</h2>
          <p>Watch the latest app updates</p>
        </div>
      </header>
      <main className="updates-list">
        {loading ? (
          <div className="text-center py-10"><Loader2 className="animate-spin text-primary mx-auto" size={36} /></div>
        ) : items.length === 0 ? (
          <div className="updates-empty">No updates yet. Check back later!</div>
        ) : items.map(u => {
          const thumb = updateThumbnail(u);
          return (
            <a key={u.id} className="update-card" href={u.video_url} target="_blank" rel="noopener noreferrer">
              <div className="update-thumb">
                {thumb ? <img src={ikImage(thumb, 400)} alt={u.title} loading="lazy" /> : <div className="update-thumb-empty" />}
                <span className="update-play"><Play size={26} fill="currentColor" /></span>
              </div>
              <div className="update-body">
                <h4>{u.title}</h4>
                {u.description && <p>{u.description}</p>}
                <small>{fmtDate(u.created_at)}</small>
                <div className="update-actions">
                  {isAdmin && (
                    <button type="button" className="update-del-btn" aria-label="Delete update" title="Delete update" onClick={(e) => removeUpdate(e, u)}><Trash2 size={14} /></button>
                  )}
                  <span className="update-watch-btn"><Play size={13} fill="currentColor" /> Watch</span>
                </div>
              </div>
            </a>
          );
        })}
      </main>
    </div>
  );
};

export default UpdatesPage;
