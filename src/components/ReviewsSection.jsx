import React, { useState } from 'react';
import { Star, Loader2, Trash2, Pencil, Check, X, MessageSquare } from 'lucide-react';
import { supabase } from '../lib/supabase';
import './ReviewsSection.css';
import { ikImage } from '../lib/imagekit';

const MAX_WORDS = 30;
const MAX_STARS = 5;
const countWords = (t) => (t.trim() ? t.trim().split(/\s+/).length : 0);
const limitWords = (t) => {
  let words = 0;
  let out = '';
  for (const part of t.split(/(\s+)/)) {
    if (part && !/^\s+$/.test(part) && ++words > MAX_WORDS) break;
    out += part;
  }
  return out;
};

export const StarRow = ({ value, size = 14, onChange, label, max = MAX_STARS }) => {
  const interactive = typeof onChange === 'function';
  return (
    <div className={`rev-stars${interactive ? ' interactive' : ''}`} role={interactive ? 'radiogroup' : undefined} aria-label={label || 'Rating'}>
      {Array.from({ length: Math.max(max, value || 0) }, (_, i) => i + 1).map(n => (
        <button
          key={n}
          type="button"
          className={`rev-star${n <= value ? ' on' : ''}`}
          onClick={interactive ? () => onChange(n) : undefined}
          disabled={!interactive}
          aria-label={`${n} star${n > 1 ? 's' : ''}`}
          tabIndex={interactive ? 0 : -1}
        >
          <Star size={size} fill={n <= value ? 'currentColor' : 'none'} strokeWidth={2} />
        </button>
      ))}
    </div>
  );
};

const ReviewsSection = ({ property, session, reviews, loading, onChanged }) => {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [editing, setEditing] = useState(false);

  const stats = reviews.reduce((acc, r) => {
    acc.sum += Number(r.rating) || 0;
    acc.count += 1;
    return acc;
  }, { sum: 0, count: 0 });
  const avg = stats.count ? stats.sum / stats.count : 0;
  const distribution = reviews.reduce((acc, r) => {
    const n = Math.min(MAX_STARS, Math.max(1, Math.round(Number(r.rating) || 0)));
    acc[n] += 1;
    return acc;
  }, { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 });

  const userId = session?.user?.id;
  const isOwner = Boolean(userId && property?.user_id && property.user_id === userId);
  const myReview = userId ? reviews.find(r => r.user_id === userId) : null;
  // May account lang ang puwedeng mag-review (isa kada listing; may unique constraint sa database)
  const canReview = Boolean(userId) && !isOwner;

  const resetForm = () => {
    setRating(0);
    setComment('');
    setError(null);
    setEditing(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canReview) return;
    if (rating < 1) {
      setError('Please choose a rating first (1–5 stars).');
      return;
    }
    if (countWords(comment) > MAX_WORDS) {
      setError(`Your review is too long. Max ${MAX_WORDS} words.`);
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const meta = session.user.user_metadata || {};
      const payload = {
        property_id: property.id,
        user_id: userId,
        rating,
        comment: comment.trim() || null,
        reviewer_name: meta.full_name || session.user.email?.split('@')[0] || 'Reviewer',
        reviewer_avatar: meta.avatar_url || null,
      };

      const { error: upsertError } = await supabase
        .from('property_reviews')
        .upsert(payload, { onConflict: 'property_id,user_id' });

      if (upsertError) throw upsertError;

      resetForm();
      onChanged?.();
    } catch (err) {
      setError(err?.message || 'Couldn’t post your review. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!myReview) return;
    setSubmitting(true);
    setError(null);
    try {
      const { error: delError } = await supabase
        .from('property_reviews')
        .delete()
        .eq('id', myReview.id);
      if (delError) throw delError;
      resetForm();
      onChanged?.();
    } catch (err) {
      setError(err?.message || 'Couldn’t delete your review.');
    } finally {
      setSubmitting(false);
    }
  };

  const startEdit = () => {
    setRating(myReview?.rating || 0);
    setComment(myReview?.comment || '');
    setEditing(true);
    setError(null);
  };

  const formatDate = (iso) => {
    try {
      return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return '';
    }
  };

  const showForm = canReview && (!myReview || editing);

  return (
    <section className="reviews-section">
      <div className="divider" style={{ margin: '0 0 20px' }} />

      <div className="reviews-head">
        <div className="reviews-title">
          <MessageSquare size={18} />
          <h3>Customer Reviews</h3>
        </div>
      </div>

      {stats.count > 0 && (
        <div className="reviews-overview">
          <div className="reviews-score">
            <strong>{avg.toFixed(1)}</strong>
            <StarRow value={Math.round(avg)} size={15} label={`Average rating ${avg.toFixed(1)} out of ${MAX_STARS}`} />
            <span>{stats.count} review{stats.count > 1 ? 's' : ''}</span>
          </div>
          <ul className="reviews-bars" aria-label="Rating breakdown">
            {[5, 4, 3, 2, 1].map(n => (
              <li key={n}>
                <span>{n}</span>
                <div className="reviews-bar"><i style={{ width: `${(distribution[n] / stats.count) * 100}%` }} /></div>
                <em>{distribution[n]}</em>
              </li>
            ))}
          </ul>
        </div>
      )}

      {loading ? (
        <div className="reviews-loading"><Loader2 size={20} className="animate-spin" /> Loading reviews...</div>
      ) : (
        <>
          {stats.count === 0 ? (
            <div className="reviews-empty">
              <Star size={28} />
              <p>No reviews for this listing yet.</p>
              {canReview && <span>Be the first to review — help others decide.</span>}
            </div>
          ) : (
            <ul className="reviews-list">
              {reviews.map(r => {
                const mine = r.user_id === userId;
                return (
                  <li key={r.id} className={`review-item${mine ? ' mine' : ''}`}>
                    <div className="review-avatar">
                      {r.reviewer_avatar ? (
                        <img src={ikImage(r.reviewer_avatar, 80)} alt="" loading="lazy" />
                      ) : (
                        <span>{(r.reviewer_name || 'R').charAt(0).toUpperCase()}</span>
                      )}
                    </div>
                    <div className="review-body">
                      <div className="review-meta">
                        <span className="review-name">
                          {r.reviewer_name || 'Reviewer'}
                          {mine && <em className="review-you">You</em>}
                        </span>
                        <span className="review-date">{formatDate(r.created_at)}</span>
                      </div>
                      <StarRow value={Number(r.rating) || 0} size={13} />
                      {r.comment && <p className="review-comment">{r.comment}</p>}
                      {mine && !editing && canReview && (
                        <div className="review-actions">
                          <button type="button" onClick={startEdit} disabled={submitting}>
                            <Pencil size={12} /> Edit
                          </button>
                          <button type="button" className="danger" onClick={handleDelete} disabled={submitting}>
                            {submitting ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />} Delete
                          </button>
                        </div>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          {canReview && myReview && !editing && (
            <button type="button" className="reviews-write-btn" onClick={startEdit}>
              <Pencil size={14} /> Edit your review
            </button>
          )}

          {showForm && (
            <form className="review-form" onSubmit={handleSubmit}>
              <h4>{editing ? 'Edit review' : 'Leave a review'}</h4>
              <div className="review-form-rating">
                <StarRow value={rating} size={22} onChange={setRating} label="Your rating" />
                <span className="review-form-hint">
                  {rating > 0 ? `${rating}/${MAX_STARS}` : 'Select a rating'}
                </span>
              </div>
              <textarea
                className="review-form-textarea"
                placeholder="How was your experience with this listing? (optional)"
                value={comment}
                onChange={(e) => setComment(limitWords(e.target.value))}
                rows={3}
              />
              <div className="review-form-footer">
                <span className="review-char-count">{countWords(comment)}/{MAX_WORDS} words</span>
                <div className="review-form-buttons">
                  {editing && (
                    <button type="button" className="review-btn cancel" onClick={resetForm} disabled={submitting}>
                      <X size={14} /> Cancel
                    </button>
                  )}
                  <button type="submit" className="review-btn submit" disabled={submitting || rating < 1}>
                    {submitting ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                    {editing ? 'Save' : 'Post Review'}
                  </button>
                </div>
              </div>
            </form>
          )}

          {isOwner && (
            <p className="review-gate">
              You own this listing — you can’t review your own listing.
            </p>
          )}
          {!userId && (
            <p className="review-gate">Log in to leave a review.</p>
          )}

          {error && <div className="review-error">{error}</div>}
        </>
      )}
    </section>
  );
};

export default ReviewsSection;
