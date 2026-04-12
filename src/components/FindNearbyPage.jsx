import React, { useState, useEffect, useRef } from 'react';
import { Navigation, Loader2, MapPin, Heart, Wifi, Building2, Star, X, ShieldCheck, Search, AlertCircle, Signal } from 'lucide-react';

const FindNearbyPage = ({ listings, onSelectProperty, onViewLandlord, isLandlord }) => {
  const [locating, setLocating] = useState(false);
  const [locationFound, setLocationFound] = useState(false);
  const [nearListings, setNearListings] = useState([]);
  const [showConfirm, setShowConfirm] = useState(false);
  const [errorType, setErrorType] = useState(null);
  const [manualQuery, setManualQuery] = useState('');
  const watchId = useRef(null);

  // Auto-track on mount if permission exists (Grab-like)
  useEffect(() => {
    if ("permissions" in navigator) {
      navigator.permissions.query({ name: 'geolocation' }).then(result => {
        if (result.state === 'granted') {
          startLiveTracking();
        }
        result.onchange = () => {
          if (result.state === 'granted') startLiveTracking();
        };
      });
    }

    return () => {
      if (watchId.current) navigator.geolocation.clearWatch(watchId.current);
    };
  }, []);

  const handleButtonClick = () => {
    setShowConfirm(true);
  };

  const startLiveTracking = () => {
    setShowConfirm(false);
    setLocating(true);
    setErrorType(null);
    
    if (watchId.current) navigator.geolocation.clearWatch(watchId.current);

    if ("geolocation" in navigator) {
      watchId.current = navigator.geolocation.watchPosition(
        (position) => {
          // Success! In a real app we use position.coords.latitude/longitude
          setLocating(false);
          setLocationFound(true);
          
          // Re-sort or simulate update when position changes
          const nearby = listings.slice(0, 4).map((item) => ({
            ...item,
            distance: (Math.random() * 1.5 + 0.1).toFixed(1)
          }));
          setNearListings(nearby);
        },
        (error) => {
          setLocating(false);
          if (error.code === error.PERMISSION_DENIED) {
            setErrorType('denied');
          } else {
            setErrorType('unavailable');
          }
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    }
  };

  const handleManualSearch = (e) => {
    e?.preventDefault();
    if (!manualQuery.trim()) return;
    
    setLocating(true);
    setErrorType(null);
    
    setTimeout(() => {
      setLocating(false);
      setLocationFound(true);
      const results = listings.filter(item => 
        item.location.toLowerCase().includes(manualQuery.toLowerCase()) || 
        (item.name || item.title || "").toLowerCase().includes(manualQuery.toLowerCase())
      );
      setNearListings(results.length > 0 ? results : listings.slice(0, 3)); 
    }, 1500);
  };

  return (
    <div className="page-section animate-fade-in" style={{ paddingBottom: '80px', background: 'white' }}>
      <header className="hero" style={{ position: 'relative', background: 'white', color: 'var(--text-color)', borderBottom: '1px solid var(--border)', paddingBottom: '32px' }}>
        <div className="hero-content">
          {!isLandlord && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '8px' }}>
                <h2 style={{ color: 'var(--text-color)', margin: 0 }}>Rentals Near You</h2>
                {locationFound && <div className="live-pill"><Signal size={12} className="pulse" /> LIVE</div>}
              </div>
              <p style={{ color: 'var(--text-muted)' }}>{locationFound ? 'Automatically tracking your current area' : 'Discover affordable housing around your area'}</p>
            </>
          )}
        </div>
      </header>

      <style>{`
        .live-pill {
          background: #ef4444;
          color: white;
          padding: 2px 8px;
          border-radius: 20px;
          font-size: 0.65rem;
          font-weight: 800;
          display: flex;
          align-items: center;
          gap: 4px;
        }
        .pulse {
          animation: pulse-animation 1.5s infinite;
        }
        @keyframes pulse-animation {
          0% { opacity: 1; }
          50% { opacity: 0.3; }
          100% { opacity: 1; }
        }
      `}</style>

      <main className="info-page-container" style={{ width: '100%', maxWidth: '800px', padding: '24px' }}>
        {!locationFound ? (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            {errorType === 'denied' ? (
              <div className="animate-fade-in" style={{ background: '#fef2f2', padding: '24px', borderRadius: '16px', border: '1px solid #fee2e2', marginBottom: '24px' }}>
                <AlertCircle size={48} style={{ color: '#ef4444', marginBottom: '16px' }} />
                <h3 style={{ color: '#991b1b', marginBottom: '8px' }}>Tracking Blocked</h3>
                <p style={{ color: '#b91c1c', fontSize: '0.9rem', marginBottom: '20px' }}>
                  Please enable "Location" in your browser settings or lock icon to see properties near you automatically.
                </p>
                <div style={{ fontSize: '0.85rem', fontWeight: 'bold', marginBottom: '12px' }}>Search manually instead:</div>
                <form onSubmit={handleManualSearch} className="search-bar" style={{ background: 'white', maxWidth: '100%' }}>
                  <Search size={18} />
                  <input type="text" placeholder="E.g. Sampaloc, Manila" value={manualQuery} onChange={(e) => setManualQuery(e.target.value)} />
                  <button type="submit" style={{ background: 'var(--primary)', color: 'white', border: 'none', borderRadius: '8px', padding: '6px 12px', fontWeight: 'bold' }}>Go</button>
                </form>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '20px 0' }}>
                <Navigation size={64} style={{ color: 'var(--primary)', margin: '0 auto 24px', opacity: 0.9 }} />
                <h3 style={{ marginBottom: '12px', fontSize: '1.2rem', color: 'var(--primary)' }}>Start Automatic Tracking</h3>
                <p style={{ color: 'var(--text-muted)', marginBottom: '32px', fontSize: '0.95rem' }}>Open your location to view boarding houses and apartments updated in real-time as you move.</p>
                
                <button 
                  onClick={handleButtonClick}
                  disabled={locating}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '10px', background: 'var(--primary)', color: 'white', padding: '18px 45px', borderRadius: '30px', border: 'none', fontSize: '1.1rem', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 8px 20px rgba(0, 51, 102, 0.3)' }}
                >
                  {locating ? <><Loader2 size={24} className="animate-spin"/> Initializing...</> : <><Navigation size={22}/> Activate Live GPS</>}
                </button>
                
                <div style={{ margin: '32px 0 24px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ flex: 1, height: '1px', background: 'var(--border)' }}></div>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 'bold' }}>OR SEARCH MANUALLY</span>
                  <div style={{ flex: 1, height: '1px', background: 'var(--border)' }}></div>
                </div>

                <form onSubmit={handleManualSearch} className="search-bar" style={{ maxWidth: '100%', height: '55px' }}>
                  <Search size={20} />
                  <input type="text" placeholder="Enter City or Area..." value={manualQuery} onChange={(e) => setManualQuery(e.target.value)} />
                  <button type="submit" style={{ background: 'var(--primary)', color: 'white', border: 'none', borderRadius: '10px', padding: '10px 20px', fontWeight: 'bold' }}>Search</button>
                </form>
              </div>
            )}
          </div>
        ) : (
          <div className="listings">
            <div className="section-header" style={{ marginBottom: '24px' }}>
              <div>
                <h3 style={{ fontSize: '1.3rem', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  Best Matches Nearby
                </h3>
                <p style={{ fontSize: '0.9rem', color: '#16a34a', fontWeight: '600' }}>GPS Connected • Updating Live</p>
              </div>
              <button 
                onClick={() => { setLocationFound(false); setErrorType(null); if (watchId.current) navigator.geolocation.clearWatch(watchId.current); }} 
                style={{ background: '#f1f5f9', border: 'none', padding: '8px 16px', borderRadius: '100px', color: 'var(--text-muted)', fontWeight: '600', cursor: 'pointer', fontSize: '0.85rem' }}
              >
                Stop Live GPS
              </button>
            </div>
            
            <div className="listing-grid">
              {nearListings.map(item => (
                <div key={item.id} className="listing-card animate-slide-up" onClick={() => onSelectProperty(item)} style={{ overflow: 'hidden' }}>
                  <div className="image-container">
                    <img src={item.image || '/placeholder.png'} alt={item.name || item.title} />
                    <div className="rating-tag" style={{ background: '#16a34a', padding: '6px 12px', borderRadius: '20px' }}>
                      <Navigation size={12} style={{ display: 'inline', marginRight: '4px' }} />
                      {item.distance ? `${item.distance} km away` : 'Nearby'}
                    </div>
                  </div>
                  <div className="card-info">
                    <h4>{item.name || item.title}</h4>
                    <p className="card-desc">{item.description}</p>
                    <div className="price">₱{item.price?.toLocaleString() || 0}<span>/month</span></div>
                    <div className="location"><MapPin size={14} /> {item.location}</div>
                    
                    <div className="property-specs">
                      <span><div className="spec-icon"><Wifi size={10} /></div> {item.wifi || 'No'}</span>
                      <span><div className="spec-icon"><Building2 size={10} /></div> {item.rooms || 1} Room</span>
                      <span><div className="spec-icon"><Star size={10} /></div> {item.cr || 'Shared'}</span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '16px 0 8px', cursor: 'pointer' }} onClick={(e) => { e.stopPropagation(); onViewLandlord && onViewLandlord(item); }}>
                      {item.owner_avatar ? <img src={item.owner_avatar} alt="" style={{ width: '28px', height: '28px', borderRadius: '50%', objectFit: 'cover', border: '1.5px solid var(--primary)' }} /> : <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'var(--primary)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 'bold' }}>{(item.owner_name || 'L').charAt(0).toUpperCase()}</div>}
                      <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: '500' }}>{item.owner_name || 'Landlord'}</span>
                    </div>
                    <button className="inquire-btn" style={{ width: '100%', marginTop: '8px' }}>Inquire Now</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {showConfirm && (
        <div className="modal-overlay" style={{ zIndex: 9999, backgroundColor: 'rgba(0,0,0,0.6)' }} onClick={() => setShowConfirm(false)}>
          <div className="modal-content animate-slide-up" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px', borderRadius: '24px', padding: '32px 24px', textAlign: 'center', position: 'relative' }}>
            <button onClick={() => setShowConfirm(false)} style={{ position: 'absolute', top: '16px', right: '16px', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={24} /></button>
            <div style={{ background: 'var(--primary)', width: '72px', height: '72px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', color: 'white' }}><Signal size={36} className="pulse" /></div>
            <h2 style={{ fontSize: '1.5rem', color: 'var(--primary)', marginBottom: '12px' }}>Enable Real-time Tracking?</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', lineHeight: '1.6', marginBottom: '24px' }}>BudgetRentPH will track your movement to keep you updated with the nearest boarding houses in real-time.</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <button onClick={startLiveTracking} style={{ background: 'var(--primary)', color: 'white', padding: '16px', borderRadius: '16px', border: 'none', fontSize: '1rem', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}><ShieldCheck size={20} /> Allow Live GPS</button>
              <button onClick={() => setShowConfirm(false)} style={{ background: 'none', color: 'var(--text-muted)', padding: '12px', borderRadius: '16px', border: '1px solid var(--border)', fontSize: '0.95rem', fontWeight: '600', cursor: 'pointer' }}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FindNearbyPage;
