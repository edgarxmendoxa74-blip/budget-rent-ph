import React, { useEffect, useRef, useState } from 'react';

const INTERVAL_MS = 4500;

export default function HeroSlideshow({ slides: allSlides }) {
  const slides = allSlides.filter(sl => sl.enabled !== false);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const touchX = useRef(null);
  const count = slides.length;

  useEffect(() => {
    if (paused || count < 2) return undefined;
    const t = setInterval(() => setIndex(i => (i + 1) % count), INTERVAL_MS);
    return () => clearInterval(t);
  }, [paused, count, index]);

  useEffect(() => { if (index >= count) setIndex(0); }, [index, count]);

  const go = (i) => setIndex((i + count) % count);

  const onTouchStart = (e) => { touchX.current = e.touches[0].clientX; setPaused(true); };
  const onTouchEnd = (e) => {
    const dx = e.changedTouches[0].clientX - (touchX.current ?? 0);
    if (Math.abs(dx) > 40) go(index + (dx < 0 ? 1 : -1));
    touchX.current = null;
    setPaused(false);
  };

  if (count === 0) return null;

  return (
    <section className="why-section" aria-label="Bakit Budget Rent">
      <h3 className="why-heading">Bakit Budget Rent?</h3>
      <div
        className="why-slideshow"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
      >
        <div className="why-track" style={{ transform: `translateX(-${index * 100}%)` }}>
          {slides.map((sl, i) => (
            <article className="why-slide" key={i} aria-hidden={i !== index}>
              {sl.image && <img src={sl.image} alt={sl.title} />}
              <div className="why-body">
                <h4>{sl.title}</h4>
                <p>{sl.description}</p>
              </div>
            </article>
          ))}
        </div>
      </div>
      <div className="why-dots">
        {slides.map((_, i) => (
          <button key={i} type="button" className={i === index ? 'active' : ''} aria-label={`Slide ${i + 1}`} onClick={() => go(i)} />
        ))}
      </div>
    </section>
  );
}
