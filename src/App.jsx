import React, { useState, useEffect, useMemo, useRef, Suspense, lazy } from 'react';
import { HeroBudi } from './components/MascotSplash';
import { Search, MapPin, Bed, Bath, Wifi, Shield, Star, Menu, X, Heart, MessageCircle, Phone, LogOut, Building2, User, Users, Loader2, ClipboardList, Mail, BadgeCheck, Headset, ArrowLeft, Home, Navigation, Globe, Trash2, ChevronLeft, ChevronRight, Bell, FileText, HousePlus, LocateFixed, PawPrint, ScrollText, FileSignature, Info, House, TreePalm, Plus, Lightbulb, Megaphone } from 'lucide-react';
import { clearSupabaseSessionStorage, recoverFromJwtError, supabase, validateCurrentSession } from './lib/supabase';
import { isAdminEmail, isAdminPath } from './lib/admin';
import { playNotifySound, unlockNotifySound } from './lib/notifySound';
import { useUserLocation } from './lib/useUserLocation';
import { isInstalledApp, hasSeenTour, forceTourFromUrl } from './lib/tour';
import { useApproxCoords } from './lib/useApproxCoords';
import { useAreaSearch } from './lib/useAreaSearch';
import CallGateLink from './components/CallGate';
import { toCoords, distanceKm, formatDistance, inArea } from './lib/geo';
import './App.css';
import './components/ProfileModal.css';

// Lazy loaded components
const Auth = lazy(() => import('./components/Auth'));
const AppTour = lazy(() => import('./components/AppTour'));
const PropertyForm = lazy(() => import('./components/PropertyForm'));
const ProfileModal = lazy(() => import('./components/ProfileModal'));
const EditListings = lazy(() => import('./components/EditListings'));
const VerificationPage = lazy(() => import('./components/VerificationPage'));
const CustomerSupportPage = lazy(() => import('./components/CustomerSupportPage'));
const FindNearbyPage = lazy(() => import('./components/FindNearbyPage'));
const AdminPanel = lazy(() => import('./components/AdminPanel'));
const AdminLogin = lazy(() => import('./components/AdminLogin'));
const EmailVerificationHandler = lazy(() => import('./components/EmailVerificationHandler'));
const SubscriptionLock = lazy(() => import('./components/SubscriptionLock'));
const AgreementDraft = lazy(() => import('./components/AgreementDraft'));
const ReviewsSection = lazy(() => import('./components/ReviewsSection'));
const UpdatesPage = lazy(() => import('./components/UpdatesPage'));

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
const CATEGORY_ICON = { Paupahan: House, Staycation: TreePalm };

// Budget input sa home search: max na presyo kada buwan (0/blank = lahat)
const parseBudget = (value) => Math.max(0, Number(value) || 0);
// Numero lang ang tinype sa search bar (hal. 4000) = presyo, hindi pangalan ng lugar
const parseNumericQuery = (value) => {
  const q = String(value || '').trim().replace(/[₱,s]/g, '');
  return /^d{3,7}$/.test(q) ? Number(q) : 0;
};
const isStaycation = (item) => String(item?.type || item?.category || '').toLowerCase().includes('staycation');

// Availability status: 'Available' (default) o 'Occupied'/'Accommodated'
const isOccupied = (item) => {
  const value = String(item?.availability || '').toLowerCase().trim();
  return value === 'occupied' || value === 'accommodated' || value === 'rented' || value === 'unavailable';
};
// Tinatayang kasya sa staycation: 2 guests kada kwarto (wala pang capacity field sa database)
const stayCapacity = (item) => Math.max(1, Number(item?.rooms) || 1) * 2;
// Staycation na occupied: puwede pa ring mag-reserve ng slot para sa ibang petsa
const availabilityLabel = (item) => (isOccupied(item) ? (isStaycation(item) ? 'Occupied • Reserve pa' : 'Occupied') : 'Available');
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
  // 0 ay valid (walang advance/deposit); default lang kapag walang naka-set
  const toMonths = (v, fallback) => (v === null || v === undefined || v === '' || Number.isNaN(Number(v)) ? fallback : Math.max(0, Number(v)));
  const advanceMonths = toMonths(item?.advance_months, 1);
  const depositMonths = toMonths(item?.deposit_months, 2);
  return { price, advanceMonths, depositMonths, advance: price * advanceMonths, deposit: price * depositMonths };
};

function ListingCard({ item, isFav, onToggleFavorite, onOpen, stats, distanceLabel }) {
  return (
    <div
      className="listing-card animate-slide-up"
      onClick={() => onOpen(item)}
    >
      <div className="image-container">
        <img src={item.image || '/placeholder.png'} alt={item.name || item.title} loading="lazy" />
        <span className={`avail-badge ${isOccupied(item) ? 'occupied' : 'available'}`}>
          {availabilityLabel(item)}
        </span>
        <button
          type="button"
          className={`fav-btn${isFav ? ' active' : ''}`}
          aria-label={isFav ? 'Remove from wishlist' : 'Save to wishlist'}
          title={isFav ? 'Remove from wishlist' : 'Save to wishlist'}
          onClick={(e) => onToggleFavorite(item.id, e)}
        >
          <Heart size={18} />
        </button>
        {distanceLabel && (
          <span className="card-km-chip" title={distanceLabel}>
            <Navigation size={11} /> {distanceLabel.replace(' mula sa iyo', '')}
          </span>
        )}
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
            <p className="card-subtitle">
              {item.type || item.category || 'Rental Property'}
              {isStaycation(item) && <span> • hanggang {stayCapacity(item)} guests</span>}
            </p>
          </div>
        </div>

        <div className="card-price-row">
          <span className="price-tag">₱{item.price?.toLocaleString() || 0}</span>
          <span className="price-period">{isStaycation(item) ? '/gabi' : '/month'}</span>
          {stats?.count > 0 && (
            <span className="card-rating" title={`${stats.avg.toFixed(1)} out of 3`}>
              <Star size={11} fill="currentColor" strokeWidth={0} />
              {stats.avg.toFixed(1)}
              <em>({stats.count})</em>
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// Buksan agad ang calendar / guest list kapag pinindot kahit saang bahagi ng segment
const openStayPicker = (e) => {
  const control = e.currentTarget.querySelector('input[type="date"], select');
  if (!control) return;
  // native na nagbubukas ang select kapag ito mismo ang pinindot
  if (e.target === control && control.tagName === 'SELECT') return;
  try {
    control.focus();
    control.showPicker?.();
  } catch { /* hindi suportado ng browser: gagana pa rin ang normal na click */ }
};

function App() {
  const [session, setSession] = useState(null);
  const [properties, setProperties] = useState([]); // Dynamic properties state
  const [reviews, setReviews] = useState([]);
  const [reviewsLoading, setReviewsLoading] = useState(true);
  const [loading, setLoading] = useState(true);
  const [isGuest, setIsGuest] = useState(localStorage.getItem('budgetrent_guest') === 'true');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isTourOpen, setIsTourOpen] = useState(false);
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
  const [budgetMax, setBudgetMax] = useState('');
  const [stayDate, setStayDate] = useState('');
  const [stayGuests, setStayGuests] = useState('');
  const stayWhereRef = useRef(null);
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
  const isOwner = isAdminEmail(session?.user?.email);

  // Layo ng bawat listing mula sa lokasyon ng tenant (kung pinayagan ang location)
  const userLoc = useUserLocation();

  // App tour: kusang lalabas sa unang bukas ng naka-install na app (o ?tour=1). Puwede ring buksan sa menu.
  useEffect(() => {
    if (!session && !isGuest) return;
    if (forceTourFromUrl() || (isInstalledApp() && !hasSeenTour())) setIsTourOpen(true);
  }, [session, isGuest]);
  // Staycation 'Where': hanapin ang buong lugar sa mapa, hindi lang text sa address
  const priceQuery = parseNumericQuery(debouncedSearchQuery);
  const stayArea = useAreaSearch(debouncedSearchQuery, selectedCategory === 'Staycation' && !priceQuery);
  const approxCoords = useApproxCoords(properties, Boolean(userLoc.coords) || Boolean(stayArea));
  const getDistanceLabel = (item) => {
    if (!userLoc.coords || !item) return null;
    const pinned = toCoords(item);
    const coords = pinned || approxCoords[item.id];
    if (!coords) return null;
    return `${pinned ? '' : '≈ '}${formatDistance(distanceKm(userLoc.coords, coords))} mula sa iyo`;
  };



  useEffect(() => {
    // Admin account ay para sa /superadmin lang — hindi ito ituturing na user session sa main app
    const forAppOnly = (s) => (s && isAdminEmail(s.user?.email) && !isAdminPath() ? null : s);
    validateCurrentSession().then((rawSession) => {
      const session = forAppOnly(rawSession);
      setSession(session);
      if (session) {
        setIsGuest(false);
        localStorage.removeItem('budgetrent_guest');
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, rawSession) => {
      const session = forAppOnly(rawSession);
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
    fetchReviews(); // Customer reviews (kasing-batch ng properties fetch)

    // Check for /superadmin route
    if (isAdminPath()) {
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

  const fetchReviews = async () => {
    try {
      setReviewsLoading(true);
      const { data, error } = await supabase
        .from('property_reviews')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(500);

      if (error) throw error;
      setReviews(data || []);
    } catch (error) {
      console.error('Error fetching reviews:', error.message);
      setReviews([]);
    } finally {
      setReviewsLoading(false);
    }
  };

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

  // Toggle ng landlord: Available <-> Occupied
  const handleToggleAvailability = async (item) => {
    const next = isOccupied(item) ? 'Available' : 'Occupied';
    const setStatus = (value) => setProperties(prev => prev.map(p => p.id === item.id ? { ...p, availability: value } : p));
    setStatus(next);
    const { error } = await supabase.from('properties').update({ availability: next }).eq('id', item.id);
    if (error) {
      setStatus(item.availability || 'Available');
      alert(error.code === '42703' || /availability/i.test(error.message || '')
        ? 'Wala pa ang "availability" column sa database. Patakbuhin muna ang SQL migration sa Supabase SQL Editor.'
        : 'Error updating availability: ' + error.message);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    localStorage.removeItem('budgetrent_admin_bypass');
    localStorage.removeItem('budgetrent_guest');
    setIsGuest(false);
    setIsMenuOpen(false);
    if (isAdminPath()) {
      window.location.href = '/';
    }
  };

  // Landlord na dating naka-subscribe at expired na ang plan = naka-lock ang app hanggang makapag-renew
  const lockedExpiry = useMemo(() => {
    if (isGuest || !session?.user?.id || session.user.user_metadata?.user_role !== 'landlord') return null;
    const mine = properties.filter(p => p.user_id === session.user.id && p.subscription_date && p.subscription_expiry);
    if (!mine.length) return null;
    const latest = Math.max(...mine.map(p => new Date(p.subscription_expiry).getTime()));
    return latest < Date.now() ? new Date(latest).toISOString() : null;
  }, [properties, session, isGuest]);

  const maxBudget = parseBudget(budgetMax) || priceQuery;

  const filteredListings = useMemo(() => {
    const skipBudget = activeTab === 'mylistings' || activeTab === 'admin';
    const matches = properties.filter(item => {
      const matchesCategory = (activeTab === 'mylistings' || activeTab === 'admin')
        ? true
        : selectedCategory === "Staycation"
          ? isStaycation(item)
          : selectedCategory === "Paupahan"
            ? !isStaycation(item)
            : (item.type || "") === selectedCategory || (item.category || "") === selectedCategory;
      const q = debouncedSearchQuery.toLowerCase();
      const matchesText = (item.name || item.title || "").toLowerCase().includes(q) || 
                          (item.location || "").toLowerCase().includes(q);
      const matchesArea = Boolean(stayArea) && inArea(toCoords(item) || approxCoords[item.id], stayArea);
      const matchesSearch = priceQuery > 0 || matchesText || matchesArea;
      // Staycation 'Who': ayon sa kasya ang guests. Kasama pa rin ang occupied dahil puwede pang mag-reserve
      const skipStay = activeTab === 'mylistings' || activeTab === 'admin' || selectedCategory !== 'Staycation';
      const matchesStay = skipStay || (
        (!stayGuests || stayCapacity(item) >= Number(stayGuests))
      );
      const matchesMyListings = activeTab === 'mylistings' ? (item.user_id === session?.user?.id) : true;
      const price = Number(item.price) || 0;
      const matchesBudget = skipBudget || maxBudget <= 0 || (price > 0 && price <= maxBudget);
      return matchesCategory && matchesSearch && matchesMyListings && matchesBudget && matchesStay;
    });
    // May budget: pinakamalapit sa budget muna (hal. 4000 → ₱4,000, ₱3,900...), para tugma ang unang lalabas
    return maxBudget > 0 && !skipBudget
      ? [...matches].sort((a, b) => (Number(b.price) || 0) - (Number(a.price) || 0))
      : matches;
  }, [properties, selectedCategory, debouncedSearchQuery, activeTab, session?.user?.id, maxBudget, stayArea, approxCoords, stayDate, stayGuests]);

  // Pinakamurang listing sa napiling category (para sa mungkahi kapag walang pasok sa budget)
  const cheapestInCategory = useMemo(() => {
    const prices = properties
      .filter(item => (selectedCategory === 'Staycation' ? isStaycation(item) : !isStaycation(item)))
      .map(item => Number(item.price) || 0)
      .filter(price => price > 0);
    return prices.length ? Math.min(...prices) : null;
  }, [properties, selectedCategory]);

  const shouldShowOwnerAvatar = (item) => Boolean(item?.owner_avatar);

  const wishlistListings = useMemo(
    () => properties.filter(item => favorites.includes(item.id)),
    [properties, favorites]
  );

  const reviewStats = useMemo(() => {
    const map = new Map();
    reviews.forEach(r => {
      const stat = map.get(r.property_id) || { sum: 0, count: 0 };
      stat.sum += Number(r.rating) || 0;
      stat.count += 1;
      map.set(r.property_id, stat);
    });
    const stats = new Map();
    map.forEach((value, key) => stats.set(key, { avg: value.sum / value.count, count: value.count }));
    return stats;
  }, [reviews]);

  const reviewsForSelected = useMemo(
    () => (selectedProperty ? reviews.filter(r => r.property_id === selectedProperty.id) : []),
    [reviews, selectedProperty]
  );

  // Announcements galing sa admin (Supabase). Hindi nagfa-fail ang app kung wala pang table.
  const [announcements, setAnnouncements] = useState([]);
  const [deletedNotifs, setDeletedNotifs] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('budgetrent_deleted_notifs') || '[]');
    } catch {
      return [];
    }
  });

  // Tunog kapag may BAGONG announcement (hindi sa unang load)
  const seenAnnIds = useRef(null);
  const loadAnnouncements = async () => {
    const { data, error } = await supabase.from('announcements').select('*').order('created_at', { ascending: false }).limit(30);
    if (error) return;
    const list = data || [];
    const key = (a) => `${a.id}-${a.updated_at || a.created_at}`;
    if (seenAnnIds.current && list.some(a => !seenAnnIds.current.has(key(a)))) playNotifySound();
    seenAnnIds.current = new Set(list.map(key));
    setAnnouncements(list);
  };

  useEffect(() => {
    window.addEventListener('pointerdown', unlockNotifySound, { once: true });
    return () => window.removeEventListener('pointerdown', unlockNotifySound);
  }, []);

  useEffect(() => {
    loadAnnouncements();
    const t = setInterval(loadAnnouncements, 60000);
    return () => clearInterval(t);
  }, []);

  // Customer info requests (gustong magpa-tawag) para sa landlord; RLS ang naglilimita sa listings niya
  const [inquiries, setInquiries] = useState([]);
  const seenInquiryIds = useRef(null);
  useEffect(() => {
    if (!session?.user || isGuest) { setInquiries([]); seenInquiryIds.current = null; return; }
    const myId = session.user.id;
    const myEmail = String(session.user.email || '').toLowerCase();
    const load = async () => {
      const { data, error } = await supabase.from('customer_inquiries').select('*').order('created_at', { ascending: false }).limit(30);
      if (error) return;
      const list = (data || []).filter(r => r.user_id !== myId && (!isAdminEmail(myEmail) || String(r.owner_email || '').toLowerCase() === myEmail));
      if (seenInquiryIds.current && list.some(r => !seenInquiryIds.current.has(r.id))) playNotifySound();
      seenInquiryIds.current = new Set(list.map(r => r.id));
      setInquiries(list);
    };
    load();
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, [session, isGuest]);

  const timeAgo = (iso) => {
    const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.round(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.round(hrs / 24)}d ago`;
  };

  const notifications = useMemo(() => {
    const announcementItems = announcements.map(a => ({
      id: `ann-${a.id}-${a.updated_at || a.created_at}`,
      icon: '📢', tone: 'gold', title: a.title, body: a.body, time: timeAgo(a.updated_at || a.created_at)
    }));
    const items = [
      ...announcementItems,
      { id: 'welcome', icon: '🎉', tone: 'gold', title: 'Welcome to BudgetRentPH', body: 'Maligayang pagdating! Simulan ang paghahanap ng affordable na rental.', time: 'Just now' },
      { id: 'categories', icon: '🏠', tone: 'navy', title: 'Paupahan or Staycation', body: 'Piliin ang category para makita ang rentals na hinahanap mo.', time: 'Today' },
      { id: 'wishlist', icon: '❤️', tone: 'red', title: 'Save your favorites', body: 'I-tap ang heart sa listing para mapunta sa iyong Wishlist.', time: 'Today' },
    ];
    if (!isGuest) {
      items.push({ id: 'verified', icon: '✅', tone: 'green', title: 'Get Verified', body: 'Mag-verify ng account para mas magtitiwala ang mga tenant sa listings mo.', time: 'Tip' });
    }
    return items.filter(n => !deletedNotifs.includes(n.id));
  }, [isGuest, announcements, deletedNotifs]);

  // Hiwalay na call requests (Phone icon sa header) para sa landlord
  const callNotifs = useMemo(() => inquiries.map(r => ({
    id: `inq-${r.id}`,
    title: `${r.customer_name} gustong tumawag`,
    phone: r.customer_phone,
    time: timeAgo(r.created_at)
  })).filter(n => !deletedNotifs.includes(n.id)), [inquiries, deletedNotifs]);
  const callUnread = callNotifs.filter(n => !readNotifs.includes(n.id)).length;
  const [isCallNotifOpen, setIsCallNotifOpen] = useState(false);
  const markCallsRead = () => {
    const next = [...new Set([...readNotifs, ...callNotifs.map(n => n.id)])];
    setReadNotifs(next);
    localStorage.setItem('budgetrent_read_notifs', JSON.stringify(next));
  };

  const unreadCount = notifications.filter(n => !readNotifs.includes(n.id)).length;

  // Delete ay sa device na ito lang (hindi nabubura ang announcement ng iba)
  const deleteNotifs = (ids) => {
    const next = [...new Set([...deletedNotifs, ...ids])];
    setDeletedNotifs(next);
    localStorage.setItem('budgetrent_deleted_notifs', JSON.stringify(next));
  };

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



  if (!session && !isGuest && !isAdminPath()) {
    return (
      <Suspense fallback={<div className="text-center py-10"><Loader2 className="animate-spin text-primary mx-auto" size={40} /></div>}>
        <Auth onAuthSuccess={() => { setIsGuest(true); localStorage.setItem('budgetrent_guest', 'true'); }} />
      </Suspense>
    );
  }

  // If visiting /superadmin specifically, override rendering to show AdminPanel if authorized (or AdminLogin if not)
  if (isAdminPath()) {
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
            {!isGuest && session?.user && (
              <div className="notif-wrap">
                <button
                  className={`menu-btn notif-btn call-btn${callUnread > 0 ? ' has-unread' : ''}`}
                  onClick={() => { setIsNotifOpen(false); setIsCallNotifOpen(o => !o); }}
                  aria-label="Call requests"
                >
                  <Phone size={22} />
                  {callUnread > 0 && <span className="notif-badge">{callUnread}</span>}
                </button>

                {isCallNotifOpen && (
                  <>
                    <div className="notif-overlay" onClick={() => setIsCallNotifOpen(false)} />
                    <div className="notif-panel animate-slide-up">
                      <div className="notif-head">
                        <h4>Call Requests</h4>
                        <div className="notif-head-actions">
                          {callUnread > 0 && <button onClick={markCallsRead}>Mark all as read</button>}
                          {callNotifs.length > 0 && <button onClick={() => deleteNotifs(callNotifs.map(n => n.id))}>Clear all</button>}
                        </div>
                      </div>
                      <div className="notif-list">
                        {callNotifs.length === 0 && <p className="notif-empty">Wala pang gustong tumawag.</p>}
                        {callNotifs.map(n => (
                          <div key={n.id} className={`notif-item${readNotifs.includes(n.id) ? '' : ' unread'}`}
                            onClick={() => {
                              const next = [...new Set([...readNotifs, n.id])];
                              setReadNotifs(next);
                              localStorage.setItem('budgetrent_read_notifs', JSON.stringify(next));
                            }}>
                            <div className="notif-icon green"><Phone size={18} /></div>
                            <div className="notif-text">
                              <p className="notif-title">{n.title}</p>
                              <p className="notif-body"><a href={`tel:${n.phone}`} style={{ color: 'inherit', fontWeight: 800 }}>{n.phone}</a></p>
                              <span className="notif-time">{n.time}</span>
                            </div>
                            <button type="button" className="notif-delete" aria-label="Delete" title="Delete"
                              onClick={(e) => { e.stopPropagation(); deleteNotifs([n.id]); }}>
                              <Trash2 size={15} />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            <div className="notif-wrap">
              <button
                className={`menu-btn notif-btn${unreadCount > 0 ? ' has-unread' : ''}`}
                onClick={() => { setIsCallNotifOpen(false); setIsNotifOpen(o => !o); }}
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
                      <div className="notif-head-actions">
                        {unreadCount > 0 && (
                          <button onClick={markAllRead}>Mark all as read</button>
                        )}
                        {notifications.length > 0 && (
                          <button onClick={() => deleteNotifs(notifications.map(n => n.id))}>Clear all</button>
                        )}
                      </div>
                    </div>
                    <div className="notif-list">
                      {notifications.length === 0 && <p className="notif-empty">Wala kang notifications.</p>}
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
                          <button
                            type="button"
                            className="notif-delete"
                            aria-label="Delete notification"
                            title="Delete"
                            onClick={(e) => { e.stopPropagation(); deleteNotifs([n.id]); }}
                          >
                            <Trash2 size={15} />
                          </button>
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
                <span className="menu-logo-chip"><img src="/logo.png" alt="Logo" className="logo-img" /></span>
                <div className="menu-brand-text">
                  <h1 className="brand-name">Budget<span>Rent</span>PH</h1>
                  <p>Mura. Malapit. Mapagkakatiwalaan.</p>
                </div>
              </div>
              <button className="close-menu" onClick={() => setIsMenuOpen(false)}><X size={24} /></button>
            </div>
            
            <div className="menu-items">
              {isGuest && (
                <>
                  <p className="menu-section-label">Explore</p>
                  <button className={`menu-link${activeTab === 'home' ? ' active' : ''}`} onClick={() => { setIsMenuOpen(false); setActiveTab('home'); }}>
                    <div className="icon-container-mini"><House size={18} /></div> Home
                  </button>
                  <button className={`menu-link${activeTab === 'wishlist' ? ' active' : ''}`} onClick={() => { setIsMenuOpen(false); setActiveTab('wishlist'); }}>
                    <div className="icon-container-mini secondary-icon"><Heart size={18} /></div> My Wishlist
                  </button>
                  <button className={`menu-link${activeTab === 'explore' ? ' active' : ''}`} onClick={() => { setIsMenuOpen(false); setActiveTab('explore'); }}>
                    <div className="icon-container-mini"><Navigation size={18} /></div> Phone Location
                  </button>
                </>
              )}
              {!isGuest && (
                <>
                  <p className="menu-section-label">Landlord</p>
                  <button className="menu-link highlight" onClick={() => { setIsMenuOpen(false); setIsPropertyFormOpen(true); }}>
                    <div className="icon-container-mini"><HousePlus size={18} /></div> List your property
                  </button>
                  <button className={`menu-link${activeTab === 'mylistings' ? ' active' : ''}`} onClick={() => { setIsMenuOpen(false); setActiveTab('mylistings'); }}>
                    <div className="icon-container-mini"><ClipboardList size={18} /></div> My Listings
                  </button>
                  <button className={`menu-link${activeTab === 'agreement' ? ' active' : ''}`} onClick={() => { setIsMenuOpen(false); setActiveTab('agreement'); }}>
                    <div className="icon-container-mini secondary-icon"><FileSignature size={18} /></div> Create Agreement Draft
                  </button>
                  <button className="menu-link" onClick={() => { setIsMenuOpen(false); setIsProfileEditing(true); setIsProfileModalOpen(true); }}>
                    <div className="icon-container-mini"><User size={18} /></div> Contact & Profile
                  </button>
                  <button className={`menu-link${activeTab === 'verified' ? ' active' : ''}`} onClick={() => { setIsMenuOpen(false); setActiveTab('verified'); }}>
                    <div className="icon-container-mini secondary-icon"><BadgeCheck size={18} /></div> Get Verified
                  </button>
                </>
              )}


              
              <div className="menu-divider"></div>
              <p className="menu-section-label">Tungkol & Tulong</p>
              <button className="menu-link" onClick={() => { setIsMenuOpen(false); setIsTourOpen(true); }}>
                <div className="icon-container-mini secondary-icon"><Lightbulb size={18} /></div> App Tour (Paano gamitin)
              </button>
              <button className={`menu-link${activeTab === 'about' ? ' active' : ''}`} onClick={() => { setIsMenuOpen(false); setActiveTab('about'); }}>
                <div className="icon-container-mini"><Building2 size={18} /></div> About Us
              </button>
              <button className={`menu-link${activeTab === 'terms' ? ' active' : ''}`} onClick={() => { setIsMenuOpen(false); setActiveTab('terms'); }}>
                <div className="icon-container-mini"><ScrollText size={18} /></div> Terms & Policies
              </button>
              <button className={`menu-link${activeTab === 'support' ? ' active' : ''}`} onClick={() => { setIsMenuOpen(false); setActiveTab('support'); }}>
                <div className="icon-container-mini secondary-icon"><Headset size={18} /></div> Chat Customer Support
              </button>
              <button className="menu-link logout" onClick={handleLogout}>
                <div className="icon-container-mini logout-icon"><LogOut size={18} /></div> Sign Out
              </button>
            </div>

            <div className="menu-footer">
              <p><strong>Budget<span>Rent</span>PH</strong><br />© 2026 Budget Rent PH</p>
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
            <HeroBudi message="Hello! 👋 Ako si Budi. Hanapin dito ang paupahan o staycation na pasok sa budget mo." />
            <div className="hero-content">
              <h2>Welcome to <span>BudgetRentPH</span></h2>
              <p>Mura. Malapit. Mapagkakatiwalaan.</p>
                {selectedCategory === 'Staycation' ? (
                  <div className="staycation-search">
                    <div className="stay-seg stay-seg-where">
                      <label htmlFor="stay-where">Where</label>
                      <div className="stay-input-row">
                        <input
                          id="stay-where"
                          ref={stayWhereRef}
                          type="text"
                          placeholder="Search destinations"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') e.target.blur(); }}
                        />
                        {searchQuery !== '' && (
                          <button
                            type="button"
                            className="stay-clear"
                            aria-label="Burahin ang search"
                            onClick={() => setSearchQuery('')}
                          >
                            <X size={13} />
                          </button>
                        )}
                      </div>
                    </div>
                    <span className="stay-sep" />
                    <div className="stay-seg" onClick={openStayPicker}>
                      <label htmlFor="stay-when">When</label>
                      <div className="stay-date">
                        <input
                          id="stay-when"
                          type="date"
                          min={new Date().toISOString().slice(0, 10)}
                          className={stayDate ? '' : 'is-empty'}
                          value={stayDate}
                          onChange={(e) => setStayDate(e.target.value)}
                        />
                        {!stayDate && <span>Add dates</span>}
                      </div>
                    </div>
                    <span className="stay-sep" />
                    <div className="stay-seg" onClick={openStayPicker}>
                      <label htmlFor="stay-who">Who</label>
                      <select
                        id="stay-who"
                        className={stayGuests ? 'has-value' : ''}
                        value={stayGuests}
                        onChange={(e) => setStayGuests(e.target.value)}
                      >
                        <option value="">Guests</option>
                        <option value="1">1 guest</option>
                        <option value="2">2 guests</option>
                        <option value="3">3 guests</option>
                        <option value="4">4 guests</option>
                        <option value="5">5 guests</option>
                        <option value="6">6 guests</option>
                        <option value="7">7 guests</option>
                        <option value="8">8+ guests</option>
                      </select>
                    </div>
                    <button
                      type="button"
                      className="stay-search-btn"
                      aria-label="Search destinations"
                      onClick={() => stayWhereRef.current?.focus()}
                    >
                      <Search size={18} />
                    </button>
                  </div>
                ) : (
                <div className="search-bar">
                  <Search className="search-icon" size={20} />
                  <input 
                    type="text" 
                    placeholder="Search by city or area..." 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                  {searchQuery !== '' && (
                    <button
                      type="button"
                      className="budget-clear"
                      aria-label="Burahin ang search"
                      onClick={() => setSearchQuery('')}
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
                )}

                <div className="budget-search">
                  <div className="budget-input-wrap">
                    <span className="budget-peso">₱</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      autoComplete="off"
                      className="budget-input"
                      placeholder={selectedCategory === 'Staycation' ? 'Budget mo kada gabi' : 'Budget mo kada buwan'}
                      value={budgetMax === '' ? '' : Number(budgetMax).toLocaleString('en-US')}
                      onChange={(e) => setBudgetMax(e.target.value.replace(/\D/g, '').replace(/^0+/, '').slice(0, 7))}
                    />
                    <span className="budget-suffix">{selectedCategory === 'Staycation' ? '/gabi' : '/mo'}</span>
                    {budgetMax !== '' && (
                      <button
                        type="button"
                        className="budget-clear"
                        aria-label="Burahin ang budget"
                        onClick={() => setBudgetMax('')}
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>
                  {maxBudget > 0 && (
                    <p className="budget-hint">
                      Hanggang ₱{maxBudget.toLocaleString()}{selectedCategory === 'Staycation' ? ' kada gabi' : ' kada buwan'} • {filteredListings.length} resulta
                      {selectedCategory !== 'Staycation' && ' • buwanang upa lang, hindi pa kasama ang advance at deposit'}
                    </p>
                  )}
                </div>
            </div>
          </header>

          <div className="category-section" style={{ position: 'relative' }}>
            <div className="category-scroll" id="main-category-scroll">
              {CATEGORIES.map(cat => (
                <button 
                  key={cat} 
                  className={`category-chip ${selectedCategory === cat ? 'active' : ''}`}
                  onClick={() => { if (cat !== selectedCategory) setBudgetMax(''); setSelectedCategory(cat); }}
                >
                  <span className="chip-emoji">{React.createElement(CATEGORY_ICON[cat] || House, { size: 20, strokeWidth: 2.2 })}</span>
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
              <>
              {userLoc.status !== 'granted' && (
                <button
                  type="button"
                  className="distance-prompt"
                  onClick={userLoc.request}
                  disabled={userLoc.status === 'loading'}
                >
                  <Navigation size={15} />
                  {userLoc.status === 'loading' ? 'Hinahanap ang lokasyon mo...'
                    : userLoc.status === 'denied' ? 'Naka-block ang location — i-Allow sa browser/phone settings para makita ang layo'
                    : userLoc.status === 'unavailable' ? 'Hindi makuha ang lokasyon — subukan ulit'
                    : 'I-on ang location para makita kung gaano kalayo ang bawat bahay'}
                </button>
              )}
              {filteredListings.length === 0 && (
                <div className="budget-empty">
                  {maxBudget > 0 && cheapestInCategory && cheapestInCategory > maxBudget ? (
                    <>
                      <strong>Walang listing na hanggang ₱{maxBudget.toLocaleString()}</strong>
                      <span>Ang pinakamura ngayon ay ₱{cheapestInCategory.toLocaleString()}{selectedCategory === 'Staycation' ? ' kada gabi' : ' kada buwan'}.</span>
                      <button type="button" onClick={() => setBudgetMax(String(cheapestInCategory))}>Ipakita hanggang ₱{cheapestInCategory.toLocaleString()}</button>
                    </>
                  ) : (
                    <>
                      <strong>Walang nahanap na listing</strong>
                      <span>Subukan ang ibang lugar, petsa, o budget.</span>
                      {maxBudget > 0 && <button type="button" onClick={() => { setBudgetMax(''); if (priceQuery) setSearchQuery(''); }}>Burahin ang budget</button>}
                    </>
                  )}
                </div>
              )}
              <div className="listing-grid">
                {filteredListings.map(item => (
                  <ListingCard
                    key={item.id}
                    item={item}
                    isFav={favorites.includes(item.id)}
                    onToggleFavorite={toggleFavorite}
                    onOpen={setSelectedProperty}
                    stats={reviewStats.get(item.id)}
                    distanceLabel={getDistanceLabel(item)}
                  />
                ))}
              </div>
              </>
            )}
          </main>
        </>
      )}

      {activeTab === 'explore' && (
        <Suspense fallback={<div className="text-center py-10"><Loader2 className="animate-spin text-primary mx-auto" size={40} /></div>}>
          <FindNearbyPage 
            listings={properties}
            userLocation={userLoc.coords}
            reviewStats={reviewStats}
            onSelectProperty={setSelectedProperty}
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
            <HeroBudi message="Dito makikita ang mga na-save mo. Pindutin ang ❤ sa kahit anong listing para i-save ito." />
            <div className="hero-content">
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
                    stats={reviewStats.get(item.id)}
                    distanceLabel={getDistanceLabel(item)}
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
            <HeroBudi message="Dito makikita ang lahat ng listing mo. Pindutin ang Edit para palitan ang detalye o status." />
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
              <div className="mine-grid">
                {filteredListings.map(item => (
                  <div key={item.id} className="mine-card animate-slide-up">
                    <div className="mine-img">
                      <img src={item.image || '/placeholder.png'} alt={item.name || item.title} loading="lazy" />
                      <span className={`avail-badge ${isOccupied(item) ? 'occupied' : 'available'}`}>
                        {availabilityLabel(item)}
                      </span>
                    </div>
                    <div className="mine-info">
                      <span className={`mine-cat ${isStaycation(item) ? 'stay' : 'rent'}`}>
                        {isStaycation(item) ? <TreePalm size={11} /> : <House size={11} />}
                        {isStaycation(item) ? 'Staycation' : 'Paupahan'}
                      </span>
                      <h4 className="mine-name">{item.name || item.title}</h4>
                      <div className="mine-price">
                        ₱{item.price?.toLocaleString() || 0}<span>{isStaycation(item) ? '/gabi' : '/month'}</span>
                      </div>
                      <div className="mine-loc"><MapPin size={12} /> <span>{item.location}</span></div>
                      <button
                        type="button"
                        className={`mine-toggle ${isOccupied(item) ? 'occupied' : 'available'}`}
                        onClick={(e) => { e.stopPropagation(); handleToggleAvailability(item); }}
                        aria-pressed={isOccupied(item)}
                        title={isStaycation(item) && isOccupied(item) ? 'Occupied — puwede pa ring mag-reserve ng slot ang guests' : 'I-toggle: Available / Occupied'}
                      >
                        <span className="mine-toggle-track"><span className="mine-toggle-knob" /></span>
                        <span className="mine-toggle-text">
                          {isOccupied(item) ? 'Occupied' : 'Available'}
                          {isStaycation(item) && isOccupied(item) && <em> • reserve pa</em>}
                        </span>
                      </button>
                      <div className="mine-actions">
                        <button
                          className="mine-btn mine-edit"
                          onClick={(e) => { e.stopPropagation(); setEditingListingItem(item); setIsEditListingsOpen(true); }}
                        >
                          Edit
                        </button>
                        <button
                          className="mine-btn mine-delete"
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

      {activeTab === 'updates' && (
        <Suspense fallback={<div className="text-center py-10"><Loader2 className="animate-spin text-primary mx-auto" size={40} /></div>}>
          <UpdatesPage />
        </Suspense>
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
              <div className="modal-badges">
                <span className="type-badge">{selectedProperty.type}</span>
                <span className={`avail-badge inline ${isOccupied(selectedProperty) ? 'occupied' : 'available'}`}>
                  {availabilityLabel(selectedProperty)}
                </span>
              </div>
              <h2>{selectedProperty.name || selectedProperty.title}</h2>
              {isStaycation(selectedProperty) && isOccupied(selectedProperty) && (
                <p className="stay-reserve-note"><Info size={14} /> Occupied ngayon, pero puwede ka pa ring mag-reserve ng slot para sa ibang petsa.</p>
              )}
              {(() => {
                const { price, advance, deposit, advanceMonths, depositMonths } = getMoveInBreakdown(selectedProperty);
                const peso = (n) => `₱${n.toLocaleString()}`;
                const mo = (n) => `${n} ${n === 1 ? 'month' : 'months'}`;
                if (isStaycation(selectedProperty)) {
                  const down = Number(selectedProperty.down_payment) || 0;
                  return (
                    <div className="modal-movein-box">
                      <div className="modal-movein-title">Bayarin</div>
                      <div className="modal-movein-grid">
                        <div className="modal-movein-cell rent">
                          <span>Per Night</span>
                          <strong>{peso(price)}</strong>
                        </div>
                        <div className="modal-movein-cell">
                          <span>Down Payment</span>
                          <strong>{down > 0 ? peso(down) : 'Wala'}</strong>
                        </div>
                      </div>
                    </div>
                  );
                }
                return (
                  <div className="modal-movein-box">
                    <div className="modal-movein-title">Bayarin</div>
                    <div className="modal-movein-grid">
                      <div className="modal-movein-cell rent">
                        <span>Monthly Rent</span>
                        <strong>{peso(price)}</strong>
                      </div>
                      <div className="modal-movein-cell">
                        <span>Advance</span>
                        <strong>{advanceMonths > 0 ? peso(advance) : 'Wala'}</strong>
                        <em>{mo(advanceMonths)}</em>
                      </div>
                      <div className="modal-movein-cell">
                        <span>Deposit</span>
                        <strong>{depositMonths > 0 ? peso(deposit) : 'Wala'}</strong>
                        <em>{mo(depositMonths)}</em>
                      </div>
                    </div>
                  </div>
                );
              })()}
              
              <div className="modal-location">
                <MapPin size={18} /> {selectedProperty.location}{getDistanceLabel(selectedProperty) && <span className="card-distance"> • {getDistanceLabel(selectedProperty)}</span>}
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
                {isStaycation(selectedProperty) && (
                  <div className="amenity-item">
                    <div className="circle-icon"><PawPrint size={16} /></div>
                    <div>
                      <label>Pets</label>
                      <p>{selectedProperty.pets_allowed === 'Yes' ? 'Pet-friendly (allowed)' : 'Not allowed'}</p>
                    </div>
                  </div>
                )}
              </div>

              <Suspense fallback={null}>
                <ReviewsSection
                  property={selectedProperty}
                  session={session}
                  isGuest={isGuest}
                  reviews={reviewsForSelected}
                  loading={reviewsLoading}
                  onChanged={fetchReviews}
                />
              </Suspense>

              <div className="modal-actions">
                <CallGateLink phone={selectedProperty.contact} propertyId={selectedProperty.id} ownerEmail={selectedProperty.email} className="contact-btn call">
                  <Phone size={20} /> Call Owner
                </CallGateLink>
                <a href={`mailto:${selectedProperty.email}?subject=Inquiry about ${selectedProperty.name}`} className="contact-btn email">
                  <Mail size={20} /> Email Owner
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      {isTourOpen && (
        <Suspense fallback={null}>
          <AppTour isLandlord={!isGuest} onClose={() => setIsTourOpen(false)} />
        </Suspense>
      )}

      {/* Navigation Bar */}
      {(!isOwner || activeTab !== 'admin') && (
        <nav className={`bottom-nav glass${!isGuest ? ' landlord-nav' : ''}`} aria-label="Main navigation">
          {!isGuest ? (
            /* Landlord Navigation */
            <>
              <button
                className={`nav-item ico-list ${activeTab === 'mylistings' ? 'active' : ''}`}
                onClick={() => setActiveTab('mylistings')}
                aria-current={activeTab === 'mylistings' ? 'page' : undefined}
              >
                <span className="nav-icon-box"><ClipboardList size={22} /></span>
                <span className="nav-label">My Listings</span>
              </button>
              <button
                className={`nav-item ico-updates ${activeTab === 'updates' ? 'active' : ''}`}
                onClick={() => setActiveTab('updates')}
                aria-current={activeTab === 'updates' ? 'page' : undefined}
              >
                <span className="nav-icon-box"><Megaphone size={22} /></span>
                <span className="nav-label">Updates</span>
              </button>
              <button className="nav-item circle-plus" onClick={() => setIsPropertyFormOpen(true)} aria-label="List your property" title="List your property"><Plus size={34} strokeWidth={3.2} /></button>
              <button
                className={`nav-item ico-account ${isProfileModalOpen ? 'active' : ''}`}
                onClick={() => { setIsProfileEditing(false); setIsProfileModalOpen(true); }}
              >
                <span className="nav-icon-box"><User size={22} /></span>
                <span className="nav-label">Account</span>
              </button>
              <button
                className={`nav-item ico-support ${activeTab === 'support' ? 'active' : ''}`}
                onClick={() => setActiveTab('support')}
                aria-current={activeTab === 'support' ? 'page' : undefined}
              >
                <span className="nav-icon-box"><Headset size={22} /></span>
                <span className="nav-label">Support</span>
              </button>
            </>
          ) : (
            /* Tenant Navigation */
            <>
              <button
                className={`nav-item ico-nearby ${activeTab === 'explore' ? 'active' : ''}`}
                onClick={() => setActiveTab('explore')}
                aria-current={activeTab === 'explore' ? 'page' : undefined}
              >
                <span className="nav-icon-box"><MapPin size={22} /></span>
                <span className="nav-label">Nearby</span>
              </button>
              <button
                className={`nav-item ico-home ${activeTab === 'home' ? 'active' : ''}`}
                onClick={() => setActiveTab('home')}
                aria-current={activeTab === 'home' ? 'page' : undefined}
              >
                <span className="nav-icon-box"><Home size={22} /></span>
                <span className="nav-label">Home</span>
              </button>
              <button
                className={`nav-item ico-updates ${activeTab === 'updates' ? 'active' : ''}`}
                onClick={() => setActiveTab('updates')}
                aria-current={activeTab === 'updates' ? 'page' : undefined}
              >
                <span className="nav-icon-box"><Megaphone size={22} /></span>
                <span className="nav-label">Updates</span>
              </button>
              <button
                className={`nav-item ico-wish ${activeTab === 'wishlist' ? 'active' : ''}`}
                onClick={() => setActiveTab('wishlist')}
                aria-current={activeTab === 'wishlist' ? 'page' : undefined}
              >
                <span className="nav-icon-box"><Heart size={22} /></span>
                <span className="nav-label">Wishlist</span>
              </button>
            </>
          )}
        </nav>
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

      {lockedExpiry && (
        <Suspense fallback={null}>
          <SubscriptionLock session={session} expiry={lockedExpiry} onLogout={handleLogout} onRefresh={fetchProperties} />
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
                 <CallGateLink phone={viewingLandlord.contact} ownerEmail={viewingLandlord.email} className="contact-btn call" style={{ flex: 1, padding: '12px', fontSize: '0.85rem', margin: 0 }}>
                   <Phone size={18} /> Call
                 </CallGateLink>
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
