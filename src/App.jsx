import React, { useState, useEffect, useMemo, Suspense, lazy } from 'react';
import { Search, MapPin, Bed, Bath, Wifi, Shield, Star, Menu, X, Heart, MessageCircle, Phone, LogOut, Building2, User, Users, Loader2, ClipboardList, Mail, BadgeCheck, Headset, ArrowLeft, Home, Navigation, Globe, Trash2, ChevronLeft, ChevronRight, Plus, Bell, FileText } from 'lucide-react';
import { clearSupabaseSessionStorage, recoverFromJwtError, supabase, validateCurrentSession } from './lib/supabase';
import './App.css';
import './components/ProfileModal.css';

// Lazy loaded components
const Auth = lazy(() => import('./components/Auth'));
const PropertyForm = lazy(() => import('./components/PropertyForm'));
const ProfileModal = lazy(() => import('./components/ProfileModal'));
const EditListings = lazy(() => import('./components/EditListings'));
const VerificationPage = lazy(() => import('./components/VerificationPage'));
const CustomerSupportPage = lazy(() => import('./components/CustomerSupportPage'));
const FindNearbyPage = lazy(() => import('./components/FindNearbyPage'));
const AdminPanel = lazy(() => import('./components/AdminPanel'));
const AdminLogin = lazy(() => import('./components/AdminLogin'));
const EmailVerificationHandler = lazy(() => import('./components/EmailVerificationHandler'));
const AgreementDraft = lazy(() => import('./components/AgreementDraft'));

// Custom Debounce Hook
function useDebounce(value, delay) {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);
    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);
  return debouncedValue;
}

const CATEGORIES = ["Paupahan", "Staycation"];
const CATEGORY_EMOJI = { Paupahan: "🏠", Staycation: "🌴" };
const isStaycation = (item) => String(item?.type || item?.category || '').toLowerCase().includes('staycation');
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

export const getMoveInBreakdown = (item) => {
  const price = Number(item?.price) || 0;
  const advanceMonths = Number(item?.advance_months) || 1;
  const depositMonths = Number(item?.deposit_months) || 2;
  const advance = price * advanceMonths;
  const deposit = price * depositMonths;
  const estimatedMoveIn = advance + deposit;
  return { price, advance, deposit, estimatedMoveIn };
};

function ListingCard({ item, isFav, onToggleFavorite, onOpen, onOpenLandlord }) {
  return (
    <div
      className="listing-card animate-slide-up"
      onClick={() => onOpen(item)}
    >
      <div className="image-container">
        <img src={item.image || '/placeholder.png'} alt={item.name || item.title} loading="lazy" />
        <button
          type="button"
          className={`fav-btn${isFav ? ' active' : ''}`}
          aria-label={isFav ? 'Remove from wishlist' : 'Save to wishlist'}
          title={isFav ? 'Remove from wishlist' : 'Save to wishlist'}
          onClick={(e) => onToggleFavorite(item.id, e)}
        >
          <Heart size={18} />
        </button>
        {isFav && (
          <span className="guest-favorite-badge">
            <Heart size={11} fill="currentColor" strokeWidth={2.5} /> Guest favorite
          </span>
        )}
      </div>
      <div className="card-info">
        <div className="card-header-row">
          <div className="card-title-group">
            <h4 className="card-title">{item.location?.split(',')[0] || item.name}</h4>
            <p className="card-subtitle">{item.type || item.category || 'Rental Property'}</p>
          </div>
          <button
            className="card-inquire-btn"
            aria-label="Inquire"
            title="Inquire"
            onClick={(e) => { e.stopPropagation(); onOpen(item); }}
          >
            <Plus size={22} strokeWidth={3} />
          </button>
        </div>

        <div className="card-price-row">
          <span className="price-tag">₱{item.price?.toLocaleString() || 0}</span>
          <span className="price-period">/month</span>
        </div>

        <div
          className="card-landlord-info"
          onClick={(e) => { e.stopPropagation(); onOpenLandlord(item); }}
        >
          <div className="mini-avatar-wrapper">
            {item?.owner_avatar ? (
              <img src={item.owner_avatar} alt="" className="mini-avatar" loading="lazy" />
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
  );
}

function App() {
  const [session, setSession] = useState(null);
  const [properties, setProperties] = useState([]); // Dynamic properties state
  const [loading, setLoading] = useState(true);
  const [isGuest, setIsGuest] = useState(localStorage.getItem('budgetrent_guest') === 'true');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [readNotifs, setReadNotifs] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('budgetrent_read_notifs') || '[]');
    } catch {
      return [];
    }
  });
  const [isPropertyFormOpen, setIsPropertyFormOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isProfileEditing, setIsProfileEditing] = useState(false);
  const [isEditListingsOpen, setIsEditListingsOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState("Paupahan");
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearchQuery = useDebounce(searchQuery, 400); // 400ms debounce
  const [selectedProperty, setSelectedProperty] = useState(null);
  const [viewingLandlord, setViewingLandlord] = useState(null);
  const [activeTab, setActiveTab] = useState('home'); // 'home' or 'explore'
  const [favorites, setFavorites] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('budgetrent_favorites') || '[]');
    } catch {
      return [];
    }
  });
  const [propertyToDelete, setPropertyToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [editingListingItem, setEditingListingItem] = useState(null);
  const isOwner = session?.user?.email === 'admin@budgetrent.ph' || 
                  session?.user?.email === 'mendozajakong@gmail.com';



  useEffect(() => {
    validateCurrentSession().then((session) => {
      setSession(session);
      if (session) {
        setIsGuest(false);
        localStorage.removeItem('budgetrent_guest');
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      if (session) {
        setIsGuest(false);
        localStorage.removeItem('budgetrent_guest');
      }
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

  // Landlords should always land on their own section (never the tenant home feed)
  useEffect(() => {
    if (!session || isGuest) return;
    const role = session.user?.user_metadata?.user_role;
    if (role === 'landlord' && (activeTab === 'home' || activeTab === 'wishlist' || activeTab === 'explore')) {
      setActiveTab('mylistings');
    }
  }, [session, isGuest, activeTab]);

  const fetchProperties = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('properties')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100); // Pagination / Limit applied
      
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

  const filteredListings = useMemo(() => {
    return properties.filter(item => {
      const matchesCategory = (activeTab === 'mylistings' || activeTab === 'admin')
        ? true
        : selectedCategory === "Staycation"
          ? isStaycation(item)
          : selectedCategory === "Paupahan"
            ? !isStaycation(item)
            : (item.type || "") === selectedCategory || (item.category || "") === selectedCategory;
      const q = debouncedSearchQuery.toLowerCase();
      const matchesSearch = (item.name || item.title || "").toLowerCase().includes(q) || 
                            (item.location || "").toLowerCase().includes(q);
      const matchesMyListings = activeTab === 'mylistings' ? (item.user_id === session?.user?.id) : true;
      return matchesCategory && matchesSearch && matchesMyListings;
    });
  }, [properties, selectedCategory, debouncedSearchQuery, activeTab, session?.user?.id]);

  const shouldShowOwnerAvatar = (item) => Boolean(item?.owner_avatar);

  const wishlistListings = useMemo(
    () => properties.filter(item => favorites.includes(item.id)),
    [properties, favorites]
  );

  const notifications = useMemo(() => {
    const items = [
      { id: 'welcome', icon: '🎉', tone: 'gold', title: 'Welcome to BudgetRentPH', body: 'Maligayang pagdating! Simulan ang paghahanap ng affordable na rental.', time: 'Just now' },
      { id: 'categories', icon: '🏠', tone: 'navy', title: 'Paupahan or Staycation', body: 'Piliin ang category para makita ang rentals na hinahanap mo.', time: 'Today' },
      { id: 'wishlist', icon: '❤️', tone: 'red', title: 'Save your favorites', body: 'I-tap ang heart sa listing para mapunta sa iyong Wishlist.', time: 'Today' },
    ];
    if (!isGuest) {
      items.push({ id: 'verified', icon: '✅', tone: 'green', title: 'Get Verified', body: 'Mag-verify ng account para mas magtitiwala ang mga tenant sa listings mo.', time: 'Tip' });
    }
    return items;
  }, [isGuest]);

  const unreadCount = notifications.filter(n => !readNotifs.includes(n.id)).length;

  const markAllRead = () => {
    const all = notifications.map(n => n.id);
    setReadNotifs(all);
    localStorage.setItem('budgetrent_read_notifs', JSON.stringify(all));
  };

  const toggleFavorite = (id, e) => {
    e.stopPropagation();
    setFavorites(prev => {
      const next = prev.includes(id) ? prev.filter(f => f !== id) : [...prev, id];
      localStorage.setItem('budgetrent_favorites', JSON.stringify(next));
      return next;
    });
  };



  if (!session && !isGuest && window.location.pathname !== '/admin') {
    return (
      <Suspense fallback={<div className="text-center py-10"><Loader2 className="animate-spin text-primary mx-auto" size={40} /></div>}>
        <Auth onAuthSuccess={() => { setIsGuest(true); localStorage.setItem('budgetrent_guest', 'true'); }} />
      </Suspense>
    );
  }

  // If visiting /admin specifically, override rendering to show AdminPanel if authorized (or AdminLogin if not)
  if (window.location.pathname === '/admin') {
    if (!isOwner) {
      return (
        <Suspense fallback={<div className="text-center py-10"><Loader2 className="animate-spin text-primary mx-auto" size={40} /></div>}>
          <AdminLogin 
            onLoginSuccess={() => window.location.reload()} 
            onBack={() => window.location.href = '/'} 
          />
        </Suspense>
      );
    }
    return (
      <Suspense fallback={<div className="text-center py-10"><Loader2 className="animate-spin text-primary mx-auto" size={40} /></div>}>
        <AdminPanel onBack={() => window.location.pathname = '/'} onLogout={handleLogout} />
      </Suspense>
    );
  }

  return (
    <div className="app-container">
      {/* Email Verification Handler */}
      <Suspense fallback={null}>
        <EmailVerificationHandler onVerificationComplete={() => window.location.reload()} />
      </Suspense>

      {/* Navbar */}
      <nav className="navbar glass">
        <div className="nav-content">
          <div className="logo-section">
            <img src="/logo.png" alt="Logo" className="logo-img" />
            <div 
              className="brand-name" 
              style={{ cursor: 'pointer', userSelect: 'none' }}
              title="Budget Rent PH"
            >
              Budget<span>Rent</span>PH
            </div>
          </div>
          <div className="nav-actions">
            <div className="notif-wrap">
              <button
                className={`menu-btn notif-btn${unreadCount > 0 ? ' has-unread' : ''}`}
                onClick={() => setIsNotifOpen(o => !o)}
                aria-label="Notifications"
              >
                <Bell size={22} />
                {unreadCount > 0 && <span className="notif-badge">{unreadCount}</span>}
              </button>

              {isNotifOpen && (
                <>
                  <div className="notif-overlay" onClick={() => setIsNotifOpen(false)} />
                  <div className="notif-panel animate-slide-up">
                    <div className="notif-head">
                      <h4>Notifications</h4>
                      {unreadCount > 0 && (
                        <button onClick={markAllRead}>Mark all as read</button>
                      )}
                    </div>
                    <div className="notif-list">
                      {notifications.map(n => (
                        <div
                          key={n.id}
                          className={`notif-item${readNotifs.includes(n.id) ? '' : ' unread'}`}
                          onClick={() => {
                            const next = [...new Set([...readNotifs, n.id])];
                            setReadNotifs(next);
                            localStorage.setItem('budgetrent_read_notifs', JSON.stringify(next));
                          }}
                        >
                          <div className={`notif-icon ${n.tone}`}>{n.icon}</div>
                          <div className="notif-text">
                            <p className="notif-title">{n.title}</p>
                            <p className="notif-body">{n.body}</p>
                            <span className="notif-time">{n.time}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>

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
                  <button className="menu-link" onClick={() => { setIsMenuOpen(false); setActiveTab('home'); }}>
                    <div className="icon-container-mini"><Home size={18} /></div> Home
                  </button>
                  <button className="menu-link" onClick={() => { setIsMenuOpen(false); setActiveTab('wishlist'); }}>
                    <div className="icon-container-mini"><Heart size={18} /></div> My Wishlist
                  </button>
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
                  <button className="menu-link" onClick={() => { setIsMenuOpen(false); setActiveTab('agreement'); }}>
                    <div className="icon-container-mini secondary-icon"><FileText size={18} /></div> Create Agreement Draft
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
              <h2>Welcome to <span>BudgetRentPH</span></h2>
              <p>Mura. Malapit. Mapagkakatiwalaan.</p>
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
                  <span className="chip-emoji">{CATEGORY_EMOJI[cat] || '🏠'}</span>
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
              <div className="listing-grid">
                {[1, 2, 3, 4].map(n => (
                  <div key={n} className="listing-card skeleton-card">
                    <div className="skeleton-img"></div>
                    <div className="card-info" style={{ marginTop: '12px' }}>
                      <div className="skeleton-title"></div>
                      <div className="skeleton-subtitle"></div>
                      <div className="skeleton-footer"></div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="listing-grid">
                {filteredListings.map(item => (
                  <ListingCard
                    key={item.id}
                    item={item}
                    isFav={favorites.includes(item.id)}
                    onToggleFavorite={toggleFavorite}
                    onOpen={setSelectedProperty}
                    onOpenLandlord={setViewingLandlord}
                  />
                ))}
              </div>
            )}
          </main>
        </>
      )}

      {activeTab === 'explore' && (
        <Suspense fallback={<div className="text-center py-10"><Loader2 className="animate-spin text-primary mx-auto" size={40} /></div>}>
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
        </Suspense>
      )}



      {activeTab === 'wishlist' && (
        <>
          <header className="hero saved-hero">
            <div className="hero-content">
              <div className="wishlist-hero-icon">
                <Heart size={34} fill="currentColor" />
              </div>
              <h2>My <span>Wishlist</span></h2>
              <p>Properties you saved for later</p>
            </div>
          </header>

          <main className="listings pt-6">
            <div className="section-header">
              <h3>Saved Listings</h3>
              <span>{wishlistListings.length} saved</span>
            </div>

            {wishlistListings.length === 0 ? (
              <div className="wishlist-empty">
                <div className="wishlist-empty-icon">
                  <Heart size={40} />
                </div>
                <h4>Your wishlist is empty</h4>
                <p>Tap the heart on any listing to save it here.</p>
                <button className="wishlist-browse-btn" onClick={() => setActiveTab('home')}>
                  Browse listings
                </button>
              </div>
            ) : (
              <div className="listing-grid">
                {wishlistListings.map(item => (
                  <ListingCard
                    key={item.id}
                    item={item}
                    isFav={favorites.includes(item.id)}
                    onToggleFavorite={toggleFavorite}
                    onOpen={setSelectedProperty}
                    onOpenLandlord={setViewingLandlord}
                  />
                ))}
              </div>
            )}
          </main>
        </>
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
              <div className="listing-grid">
                {[1, 2].map(n => (
                  <div key={n} className="listing-card skeleton-card">
                    <div className="skeleton-img"></div>
                    <div className="card-info" style={{ marginTop: '12px' }}>
                      <div className="skeleton-title"></div>
                      <div className="skeleton-subtitle"></div>
                      <div className="skeleton-footer"></div>
                    </div>
                  </div>
                ))}
              </div>
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
                      <img src={item.image || '/placeholder.png'} alt={item.name || item.title} loading="lazy" />
                      <div className="rating-tag" style={{ background: 'var(--primary)', color: 'white' }}>
                        <Shield size={12} fill="currentColor" /> Manage Listing
                      </div>
                    </div>
                    <div className="card-info">
                      <h4>{item.name || item.title}</h4>
                      <p className="card-desc">{item.description}</p>
                      <div className="card-price-row">
                        <span className="price-tag">₱{item.price?.toLocaleString() || 0}</span>
                        <span className="price-period">/month</span>
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
                            <img src={item.owner_avatar} alt="" style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover', border: '1.5px solid var(--primary)' }} loading="lazy" />
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

      {activeTab === 'agreement' && (
        <Suspense fallback={<div className="text-center py-10"><Loader2 className="animate-spin text-primary mx-auto" size={40} /></div>}>
          <AgreementDraft session={session} />
        </Suspense>
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
        <Suspense fallback={<div className="text-center py-10"><Loader2 className="animate-spin text-primary mx-auto" size={40} /></div>}>
          <VerificationPage session={session} onDone={() => setActiveTab('mylistings')} />
        </Suspense>
      )}

      {activeTab === 'support' && (
        <Suspense fallback={<div className="text-center py-10"><Loader2 className="animate-spin text-primary mx-auto" size={40} /></div>}>
          <CustomerSupportPage onDone={() => {
            if (!isGuest && session?.user?.user_metadata?.user_role === 'landlord') {
              setActiveTab('mylistings');
            } else {
              setActiveTab('home');
            }
          }} />
        </Suspense>
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
              {(() => {
                const { price, advance, deposit, estimatedMoveIn } = getMoveInBreakdown(selectedProperty);
                return (
                  <div className="modal-movein-box">
                    <div className="modal-movein-row">
                      <span>Monthly Rent:</span>
                      <strong>₱{price.toLocaleString()}</strong>
                    </div>
                    <div className="modal-movein-row">
                      <span>Advance:</span>
                      <span>₱{advance.toLocaleString()}</span>
                    </div>
                    <div className="modal-movein-row">
                      <span>Deposit:</span>
                      <span>₱{deposit.toLocaleString()}</span>
                    </div>
                    <div className="modal-movein-divider"></div>
                    <div className="modal-movein-row total">
                      <span>Estimated Move-in:</span>
                      <strong>₱{estimatedMoveIn.toLocaleString()}</strong>
                    </div>
                  </div>
                );
              })()}
              
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
                </div>
                <div className="property-owner-info">
                  <p className="property-owner-name">
                    {selectedProperty.owner_name || 'Landlord'}
                    {selectedProperty.is_verified && <BadgeCheck size={16} fill="#0066ff" color="white" style={{ display: 'inline', marginLeft: '6px', verticalAlign: 'middle' }} />}
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
                className={`nav-item ${activeTab === 'home' ? 'active' : ''}`}
                onClick={() => setActiveTab('home')}
              >
              <div className={`nav-icon-box ${activeTab === 'home' ? 'active' : ''}`}><Home size={22} /></div>
                <span>Home</span>
              </button>
              <button 
                className={`nav-item ${activeTab === 'wishlist' ? 'active' : ''}`}
                onClick={() => setActiveTab('wishlist')}
              >
                <div className={`nav-icon-box ${activeTab === 'wishlist' ? 'active' : ''}`}><Heart size={22} /></div>
                <span>Wishlist</span>
              </button>
            </>
          )}
        </div>
      )}

      {/* Property Listing Form Modal */}
      {isPropertyFormOpen && (
        <Suspense fallback={<div className="modal-overlay centered"><Loader2 className="animate-spin" color="white" size={40} /></div>}>
          <PropertyForm 
            onClose={() => setIsPropertyFormOpen(false)} 
            session={session} 
            onListingAdded={fetchProperties} 
          />
        </Suspense>
      )}

      {/* Edit Profile Modal */}
      {isProfileModalOpen && (
        <Suspense fallback={<div className="modal-overlay centered"><Loader2 className="animate-spin" color="white" size={40} /></div>}>
          <ProfileModal session={session} onClose={() => setIsProfileModalOpen(false)} isEditingInitial={isProfileEditing} onProfileUpdated={fetchProperties} />
        </Suspense>
      )}

      {/* Edit Listings Modal */}
      {isEditListingsOpen && (
        <Suspense fallback={<div className="modal-overlay centered"><Loader2 className="animate-spin" color="white" size={40} /></div>}>
          <EditListings 
            session={session} 
            onClose={() => { setIsEditListingsOpen(false); setEditingListingItem(null); }} 
            onListingUpdated={fetchProperties}
            initialEditingItem={editingListingItem}
          />
        </Suspense>
      )}

      {/* Public Landlord Profile Modal */}
      {viewingLandlord && (
        <div className="modal-overlay" onClick={() => setViewingLandlord(null)} style={{ zIndex: 2001 }}>
          <div className="modal-content profile-modal animate-slide-up" onClick={e => e.stopPropagation()}>
            <button className="close-btn" onClick={() => setViewingLandlord(null)}><X size={24} /></button>
            
            <div className="profile-header">
              <div className="profile-avatar">
                {shouldShowOwnerAvatar(viewingLandlord) ? (
                  <img src={viewingLandlord.owner_avatar} alt="Avatar" className="avatar-img" />
                ) : (
                  <div className="avatar-placeholder">
                    {viewingLandlord.owner_name ? viewingLandlord.owner_name.charAt(0).toUpperCase() : <User />}
                  </div>
                )}
              </div>
               <span className={`role-badge ${viewingLandlord.is_verified ? 'verified' : 'landlord'}`}>
                 {viewingLandlord.is_verified ? (<><BadgeCheck size={12} fill="white" color="var(--primary)" /> VERIFIED OWNER</>) : 'LANDLORD'}
               </span>
               <h2 style={{ marginBottom: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                 {viewingLandlord.owner_name || 'Landlord'}
                 {viewingLandlord.is_verified && <BadgeCheck size={22} fill="#0066ff" color="white" />}
               </h2>
               {viewingLandlord.email ? (
                 <a href={`mailto:${viewingLandlord.email}`} className="profile-email">{viewingLandlord.email}</a>
               ) : (
                 <span className="profile-email">No email provided</span>
               )}
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

              <div className="info-group">
                <Globe size={18} />
                <div className="info-content">
                  <label>Facebook / Social</label>
                  <p style={{ wordBreak: 'break-all' }}>{viewingLandlord.owner_facebook || 'Search on Facebook'}</p>
                </div>
              </div>

              {viewingLandlord.owner_whatsapp && (
                <div className="info-group">
                  <MessageCircle size={18} />
                  <div className="info-content">
                    <label>WhatsApp</label>
                    <p>{viewingLandlord.owner_whatsapp}</p>
                  </div>
                </div>
              )}
            </div>
            
            <div className="modal-actions" style={{ position: 'static', background: 'transparent', flexDirection: 'row', width: '100%', gap: '8px', padding: '16px 20px 20px', margin: 0, justifyContent: 'center' }}>
               {viewingLandlord.contact ? (
                 <a href={`tel:${viewingLandlord.contact}`} className="contact-btn call" style={{ flex: 1, padding: '12px', fontSize: '0.85rem', margin: 0 }}>
                   <Phone size={18} /> Call
                 </a>
               ) : (
                 <span className="contact-btn call" style={{ flex: 1, padding: '12px', fontSize: '0.85rem', margin: 0, opacity: 0.6, pointerEvents: 'none' }}>
                   <Phone size={18} /> No number
                 </span>
               )}
               {viewingLandlord.email ? (
                 <a href={`mailto:${viewingLandlord.email}`} className="contact-btn email" style={{ flex: 1, padding: '12px', fontSize: '0.85rem', margin: 0 }}>
                   <Mail size={18} /> Message
                 </a>
               ) : (
                 <span className="contact-btn email" style={{ flex: 1, padding: '12px', fontSize: '0.85rem', margin: 0, opacity: 0.6, pointerEvents: 'none' }}>
                   <Mail size={18} /> No email
                 </span>
               )}
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
