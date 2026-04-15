import React, { useState, useEffect } from 'react';
import { Search, MapPin, Bed, Bath, Wifi, Shield, Star, Menu, X, Heart, MessageCircle, Phone, LogOut, Building2, User, Users, Loader2, ClipboardList, Mail, BadgeCheck, Headset, ArrowLeft, Home, Navigation, Globe, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';
import { clearSupabaseSessionStorage, recoverFromJwtError, supabase, validateCurrentSession } from './lib/supabase';
import Auth from './components/Auth';
import PropertyForm from './components/PropertyForm';
import ProfileModal from './components/ProfileModal';
import EditListings from './components/EditListings';
import VerificationPage from './components/VerificationPage';
import CustomerSupportPage from './components/CustomerSupportPage';
import FindNearbyPage from './components/FindNearbyPage';
import AdminPanel from './components/AdminPanel';
import AdminLogin from './components/AdminLogin';
import './App.css';

const CATEGORIES = ["All", "Boarding House", "Bed Space", "Apartment", "Studio"];
const HIDDEN_PROPERTIES_KEY = 'budgetrent_hidden_properties';

const getHiddenPropertyIds = () => {
  try {
    return JSON.parse(localStorage.getItem(HIDDEN_PROPERTIES_KEY) || '[]');
  } catch {
    return [];
  }
};

const normalizePropertyOwnerProfiles = (items) => {
  const ownerMap = new Map();

  items.forEach((item) => {
    const ownerKey = item.user_id || item.email;
    if (!ownerKey) return;

    const existing = ownerMap.get(ownerKey) || {};
    ownerMap.set(ownerKey, {
      owner_name: existing.owner_name || item.owner_name,
      owner_avatar: existing.owner_avatar || item.owner_avatar,
      owner_business_name: existing.owner_business_name || item.owner_business_name,
      owner_facebook: existing.owner_facebook || item.owner_facebook,
      owner_whatsapp: existing.owner_whatsapp || item.owner_whatsapp,
      contact: existing.contact || item.contact,
      email: existing.email || item.email
    });
  });

  return items.map((item) => {
    const ownerKey = item.user_id || item.email;
    if (!ownerKey || !ownerMap.has(ownerKey)) return item;
    return {
      ...item,
      ...ownerMap.get(ownerKey)
    };
  });
};

export const applySubscriptionExpiry = (properties) => {
  return properties.map(item => {
    if (item.is_verified && item.subscription_expiry && new Date(item.subscription_expiry) < new Date()) {
      console.log(`[Auto-Expiry] ${item.name} has expired (locally).`);
      return { ...item, is_verified: false, subscription_status: 'Expired' };
    }
    return item;
  });
};

function App() {
  const [session, setSession] = useState(null);
  const [properties, setProperties] = useState([]); // Dynamic properties state
  const [loading, setLoading] = useState(true);
  const [isGuest, setIsGuest] = useState(localStorage.getItem('budgetrent_guest') === 'true');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isPropertyFormOpen, setIsPropertyFormOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isProfileEditing, setIsProfileEditing] = useState(false);
  const [isEditListingsOpen, setIsEditListingsOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedProperty, setSelectedProperty] = useState(null);
  const [viewingLandlord, setViewingLandlord] = useState(null);
  const [activeTab, setActiveTab] = useState('home'); // 'home' or 'explore'
  const [propertyToDelete, setPropertyToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [editingListingItem, setEditingListingItem] = useState(null);
  const isOwner = session?.user?.email === 'admin@budgetrent.ph' || 
                  session?.user?.email === 'mendozajakong@gmail.com' || 
                  localStorage.getItem('budgetrent_admin_bypass') === 'true';



  useEffect(() => {
    validateCurrentSession().then((session) => {
      setSession(session);
    });

    // Secret Admin Shortcut: visit yoursite.com/?admin=true to unlock admin tools
    const params = new URLSearchParams(window.location.search);
    if (params.get('admin') === 'true') {
      localStorage.setItem('budgetrent_admin_bypass', 'true');
      alert('Secret Admin Mode Activated 🚀');
      window.location.href = window.location.pathname; // Clean URL
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      if (event === 'SIGNED_OUT') {
        const hiddenProperties = localStorage.getItem(HIDDEN_PROPERTIES_KEY);
        clearSupabaseSessionStorage();
        if (hiddenProperties) localStorage.setItem(HIDDEN_PROPERTIES_KEY, hiddenProperties);
      }
    });

    fetchProperties(); // Initial fetch

    // Check for /admin route
    if (window.location.pathname === '/admin') {
      setActiveTab('admin');
    }

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
      const hiddenPropertyIds = new Set(getHiddenPropertyIds());
      const normalizedProperties = applySubscriptionExpiry(normalizePropertyOwnerProfiles(data || []));
      setProperties(normalizedProperties.filter(item => !hiddenPropertyIds.has(item.id)));
    } catch (error) {
      console.error('Error fetching properties:', error.message);
      if (await recoverFromJwtError(error)) {
         window.location.reload();
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteProperty = async () => {
    if (!propertyToDelete) return;
    try {
      setIsDeleting(true);
      const { error } = await supabase
        .from('properties')
        .delete()
        .eq('id', propertyToDelete.id);
      
      if (error) throw error;
      
      setProperties(prev => prev.filter(p => p.id !== propertyToDelete.id));
      setPropertyToDelete(null);
    } catch (error) {
      alert('Error deleting listing: ' + error.message);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    localStorage.removeItem('budgetrent_admin_bypass');
    localStorage.removeItem('budgetrent_guest');
    setIsGuest(false);
    setIsMenuOpen(false);
    if (window.location.pathname === '/admin') {
      window.location.href = '/';
    }
  };

  const filteredListings = properties.filter(item => {
    const matchesCategory = selectedCategory === "All" || (item.type || "") === selectedCategory || (item.category || "") === selectedCategory;
    const matchesSearch = (item.name || item.title || "").toLowerCase().includes(searchQuery.toLowerCase()) || 
                          (item.location || "").toLowerCase().includes(searchQuery.toLowerCase());
    const matchesMyListings = activeTab === 'mylistings' ? (item.user_id === session?.user?.id) : true;
    return matchesCategory && matchesSearch && matchesMyListings;
  });

  const isUserVerified = properties.some(p => p.user_id === session?.user?.id && p.is_verified);

  const shouldShowOwnerAvatar = (item) => Boolean(item?.owner_avatar);



  if (!session && !isGuest && window.location.pathname !== '/admin') {
    return <Auth onAuthSuccess={() => { setIsGuest(true); localStorage.setItem('budgetrent_guest', 'true'); }} />;
  }

  // If visiting /admin specifically, override rendering to show AdminPanel if authorized (or AdminLogin if not)
  if (window.location.pathname === '/admin') {
    if (!isOwner) {
      return (
        <AdminLogin 
          onLoginSuccess={() => window.location.reload()} 
          onBack={() => window.location.href = '/'} 
        />
      );
    }
    return <AdminPanel onBack={() => window.location.pathname = '/'} onLogout={handleLogout} />;
  }

  return (
    <div className="app-container">
      {/* Navbar */}
      <nav className="navbar glass">
        <div className="nav-content">
          <div className="logo-section">
            <img src="/logo.png" alt="Logo" className="logo-img" />
            <div 
              className="brand-name" 
              onContextMenu={(e) => {
                e.preventDefault();
                const bypass = localStorage.getItem('budgetrent_admin_bypass') === 'true';
                localStorage.setItem('budgetrent_admin_bypass', bypass ? 'false' : 'true');
                alert(bypass ? 'Admin Bypass Disabled' : 'Admin Bypass Enabled 🔒');
                window.location.reload();
              }}
              style={{ cursor: 'pointer', userSelect: 'none' }}
              title="Hold/Right-click for Admin"
            >
              Budget<span>Rent</span>PH
            </div>
          </div>
          <div className="nav-actions">
            <button className="menu-btn" onClick={() => setIsMenuOpen(true)}>
              <Menu size={28} />
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
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <h1 className="brand-name" style={{ margin: 0 }}>BudgetRent<span>PH</span></h1>
                </div>
              </div>
              <button className="close-menu" onClick={() => setIsMenuOpen(false)}><X size={24} /></button>
            </div>
            
            <div className="menu-items">
              {isGuest && (
                <>
                  <button className="menu-link" onClick={() => { setIsMenuOpen(false); setActiveTab('explore'); }}>
                    <div className="icon-container-mini"><MapPin size={18} /></div> Phone Location
                  </button>
                </>
              )}
              {!isGuest && (
                <>
                  <button className="menu-link highlight" onClick={() => { setIsMenuOpen(false); setIsPropertyFormOpen(true); }}>
                    <div className="icon-container-mini"><Shield size={18} /></div> List your property
                  </button>
                  <button className="menu-link" onClick={() => { setIsMenuOpen(false); setActiveTab('mylistings'); }}>
                    <div className="icon-container-mini"><ClipboardList size={18} /></div> My Listings
                  </button>
                  <button className="menu-link" onClick={() => { setIsMenuOpen(false); setIsProfileEditing(true); setIsProfileModalOpen(true); }}>
                    <div className="icon-container-mini"><User size={18} /></div> Contact & Profile
                  </button>
                  <button className="menu-link" onClick={() => { setIsMenuOpen(false); setActiveTab('verified'); }}>
                    <div className="icon-container-mini secondary-icon"><BadgeCheck size={18} /></div> Get Verified
                  </button>
                </>
              )}


              
              <div className="menu-divider"></div>
              
              <button className="menu-link" onClick={() => { setIsMenuOpen(false); setActiveTab('about'); }}>
                <div className="icon-container-mini"><Building2 size={18} /></div> About Us
              </button>
              <button className="menu-link" onClick={() => { setIsMenuOpen(false); setActiveTab('terms'); }}>
                <div className="icon-container-mini"><Shield size={18} /></div> Terms & Policies
              </button>
              <button className="menu-link" onClick={() => { setIsMenuOpen(false); setActiveTab('support'); }}>
                <div className="icon-container-mini"><Headset size={18} /></div> Chat Customer Support
              </button>
              <button className="menu-link logout" onClick={handleLogout}>
                <div className="icon-container-mini logout-icon"><LogOut size={18} /></div> Sign Out
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

      {/* Main Content Area based on Active Tab */}
      
      {activeTab === 'home' && (
        <>
          <header className={`hero ${activeTab === 'saved' ? 'saved-hero' : ''}`}>
            <div className="hero-content">
              <h2>Find your <span>next home</span></h2>
              <p>Rent smart, live better.</p>
                <div className="search-bar">
                  <Search className="search-icon" size={20} />
                  <input 
                    type="text" 
                    placeholder="Search by city or area..." 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                  <button className="search-btn">Search</button>
                </div>
            </div>
          </header>

          <div className="category-section" style={{ position: 'relative' }}>
            <div className="category-scroll" id="main-category-scroll">
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
          </div>

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
                    </div>
                    <div className="card-info">
                      <div className="card-header-row">
                        <h4 className="card-title">{item.location?.split(',')[0] || item.name}</h4>
                      </div>
                      <p className="card-subtitle">{item.type || item.category || 'Rental Property'}</p>
                      <div className="card-footer">
                        <div className="price">
                          ₱{item.price?.toLocaleString() || 0}<span> month</span>
                        </div>
                        <button 
                          className="card-inquire-btn"
                          onClick={(e) => { e.stopPropagation(); setSelectedProperty(item); }}
                        >
                          Inquire
                        </button>
                      </div>
                      
                      <div 
                        className="card-landlord-info"
                        onClick={(e) => { e.stopPropagation(); setViewingLandlord(item); }}
                      >
                        <div className="mini-avatar-wrapper">
                          {shouldShowOwnerAvatar(item) ? (
                            <img src={item.owner_avatar} alt="" className="mini-avatar" />
                          ) : (
                            <div className="mini-avatar-placeholder">
                              {(item.owner_name || 'L').charAt(0).toUpperCase()}
                            </div>
                          )}
                          {item.is_verified && (
                            <div className="mini-verify-badge">
                              <BadgeCheck size={10} fill="#0066ff" color="white" />
                            </div>
                          )}
                        </div>
                        <span className="landlord-name-small">
                          {item.owner_name || 'Landlord'}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </main>
        </>
      )}

      {activeTab === 'explore' && (
        <FindNearbyPage 
          listings={filteredListings}
          onSelectProperty={setSelectedProperty}
          onViewLandlord={setViewingLandlord}
          isLandlord={!isGuest && session?.user?.user_metadata?.user_role === 'landlord'}
          onBack={() => {
            if (!isGuest && session?.user?.user_metadata?.user_role === 'landlord') {
              setActiveTab('mylistings');
            } else {
              setActiveTab('home');
            }
          }}
        />
      )}



      {activeTab === 'mylistings' && (
        <>
          <header className={`hero saved-hero`} style={{ position: 'relative' }}>
            <div className="hero-content">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '8px' }}>
                <h2>My Properties</h2>
              </div>
              <p>View properties you've listed on our platform</p>
            </div>
          </header>
          <main className="listings pt-6">
            <div className="section-header">
              <h3>Your Listings</h3>
              <span>{filteredListings.length} properties</span>
            </div>
            {loading ? (
              <div className="text-center py-10"><Loader2 className="animate-spin" size={32} /> Loading...</div>
            ) : filteredListings.length === 0 ? (
              <div className="text-center py-10" style={{ color: 'var(--text-muted)' }}>
                You haven't listed any properties yet. Use the "List your property" button to start!
              </div>
            ) : (
              <div className="listing-grid">
                {filteredListings.map(item => (
                  <div 
                    key={item.id} 
                    className="listing-card animate-slide-up"
                  >
                    <div className="image-container">
                      <img src={item.image || '/placeholder.png'} alt={item.name || item.title} />
                      <div className="rating-tag" style={{ background: 'var(--primary)', color: 'white' }}>
                        <Shield size={12} fill="currentColor" /> Manage Listing
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
                        onClick={(e) => { e.stopPropagation(); setViewingLandlord(item); }}
                      >
                        <div style={{ position: 'relative' }}>
                          {shouldShowOwnerAvatar(item) ? (
                            <img src={item.owner_avatar} alt="" style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover', border: '1.5px solid var(--primary)' }} />
                          ) : (
                            <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--primary)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.85rem', fontWeight: 'bold' }}>
                              {(item.owner_name || 'L').charAt(0).toUpperCase()}
                            </div>
                          )}
                          {item.is_verified && (
                            <div style={{ 
                              position: 'absolute', 
                              bottom: '-2px', 
                              right: '-2px', 
                              background: 'white', 
                              borderRadius: '50%', 
                              width: '14px', 
                              height: '14px', 
                              display: 'flex', 
                              alignItems: 'center', 
                              justifyContent: 'center',
                              boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                            }}>
                              <BadgeCheck size={12} fill="#0066ff" color="white" />
                            </div>
                          )}
                        </div>
                        <span style={{ fontSize: '0.85rem', color: 'var(--text-main)', fontWeight: '600' }}>
                          {item.owner_name || 'Landlord'}
                        </span>
                      </div>
                      <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                        <button className="action-btn-outline" style={{ flex: 1, margin: 0 }} onClick={(e) => { e.stopPropagation(); setEditingListingItem(item); setIsEditListingsOpen(true); }}>
                          Edit
                        </button>
                        <button 
                          className="action-btn-outline" 
                          style={{ flex: 1, margin: 0, background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.2)' }} 
                          onClick={(e) => { e.stopPropagation(); setPropertyToDelete(item); }}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </main>
        </>
      )}

      {activeTab === 'about' && (
        <div className="page-section animate-fade-in">
          <header className="hero branding-hero">
            <div className="hero-content">
              <span className="branding-kicker">Get to know us</span>
              <h2>About BudgetRentPH</h2>
              <p>Your partner in finding affordable housing</p>
            </div>
          </header>
          <main className="info-page-container">
            <div className="info-section">
              <p><strong>BudgetRentPH</strong> is the Philippines' premier platform for finding affordable, safe, and convenient housing solutions.</p>
              <p>Our mission is to bridge the gap between property owners and house-seekers, making the search for boarding houses, bedspaces, and apartments as seamless as possible for every Filipino student and professional.</p>
            </div>
            <div className="info-grid">
              <div className="info-card">
                <Shield size={32} />
                <h4>Verified Owners</h4>
                <p>We work with trusted landlords to ensure your safety and peace of mind.</p>
              </div>
              <div className="info-card">
                <Star size={32} />
                <h4>Quality Picks</h4>
                <p>Curated listings that meet our standards for comfort and accessibility.</p>
              </div>
            </div>
          </main>
        </div>
      )}

      {activeTab === 'terms' && (
        <div className="page-section animate-fade-in">
          <header className="hero branding-hero">
            <div className="hero-content">
              <span className="branding-kicker">Guidelines</span>
              <h2>Terms & Policies</h2>
              <p>Simple rules for shared safety</p>
            </div>
          </header>
          <main className="info-page-container terms-shell">
            <div className="terms-intro-card">
              <span className="terms-kicker">Read Before You Use</span>
              <h3>Platform rules and privacy.</h3>
            </div>
            <section className="terms-card">
              <div className="terms-icon-box"><ClipboardList size={20} /></div>
              <div className="terms-content">
                <p>By using <strong>BudgetRentPH</strong>, you agree to these basic rules:</p>
              </div>
            </section>
            <section className="terms-card">
              <div className="terms-icon-box"><Users size={20} /></div>
              <div className="terms-content">
                <h3>Direct Deals</h3>
                <p>We are a listing site. All inquiries and payments are made directly between tenants and landlords.</p>
              </div>
            </section>
            <section className="terms-card">
              <div className="terms-icon-box"><Shield size={20} /></div>
              <div className="terms-content">
                <h3>Honesty</h3>
                <p>Landlords must provide real photos and prices. Misleading listings will be removed.</p>
              </div>
            </section>
            <section className="terms-card">
              <div className="terms-icon-box"><BadgeCheck size={20} /></div>
              <div className="terms-content">
                <h3>Privacy</h3>
                <p>Your data is only used for inquiries. We never sell your personal information.</p>
              </div>
            </section>
          </main>
        </div>
      )}

      {activeTab === 'verified' && (
        <VerificationPage session={session} onDone={() => setActiveTab('mylistings')} />
      )}

      {activeTab === 'support' && (
        <CustomerSupportPage onDone={() => {
          if (!isGuest && session?.user?.user_metadata?.user_role === 'landlord') {
            setActiveTab('mylistings');
          } else {
            setActiveTab('home');
          }
        }} />
      )}

      {activeTab === 'admin' && isOwner && (
        <AdminPanel onBack={() => setActiveTab('home')} onLogout={handleLogout} />
      )}

      {/* Property Modal */}
      {selectedProperty && (
        <div className="modal-overlay" onClick={() => setSelectedProperty(null)}>
          <div className="modal-content property-detail-modal animate-slide-up" onClick={e => e.stopPropagation()}>
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

              {/* Owner Profile */}
              <div className="divider"></div>
              <div className="owner-profile-card clickable property-owner-card" onClick={() => setViewingLandlord(selectedProperty)}>
                <div style={{ position: 'relative' }}>
                  {shouldShowOwnerAvatar(selectedProperty) ? (
                    <img src={selectedProperty.owner_avatar} alt="Owner" className="property-owner-avatar" />
                  ) : (
                    <div className="property-owner-avatar property-owner-placeholder">
                      {(selectedProperty.owner_name || 'L').charAt(0).toUpperCase()}
                    </div>
                  )}
                  {selectedProperty.is_verified && (
                    <div style={{ 
                      position: 'absolute', 
                      bottom: '4px', 
                      right: '4px', 
                      background: 'white', 
                      borderRadius: '50%', 
                      width: '18px', 
                      height: '18px', 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center',
                      boxShadow: '0 2px 6px rgba(0,0,0,0.2)'
                    }}>
                      <BadgeCheck size={14} fill="#0066ff" color="white" />
                    </div>
                  )}
                </div>
                <div className="property-owner-info">
                  <p className="property-owner-name">
                    {selectedProperty.owner_name || 'Landlord'}
                  </p>
                  <span className="property-owner-meta">Tap to view full profile</span>
                </div>
                <Navigation size={16} className="property-owner-arrow" />
              </div>

              <h3>{selectedProperty.type === 'Boarding House' ? 'Boarding House Details' : 'Listing Details'}</h3>
              <div className="amenities-list">
                <div className="amenity-item">
                  <div className="circle-icon"><Wifi size={16} /></div> 
                  <div>
                    <label>WiFi</label>
                    <p>{selectedProperty.wifi || 'No'}</p>
                  </div>
                </div>
                <div className="amenity-item">
                  <div className="circle-icon"><Bed size={16} /></div> 
                  <div>
                    <label>Available Rooms</label>
                    <p>{selectedProperty.rooms || 1} Room(s)</p>
                  </div>
                </div>
                <div className="amenity-item">
                  <div className="circle-icon"><Bath size={16} /></div> 
                  <div>
                    <label>CR / Bathroom</label>
                    <p>{selectedProperty.cr || 'Shared'}</p>
                  </div>
                </div>
                <div className="amenity-item">
                  <div className="circle-icon"><Building2 size={16} /></div> 
                  <div>
                    <label>Parking</label>
                    <p>{selectedProperty.parking || 'No'}</p>
                  </div>
                </div>
                <div className="amenity-item">
                  <div className="circle-icon"><Home size={16} /></div> 
                  <div>
                    <label>Kitchen</label>
                    <p>{Number(selectedProperty.kitchen) > 0 ? `${selectedProperty.kitchen} Available` : 'None'}</p>
                  </div>
                </div>
                <div className="amenity-item">
                  <div className="circle-icon"><Shield size={16} /></div> 
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
      {(!isOwner || activeTab !== 'admin') && (
        <div className="bottom-nav glass">
          {!isGuest ? (
            /* Landlord Navigation */
            <>
              <button className={`nav-item ${activeTab === 'mylistings' ? 'active' : ''}`} onClick={() => setActiveTab('mylistings')}><ClipboardList size={24} /> <span>My Listings</span></button>
              <button className="nav-item circle-plus" onClick={() => setIsPropertyFormOpen(true)}>+</button>
              <button className="nav-item" onClick={() => { setIsProfileEditing(false); setIsProfileModalOpen(true); }}><User size={24} /> <span>Account</span></button>
            </>
          ) : (
            /* Tenant Navigation */
            <>
              <button 
                className={`nav-item ${activeTab === 'explore' ? 'active' : ''}`}
                onClick={() => setActiveTab('explore')}
              >
                <div className={`nav-icon-box ${activeTab === 'explore' ? 'active' : ''}`}><MapPin size={22} /></div>
                <span>Nearby</span>
              </button>
              <button 
                className={`nav-item ${activeTab === 'home' || activeTab !== 'explore' ? 'active' : ''}`}
                onClick={() => setActiveTab('home')}
              >
                <div className={`nav-icon-box ${activeTab === 'home' ? 'active' : ''}`}><Home size={22} /></div>
                <span>Home</span>
              </button>
            </>
          )}
        </div>
      )}

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
        <ProfileModal session={session} onClose={() => setIsProfileModalOpen(false)} isEditingInitial={isProfileEditing} onProfileUpdated={fetchProperties} />
      )}

      {/* Edit Listings Modal */}
      {isEditListingsOpen && (
        <EditListings 
          session={session} 
          onClose={() => { setIsEditListingsOpen(false); setEditingListingItem(null); }} 
          onListingUpdated={fetchProperties}
          initialEditingItem={editingListingItem}
        />
      )}

      {/* Public Landlord Profile Modal */}
      {viewingLandlord && (
        <div className="modal-overlay" onClick={() => setViewingLandlord(null)} style={{ zIndex: 2001 }}>
          <div className="modal-content profile-modal animate-slide-up" onClick={e => e.stopPropagation()}>
            <button className="close-btn" onClick={() => setViewingLandlord(null)}><X size={24} /></button>
            
            <div className="profile-header">
              <div className="profile-avatar" style={{ position: 'relative' }}>
                {shouldShowOwnerAvatar(viewingLandlord) ? (
                  <img src={viewingLandlord.owner_avatar} alt="Avatar" className="avatar-img" />
                ) : (
                  <div className="avatar-placeholder">
                    {viewingLandlord.owner_name ? viewingLandlord.owner_name.charAt(0).toUpperCase() : <User />}
                  </div>
                )}
                {viewingLandlord.is_verified && (
                  <div style={{ 
                    position: 'absolute', 
                    bottom: '8px', 
                    right: '8px', 
                    background: 'white', 
                    borderRadius: '50%', 
                    width: '28px', 
                    height: '28px', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    boxShadow: '0 4px 10px rgba(0,0,0,0.2)',
                    zIndex: 2
                  }}>
                    <BadgeCheck size={20} fill="#0066ff" color="white" />
                  </div>
                )}
              </div>
               <span className={`role-badge ${viewingLandlord.is_verified ? 'verified' : 'landlord'}`}>
                 {viewingLandlord.is_verified ? 'VERIFIED OWNER' : 'LANDLORD'}
               </span>
               <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
                 {viewingLandlord.owner_name || 'Landlord'}
               </h2>
               <a href={`mailto:${viewingLandlord.email}`} className="profile-email">{viewingLandlord.email}</a>
            </div>

            <div className="profile-details">
              <div className="info-group">
                <Phone size={18} />
                <div className="info-content">
                  <label>Contact Number</label>
                  <p>{viewingLandlord.contact || 'Not provided'}</p>
                </div>
              </div>
              
              {(viewingLandlord.owner_business_name || viewingLandlord.property_name) && (
                <div className="info-group">
                  <Building2 size={18} />
                  <div className="info-content">
                    <label>Business / Property Name</label>
                    <p>{viewingLandlord.owner_business_name || viewingLandlord.property_name}</p>
                  </div>
                </div>
              )}

              <div className="info-grid">
                <div className="info-group">
                  <Globe size={18} />
                  <div className="info-content">
                    <label>Facebook / Social</label>
                    <p>{viewingLandlord.owner_facebook || 'Search on Facebook'}</p>
                  </div>
                </div>
              </div>

              {viewingLandlord.owner_whatsapp && (
                <div className="info-group" style={{marginTop: '12px'}}>
                  <MessageCircle size={18} />
                  <div className="info-content">
                    <label>WhatsApp</label>
                    <p>{viewingLandlord.owner_whatsapp}</p>
                  </div>
                </div>
              )}
            </div>

            <div className="modal-actions" style={{ padding: '0 24px 24px', position: 'static', background: 'transparent' }}>
               <a href={`tel:${viewingLandlord.contact}`} className="contact-btn call">
                  <Phone size={20} /> Call Now
               </a>
               <a href={`mailto:${viewingLandlord.email}`} className="contact-btn email">
                  <Mail size={20} /> Message
               </a>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {propertyToDelete && (
        <div className="modal-overlay centered" onClick={() => setPropertyToDelete(null)} style={{ zIndex: 3000 }}>
          <div className="modal-content success-modal animate-fade-in" onClick={e => e.stopPropagation()} style={{ maxWidth: '350px', padding: '30px', textAlign: 'center' }}>
            <div style={{ color: '#ef4444', marginBottom: '20px' }}>
              <Trash2 size={64} style={{ margin: '0 auto' }} />
            </div>
            <h3 style={{ fontSize: '1.25rem', marginBottom: '12px' }}>Are you sure?</h3>
            <p style={{ color: 'var(--text-muted)', marginBottom: '24px', fontSize: '0.95rem' }}>
              Do you really want to delete <strong>{propertyToDelete.name || propertyToDelete.title}</strong>? This action cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button 
                className="inquire-btn" 
                style={{ flex: 1, margin: 0, background: 'var(--background)', color: 'var(--text-main)', border: '1px solid var(--border)' }}
                onClick={() => setPropertyToDelete(null)}
              >
                Cancel
              </button>
              <button 
                className="inquire-btn" 
                style={{ flex: 1, margin: 0, background: '#ef4444' }}
                onClick={handleDeleteProperty}
                disabled={isDeleting}
              >
                {isDeleting ? <Loader2 className="animate-spin" size={20} /> : 'Delete Item'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default App;
