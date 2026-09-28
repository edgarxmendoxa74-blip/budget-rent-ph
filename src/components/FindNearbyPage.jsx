import React, { useState, useEffect, useRef } from 'react';
import { Navigation, Loader2, MapPin, Wifi, Building2, Star, X, ShieldCheck, Search, AlertCircle, Signal } from 'lucide-react';
import './FindNearbyPage.css';

const FindNearbyPage = ({ listings, reviewStats, onSelectProperty, isLandlord }) => {
  const [locating, setLocating] = useState(false);
  const [locationFound, setLocationFound] = useState(false);
  const [nearListings, setNearListings] = useState([]);
  const [showConfirm, setShowConfirm] = useState(false);
  const [errorType, setErrorType] = useState(null);
  const [manualQuery, setManualQuery] = useState('');
  const watchId = useRef(null);

  const startLiveTracking = () => {
    setShowConfirm(false);
    setLocating(true);
    setErrorType(null);
    
    if (watchId.current) navigator.geolocation.clearWatch(watchId.current);

    if ("geolocation" in navigator) {
      watchId.current = navigator.geolocation.watchPosition(
        () => {
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
    <div className="page-section animate-fade-in" style={{ paddingBottom: '80px', backgroundColor: 'white' }}>
      <header className="hero nearby-hero">
        <div className="hero-content">
          {!isLandlord && (
            <>
              <div className="nearby-title-row">
                <span className="nearby-icon"><Navigation size={22} /></span>
                <h2>Rentals Near You</h2>
                {locationFound && <span className="live-pill"><Signal size={12} className="pulse" /> LIVE</span>}
              </div>
              <p className="nearby-sub">{locationFound ? 'Automatically tracking your current area' : 'Discover affordable housing around your area'}</p>

              <form onSubmit={handleManualSearch} className="search-bar nearby-search">
                <Search className="search-icon" size={20} />
                <input type="text" placeholder="Enter City or Area..." value={manualQuery} onChange={(e) => setManualQuery(e.target.value)} />
                <button type="submit" className="nearby-search-btn">Search</button>
              </form>
            </>
          )}
        </div>
      </header>

      <main className="info-page-container" style={{ width: '100%', maxWidth: '800px', padding: '6px' }}>
        {!locationFound ? (
          <div className="near-empty">
            {errorType === 'denied' ? (
              <div className="near-error-card animate-fade-in">
                <AlertCircle size={44} />
                <h3>Location Access Required</h3>
                <p>
                  Please enable "Location" in your <b>Phone Settings</b> for this app to see properties near you automatically. Or use the manual search above.
                </p>
              </div>
            ) : (
              <div>
                <div className="near-pin"><MapPin size={42} /></div>
                <h3>Start Automatic Tracking</h3>

                <button
                  onClick={handleButtonClick}
                  disabled={locating}
                  className="near-cta"
                >
                  {locating ? <><Loader2 size={22} className="animate-spin" /> Initializing...</> : <><MapPin size={20} /> Activate Live GPS</>}
                </button>

                <p className="near-reminder">
                  <strong>Reminder</strong>
                  Go to your <b>Phone Settings</b> &gt; <b>Location</b> then turn it <b>ON</b>. This allows the app to show listings updated in real-time as you move.
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="listings">
            <div className="nearby-head">
              <div>
                <h3>Best Matches Nearby</h3>
                <p className="gps-status"><span className="gps-dot" /> GPS Connected • Updating Live</p>
              </div>
              <button
                className="stop-gps-btn"
                onClick={() => { setLocationFound(false); setErrorType(null); if (watchId.current) navigator.geolocation.clearWatch(watchId.current); }}
              >
                Stop GPS
              </button>
            </div>
            
            <div className="listing-grid">
              {nearListings.map(item => (
                <div 
                  key={item.id} 
                  className="listing-card animate-slide-up" 
                  onClick={() => onSelectProperty(item)}
                >
                  <div className="image-container">
                    <img src={item.image || '/placeholder.png'} alt={item.name || item.title} />
                    <span className="near-distance">
                      <MapPin size={11} /> {item.distance ? `${item.distance} km` : 'Nearby'}
                    </span>
                  </div>
                    <div className="card-info">
                      <h4 className="card-title">{item.location?.split(',')[0] || item.name}</h4>
                      <p className="card-subtitle">
                        {item.type || 'Rental'} • {item.distance ? `${item.distance} km` : 'Nearby'}
                      </p>
                      
                      <div className="card-price-row">
                        <span className="price-tag">₱{item.price?.toLocaleString() || 0}</span>
                        <span className="price-period">/month</span>
                        {reviewStats?.get(item.id)?.count > 0 && (
                          <span
                            className="card-rating"
                            title={`${reviewStats.get(item.id).avg.toFixed(1)} out of 5`}
                          >
                            <Star size={11} fill="currentColor" strokeWidth={0} />
                            {reviewStats.get(item.id).avg.toFixed(1)}
                            <em>({reviewStats.get(item.id).count})</em>
                          </span>
                        )}
                      </div>
                      
                      <button 
                        className="card-inquire-btn"
                        aria-label="Book this listing"
                        title="Book this listing"
                        onClick={(e) => { e.stopPropagation(); onSelectProperty(item); }}
                      >
                        📅
                      </button>
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
            <div className="near-confirm-icon"><Signal size={34} className="pulse" /></div>
            <h2 style={{ fontSize: '1.4rem', color: 'var(--primary)', marginBottom: '10px', fontWeight: 800 }}>Enable Real-time Tracking?</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.92rem', lineHeight: '1.6', marginBottom: '24px' }}>BudgetRentPH will track your movement to keep you updated with the nearest boarding houses in real-time.</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <button onClick={startLiveTracking} className="near-confirm-allow"><ShieldCheck size={20} /> Allow Live GPS</button>
              <button onClick={() => setShowConfirm(false)} className="near-confirm-cancel">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FindNearbyPage;
