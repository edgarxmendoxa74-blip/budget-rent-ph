import React, { useState, useEffect } from 'react';
import { Navigation, Loader2, MapPin, Heart, Wifi, Building2, Star, X, ShieldCheck } from 'lucide-react';

const FindNearbyPage = ({ listings, onSelectProperty, onViewLandlord, isLandlord }) => {
  const [locating, setLocating] = useState(false);
  const [locationFound, setLocationFound] = useState(false);
  const [nearListings, setNearListings] = useState([]);
  const [showConfirm, setShowConfirm] = useState(false);

  const handleButtonClick = () => {
    setShowConfirm(true);
  };

  const handleConfirmLocation = () => {
    setShowConfirm(false);
    setLocating(true);
    
    // Simulate phone location fetch with Geolocation API
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          // In a real app, we'd use position.coords.latitude/longitude to filter listings by distance
          // For this demo, we'll simulate a search delay and then show relevant listings
          setTimeout(() => {
            setLocating(false);
            setLocationFound(true);
            
            // Mock nearby algorithm: find properties that might be "near"
            // We'll just take a subset and add a "distance" tag for effect
            const nearby = listings.slice(0, 4).map((item, index) => ({
              ...item,
              distance: (Math.random() * 2 + 0.1).toFixed(1) // Random distance between 0.1 and 2.1km
            }));
            setNearListings(nearby); 
          }, 2000);
        },
        (error) => {
          alert('Location access denied. Please enable Location Services in your browser settings to find nearby rentals.');
          setLocating(false);
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    } else {
      alert("Geolocation is not supported by your browser.");
      setLocating(false);
    }
  };

  return (
    <div className="page-section animate-fade-in" style={{ paddingBottom: '80px', background: 'white' }}>
      <header className="hero" style={{ position: 'relative', background: 'white', color: 'var(--text-color)', borderBottom: '1px solid var(--border)', paddingBottom: '32px' }}>
        <div className="hero-content">
          {!isLandlord && (
            <>
              <h2 style={{ color: 'var(--text-color)' }}>Find Rentals Near You</h2>
              <p style={{ color: 'var(--text-muted)' }}>Discover affordable housing in your immediate area</p>
            </>
          )}
        </div>
      </header>

      <main className="info-page-container" style={{ width: '100%', maxWidth: '800px', padding: '24px' }}>
        {!locationFound ? (
          <div style={{ textAlign: 'center', padding: '40px 20px', borderRadius: '16px' }}>
            <Navigation size={64} style={{ color: 'var(--primary)', margin: '0 auto 24px', opacity: 0.9 }} />
            <h3 style={{ marginBottom: '12px', fontSize: '1.2rem', color: 'var(--primary)' }}>Find Nearby Rentals</h3>
            <p style={{ color: 'var(--text-muted)', marginBottom: '32px', fontSize: '0.95rem' }}>Use your phone's GPS to find the best boarding houses and apartments right around your current location.</p>
            
            <button 
              onClick={handleButtonClick}
              disabled={locating}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: 'var(--primary)', color: 'white', padding: '16px 40px', borderRadius: '30px', border: 'none', fontSize: '1.05rem', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 4px 15px rgba(0, 51, 102, 0.3)', transition: 'transform 0.2s' }}
              onMouseDown={(e) => e.currentTarget.style.transform = 'scale(0.95)'}
              onMouseUp={(e) => e.currentTarget.style.transform = 'scale(1)'}
            >
              {locating ? <><Loader2 size={20} className="animate-spin"/> Locating...</> : <><Navigation size={20}/> Use Phone Location</>}
            </button>
          </div>
        ) : (
          <div className="listings">
            <div className="section-header" style={{ marginBottom: '24px' }}>
              <div>
                <h3 style={{ fontSize: '1.3rem', color: 'var(--primary)' }}>Properties Near You</h3>
                <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>Found {nearListings.length} results within 5km</p>
              </div>
              <button 
                onClick={() => setLocationFound(false)} 
                style={{ background: 'none', border: 'none', color: 'var(--primary)', fontWeight: '600', cursor: 'pointer', fontSize: '0.9rem' }}
              >
                Refresh
              </button>
            </div>
            
            <div className="listing-grid">
              {nearListings.map(item => (
                <div 
                  key={item.id} 
                  className="listing-card animate-slide-up"
                  onClick={() => onSelectProperty(item)}
                  style={{ overflow: 'hidden' }}
                >
                  <div className="image-container">
                    <img src={item.image || '/placeholder.png'} alt={item.name || item.title} />
                    <div className="rating-tag" style={{ background: '#16a34a', padding: '6px 12px', borderRadius: '20px' }}>
                      <Navigation size={12} style={{ display: 'inline', marginRight: '4px' }} />
                      {item.distance} km away
                    </div>
                  </div>
                  <div className="card-info">
                    <h4>{item.name || item.title}</h4>
                    <p className="card-desc" style={{ fontSize: '0.85rem', marginBottom: '12px', color: 'var(--text-muted)' }}>{item.description}</p>
                    <div className="price">
                      ₱{item.price?.toLocaleString() || 0}<span>/month</span>
                    </div>
                    <div className="location" style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '8px' }}>
                      <MapPin size={14} /> {item.location}
                    </div>
                    
                    <div className="property-specs" style={{ marginTop: '12px' }}>
                      <span title="WiFi"><div className="spec-icon"><Wifi size={10} /></div> {item.wifi || 'No'}</span>
                      <span title="Rooms"><div className="spec-icon"><Building2 size={10} /></div> {item.rooms || 1} Room</span>
                      <span title="Bathroom"><div className="spec-icon"><Star size={10} /></div> {item.cr || 'Shared'}</span>
                    </div>

                    <div 
                      style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '16px 0 8px', cursor: 'pointer' }}
                      onClick={(e) => { e.stopPropagation(); onViewLandlord && onViewLandlord(item); }}
                    >
                      {item.owner_avatar ? (
                        <img src={item.owner_avatar} alt="" style={{ width: '28px', height: '28px', borderRadius: '50%', objectFit: 'cover', border: '1.5px solid var(--primary)' }} />
                      ) : (
                        <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'var(--primary)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 'bold' }}>
                          {(item.owner_name || 'L').charAt(0).toUpperCase()}
                        </div>
                      )}
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

      {/* Confirmation Modal */}
      {showConfirm && (
        <div className="modal-overlay" style={{ zIndex: 9999, backgroundColor: 'rgba(0,0,0,0.6)' }} onClick={() => setShowConfirm(false)}>
          <div 
            className="modal-content animate-slide-up" 
            onClick={e => e.stopPropagation()}
            style={{ 
              maxWidth: '400px', 
              borderRadius: '24px', 
              padding: '32px 24px', 
              textAlign: 'center',
              position: 'relative'
            }}
          >
            <button 
              onClick={() => setShowConfirm(false)}
              style={{ position: 'absolute', top: '16px', right: '16px', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
            >
              <X size={24} />
            </button>

            <div style={{ background: 'var(--primary)', width: '64px', height: '64px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', color: 'white' }}>
              <Navigation size={32} />
            </div>

            <h2 style={{ fontSize: '1.4rem', color: 'var(--primary)', marginBottom: '12px' }}>Use Phone Location?</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', lineHeight: '1.6', marginBottom: '24px' }}>
              BudgetRentPH will use your device's location to find and track rental listings closest to you. This helps you find the most convenient housing options.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <button 
                onClick={handleConfirmLocation}
                style={{ 
                  background: 'var(--primary)', 
                  color: 'white', 
                  padding: '16px', 
                  borderRadius: '16px', 
                  border: 'none', 
                  fontSize: '1rem', 
                  fontWeight: 'bold', 
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px'
                }}
              >
                <ShieldCheck size={20} /> Accept & Track
              </button>
              <button 
                onClick={() => setShowConfirm(false)}
                style={{ 
                  background: 'none', 
                  color: 'var(--text-muted)', 
                  padding: '12px', 
                  borderRadius: '16px', 
                  border: '1px solid var(--border)', 
                  fontSize: '0.95rem', 
                  fontWeight: '600', 
                  cursor: 'pointer' 
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FindNearbyPage;
