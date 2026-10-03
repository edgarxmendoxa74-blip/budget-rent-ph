import React, { useState, useEffect, useMemo, useRef, Suspense, lazy } from 'react';
import { HeroBudi } from './components/MascotSplash';
import { Search, MapPin, Bed, Bath, Wifi, Shield, Star, Menu, X, Heart, MessageCircle, Phone, LogOut, Building2, User, Users, Loader2, ClipboardList, Mail, BadgeCheck, Headset, ArrowLeft, Home, Navigation, Globe, Trash2, ChevronLeft, ChevronRight, Bell, FileText, HousePlus, LocateFixed, PawPrint, ScrollText, FileSignature, Info, House, TreePalm, Plus, Lightbulb, Megaphone, CalendarCheck, Inbox, BarChart3, Wallet } from 'lucide-react';
import { clearSupabaseSessionStorage, recoverFromJwtError, supabase, validateCurrentSession } from './lib/supabase';
import { isAdminEmail, isAdminPath } from './lib/admin';
import { playNotifySound, unlockNotifySound } from './lib/notifySound';
import { useUserLocation } from './lib/useUserLocation';
import { isInstalledApp, hasSeenTour, forceTourFromUrl } from './lib/tour';
import { useApproxCoords } from './lib/useApproxCoords';
import { useAreaSearch } from './lib/useAreaSearch';
import { NEW_TENANT_KEY } from './lib/tenantAuth';
import { fetchDismissedIds, dismissBooking } from './lib/bookingDismissals';
import { matchesPlaceQuery, buildPlaceIndex, normalizePlace, PLACE_LEVELS } from './lib/placeSearch';
import CallGateLink from './components/CallGate';
import { toCoords, distanceKm, formatDistance, inArea } from './lib/geo';
import './App.css';
import './components/ProfileModal.css';
import { ikImage } from './lib/imagekit';
import { fetchMyPlan, fetchTenantVerifiedUntil, isProActive, listingLimitFor, PRO_PLAN, PRO_LISTING_LIMIT, FREE_LISTING_LIMIT } from './lib/listingPlan';

// Lazy loaded components
const Auth = lazy(() => import('./components/Auth'));
const AppTour = lazy(() => import('./components/AppTour'));
const PropertyForm = lazy(() => import('./components/PropertyForm'));
const ProfileModal = lazy(() => import('./components/ProfileModal'));
const EditListings = lazy(() => import('./components/EditListings'));
const VerificationPage = lazy(() => import('./components/VerificationPage'));
const CustomerSupportPage = lazy(() => import('./components/CustomerSupportPage'));
const BookingsPage = lazy(() => import('./components/BookingsPage'));
const PaymentMethods = lazy(() => import('./components/PaymentMethods'));
const InboxPage = lazy(() => import('./components/InboxPage'));
const WelcomeModal = lazy(() => import('./components/WelcomeModal'));
const TenantAccountModal = lazy(() => import('./components/TenantAccountModal'));
const ListingActionSheet = lazy(() => import('./components/ListingActionSheet'));
const BookingAnalytics = lazy(() => import('./components/BookingAnalytics'));
const FindNearbyPage = lazy(() => import('./components/FindNearbyPage'));
const AdminPanel = lazy(() => import('./components/AdminPanel'));
const AdminLogin = lazy(() => import('./components/AdminLogin'));
const EmailVerificationHandler = lazy(() => import('./components/EmailVerificationHandler'));
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
const CATEGORY_LABEL = { Paupahan: 'Rentals', Staycation: 'Staycation' };

// Budget input sa home search: max na presyo kada buwan (0/blank = lahat)
const parseBudget = (value) => Math.max(0, Number(value) || 0);
// Numero lang ang tinype sa search bar (hal. 4000) = presyo, hindi pangalan ng lugar
const parseNumericQuery = (value) => {
  const q = String(value || '').trim().replace(/[₱,\s]/g, '');
  return /^\d{3,7}$/.test(q) ? Number(q) : 0;
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
const availabilityLabel = (item) => (isOccupied(item) ? (isStaycation(item) ? 'Occupied • Can still reserve' : 'Occupied') : 'Available');
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

const applySubscriptionExpiry = (properties) => {
  return properties.map(item => {
    if (item.is_verified && item.subscription_expiry && new Date(item.subscription_expiry) < new Date()) {
      console.log(`[Auto-Expiry] ${item.name} has expired (locally).`);
      return { ...item, is_verified: false, subscription_status: 'Expired' };
    }
    return item;
  });
};

const getMoveInBreakdown = (item) => {
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
        <img src={ikImage(item.image, 480) || '/placeholder.png'} alt={item.name || item.title} loading="lazy" />
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
            <Navigation size={11} /> {distanceLabel.replace(' from you', '')}
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
              {isStaycation(item) && <span> • up to {stayCapacity(item)} guests</span>}
            </p>
          </div>
          {stats?.count > 0 && (
            <span className="card-rating" title={`${stats.avg.toFixed(1)} out of 3`}>
              <Star size={11} fill="currentColor" strokeWidth={0} />
              {stats.avg.toFixed(1)}
              <em>({stats.count})</em>
            </span>
          )}
        </div>

        <div className="card-price-row">
          <span className="price-tag">₱{item.price?.toLocaleString() || 0}</span>
          <span className="price-period">{isStaycation(item) ? '/night' : '/month'}</span>
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
  // Tenant = account na may mobile number (walang email). Landlord = may email at verification.
  const isGuest = session?.user?.user_metadata?.user_role === 'tenant';
  // Verified ang landlord kung may listing nilang naka-verify (expired ay na-false na sa itaas)
  const myVerified = properties.some((p) => p.user_id === session?.user?.id && p.is_verified);
  // Welcome message pagkatapos mag-sign up ng tenant (nakaflag sa sessionStorage ng Auth)
  const [showWelcome, setShowWelcome] = useState(false);
  const [isTenantAccountOpen, setIsTenantAccountOpen] = useState(false);
  // Verified Tenant (₱50 / taon): kinukuha tuwing bubuksan ang My Account para sariwa
  const [tenantVerifiedUntil, setTenantVerifiedUntil] = useState(null);
  useEffect(() => {
    if (!isGuest || !session?.user?.id) { setTenantVerifiedUntil(null); return; }
    fetchTenantVerifiedUntil(session.user.id).then(setTenantVerifiedUntil);
  }, [isGuest, session?.user?.id, isTenantAccountOpen]);
  useEffect(() => {
    if (!isGuest) return;
    try {
      if (sessionStorage.getItem(NEW_TENANT_KEY)) {
        sessionStorage.removeItem(NEW_TENANT_KEY);
        setShowWelcome(true);
      }
    } catch { /* ignore */ }
  }, [isGuest]);
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
  const [myPlan, setMyPlan] = useState(null); // Pro Listings plan ng landlord (6-10 listings)
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
  // "Not now" sa banner: isang beses lang bawat session
  const [locBannerHidden, setLocBannerHidden] = useState(() => {
    try { return sessionStorage.getItem('budgetrent_loc_banner_hidden') === '1'; } catch { return false; }
  });
  const hideLocBanner = () => {
    setLocBannerHidden(true);
    try { sessionStorage.setItem('budgetrent_loc_banner_hidden', '1'); } catch { /* okay lang */ }
  };
  const locNeedsFix = ['denied', 'off', 'unavailable'].includes(userLoc.status);

  // App tour: kusang lalabas sa unang bukas ng naka-install na app (o ?tour=1). Puwede ring buksan sa menu.
  useEffect(() => {
    if (!session) return;
    if (forceTourFromUrl() || (isInstalledApp() && !hasSeenTour())) setIsTourOpen(true);
  }, [session, isGuest]);
  // Staycation 'Where': hanapin ang buong lugar sa mapa, hindi lang text sa address
  const priceQuery = parseNumericQuery(debouncedSearchQuery);
  // Hanapin ang buong lugar (lalawigan/bayan/barangay) sa mapa para sa Paupahan at Staycation
  const stayArea = useAreaSearch(debouncedSearchQuery, (selectedCategory === 'Staycation' || selectedCategory === 'Paupahan') && !priceQuery);
  // Rentals search: hiwa-hiwalay na Province / Town-City / Barangay; pinagsasama sa isang searchQuery para gumana ang filters
  const [rentPlace, setRentPlace] = useState({ province: '', town: '', brgy: '' });
  const [activeField, setActiveField] = useState(null); // 'province' | 'town' | 'brgy' | null
  const updateRentPlace = (patch) => {
    const next = { ...rentPlace, ...patch };
    setRentPlace(next);
    setSearchQuery([next.brgy, next.town, next.province].map((v) => v.trim()).filter(Boolean).join(', '));
  };
  const resetRentPlace = () => { setRentPlace({ province: '', town: '', brgy: '' }); setSearchQuery(''); };
  const [bookSheet, setBookSheet] = useState(null); // { item, kind } para sa Book Here sa property modal
  const approxCoords = useApproxCoords(properties, Boolean(userLoc.coords) || Boolean(stayArea));
  const getDistanceLabel = (item) => {
    if (!userLoc.coords || !item) return null;
    const pinned = toCoords(item);
    const coords = pinned || approxCoords[item.id];
    if (!coords) return null;
    return `${pinned ? '' : '≈ '}${formatDistance(distanceKm(userLoc.coords, coords))} from you`;
  };



  useEffect(() => {
    // Admin account ay para sa /superadmin lang — hindi ito ituturing na user session sa main app
    const forAppOnly = (s) => (s && isAdminEmail(s.user?.email) && !isAdminPath() ? null : s);
    validateCurrentSession().then((rawSession) => {
      const session = forAppOnly(rawSession);
      setSession(session);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, rawSession) => {
      const session = forAppOnly(rawSession);
      setSession(session);
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

  // Pagka-log in (o pagpalit ng account): tenant → Home, landlord → My Listings.
  // Hindi na madadala ang tab na naiwan ng dating naka-log in.
  const landedUserIdRef = useRef(null);
  useEffect(() => {
    const userId = session?.user?.id || null;
    if (userId === landedUserIdRef.current) return;
    landedUserIdRef.current = userId;
    if (!userId || isAdminPath()) return;
    setSelectedProperty(null);
    setActiveTab(session.user.user_metadata?.user_role === 'landlord' ? 'mylistings' : 'home');
  }, [session]);

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
        ? 'The "availability" column does not exist in the database yet. Run the SQL migration in the Supabase SQL Editor first.'
        : 'Error updating availability: ' + error.message);
    }
  };

  const handleLogout = async () => {
    // Local sign-out is instant (no network); revoke the server session in the background so a slow connection doesn't stall logout
    const accessToken = session?.access_token;
    await supabase.auth.signOut({ scope: 'local' });
    if (accessToken) {
      fetch(`${import.meta.env.VITE_SUPABASE_URL}/auth/v1/logout`, {
        method: 'POST',
        headers: {
          apikey: import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          Authorization: `Bearer ${accessToken}`,
        },
        keepalive: true,
      }).catch(() => {});
    }
    localStorage.removeItem('budgetrent_admin_bypass');
    localStorage.removeItem('budgetrent_guest');
    setIsMenuOpen(false);
    if (isAdminPath()) {
      window.location.href = '/';
    }
  };

  useEffect(() => {
    const uid = session?.user?.id;
    if (!uid || isGuest || activeTab !== 'mylistings') return;
    let alive = true;
    fetchMyPlan(uid).then((plan) => { if (alive) setMyPlan(plan); });
    return () => { alive = false; };
  }, [session?.user?.id, isGuest, activeTab]);

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
      const matchesText = matchesPlaceQuery(item, debouncedSearchQuery);
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
  }, [properties, selectedCategory, debouncedSearchQuery, activeTab, session?.user?.id, maxBudget, stayArea, approxCoords, stayGuests, priceQuery]);

  // Mungkahing lalawigan / bayan / barangay habang nagta-type (mula sa mga listing sa napiling category)
  const placeIndex = useMemo(
    () => buildPlaceIndex(properties.filter(item => (selectedCategory === 'Staycation' ? isStaycation(item) : !isStaycation(item)))),
    [properties, selectedCategory]
  );
  const rentSuggestions = useMemo(() => {
    if (!activeField) return [];
    const level = { province: 'lalawigan', town: 'bayan', brgy: 'barangay' }[activeField];
    const text = normalizePlace(rentPlace[activeField]);
    const inContext = (entry, value) => !value.trim() || normalizePlace(entry.context).includes(normalizePlace(value));
    return placeIndex
      .filter((e) => e.level === level
        && (!text || e.norm.includes(text))
        && (activeField === 'province' || inContext(e, rentPlace.province))
        && (activeField !== 'brgy' || inContext(e, rentPlace.town)))
      .sort((a, b) => b.count - a.count)
      .slice(0, 7);
  }, [placeIndex, activeField, rentPlace]);
  const pickRentSuggestion = (entry) => {
    const [ctxA, ctxB] = String(entry.context || '').split(',').map((p) => p.trim());
    if (activeField === 'province') updateRentPlace({ province: entry.label });
    else if (activeField === 'town') updateRentPlace({ town: entry.label, province: rentPlace.province || entry.context || '' });
    else updateRentPlace({ brgy: entry.label, town: rentPlace.town || ctxA || '', province: rentPlace.province || ctxB || '' });
    setActiveField(null);
  };

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
  const [bookings, setBookings] = useState([]);
  const [ownerUnread, setOwnerUnread] = useState({}); // booking_id -> bilang ng hindi pa nababasang chat ng guest
  const [guestUnread, setGuestUnread] = useState({}); // booking_id -> bilang ng hindi pa nababasang chat ng owner
  const reloadOwnerRef = useRef(null);
  const reloadGuestRef = useRef(null);
  const seenInquiryIds = useRef(null);
  useEffect(() => {
    if (!session?.user || isGuest) { setInquiries([]); setBookings([]); setOwnerUnread({}); seenInquiryIds.current = null; reloadOwnerRef.current = null; return; }
    const myId = session.user.id;
    const myEmail = String(session.user.email || '').toLowerCase();
    const load = async () => {
      const { data, error } = await supabase.from('customer_inquiries').select('*').order('created_at', { ascending: false }).limit(30);
      if (error) return;
      const mine = (r) => r.user_id !== myId && (!isAdminEmail(myEmail) || String(r.owner_email || '').toLowerCase() === myEmail);
      const list = (data || []).filter(mine);
      // Staycation booking requests (kung wala pa ang table, tahimik na lalaktawan)
      const { data: bData } = await supabase.from('booking_requests').select('*').order('created_at', { ascending: false }).limit(30);
      const dismissed = await fetchDismissedIds();
      const bList = (bData || []).filter(mine).filter(r => !dismissed.has(r.id));
      // Hindi pa nababasang chat ng mga guest (RLS: sa listings lang niya)
      const { data: mData } = await supabase.from('booking_messages').select('id, booking_id').eq('sender', 'guest').is('read_at', null);
      const unread = {};
      (mData || []).filter(m => !dismissed.has(m.booking_id)).forEach(m => { unread[m.booking_id] = (unread[m.booking_id] || 0) + 1; });
      const ids = [...list, ...bList].map(r => r.id).concat((mData || []).map(m => m.id));
      if (seenInquiryIds.current && ids.some(id => !seenInquiryIds.current.has(id))) playNotifySound();
      seenInquiryIds.current = new Set(ids);
      setInquiries(list);
      setBookings(bList);
      setOwnerUnread(unread);
    };
    reloadOwnerRef.current = load;
    load();
    const t = setInterval(load, 30000);
    // Realtime: bagong chat o booking = agad na lalabas (sumusunod sa RLS)
    const channel = supabase.channel('owner-bookings')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'booking_messages' }, () => load())
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'booking_requests' }, () => load())
      .subscribe();
    return () => { clearInterval(t); supabase.removeChannel(channel); };
  }, [session, isGuest]);

  // Tenant: hindi pa nababasang sagot ng owner (RLS: sarili niyang bookings lang)
  useEffect(() => {
    if (!isGuest || !session?.user?.id) { setGuestUnread({}); reloadGuestRef.current = null; return undefined; }
    let first = true;
    let prevTotal = 0;
    const load = async () => {
      const { data, error } = await supabase.from('booking_messages').select('booking_id').eq('sender', 'owner').is('read_at', null);
      if (error) return;
      const map = {};
      const dismissed = await fetchDismissedIds();
      (data || []).filter(r => !dismissed.has(r.booking_id)).forEach(r => { map[r.booking_id] = (map[r.booking_id] || 0) + 1; });
      const total = Object.values(map).reduce((a, b) => a + b, 0);
      if (!first && total > prevTotal) playNotifySound();
      first = false;
      prevTotal = total;
      setGuestUnread(map);
    };
    reloadGuestRef.current = load;
    load();
    const t = setInterval(load, 15000);
    const channel = supabase.channel('tenant-inbox')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'booking_messages' }, () => load())
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'booking_requests' }, () => load())
      .subscribe();
    return () => { clearInterval(t); supabase.removeChannel(channel); };
  }, [isGuest, session?.user?.id]);

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
      { id: 'welcome', icon: '🎉', tone: 'gold', title: 'Welcome to BudgetRentPH', body: 'Welcome! Start searching for an affordable rental.', time: 'Just now' },
      { id: 'categories', icon: '🏠', tone: 'navy', title: 'Rentals or Staycation', body: 'Pick a category to see the rentals you are looking for.', time: 'Today' },
      { id: 'wishlist', icon: '❤️', tone: 'red', title: 'Save your favorites', body: 'Tap the heart on a listing to add it to your Wishlist.', time: 'Today' },
    ];
    if (!isGuest) {
      items.push({ id: 'verified', icon: '✅', tone: 'green', title: 'Get Verified', body: 'Verify your account so tenants trust your listings more.', time: 'Tip' });
    }
    return items.filter(n => !deletedNotifs.includes(n.id));
  }, [isGuest, announcements, deletedNotifs]);

  // Hiwalay na call requests (Phone icon sa header) para sa landlord
  const callNotifs = useMemo(() => inquiries.map(r => ({
    id: `inq-${r.id}`,
    title: `${r.customer_name} wants a call`,
    phone: r.customer_phone,
    time: timeAgo(r.created_at)
  })).filter(n => !deletedNotifs.includes(n.id)), [inquiries, deletedNotifs]);

  const ownerUnreadTotal = Object.values(ownerUnread).reduce((a, b) => a + b, 0);
  const guestUnreadTotal = Object.values(guestUnread).reduce((a, b) => a + b, 0);
  const pendingBookings = bookings.filter(r => r.status === 'pending').length + ownerUnreadTotal;
  const setBookingStatus = async (bookingId, status) => {
    const { error } = await supabase.from('booking_requests').update({ status }).eq('id', bookingId);
    if (error) { alert(error.message || 'Could not update the booking.'); return; }
    setBookings(list => list.map(b => (b.id === bookingId ? { ...b, status } : b)));
  };
  const removeBooking = async (bookingId) => {
    try {
      await dismissBooking(bookingId);
      setBookings(list => list.filter(b => b.id !== bookingId));
      reloadOwnerRef.current?.();
    } catch {
      alert('Could not delete the booking. Please try again.');
    }
  };
  const callUnread = callNotifs.filter(n => !readNotifs.includes(n.id)).length;
  const [isCallNotifOpen, setIsCallNotifOpen] = useState(false);
  const markCallsRead = () => {
    const next = [...new Set([...readNotifs, ...callNotifs.map(n => n.id)])];
    setReadNotifs(next);
    localStorage.setItem('budgetrent_read_notifs', JSON.stringify(next));
  };

  const unreadCount = notifications.filter(n => !readNotifs.includes(n.id)).length;

  // Bagong videos sa Updates: bilang ng updates na mas bago sa huling pagbukas ng tab (per device)
  const [newUpdates, setNewUpdates] = useState(0);
  useEffect(() => {
    let alive = true;
    const seenKey = 'budgetrent_updates_seen';
    const readSeen = () => { try { return localStorage.getItem(seenKey) || ''; } catch { return ''; } };
    if (activeTab === 'updates') {
      try { localStorage.setItem(seenKey, new Date().toISOString()); } catch { /* ignore */ }
      setNewUpdates(0);
      return undefined;
    }
    const seen = readSeen();
    if (!seen) {
      // Unang beses sa device: huwag i-badge ang lumang updates
      try { localStorage.setItem(seenKey, new Date().toISOString()); } catch { /* ignore */ }
      return undefined;
    }
    supabase.from('app_updates').select('id', { count: 'exact', head: true }).gt('created_at', seen)
      .then(({ count, error }) => { if (alive && !error) setNewUpdates(count || 0); });
    return () => { alive = false; };
  }, [activeTab]);

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



  if (!session && !isAdminPath()) {
    return (
      <Suspense fallback={<div className="text-center py-10"><Loader2 className="animate-spin text-primary mx-auto" size={40} /></div>}>
        <Auth />
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
                        {callNotifs.length === 0 && <p className="notif-empty">No call requests yet.</p>}
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
                      {notifications.length === 0 && <p className="notif-empty">You have no notifications.</p>}
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

            {isGuest && session?.user && (
              <button className="menu-btn" onClick={() => setIsTenantAccountOpen(true)} aria-label="My Account" title="My Account">
                <User size={22} />
              </button>
            )}

            <button className="menu-btn" onClick={() => setIsMenuOpen(true)}>
              <Menu size={22} />
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
                  <p>Affordable. Nearby. Trustworthy.</p>
                </div>
              </div>
              <button className="close-menu" onClick={() => setIsMenuOpen(false)}><X size={24} /></button>
            </div>
            
            <div className="menu-items">
              <button className="menu-link highlight" onClick={() => { setIsMenuOpen(false); setIsTourOpen(true); }}>
                <div className="icon-container-mini secondary-icon"><Lightbulb size={18} /></div> How to use the app
              </button>

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
                    <div className="icon-container-mini"><Navigation size={18} /></div> Nearby Map
                  </button>
                  <button
                    className="menu-link"
                    onClick={() => { if (userLoc.status !== 'granted') { setIsMenuOpen(false); (locNeedsFix ? userLoc.openSettings : userLoc.request)(); } }}
                  >
                    <div className="icon-container-mini"><MapPin size={18} /></div> Location Settings
                    <span className={`menu-loc-status${userLoc.status === 'granted' ? ' on' : ''}`}>
                      {userLoc.status === 'granted' ? 'On' : userLoc.status === 'loading' ? '...' : userLoc.status === 'denied' ? 'Blocked' : 'Off'}
                    </span>
                  </button>
                  <button className={`menu-link${activeTab === 'inbox' ? ' active' : ''}`} onClick={() => { setIsMenuOpen(false); setActiveTab('inbox'); }}>
                    <div className="icon-container-mini secondary-icon"><Inbox size={18} /></div> Inbox{guestUnreadTotal > 0 ? ` (${guestUnreadTotal})` : ''}
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
                  <button className={`menu-link${activeTab === 'bookings' ? ' active' : ''}`} onClick={() => { setIsMenuOpen(false); setActiveTab('bookings'); }}>
                    <div className="icon-container-mini"><CalendarCheck size={18} /></div> Bookings{pendingBookings > 0 ? ` (${pendingBookings})` : ''}
                  </button>
                  <button className={`menu-link${activeTab === 'analytics' ? ' active' : ''}`} onClick={() => { setIsMenuOpen(false); setActiveTab('analytics'); }}>
                    <div className="icon-container-mini"><BarChart3 size={18} /></div> Analytics
                  </button>
                  <button className={`menu-link${activeTab === 'agreement' ? ' active' : ''}`} onClick={() => { setIsMenuOpen(false); setActiveTab('agreement'); }}>
                    <div className="icon-container-mini secondary-icon"><FileSignature size={18} /></div> Create Agreement Draft
                  </button>
                  <button className={`menu-link${activeTab === 'payments' ? ' active' : ''}`} onClick={() => { setIsMenuOpen(false); setActiveTab('payments'); }}>
                    <div className="icon-container-mini"><Wallet size={18} /></div> Payment Methods
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
              <p className="menu-section-label">About & Help</p>
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
            <HeroBudi message="Hello! 👋 I'm Budi. Find a rental or staycation that fits your budget here." />
            <div className="hero-content">
              <h2>Welcome to <span>BudgetRentPH</span></h2>
              <p>Affordable. Nearby. Trustworthy.</p>
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
                            aria-label="Clear search"
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
                    <span className="stay-sep" />
                    <div className="stay-seg stay-seg-budget">
                      <label htmlFor="stay-budget">Budget</label>
                      <div className="stay-input-row">
                        <input
                          id="stay-budget"
                          type="text"
                          inputMode="numeric"
                          autoComplete="off"
                          placeholder="₱ per night"
                          value={budgetMax === '' ? '' : '₱' + Number(budgetMax).toLocaleString('en-US')}
                          onChange={(e) => setBudgetMax(e.target.value.replace(/\D/g, '').replace(/^0+/, '').slice(0, 7))}
                        />
                        {budgetMax !== '' && (
                          <button type="button" className="stay-clear" aria-label="Clear budget" onClick={() => setBudgetMax('')}>
                            <X size={13} />
                          </button>
                        )}
                      </div>
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
                <div className="search-wrap">
                <div className="staycation-search rent-search">
                  <div className="stay-seg rent-seg-province">
                    <label htmlFor="rent-province">Province</label>
                    <div className="stay-input-row">
                      <input
                        id="rent-province"
                        type="text"
                        placeholder="e.g. Pangasinan"
                        value={rentPlace.province}
                        onChange={(e) => updateRentPlace({ province: e.target.value })}
                        onFocus={() => setActiveField('province')}
                        onBlur={() => setTimeout(() => setActiveField((f) => (f === 'province' ? null : f)), 150)}
                        onKeyDown={(e) => { if (e.key === 'Enter') e.target.blur(); }}
                        autoComplete="off"
                      />
                      {rentPlace.province !== '' && (
                        <button type="button" className="stay-clear" aria-label="Clear Province" onMouseDown={(e) => e.preventDefault()} onClick={() => updateRentPlace({ province: '' })}>
                          <X size={13} />
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="stay-seg rent-seg-town">
                    <label htmlFor="rent-town">Town / City</label>
                    <div className="stay-input-row">
                      <input
                        id="rent-town"
                        type="text"
                        placeholder="e.g. Dagupan City"
                        value={rentPlace.town}
                        onChange={(e) => updateRentPlace({ town: e.target.value })}
                        onFocus={() => setActiveField('town')}
                        onBlur={() => setTimeout(() => setActiveField((f) => (f === 'town' ? null : f)), 150)}
                        onKeyDown={(e) => { if (e.key === 'Enter') e.target.blur(); }}
                        autoComplete="off"
                      />
                      {rentPlace.town !== '' && (
                        <button type="button" className="stay-clear" aria-label="Clear Town / City" onMouseDown={(e) => e.preventDefault()} onClick={() => updateRentPlace({ town: '' })}>
                          <X size={13} />
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="stay-seg rent-seg-brgy">
                    <label htmlFor="rent-brgy">Barangay</label>
                    <div className="stay-input-row">
                      <input
                        id="rent-brgy"
                        type="text"
                        placeholder="e.g. Bonuan"
                        value={rentPlace.brgy}
                        onChange={(e) => updateRentPlace({ brgy: e.target.value })}
                        onFocus={() => setActiveField('brgy')}
                        onBlur={() => setTimeout(() => setActiveField((f) => (f === 'brgy' ? null : f)), 150)}
                        onKeyDown={(e) => { if (e.key === 'Enter') e.target.blur(); }}
                        autoComplete="off"
                      />
                      {rentPlace.brgy !== '' && (
                        <button type="button" className="stay-clear" aria-label="Clear Barangay" onMouseDown={(e) => e.preventDefault()} onClick={() => updateRentPlace({ brgy: '' })}>
                          <X size={13} />
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="stay-seg rent-seg-budget">
                    <label htmlFor="rent-budget">Budget</label>
                    <div className="stay-input-row">
                      <input
                        id="rent-budget"
                        type="text"
                        inputMode="numeric"
                        autoComplete="off"
                        placeholder="₱ per month"
                        value={budgetMax === '' ? '' : '₱' + Number(budgetMax).toLocaleString('en-US')}
                        onChange={(e) => setBudgetMax(e.target.value.replace(/\D/g, '').replace(/^0+/, '').slice(0, 7))}
                      />
                      {budgetMax !== '' && (
                        <button type="button" className="stay-clear" aria-label="Clear budget" onClick={() => setBudgetMax('')}>
                          <X size={13} />
                        </button>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="stay-search-btn"
                    aria-label="Search places"
                    onClick={() => document.getElementById('rent-province')?.focus()}
                  >
                    <Search size={18} />
                  </button>
                </div>
                {rentSuggestions.length > 0 && (
                  <ul className="search-suggest" role="listbox">
                    {rentSuggestions.map((sg) => (
                      <li key={`${sg.level}-${sg.label}-${sg.context}`}>
                        <button
                          type="button"
                          role="option"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => pickRentSuggestion(sg)}
                        >
                          <MapPin size={15} />
                          <span className="ss-text">
                            <strong>{sg.label}</strong>
                            {sg.context && <em>{sg.context}</em>}
                          </span>
                          <span className={`ss-level ${sg.level}`}>{PLACE_LEVELS[sg.level]}</span>
                          <span className="ss-count">{sg.count}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                </div>
                )}

                <div className="budget-search">
                  {maxBudget > 0 && (
                    <p className="budget-hint">
                      Up to ₱{maxBudget.toLocaleString()}{selectedCategory === 'Staycation' ? ' per night' : ' per month'} • {filteredListings.length} results
                      {selectedCategory !== 'Staycation' && ' • monthly rent only, advance and deposit not included'}
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
                  onClick={() => { if (cat !== selectedCategory) { setBudgetMax(''); resetRentPlace(); } setSelectedCategory(cat); }}
                >
                  <span className="chip-emoji">{React.createElement(CATEGORY_ICON[cat] || House, { size: 20, strokeWidth: 2.2 })}</span>
                  {CATEGORY_LABEL[cat] || cat}
                </button>
              ))}
            </div>
          </div>

          <main className="listings">
            <div className="section-header">
              <h3>Local Listings</h3>
              <span>{filteredListings.length} results</span>
            </div>
            
            {loading && properties.length === 0 ? (
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
              {isGuest && userLoc.status !== 'granted' && !(locNeedsFix && locBannerHidden) && (
                <div className="distance-prompt-wrap">
                  <button
                    type="button"
                    className="distance-prompt"
                    onClick={locNeedsFix ? userLoc.openSettings : userLoc.request}
                    disabled={userLoc.status === 'loading'}
                  >
                    <Navigation size={15} />
                    {userLoc.status === 'loading' ? 'Finding your location...'
                      : userLoc.status === 'denied' ? 'Location is blocked — tap to open settings and allow it to see distances'
                      : userLoc.status === 'off' ? 'Your phone’s Location is off — tap to turn it on and see distances'
                      : userLoc.status === 'unavailable' ? 'Could not get your location — tap to try again'
                      : 'Turn on location to see how far each place is'}
                  </button>
                  {locNeedsFix && (
                    <button type="button" className="distance-prompt-dismiss" onClick={hideLocBanner}>Not now</button>
                  )}
                </div>
              )}
              {filteredListings.length === 0 && (
                <div className="budget-empty">
                  {maxBudget > 0 && cheapestInCategory && cheapestInCategory > maxBudget ? (
                    <>
                      <strong>No listings up to ₱{maxBudget.toLocaleString()}</strong>
                      <span>The cheapest right now is ₱{cheapestInCategory.toLocaleString()}{selectedCategory === 'Staycation' ? ' per night' : ' per month'}.</span>
                      <button type="button" onClick={() => setBudgetMax(String(cheapestInCategory))}>Show up to ₱{cheapestInCategory.toLocaleString()}</button>
                    </>
                  ) : (
                    <>
                      <strong>No listings found</strong>
                      <span>Try a different place, date, or budget.</span>
                      {maxBudget > 0 && <button type="button" onClick={() => { setBudgetMax(''); if (priceQuery) setSearchQuery(''); }}>Clear budget</button>}
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
            <HeroBudi message="Your saved listings show up here. Tap the ❤ on any listing to save it." />
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
            <HeroBudi message="All your listings show up here. Tap Edit to change the details or status." />
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
            {(() => {
              const mine = properties.filter(p => p.user_id === session?.user?.id).length;
              const limit = listingLimitFor(myPlan);
              const pro = isProActive(myPlan);
              return (
                <div className="listing-quota">
                  <div>
                    <strong>{mine} / {limit} listings</strong>
                    <small>
                      {pro
                        ? `${PRO_PLAN.label} active until ${new Date(myPlan.expires_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}`
                        : `First ${FREE_LISTING_LIMIT} listings are free`}
                    </small>
                  </div>
                  {!pro && mine >= FREE_LISTING_LIMIT - 1 && (
                    <button type="button" onClick={() => setActiveTab('upgrade')}>Get {PRO_PLAN.label} · ₱{PRO_PLAN.price}</button>
                  )}
                  {pro && mine >= PRO_LISTING_LIMIT && <small>Maximum reached</small>}
                </div>
              );
            })()}
            {loading && properties.length === 0 ? (
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
                      <img src={ikImage(item.image, 480) || '/placeholder.png'} alt={item.name || item.title} loading="lazy" />
                      <span className={`avail-badge ${isOccupied(item) ? 'occupied' : 'available'}`}>
                        {availabilityLabel(item)}
                      </span>
                    </div>
                    <div className="mine-info">
                      <span className={`mine-cat ${isStaycation(item) ? 'stay' : 'rent'}`}>
                        {isStaycation(item) ? <TreePalm size={11} /> : <House size={11} />}
                        {isStaycation(item) ? 'Staycation' : 'Rental'}
                      </span>
                      <h4 className="mine-name">{item.name || item.title}</h4>
                      <div className="mine-price">
                        ₱{item.price?.toLocaleString() || 0}<span>{isStaycation(item) ? '/night' : '/month'}</span>
                      </div>
                      <div className="mine-loc"><MapPin size={12} /> <span>{item.location}</span></div>
                      <button
                        type="button"
                        className={`mine-toggle ${isOccupied(item) ? 'occupied' : 'available'}`}
                        onClick={(e) => { e.stopPropagation(); handleToggleAvailability(item); }}
                        aria-pressed={isOccupied(item)}
                        title={isStaycation(item) && isOccupied(item) ? 'Occupied — guests can still reserve a slot' : 'Toggle: Available / Occupied'}
                      >
                        <span className="mine-toggle-track"><span className="mine-toggle-knob" /></span>
                        <span className="mine-toggle-text">
                          {isOccupied(item) ? 'Occupied' : 'Available'}
                          {isStaycation(item) && isOccupied(item) && <em> • can still reserve</em>}
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

      {activeTab === 'payments' && !isGuest && (
        <Suspense fallback={<div className="text-center py-10"><Loader2 className="animate-spin text-primary mx-auto" size={40} /></div>}>
          <PaymentMethods session={session} />
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
              <p><strong>BudgetRentPH</strong> is a Philippine rental marketplace that connects tenants with landlords of boarding houses, bedspaces, studios, apartments, and staycations.</p>
              <p>Our mission is to make the search for an affordable place simple and honest. Tenants can browse listings, check what is available near them on the map, get directions, and call the owner directly. Landlords can post their listings, build trust through verification, and reach more people.</p>
              <p>We are a listing platform. We are not a landlord, agent, or party to any rental or booking, and we do not hold deposits or rent payments.</p>
            </div>
            <div className="info-grid">
              <div className="info-card">
                <Shield size={32} />
                <h4>Verified Owners</h4>
                <p>Landlords can request verification. Look for the verified badge, and still check the place before you pay.</p>
              </div>
              <div className="info-card">
                <Navigation size={32} />
                <h4>Find Nearby</h4>
                <p>See available rentals and staycations around you, with live directions to the property.</p>
              </div>
              <div className="info-card">
                <Star size={32} />
                <h4>Real Reviews</h4>
                <p>Read ratings and comments from other tenants to help you decide.</p>
              </div>
              <div className="info-card">
                <Phone size={32} />
                <h4>Direct Contact</h4>
                <p>Talk to the owner directly. No middleman and no hidden booking fees from us.</p>
              </div>
            </div>
            <div className="info-section">
              <p>Questions, feedback, or a problem with a listing? Open <strong>Customer Support</strong> from the menu and we will get back to you.</p>
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
                <h3>Acceptance</h3>
                <p>By creating an account or using <strong>BudgetRentPH</strong>, you agree to these Terms and Policies. If you do not agree, please do not use the app.</p>
              </div>
            </section>
            <section className="terms-card">
              <div className="terms-icon-box"><Users size={20} /></div>
              <div className="terms-content">
                <h3>We Are a Listing Platform</h3>
                <p>BudgetRentPH only connects tenants and landlords. We are not a party to any lease, booking, or payment. Inquiries, viewings, contracts, deposits, and rent or staycation payments are arranged directly between tenant and landlord, at their own risk. We do not guarantee any listing, price, or availability.</p>
              </div>
            </section>
            <section className="terms-card">
              <div className="terms-icon-box"><Shield size={20} /></div>
              <div className="terms-content">
                <h3>Landlord Responsibilities</h3>
                <p>Landlords must post accurate information, real photos, current prices, and availability, and must have the right to rent out the property. Misleading, duplicate, or fraudulent listings will be removed and the account may be suspended. For staycations, down payment and house rules must be stated clearly in the listing.</p>
              </div>
            </section>
            <section className="terms-card">
              <div className="terms-icon-box"><BadgeCheck size={20} /></div>
              <div className="terms-content">
                <h3>Verification and Subscription</h3>
                <p>The verified badge means we reviewed the landlord's request. It is not a guarantee of the property or the person. Landlords may be required to pay a subscription to keep listings active. Payment proofs are stored privately and only used to confirm your subscription. Subscription fees are non-refundable once activated, unless required by law.</p>
              </div>
            </section>
            <section className="terms-card">
              <div className="terms-icon-box"><Star size={20} /></div>
              <div className="terms-content">
                <h3>Reviews and Conduct</h3>
                <p>Reviews must be honest and based on real experience. No harassment, hate speech, spam, fake reviews, or scams. We may remove content or suspend accounts that break these rules.</p>
              </div>
            </section>
            <section className="terms-card">
              <div className="terms-icon-box"><Phone size={20} /></div>
              <div className="terms-content">
                <h3>Calls and Inquiries</h3>
                <p>Before calling an owner, you give your name and phone number. The owner can see this so they know who is calling. Use it only for genuine rental inquiries. Owners must not misuse tenant contact details.</p>
              </div>
            </section>
            <section className="terms-card">
              <div className="terms-icon-box"><User size={20} /></div>
              <div className="terms-content">
                <h3>Tenant Accounts</h3>
                <p>Tenants sign up with their name, mobile number, birthday, and work status. No email is needed. One mobile number can have only one account. You must use your own number and give true information, and you are responsible for keeping your password safe. We do not verify mobile numbers by SMS, and a forgotten password cannot be recovered automatically, so contact Customer Support if you need help. Accounts with false information or that are shared or abused may be suspended.</p>
              </div>
            </section>
            <section className="terms-card">
              <div className="terms-icon-box"><MessageCircle size={20} /></div>
              <div className="terms-content">
                <h3>Inbox and Messages</h3>
                <p>Your booking requests and the replies of landlords are kept in your Inbox. Tenants can send up to 3 messages per booking, so please make each one clear. Keep the chat about the booking only. Do not send passwords, bank details, or personal IDs, and do not harass or spam. Landlords can see the name and mobile number you used for the booking. We may review or remove messages that break these rules.</p>
              </div>
            </section>
            <section className="terms-card">
              <div className="terms-icon-box"><Navigation size={20} /></div>
              <div className="terms-content">
                <h3>Location</h3>
                <p>With your permission, your device location is used to show nearby listings and directions while you use the app. We do not track you in the background. You can turn off location anytime in your phone settings. Route times are estimates only.</p>
              </div>
            </section>
            <section className="terms-card">
              <div className="terms-icon-box"><Shield size={20} /></div>
              <div className="terms-content">
                <h3>Privacy</h3>
                <p>We collect only what the app needs. Tenants: name, mobile number, birthday, and work status (no email required; one mobile number can have only one account). Landlords: email, name, phone, listing details, and verification and payment proofs. This is used to run the service, prevent fraud, and contact you. We never sell your personal information. Data is stored securely, and you may ask us through Customer Support to correct or delete your account data, in line with the Data Privacy Act of 2012 (RA 10173).</p>
              </div>
            </section>
            <section className="terms-card">
              <div className="terms-icon-box"><FileText size={20} /></div>
              <div className="terms-content">
                <h3>Agreement Drafts</h3>
                <p>The Agreement Draft tool creates a simple template only. It is not legal advice and is not binding until both parties sign. Consider having a lawyer review any contract.</p>
              </div>
            </section>
            <section className="terms-card">
              <div className="terms-icon-box"><Info size={20} /></div>
              <div className="terms-content">
                <h3>Liability and Changes</h3>
                <p>To the extent allowed by law, BudgetRentPH is not liable for disputes, losses, or damages arising from dealings between users. Always visit the property and avoid paying before you are sure. We may update these Terms from time to time; continuing to use the app means you accept the changes.</p>
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

      {activeTab === 'upgrade' && (
        <Suspense fallback={<div className="text-center py-10"><Loader2 className="animate-spin text-primary mx-auto" size={40} /></div>}>
          <VerificationPage session={session} mode="listings" onDone={() => setActiveTab('mylistings')} />
        </Suspense>
      )}

      {activeTab === 'verified' && (
        <Suspense fallback={<div className="text-center py-10"><Loader2 className="animate-spin text-primary mx-auto" size={40} /></div>}>
          <VerificationPage session={session} mode={isGuest ? 'tenant' : 'verify'} onDone={() => setActiveTab(isGuest ? 'home' : 'mylistings')} />
        </Suspense>
      )}

      {activeTab === 'inbox' && isGuest && (
        <Suspense fallback={<div className="text-center py-10"><Loader2 className="animate-spin text-primary mx-auto" size={40} /></div>}>
          <InboxPage properties={properties} unread={guestUnread} onChatChanged={() => reloadGuestRef.current?.()} />
        </Suspense>
      )}

      {activeTab === 'analytics' && !isGuest && (
        <Suspense fallback={<div className="text-center py-10"><Loader2 className="animate-spin text-primary mx-auto" size={40} /></div>}>
          <BookingAnalytics session={session} properties={properties} />
        </Suspense>
      )}

      {activeTab === 'bookings' && (
        <Suspense fallback={<div className="text-center py-10"><Loader2 className="animate-spin text-primary mx-auto" size={40} /></div>}>
          <BookingsPage bookings={bookings} properties={properties} onSetStatus={setBookingStatus} onDismiss={removeBooking} unread={ownerUnread} onChatChanged={() => reloadOwnerRef.current?.()} />
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
              <img src={ikImage(selectedProperty.image, 1080)} alt={selectedProperty.name || selectedProperty.title} />
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
                <p className="stay-reserve-note"><Info size={14} /> Occupied right now, but you can still reserve a slot for other dates.</p>
              )}
              {(() => {
                const { price, advance, deposit, advanceMonths, depositMonths } = getMoveInBreakdown(selectedProperty);
                const peso = (n) => `₱${n.toLocaleString()}`;
                const mo = (n) => `${n} ${n === 1 ? 'month' : 'months'}`;
                if (isStaycation(selectedProperty)) {
                  const down = Number(selectedProperty.down_payment) || 0;
                  return (
                    <div className="modal-movein-box">
                      <div className="modal-movein-title">Fees</div>
                      <div className="modal-movein-grid">
                        <div className="modal-movein-cell rent">
                          <span>Per Night</span>
                          <strong>{peso(price)}</strong>
                        </div>
                        <div className="modal-movein-cell">
                          <span>Down Payment</span>
                          <strong>{down > 0 ? peso(down) : 'None'}</strong>
                        </div>
                      </div>
                    </div>
                  );
                }
                return (
                  <div className="modal-movein-box">
                    <div className="modal-movein-title">Fees</div>
                    <div className="modal-movein-grid">
                      <div className="modal-movein-cell rent">
                        <span>Monthly Rent</span>
                        <strong>{peso(price)}</strong>
                      </div>
                      <div className="modal-movein-cell">
                        <span>Advance</span>
                        <strong>{advanceMonths > 0 ? peso(advance) : 'None'}</strong>
                        <em>{mo(advanceMonths)}</em>
                      </div>
                      <div className="modal-movein-cell">
                        <span>Deposit</span>
                        <strong>{depositMonths > 0 ? peso(deposit) : 'None'}</strong>
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
                    <img src={ikImage(selectedProperty.owner_avatar, 96)} alt="Owner" className="property-owner-avatar" />
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
                {selectedProperty.user_id !== session?.user?.id && (
                  <button type="button" className="contact-btn email" onClick={() => setBookSheet({ item: selectedProperty, kind: isStaycation(selectedProperty) ? 'book' : 'inquire' })}>
                    <CalendarCheck size={20} /> Book Here
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {isTenantAccountOpen && isGuest && session?.user && (
        <Suspense fallback={null}>
          <TenantAccountModal
            user={session.user}
            onClose={() => setIsTenantAccountOpen(false)}
            onLogout={() => { setIsTenantAccountOpen(false); handleLogout(); }}
            verifiedUntil={tenantVerifiedUntil}
            onGetVerified={() => { setIsTenantAccountOpen(false); setActiveTab('verified'); }}
          />
        </Suspense>
      )}

      {showWelcome && isGuest && (
        <Suspense fallback={null}>
          <WelcomeModal
            name={session?.user?.user_metadata?.full_name}
            phone={session?.user?.user_metadata?.phone ? `0${String(session.user.user_metadata.phone).slice(2)}` : ''}
            onClose={() => setShowWelcome(false)}
          />
        </Suspense>
      )}

      {bookSheet && (
        <Suspense fallback={null}>
          <ListingActionSheet item={bookSheet.item} kind={bookSheet.kind} onClose={() => setBookSheet(null)} />
        </Suspense>
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
                <span className="nav-icon-box" style={{ position: 'relative' }}><Megaphone size={22} />{newUpdates > 0 && <span className="notif-badge">{newUpdates}</span>}</span>
                <span className="nav-label">Updates</span>
              </button>
              <button className="nav-item circle-plus" onClick={() => setIsPropertyFormOpen(true)} aria-label="List your property" title="List your property"><Plus size={34} strokeWidth={3.2} /></button>
              <button
                className={`nav-item ico-account ${isProfileModalOpen ? 'active' : ''}`}
                onClick={() => { setIsProfileEditing(false); setIsProfileModalOpen(true); }}
              >
                <span className="nav-icon-box" style={{ position: 'relative' }}>
                  <User size={22} />
                  <BadgeCheck
                    size={15}
                    fill={myVerified ? '#0066ff' : '#7c3aed'}
                    color="white"
                    aria-label={myVerified ? 'Verified account' : 'Not verified yet'}
                    style={{ position: 'absolute', top: -6, right: -12 }}
                  />
                </span>
                <span className="nav-label">Account</span>
              </button>
              <button
                className={`nav-item ico-support ${activeTab === 'bookings' ? 'active' : ''}`}
                onClick={() => setActiveTab('bookings')}
                aria-current={activeTab === 'bookings' ? 'page' : undefined}
              >
                <span className="nav-icon-box" style={{ position: 'relative' }}>
                  <CalendarCheck size={22} />
                  {pendingBookings > 0 && <span className="notif-badge">{pendingBookings}</span>}
                </span>
                <span className="nav-label">Bookings</span>
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
                className={`nav-item ico-updates ${activeTab === 'updates' ? 'active' : ''}`}
                onClick={() => setActiveTab('updates')}
                aria-current={activeTab === 'updates' ? 'page' : undefined}
              >
                <span className="nav-icon-box" style={{ position: 'relative' }}><Megaphone size={22} />{newUpdates > 0 && <span className="notif-badge">{newUpdates}</span>}</span>
                <span className="nav-label">Updates</span>
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
                className={`nav-item ico-wish ${activeTab === 'wishlist' ? 'active' : ''}`}
                onClick={() => setActiveTab('wishlist')}
                aria-current={activeTab === 'wishlist' ? 'page' : undefined}
              >
                <span className="nav-icon-box"><Heart size={22} /></span>
                <span className="nav-label">Wishlist</span>
              </button>
              <button
                className={`nav-item ico-support ${activeTab === 'inbox' ? 'active' : ''}`}
                onClick={() => setActiveTab('inbox')}
                aria-current={activeTab === 'inbox' ? 'page' : undefined}
              >
                <span className="nav-icon-box" style={{ position: 'relative' }}>
                  <Inbox size={22} />
                  {guestUnreadTotal > 0 && <span className="notif-badge">{guestUnreadTotal}</span>}
                </span>
                <span className="nav-label">Inbox</span>
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
            onUpgrade={() => { setIsPropertyFormOpen(false); setActiveTab('upgrade'); }}
          />
        </Suspense>
      )}

      {/* Edit Profile Modal */}
      {isProfileModalOpen && (
        <Suspense fallback={<div className="modal-overlay centered"><Loader2 className="animate-spin" color="white" size={40} /></div>}>
          <ProfileModal session={session} onClose={() => setIsProfileModalOpen(false)} isEditingInitial={isProfileEditing} onProfileUpdated={fetchProperties} onGetVerified={() => { setIsProfileModalOpen(false); setActiveTab('verified'); }} />
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
                  <img src={ikImage(viewingLandlord.owner_avatar, 160)} alt="Avatar" className="avatar-img" />
                ) : (
                  <div className="avatar-placeholder">
                    {viewingLandlord.owner_name ? viewingLandlord.owner_name.charAt(0).toUpperCase() : <User />}
                  </div>
                )}
              </div>
               <span className={`role-badge ${viewingLandlord.is_verified ? 'verified' : 'landlord'}`}>
                 {viewingLandlord.is_verified ? (<><BadgeCheck size={12} fill="white" color="var(--primary)" /> VERIFIED OWNER</>) : 'LANDLORD'}
               </span>
               <h2 style={{ marginBottom: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', color: '#fff' }}>
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
