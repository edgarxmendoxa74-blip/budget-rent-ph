import React, { useState } from 'react';
import { Star, Loader2, Trash2, Pencil, Check, X, MessageSquare } from 'lucide-react';
import { supabase } from '../lib/supabase';
import './ReviewsSection.css';

const MAX_COMMENT = 500;

export const StarRow = ({ value, size = 14, onChange, label }) => {
  const interactive = typeof onChange === 'function';
  return (
    <div className={`rev-stars${interactive ? ' interactive' : ''}`} role={interactive ? 'radiogroup' : undefined} aria-label={label || 'Rating'}>
      {[1, 2, 3, 4, 5].map(n => (
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

const ReviewsSection = ({ property, session, isGuest, reviews, loading, onChanged }) => {
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

  const userId = session?.user?.id;
  const isOwner = Boolean(userId && property?.user_id && property.user_id === userId);
  const myReview = userId ? reviews.find(r => r.user_id === userId) : null;
  const canReview = Boolean(userId) && !isGuest && !isOwner;

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
      setError('Pumili muna ng rating (1–5 stars).');
      return;
    }
    if (comment.trim().length > MAX_COMMENT) {
      setError(`Masyadong mahaba ang comment. Max ${MAX_COMMENT} characters.`);
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
      setError(err?.message || 'Hindi na-post ang review. Subukan muli.');
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
      setError(err?.message || 'Hindi na-delete ang review.');
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
        {stats.count > 0 && (
          <div className="reviews-summary">
            <Star size={15} fill="currentColor" />
            <strong>{avg.toFixed(1)}</strong>
            <span>· {stats.count} review{stats.count > 1 ? 's' : ''}</span>
          </div>
        )}
      </div>

      {loading ? (
        <div className="reviews-loading"><Loader2 size={20} className="animate-spin" /> Loading reviews...</div>
      ) : (
        <>
          {stats.count === 0 ? (
            <div className="reviews-empty">
              <Star size={28} />
              <p>Wala pang reviews para sa listing na ito.</p>
              {canReview && <span>Ang unang mag-review — tulungan ang iba sa pipiliin nila.</span>}
            </div>
          ) : (
            <ul className="reviews-list">
              {reviews.map(r => {
                const mine = r.user_id === userId;
                return (
                  <li key={r.id} className={`review-item${mine ? ' mine' : ''}`}>
                    <div className="review-avatar">
                      {r.reviewer_avatar ? (
                        <img src={r.reviewer_avatar} alt="" loading="lazy" />
                      ) : (
                        <span>{(r.reviewer_name || 'R').charAt(0).toUpperCase()}</span>
                      )}
                    </div>
                    <div className="review-body">
                      <div className="review-meta">
                        <span className="review-name">
                          {r.reviewer_name || 'Reviewer'}
                          {mine && <em className="review-you">Ikaw</em>}
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
              <Pencil size={14} /> I-edit ang iyong review
            </button>
          )}

          {showForm && (
            <form className="review-form" onSubmit={handleSubmit}>
              <h4>{editing ? 'I-edit ang review' : 'Mag-iwan ng review'}</h4>
              <div className="review-form-rating">
                <StarRow value={rating} size={22} onChange={setRating} label="Ang iyong rating" />
                <span className="review-form-hint">
                  {rating > 0 ? `${rating}/5` : 'Piliin ang rating'}
                </span>
              </div>
              <textarea
                className="review-form-textarea"
                placeholder="Ano ang naging experience mo sa listing na ito? (optional)"
                value={comment}
                maxLength={MAX_COMMENT}
                onChange={(e) => setComment(e.target.value)}
                rows={3}
              />
              <div className="review-form-footer">
                <span className="review-char-count">{comment.length}/{MAX_COMMENT}</span>
                <div className="review-form-buttons">
                  {editing && (
                    <button type="button" className="review-btn cancel" onClick={resetForm} disabled={submitting}>
                      <X size={14} /> Cancel
                    </button>
                  )}
                  <button type="submit" className="review-btn submit" disabled={submitting || rating < 1}>
                    {submitting ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                    {editing ? 'I-save' : 'Post Review'}
                  </button>
                </div>
              </div>
            </form>
          )}

          {!canReview && (
            <p className="review-gate">
              {isGuest
                ? 'Mag-sign in upang makapag-review ng listing.'
                : isOwner
                  ? 'Ikaw ang may-ari ng listing na ito — hindi ka puwedeng mag-review sa sarili mo.'
                  : 'Mag-sign in upang makapag-review.'}
            </p>
          )}

          {error && <div className="review-error">{error}</div>}
        </>
      )}
    </section>
  );
};

export default ReviewsSection;
