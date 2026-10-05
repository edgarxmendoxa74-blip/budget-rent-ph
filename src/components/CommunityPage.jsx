import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Loader2, Send, Trash2, MessageCircle, Users, Clock, Play, CalendarDays, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { updateThumbnail } from '../lib/updates';
import { isAdminEmail } from '../lib/admin';
import { HeroBudi } from './MascotSplash';
import './CommunityPage.css';

const timeAgo = (iso) => {
  const mins = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 60) return `${mins}m ago`;
  if (mins < 1440) return `${Math.round(mins / 60)}h ago`;
  return new Date(iso).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' });
};

const HIGHLIGHTS = [
  { img: '/community/together.jpg', title: 'Landlords Together', text: 'Share stories and experiences: how to find honest tenants, set the right price, and handle problems with your rental.' },
  { img: '/community/seminar.jpg', title: 'Seminars and Training', text: 'Free seminars on proper contracts, safe renting, and growing your rental income.' },
  { img: '/community/workshop.jpg', title: 'Talks and Workshops', text: 'Learn from experts and fellow landlords: listing marketing, managing payments, and getting the most out of BudgetRentPH.' },
  { img: '/community/event.jpg', title: 'Special Events', text: 'Meet-ups, thank-you gatherings, and special occasions to get to know the whole community.' },
];

const CommunityHighlights = () => (
  <section className="community-highlights">
    <h3>What to expect in the community</h3>
    {HIGHLIGHTS.map((h) => (
      <figure key={h.title} className="community-highlight">
        <img src={h.img} alt={h.title} loading="lazy" />
        <figcaption><strong>{h.title}</strong><span>{h.text}</span></figcaption>
      </figure>
    ))}
    <p className="community-highlights-note">Photos are for illustration only. Photos: Wikimedia Commons, CC BY-SA 4.0.</p>
  </section>
);

const CommunityFeed = ({ session }) => {
  const [posts, setPosts] = useState([]);
  const [comments, setComments] = useState({});
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState('');
  const [posting, setPosting] = useState(false);
  const [openPost, setOpenPost] = useState(null);
  const [replyDraft, setReplyDraft] = useState('');

  const user = session?.user;
  const isAdmin = isAdminEmail(user?.email);
  const myName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Landlord';

  const [memberCount, setMemberCount] = useState(null);
  const [featured, setFeatured] = useState([]);
  const [cf, setCf] = useState({ kind: 'video', title: '', body: '', video_url: '', event_date: '' });
  const [publishing, setPublishing] = useState(false);

  const loadFeatured = async () => {
    const { data } = await supabase.from('community_content').select('*').order('created_at', { ascending: false }).limit(20);
    setFeatured(data || []);
  };

  const publish = async (e) => {
    e.preventDefault();
    if (publishing || !cf.title.trim()) return;
    setPublishing(true);
    const { error } = await supabase.from('community_content').insert({
      kind: cf.kind,
      title: cf.title.trim(),
      body: cf.body.trim(),
      video_url: cf.video_url.trim() || null,
      event_date: cf.kind === 'event' && cf.event_date ? new Date(cf.event_date).toISOString() : null,
    });
    setPublishing(false);
    if (error) return alert('Could not publish: ' + error.message);
    setCf({ kind: 'video', title: '', body: '', video_url: '', event_date: '' });
    loadFeatured();
  };

  const load = async () => {
    const [p, c] = await Promise.all([
      supabase.from('community_posts').select('*').order('created_at', { ascending: false }).limit(50),
      supabase.from('community_comments').select('*').order('created_at', { ascending: true }).limit(500),
    ]);
    setPosts(p.data || []);
    const grouped = {};
    (c.data || []).forEach((x) => { (grouped[x.post_id] ||= []).push(x); });
    setComments(grouped);
    setLoading(false);
  };

  useEffect(() => {
    load();
    loadFeatured();
    supabase.rpc('community_member_count').then(({ data }) => setMemberCount(typeof data === 'number' ? data : null));
  }, []);

  const submitPost = async (e) => {
    e.preventDefault();
    const body = draft.trim();
    if (!body || posting) return;
    setPosting(true);
    const { error } = await supabase.from('community_posts').insert({ user_id: user.id, author_name: myName, body });
    setPosting(false);
    if (error) return alert('Could not post: ' + error.message);
    setDraft('');
    load();
  };

  const submitReply = async (e, postId) => {
    e.preventDefault();
    const body = replyDraft.trim();
    if (!body) return;
    const { error } = await supabase.from('community_comments').insert({ post_id: postId, user_id: user.id, author_name: myName, body });
    if (error) return alert('Could not send: ' + error.message);
    setReplyDraft('');
    load();
  };

  const remove = async (table, id) => {
    if (!window.confirm('Delete this?')) return;
    const { error } = await supabase.from(table).delete().eq('id', id);
    if (error) return alert('Could not delete: ' + error.message);
    load();
  };

  return (
    <div className="page-section animate-fade-in">
      <header className="hero saved-hero">
        <HeroBudi message="Chat and help each other here, landlords!" />
        <div className="hero-content">
          <h2>Budget Rent Community</h2>
          <p>The BudgetRentPH landlord community</p>
          {memberCount !== null && (
            <span className="community-count"><Users size={14} /> {memberCount.toLocaleString('en-PH')} {memberCount === 1 ? 'member' : 'members'}</span>
          )}
        </div>
      </header>
      <main className="community-wrap">
        {isAdmin && (
          <form className="community-compose community-admin-form" onSubmit={publish}>
            <strong>Post to members (admin)</strong>
            <select className="community-input" value={cf.kind} onChange={(e) => setCf({ ...cf, kind: e.target.value })}>
              <option value="video">Video</option>
              <option value="event">Special event</option>
              <option value="content">Valuable content</option>
            </select>
            <input className="community-input" placeholder="Title" value={cf.title} onChange={(e) => setCf({ ...cf, title: e.target.value })} maxLength={120} required />
            <textarea placeholder="Description" value={cf.body} onChange={(e) => setCf({ ...cf, body: e.target.value })} maxLength={2000} rows={3} />
            <input className="community-input" type="url" placeholder="Video / link (YouTube, Facebook, etc.)" value={cf.video_url} onChange={(e) => setCf({ ...cf, video_url: e.target.value })} />
            {cf.kind === 'event' && (
              <input className="community-input" type="datetime-local" value={cf.event_date} onChange={(e) => setCf({ ...cf, event_date: e.target.value })} />
            )}
            <button type="submit" disabled={publishing || !cf.title.trim()}>
              {publishing ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />} Publish
            </button>
          </form>
        )}

        {featured.map((f) => {
          const thumb = f.video_url ? updateThumbnail({ video_url: f.video_url }) : '';
          return (
            <article key={f.id} className="community-featured">
              <span className={`community-tag ${f.kind}`}>{f.kind === 'video' ? 'Video' : f.kind === 'event' ? 'Special event' : 'Valuable content'}</span>
              {thumb && (
                <a href={f.video_url} target="_blank" rel="noopener noreferrer" className="community-thumb">
                  <img src={thumb} alt={f.title} loading="lazy" />
                  <span className="community-play"><Play size={24} fill="currentColor" /></span>
                </a>
              )}
              <h4>{f.title}</h4>
              {f.event_date && (
                <p className="community-event-date"><CalendarDays size={14} /> {new Date(f.event_date).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' })}</p>
              )}
              {f.body && <p className="community-body">{f.body}</p>}
              {f.video_url && !thumb && (
                <a href={f.video_url} target="_blank" rel="noopener noreferrer" className="community-link">Open link</a>
              )}
              {isAdmin && (
                <button type="button" className="community-del" aria-label="Delete" onClick={() => remove('community_content', f.id).then(loadFeatured)}><Trash2 size={14} /></button>
              )}
            </article>
          );
        })}

        <section className="community-about">
          <Users size={22} />
          <div>
            <h3>By landlords, for landlords</h3>
            <p>Ask questions, share tips, and help fellow landlords: finding honest tenants, setting prices, solving problems, and growing your rental business. Be respectful and never share tenants' personal information.</p>
          </div>
        </section>

        <CommunityHighlights />

        <form className="community-compose" onSubmit={submitPost}>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Ask a question or share with fellow landlords..."
            maxLength={1000}
            rows={3}
          />
          <button type="submit" disabled={posting || !draft.trim()}>
            {posting ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />} Post
          </button>
        </form>

        {loading ? (
          <div className="text-center py-10"><Loader2 className="animate-spin text-primary mx-auto" size={36} /></div>
        ) : posts.length === 0 ? (
          <div className="community-empty">No posts yet. Be the first!</div>
        ) : posts.map((p) => {
          const replies = comments[p.id] || [];
          const open = openPost === p.id;
          return (
            <article key={p.id} className="community-post">
              <div className="community-meta">
                <strong>{p.author_name}</strong>
                <span>{timeAgo(p.created_at)}</span>
                {(p.user_id === user?.id || isAdmin) && (
                  <button type="button" aria-label="Delete post" onClick={() => remove('community_posts', p.id)}><Trash2 size={14} /></button>
                )}
              </div>
              <p className="community-body">{p.body}</p>
              <button type="button" className="community-toggle" onClick={() => { setOpenPost(open ? null : p.id); setReplyDraft(''); }}>
                <MessageCircle size={15} /> {replies.length} {replies.length === 1 ? 'reply' : 'replies'}
              </button>
              {open && (
                <div className="community-replies">
                  {replies.map((r) => (
                    <div key={r.id} className="community-reply">
                      <div className="community-meta">
                        <strong>{r.author_name}</strong>
                        <span>{timeAgo(r.created_at)}</span>
                        {(r.user_id === user?.id || isAdmin) && (
                          <button type="button" aria-label="Delete reply" onClick={() => remove('community_comments', r.id)}><Trash2 size={13} /></button>
                        )}
                      </div>
                      <p className="community-body">{r.body}</p>
                    </div>
                  ))}
                  <form className="community-reply-form" onSubmit={(e) => submitReply(e, p.id)}>
                    <input value={replyDraft} onChange={(e) => setReplyDraft(e.target.value)} placeholder="Write a reply..." maxLength={500} />
                    <button type="submit" disabled={!replyDraft.trim()} aria-label="Send reply"><Send size={16} /></button>
                  </form>
                </div>
              )}
            </article>
          );
        })}
      </main>
    </div>
  );
};

const EMPTY_FORM = { full_name: '', phone: '', location: '', property_count: '', reason: '' };

// Gate: only approved members (and superadmin) can enter the community
const CommunityPage = ({ session }) => {
  const user = session?.user;
  const isAdmin = isAdminEmail(user?.email);
  const [member, setMember] = useState(undefined); // undefined = loading, null = has not applied yet
  const [form, setForm] = useState({ ...EMPTY_FORM, full_name: user?.user_metadata?.full_name || '' });
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    if (!showForm) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [showForm]);

  const loadMember = async () => {
    const { data } = await supabase.from('community_members').select('*').eq('user_id', user.id).maybeSingle();
    setMember(data || null);
  };
  useEffect(() => { if (!isAdmin) loadMember(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (isAdmin || member?.status === 'approved') return <CommunityFeed session={session} />;

  const apply = async (e) => {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    const row = {
      user_id: user.id, email: user.email, status: 'pending', decided_at: null,
      full_name: form.full_name.trim(), phone: form.phone.trim(), location: form.location.trim(),
      property_count: form.property_count.trim(), reason: form.reason.trim(),
    };
    const { error } = member
      ? await supabase.from('community_members').update(row).eq('user_id', user.id)
      : await supabase.from('community_members').insert(row);
    setSaving(false);
    if (error) return alert('Could not send application: ' + error.message);
    setShowForm(false);
    loadMember();
  };
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <div className="page-section animate-fade-in">
      <header className="hero saved-hero">
        <HeroBudi message="This community is exclusive to approved landlords." />
        <div className="hero-content">
          <h2>Budget Rent Community</h2>
          <p>Exclusive to approved landlords</p>
        </div>
      </header>
      <main className="community-wrap">
        {member === undefined ? (
          <div className="text-center py-10"><Loader2 className="animate-spin text-primary mx-auto" size={36} /></div>
        ) : member?.status === 'pending' ? (
          <section className="community-about">
            <Clock size={22} />
            <div>
              <h3>Waiting for approval</h3>
              <p>We received your application, {member.full_name}. The admin will review it and you will get a notification once you are approved as a member.</p>
            </div>
          </section>
        ) : (
          <>
            <section className="community-about">
              <Users size={22} />
              <div>
                <h3>{member?.status === 'rejected' ? 'Application not approved' : 'Join the community'}</h3>
                <p>{member?.status === 'rejected' ? 'You can apply again. Please make sure your details are complete and correct.' : 'Tap Apply now and fill out the form. The admin will approve your application before you can enter.'}</p>
              </div>
            </section>
            <button type="button" className="community-apply-btn" onClick={() => setShowForm(true)}>
              <Send size={16} /> Apply now
            </button>
            {showForm && createPortal(
            <div className="community-modal-backdrop" onClick={() => !saving && setShowForm(false)}>
            <form className="community-modal" onSubmit={apply} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Community application">
              <div className="community-modal-head">
                <h3>Apply to Budget Rent Community</h3>
                <button type="button" className="community-modal-close" aria-label="Close" onClick={() => setShowForm(false)} disabled={saving}><X size={18} /></button>
              </div>
              <p className="community-modal-sub">The admin will review your application before you can enter.</p>
              <input className="community-input" placeholder="Full name" value={form.full_name} onChange={set('full_name')} required maxLength={80} />
              <input className="community-input" type="tel" placeholder="Mobile number" value={form.phone} onChange={set('phone')} required maxLength={20} />
              <input className="community-input" placeholder="Rental location (city/town)" value={form.location} onChange={set('location')} required maxLength={100} />
              <input className="community-input" placeholder="How many units/rentals do you have?" value={form.property_count} onChange={set('property_count')} required maxLength={30} />
              <textarea placeholder="Why do you want to join?" value={form.reason} onChange={set('reason')} required maxLength={500} rows={3} />
              <button type="submit" disabled={saving}>
                {saving ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />} Submit application
              </button>
            </form>
            </div>,
            document.body)}
          </>
        )}
        {member !== undefined && <CommunityHighlights />}
      </main>
    </div>
  );
};

export default CommunityPage;
