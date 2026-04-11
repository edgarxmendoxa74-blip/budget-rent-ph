import React, { useState, useEffect } from 'react';
import { Navigation, Loader2, MapPin, Heart, Wifi, Building2, Star } from 'lucide-react';

const FindNearbyPage = ({ listings, onSelectProperty, onViewLandlord, isLandlord }) => {
  const [locating, setLocating] = useState(false);
  const [locationFound, setLocationFound] = useState(false);
  const [nearListings, setNearListings] = useState([]);

  const handleFindNearby = () => {
    setLocating(true);
    // Simulate phone location fetch
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setTimeout(() => {
            setLocating(false);
            setLocationFound(true);
            // Mock nearby algorithm (just shuffle or slice for demo)
            setNearListings(listings.slice(0, 3)); 
          }, 1500);
        },
        (error) => {
          alert('Please enable Location Services to find nearby rentals.');
          setLocating(false);
        }
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
            <h3 style={{ marginBottom: '12px', fontSize: '1.2rem', color: 'var(--primary)' }}>Allow Location Access</h3>
            <p style={{ color: 'var(--text-muted)', marginBottom: '32px', fontSize: '0.95rem' }}>We need your phone location to find the best boarding houses and apartments right around your current area.</p>
            
            <button 
              onClick={handleFindNearby}
              disabled={locating}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: 'var(--primary)', color: 'white', padding: '16px 32px', borderRadius: '30px', border: 'none', fontSize: '1rem', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 4px 12px rgba(37, 99, 235, 0.3)' }}
            >
              {locating ? <><Loader2 size={20} className="animate-spin"/> Locating...</> : <><Navigation size={20}/> Use Phone Location</>}
            </button>
          </div>
        ) : (
          <div className="listings">
            <div className="section-header">
              <h3>Nearby Properties</h3>
              <span>{nearListings.length} found near you</span>
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
                    <div className="rating-tag" style={{ background: '#16a34a' }}>
                      <Navigation size={12} style={{ display: 'inline', marginRight: '4px' }} />
                      Within 2 km
                    </div>
                  </div>
                  <div className="card-info">
                    <h4>{item.name || item.title}</h4>
                    <p className="card-desc">{item.description}</p>
                    <div className="price">
                      ₱{item.price?.toLocaleString() || 0}<span>/month</span>
                    </div>
                    <div className="location">
                      <MapPin size={14} /> {item.location}
                    </div>
                    <div className="property-specs">
                      <span><div className="spec-icon"><Wifi size={10} /></div> {item.wifi || 'No'}</span>
                      <span><div className="spec-icon"><Building2 size={10} /></div> {item.rooms || 1} Room</span>
                      <span><div className="spec-icon"><Star size={10} /></div> {item.cr || 'Shared'}</span>
                    </div>
                    <div 
                      style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '8px 0', cursor: 'pointer' }}
                      onClick={(e) => { e.stopPropagation(); onViewLandlord && onViewLandlord(item); }}
                    >
                      {item.owner_avatar ? (
                        <img src={item.owner_avatar} alt="" style={{ width: '28px', height: '28px', borderRadius: '50%', objectFit: 'cover', border: '1.5px solid var(--primary)' }} />
                      ) : (
                        <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'var(--primary)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 'bold' }}>
                          {(item.owner_name || 'L').charAt(0).toUpperCase()}
                        </div>
                      )}
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{item.owner_name || 'Landlord'}</span>
                    </div>
                    <button className="inquire-btn">Inquire Now</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default FindNearbyPage;
