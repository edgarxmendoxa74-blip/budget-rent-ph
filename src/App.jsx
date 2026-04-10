import React, { useState, useEffect } from 'react';
import { Search, MapPin, Bed, Bath, Wifi, Shield, Star, Menu, X, Heart, MessageCircle, Phone, LogOut, Building2, User, Loader2, ClipboardList, Mail } from 'lucide-react';
import { supabase } from './lib/supabase';
import Auth from './components/Auth';
import PropertyForm from './components/PropertyForm';
import ProfileModal from './components/ProfileModal';
import EditListings from './components/EditListings';
import './App.css';

const LISTINGS = [
  {
    id: 1,
    title: "Premium Male Boarding House",
    type: "Boarding House",
    price: 3500,
    location: "Sampaloc, Manila",
    image: "/boarding.png",
    rating: 4.8,
    amenities: ["WiFi", "Laundry", "24/7 Security"],
    description: "Located near UST, this boarding house offers a quiet study environment with high-speed internet and regular housekeeping."
  },
  {
    id: 2,
    title: "Cozy Bedspace for Females",
    type: "Bed Space",
    price: 2500,
    location: "Katipunan, Quezon City",
    image: "/bedspace.png",
    rating: 4.5,
    amenities: ["WiFi", "Aircon", "Near Mall"],
    description: "A secure and friendly bedspace perfect for students and young professionals. Walking distance to UP and Ateneo."
  },
  {
    id: 3,
    title: "Modern Studio Apartment",
    type: "Apartment",
    price: 8500,
    location: "Makati City",
    image: "/studio.png",
    rating: 4.9,
    amenities: ["WiFi", "Kitchen", "Gym Access"],
    description: "Centrally located in Makati, this studio is perfect for solo living. High-end finishes and great city view."
  },
  {
    id: 4,
    title: "Budget Bedspace near LRT",
    type: "Bed Space",
    price: 1800,
    location: "Pasay City",
    image: "/bedspace.png",
    rating: 4.2,
    amenities: ["Fan", "Storage", "CCTV"],
    description: "Very affordable bedspace for commute-heavy professionals. Just 2 mins away from LRT Libertad station."
  }
];

const CATEGORIES = ["All", "Boarding House", "Bed Space", "Apartment"];

function App() {
  const [session, setSession] = useState(null);
  const [properties, setProperties] = useState([]); // Dynamic properties state
  const [loading, setLoading] = useState(true);
  const [isGuest, setIsGuest] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isPropertyFormOpen, setIsPropertyFormOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isProfileEditing, setIsProfileEditing] = useState(false);
  const [isEditListingsOpen, setIsEditListingsOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedProperty, setSelectedProperty] = useState(null);
  const [favorites, setFavorites] = useState([]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    fetchProperties(); // Initial fetch

    return () => subscription.unsubscribe();
  }, []);

  const fetchProperties = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('properties')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setProperties(data || []);
    } catch (error) {
      console.error('Error fetching properties:', error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setIsGuest(false);
    setIsMenuOpen(false);
  };

  const filteredListings = properties.filter(item => {
    const matchesCategory = selectedCategory === "All" || item.type === selectedCategory;
    const matchesSearch = (item.name || item.title || "").toLowerCase().includes(searchQuery.toLowerCase()) || 
                          item.location.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const toggleFavorite = (id) => {
    setFavorites(prev => prev.includes(id) ? prev.filter(f => f !== id) : [...prev, id]);
  };

  if (!session && !isGuest) {
    return <Auth onAuthSuccess={() => setIsGuest(true)} />;
  }

  return (
    <div className="app-container">
      {/* Navbar */}
      <nav className="navbar glass">
        <div className="nav-content">
          <div className="logo-section">
            <img src="/logo.png" alt="Logo" className="logo-img" />
            <h1 className="brand-name">BudgetRent<span>PH</span></h1>
          </div>
          <div className="nav-actions">
            {!isGuest && <button className="list-property-btn desktop-only" onClick={() => setIsPropertyFormOpen(true)}>List your property</button>}
            <button className="menu-btn" onClick={() => setIsMenuOpen(true)}>
              <Menu size={24} />
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile Menu Drawer */}
      {isMenuOpen && (
        <div className="mobile-menu-overlay" onClick={() => setIsMenuOpen(false)}>
          <div className="mobile-menu-content animate-slide-left" onClick={e => e.stopPropagation()}>
            <div className="menu-header">
              <div className="logo-section">
                <img src="/logo.png" alt="Logo" className="logo-img" />
                <h1 className="brand-name">BudgetRent<span>PH</span></h1>
              </div>
              <button className="close-menu" onClick={() => setIsMenuOpen(false)}><X size={24} /></button>
            </div>
            
            <div className="menu-items">
              {isGuest && (
                <>
                  <button className="menu-link" onClick={() => setIsMenuOpen(false)}>
                    <Search size={20} /> Explore Homes
                  </button>
                  <button className="menu-link" onClick={() => setIsMenuOpen(false)}>
                    <Heart size={20} /> Saved Listings
                  </button>
                </>
              )}
              {!isGuest && (
                <>
                  <button className="menu-link highlight" onClick={() => { setIsMenuOpen(false); setIsPropertyFormOpen(true); }}>
                    <Shield size={20} /> List your property
                  </button>
                  <button className="menu-link" onClick={() => { setIsMenuOpen(false); setIsEditListingsOpen(true); }}>
                    <ClipboardList size={20} /> Edit Listings
                  </button>
                  <button className="menu-link" onClick={() => { setIsMenuOpen(false); setIsProfileEditing(true); setIsProfileModalOpen(true); }}>
                    <User size={20} /> Contact & Profile
                  </button>
                </>
              )}
              
              <div className="menu-divider"></div>
              
              <button className="menu-link logout" onClick={handleLogout}>
                <LogOut size={20} /> Sign Out
              </button>
            </div>

            <div className="menu-footer">
              <p>© 2026 Budget Rent PH</p>
              <div className="social-links">
                <Phone size={18} />
                <MessageCircle size={18} />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Hero / Search */}
      <header className="hero">
        <div className="hero-content">
          <h2>Find your next home</h2>
          <p>Affordable rentals across the Philippines</p>
          <div className="search-bar">
            <Search className="search-icon" size={20} />
            <input 
              type="text" 
              placeholder="Search by city or area..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
      </header>

      {/* Categories */}
      <div className="category-scroll">
        {CATEGORIES.map(cat => (
          <button 
            key={cat} 
            className={`category-chip ${selectedCategory === cat ? 'active' : ''}`}
            onClick={() => setSelectedCategory(cat)}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Listing Grid */}
      <main className="listings">
        <div className="section-header">
          <h3>Local Listings</h3>
          <span>{filteredListings.length} results</span>
        </div>
        
        {loading ? (
          <div className="text-center py-10"><Loader2 className="animate-spin" size={32} /> Loading...</div>
        ) : (
          <div className="listing-grid">
            {filteredListings.map(item => (
              <div 
                key={item.id} 
                className="listing-card animate-slide-up"
                onClick={() => setSelectedProperty(item)}
              >
                <div className="image-container">
                  <img src={item.image || '/placeholder.png'} alt={item.name || item.title} />
                  <button 
                    className={`fav-btn ${favorites.includes(item.id) ? 'active' : ''}`}
                    onClick={(e) => { e.stopPropagation(); toggleFavorite(item.id); }}
                  >
                    <Heart size={18} fill={favorites.includes(item.id) ? "currentColor" : "none"} />
                  </button>
                  <div className="rating-tag">
                    <Star size={12} fill="currentColor" /> {item.rating || 4.5}
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
                    <span><Wifi size={12} /> {item.wifi || 'No'}</span>
                    <span><Building2 size={12} /> {item.rooms || 1} Room</span>
                    <span><Star size={12} /> {item.cr || 'Shared'}</span>
                  </div>
                  <button className="inquire-btn">Inquire Now</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Property Modal */}
      {selectedProperty && (
        <div className="modal-overlay" onClick={() => setSelectedProperty(null)}>
          <div className="modal-content animate-slide-up" onClick={e => e.stopPropagation()}>
            <button className="close-btn" onClick={() => setSelectedProperty(null)}><X size={24} /></button>
            <div className="modal-image">
              <img src={selectedProperty.image} alt={selectedProperty.name || selectedProperty.title} />
            </div>
            <div className="modal-body">
              <span className="type-badge">{selectedProperty.type}</span>
              <h2>{selectedProperty.name || selectedProperty.title}</h2>
              <div className="modal-price">₱{selectedProperty.price?.toLocaleString() || 0}<span> / month</span></div>
              
              <div className="modal-location">
                <MapPin size={18} /> {selectedProperty.location}
              </div>

              <div className="divider"></div>

              <h3>Description</h3>
              <p>{selectedProperty.description}</p>

              <h3>Listing Details</h3>
              <div className="amenities-list">
                <div className="amenity-item">
                  <Wifi size={18} /> 
                  <div>
                    <label>WiFi</label>
                    <p>{selectedProperty.wifi || 'No'}</p>
                  </div>
                </div>
                <div className="amenity-item">
                  <Building2 size={18} /> 
                  <div>
                    <label>Total Rooms</label>
                    <p>{selectedProperty.rooms || 1} Room(s)</p>
                  </div>
                </div>
                <div className="amenity-item">
                  <Star size={18} /> 
                  <div>
                    <label>CR / Bathroom</label>
                    <p>{selectedProperty.cr || 'Shared'}</p>
                  </div>
                </div>
                <div className="amenity-item">
                  <Shield size={18} /> 
                  <div>
                    <label>Secured / Gated</label>
                    <p>{selectedProperty.secured || 'No'}</p>
                  </div>
                </div>
              </div>

              {selectedProperty.amenities?.length > 0 && (
                <>
                  <h3>Other Amenities</h3>
                  <div className="amenities-list">
                    {selectedProperty.amenities.map(a => (
                      <div key={a} className="amenity-item">
                        <Star size={16} className="text-secondary" /> <span>{a}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}

              <div className="modal-actions">
                <a href={`tel:${selectedProperty.contact}`} className="contact-btn call">
                  <Phone size={20} /> Call Owner
                </a>
                <a href={`mailto:${selectedProperty.email}?subject=Inquiry about ${selectedProperty.name}`} className="contact-btn email">
                  <Mail size={20} /> Email Owner
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Navigation Bar */}
      <div className="bottom-nav glass">
        {!isGuest ? (
          /* Landlord Navigation */
          <>
            <button className="nav-item"><MessageCircle size={24} /> <span>Chats</span></button>
            <button className="nav-item circle-plus" onClick={() => setIsPropertyFormOpen(true)}>+</button>
            <button className="nav-item" onClick={() => { setIsProfileEditing(false); setIsProfileModalOpen(true); }}><Shield size={24} /> <span>Account</span></button>
          </>
        ) : (
          /* Tenant Navigation */
          <>
            <button className="nav-item active"><Search size={24} /> <span>Explore</span></button>
            <button className="nav-item"><Heart size={24} /> <span>Saved</span></button>
          </>
        )}
      </div>

      {/* Property Listing Form Modal */}
      {isPropertyFormOpen && (
        <PropertyForm 
          onClose={() => setIsPropertyFormOpen(false)} 
          session={session} 
          onListingAdded={fetchProperties} 
        />
      )}

      {/* Edit Profile Modal */}
      {isProfileModalOpen && (
        <ProfileModal session={session} onClose={() => setIsProfileModalOpen(false)} isEditingInitial={isProfileEditing} />
      )}

      {/* Edit Listings Modal */}
      {isEditListingsOpen && (
        <EditListings 
          session={session} 
          onClose={() => setIsEditListingsOpen(false)} 
          onListingUpdated={fetchProperties} 
        />
      )}
    </div>
  );
}

export default App;
