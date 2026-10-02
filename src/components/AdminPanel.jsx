import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { 
  Users, ClipboardList, Shield, LogOut, Search, 
  Check, X, Building2, Trash2, Star,
  Settings, BarChart3, Clock, Award, AlertCircle, RefreshCw, ImagePlus,
  Download, Home, MapPin, Megaphone, Pencil, Send, Video, User
} from 'lucide-react';
import { updateThumbnail } from '../lib/updates';
import { fetchPlans } from '../lib/plans';
import { downloadCsv, fmtDate } from '../lib/csv';
import './AdminPanel.css';
import { ikImage } from '../lib/imagekit';

const HIDDEN_PROPERTIES_KEY = 'budgetrent_hidden_properties';
const PAYMENT_METHODS_KEY = 'budgetrent_payment_methods';

const DEFAULT_PAYMENT_METHODS = [
  { id: 1, method: 'GCash', accountName: 'EDGAR M.', accountNumber: '09171234567', qrUrl: '' },
  { id: 2, method: 'Maya', accountName: 'EDGAR M.', accountNumber: '09171234567', qrUrl: '' },
  { id: 3, method: 'ShopeePay', accountName: 'EDGAR M.', accountNumber: '09171234567', qrUrl: '' }
];

const getHiddenPropertyIds = () => {
  try {
    return JSON.parse(localStorage.getItem(HIDDEN_PROPERTIES_KEY) || '[]');
  } catch {
    return [];
  }
};

const setHiddenPropertyIds = (ids) => {
  localStorage.setItem(HIDDEN_PROPERTIES_KEY, JSON.stringify(ids));
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

const getStoredPaymentMethods = () => {
  try {
    const parsed = JSON.parse(localStorage.getItem(PAYMENT_METHODS_KEY) || 'null');
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : DEFAULT_PAYMENT_METHODS;
  } catch {
    return DEFAULT_PAYMENT_METHODS;
  }
};

const getAdminAvatarFallback = ({ ownerName, businessName }) => {
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(ownerName || businessName || 'Landlord')}&background=random`;
};

// 639171234567 -> 09171234567
const tenantPhone = (phone) => (/^639\d{9}$/.test(phone || '') ? `0${phone.slice(2)}` : (phone || ''));
const tenantAge = (iso) => {
  const b = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(b.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - b.getFullYear();
  if (now.getMonth() < b.getMonth() || (now.getMonth() === b.getMonth() && now.getDate() < b.getDate())) age -= 1;
  return age;
};

const AdminPanel = ({ onLogout }) => {
  const [activeTab, setActiveTab] = useState('analytics'); 
  const [paymentMethods, setPaymentMethods] = useState(getStoredPaymentMethods);
  const [plans, setPlans] = useState([]);
  const [renewSuccess, setRenewSuccess] = useState(null);
  const [planOwner, setPlanOwner] = useState(null);
  useEffect(() => {
    if (!renewSuccess) return undefined;
    const t = setTimeout(() => setRenewSuccess(null), 2500);
    return () => clearTimeout(t);
  }, [renewSuccess]);
  useEffect(() => { fetchPlans().then(setPlans); }, []);
  
  const [landlords, setLandlords] = useState([]);
  const [tenants, setTenants] = useState([]);
  const [tenantsError, setTenantsError] = useState('');
  const [verificationRequests, setVerificationRequests] = useState([]);
  const [allProperties, setAllProperties] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [annForm, setAnnForm] = useState({ id: null, title: '', body: '' });
  const [annSaving, setAnnSaving] = useState(false);
  const EMPTY_UPD = { id: null, title: '', description: '', thumbnail_url: '', video_url: '' };
  const [updates, setUpdates] = useState([]);
  const [updForm, setUpdForm] = useState(EMPTY_UPD);
  const [updSaving, setUpdSaving] = useState(false);
  const [hiddenPropertyIds, setHiddenPropertyIdsState] = useState(getHiddenPropertyIds());
  const [, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [proofInput, setProofInput] = useState('');
  const [proofUrl, setProofUrl] = useState('');
  const [proofError, setProofError] = useState('');
  const [listingFilter, setListingFilter] = useState('paupahan'); // paupahan | staycation
  
  // Modals state
  const [isManageModalOpen, setIsManageModalOpen] = useState(false);
  const [selectedLandlordListings, setSelectedLandlordListings] = useState([]);

  const filteredLandlords = useMemo(() => {
    if (!searchQuery) return landlords;
    const lowerQuery = searchQuery.toLowerCase();
    return landlords.filter(l => (l.owner_name || l.email)?.toLowerCase().includes(lowerQuery));
  }, [landlords, searchQuery]);

  // Verified / may plan na (kasama ang Expired) = Managed Plans; ang iba = Verification Request
  const isInPlans = (l) => l.is_verified || l.subscription_status === 'Expired' || !!l.subscription_date;
  const requestLandlords = useMemo(() => filteredLandlords.filter(l => !isInPlans(l)), [filteredLandlords]);
  const planLandlords = useMemo(() => filteredLandlords.filter(isInPlans), [filteredLandlords]);
  const hasPendingRequest = (l) => verificationRequests.some(r =>
    r.status === 'pending' && (r.email === l.email || (l.user_id && r.user_id === l.user_id))
  );

  const visibleProperties = useMemo(() => {
    const hiddenSet = new Set(hiddenPropertyIds);
    return allProperties.filter(p => !hiddenSet.has(p.id));
  }, [allProperties, hiddenPropertyIds]);

  // Tenant accounts (walang email): hanapin ayon sa pangalan, number, o work status
  const filteredTenants = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return tenants;
    return tenants.filter(t => [t.full_name, t.work_status, tenantPhone(t.phone), t.phone].some(v => String(v || '').toLowerCase().includes(q)));
  }, [tenants, searchQuery]);

  const filteredProperties = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return allProperties;
    return allProperties.filter(p =>
      [p.name, p.title, p.location, p.owner_name, p.email, p.type].some(v => v?.toLowerCase().includes(q))
    );
  }, [allProperties, searchQuery]);

  const isStaycation = (p) => String(p.type || '').trim().toLowerCase() === 'staycation';
  const listingCounts = useMemo(() => ({
    all: filteredProperties.length,
    paupahan: filteredProperties.filter(p => !isStaycation(p)).length,
    staycation: filteredProperties.filter(isStaycation).length
  }), [filteredProperties]);
  const shownProperties = useMemo(() => {
    if (listingFilter === 'staycation') return filteredProperties.filter(isStaycation);
    if (listingFilter === 'paupahan') return filteredProperties.filter(p => !isStaycation(p));
    return filteredProperties;
  }, [filteredProperties, listingFilter]);

  // Listings na naka-group ayon sa category (type)
  const listingsByCategory = useMemo(() => {
    const groups = new Map();
    shownProperties.forEach(p => {
      const key = String(p.type || '').trim() || 'Others';
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(p);
    });
    return [...groups.entries()].sort((a, b) => b[1].length - a[1].length);
  }, [shownProperties]);

  const stats = useMemo(() => {
    const now = new Date();
    const in30 = new Date(now.getTime() + 30 * 86400000);
    const ago30 = new Date(now.getTime() - 30 * 86400000);
    const hiddenSet = new Set(hiddenPropertyIds);
    const isOccupied = p => String(p.availability || '').toLowerCase() === 'occupied';
    const tally = (items, keyFn) => {
      const counts = {};
      items.forEach(i => { const k = keyFn(i); if (k) counts[k] = (counts[k] || 0) + 1; });
      return Object.entries(counts).sort((a, b) => b[1] - a[1]);
    };
    const cityOf = p => {
      const parts = (p.location || '').split(',').map(s => s.trim()).filter(Boolean);
      return parts.length >= 2 ? parts[parts.length - 2] : parts[0];
    };

    const live = allProperties.filter(p => !hiddenSet.has(p.id));
    const prices = live.map(p => Number(p.price)).filter(n => n > 0);
    const expiringSoon = landlords
      .filter(l => l.is_verified && l.subscription_expiry && new Date(l.subscription_expiry) <= in30)
      .sort((a, b) => new Date(a.subscription_expiry) - new Date(b.subscription_expiry));
    const ratings = reviews.map(r => Number(r.rating)).filter(n => n >= 1 && n <= 5);
    const ratingDist = [5, 4, 3, 2, 1].map(star => [star, ratings.filter(r => r === star).length]);

    return {
      landlords: landlords.length,
      verified: landlords.filter(l => l.is_verified).length,
      expired: landlords.filter(l => l.subscription_status === 'Expired').length,
      expiringSoon,
      noContact: landlords.filter(l => !l.contact && !l.owner_whatsapp && !l.owner_facebook).length,
      listings: live.length,
      hidden: allProperties.length - live.length,
      available: live.filter(p => !isOccupied(p)).length,
      occupied: live.filter(isOccupied).length,
      newListings30: live.filter(p => p.created_at && new Date(p.created_at) >= ago30).length,
      noPin: live.filter(p => p.latitude == null || p.longitude == null).length,
      avgPrice: prices.length ? Math.round(prices.reduce((a, b) => a + b, 0) / prices.length) : 0,
      minPrice: prices.length ? Math.min(...prices) : 0,
      maxPrice: prices.length ? Math.max(...prices) : 0,
      byType: tally(live, p => p.type || 'Unspecified'),
      topAreas: tally(live, cityOf).slice(0, 6),
      reviewCount: ratings.length,
      avgRating: ratings.length ? (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1) : '—',
      ratingDist,
      pendingCount: verificationRequests.filter(r => r.status === 'pending').length,
      approvedCount: verificationRequests.filter(r => r.status === 'approved').length,
      totalLogins: landlords.reduce((sum, l) => sum + (Number(l.login_count) || 0), 0)
    };
  }, [landlords, allProperties, reviews, verificationRequests, hiddenPropertyIds]);

  const exportLandlords = () => downloadCsv('budgetrent-landlords', [
    { label: 'Name', value: l => l.owner_name },
    { label: 'Business', value: l => l.owner_business_name },
    { label: 'Email', value: l => l.email },
    { label: 'Contact', value: l => l.contact },
    { label: 'WhatsApp', value: l => l.owner_whatsapp },
    { label: 'Facebook', value: l => l.owner_facebook },
    { label: 'Verified', value: l => (l.is_verified ? 'Yes' : 'No') },
    { label: 'Plan Status', value: l => l.subscription_status },
    { label: 'Plan Availed', value: l => fmtDate(l.subscription_date) },
    { label: 'Plan Expiry', value: l => fmtDate(l.subscription_expiry) },
    { label: 'Listings', value: l => allProperties.filter(p => p.email === l.email).length },
    { label: 'Login Count', value: l => l.login_count },
    { label: 'Last Login', value: l => fmtDate(l.last_login) }
  ], requestLandlords);

  const exportSubscriptions = () => downloadCsv('budgetrent-subscriptions', [
    { label: 'Name', value: l => l.owner_name },
    { label: 'Email', value: l => l.email },
    { label: 'Plan Status', value: l => l.subscription_status },
    { label: 'Availed', value: l => fmtDate(l.subscription_date) },
    { label: 'Expiry', value: l => fmtDate(l.subscription_expiry) },
    { label: 'Verified', value: l => (l.is_verified ? 'Yes' : 'No') }
  ], planLandlords);

  const exportTenants = () => downloadCsv('budgetrent-tenants', [
    { label: 'Name', value: t => t.full_name },
    { label: 'Mobile', value: t => tenantPhone(t.phone) },
    { label: 'Birthday', value: t => t.birthday },
    { label: 'Age', value: t => tenantAge(t.birthday) },
    { label: 'Work Status', value: t => t.work_status },
    { label: 'Bookings', value: t => t.bookings },
    { label: 'Joined', value: t => fmtDate(t.created_at) },
    { label: 'Last Login', value: t => fmtDate(t.last_sign_in_at) }
  ], filteredTenants);

  const exportListings = () => downloadCsv('budgetrent-listings', [
    { label: 'Name', value: p => p.name || p.title },
    { label: 'Type', value: p => p.type },
    { label: 'Price (PHP/mo)', value: p => p.price },
    { label: 'Availability', value: p => p.availability || 'Available' },
    { label: 'Location', value: p => p.location },
    { label: 'Latitude', value: p => p.latitude },
    { label: 'Longitude', value: p => p.longitude },
    { label: 'Rooms', value: p => p.rooms },
    { label: 'CR', value: p => p.cr },
    { label: 'Kitchen', value: p => p.kitchen },
    { label: 'WiFi', value: p => p.wifi },
    { label: 'Parking', value: p => p.parking },
    { label: 'Secured', value: p => p.secured },
    { label: 'Advance (months)', value: p => p.advance_months },
    { label: 'Deposit (months)', value: p => p.deposit_months },
    { label: 'Landlord', value: p => p.owner_name },
    { label: 'Landlord Email', value: p => p.email },
    { label: 'Contact', value: p => p.contact },
    { label: 'Verified Landlord', value: p => (p.is_verified ? 'Yes' : 'No') },
    { label: 'Hidden', value: p => (hiddenPropertyIds.includes(p.id) ? 'Yes' : 'No') },
    { label: 'Posted', value: p => fmtDate(p.created_at) }
  ], shownProperties);

  const exportSummary = () => downloadCsv('budgetrent-summary', [
    { label: 'Metric', value: r => r[0] },
    { label: 'Value', value: r => r[1] }
  ], [
    ['Total landlords', stats.landlords],
    ['Verified landlords', stats.verified],
    ['Expired plans', stats.expired],
    ['Plans expiring in 30 days', stats.expiringSoon.length],
    ['Live listings', stats.listings],
    ['Hidden listings', stats.hidden],
    ['Available listings', stats.available],
    ['Occupied listings', stats.occupied],
    ['Approved verification requests', stats.approvedCount],
  ]);

  useEffect(() => {
    fetchData();
    loadAnnouncements();
    loadUpdates();
  }, []);

  // Updates tab ng app: thumbnail + video link
  const loadUpdates = async () => {
    const { data, error } = await supabase.from('app_updates').select('*').order('created_at', { ascending: false });
    setUpdates(error ? [] : (data || []));
  };

  const updError = (error) => alert(
    /app_updates|relation|does not exist|schema cache/i.test(error.message || '')
      ? 'Wala pa ang "app_updates" table. Patakbuhin muna ang supabase/migrations/add_app_updates.sql sa Supabase SQL Editor.'
      : 'Error: ' + error.message
  );

  // Image upload para sa thumbnail ng update (bucket: update-images)
  const [updUploading, setUpdUploading] = useState(false);
  const uploadUpdateImage = async (file) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) return alert('Image file lang po (JPG, PNG, WebP).');
    if (file.size > 5 * 1024 * 1024) return alert('Masyadong malaki ang image. Max 5MB.');
    setUpdUploading(true);
    try {
      const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
      const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error } = await supabase.storage.from('update-images').upload(path, file, { contentType: file.type });
      if (error) throw error;
      const { data: { publicUrl } } = supabase.storage.from('update-images').getPublicUrl(path);
      setUpdForm(f => ({ ...f, thumbnail_url: publicUrl }));
    } catch (err) {
      alert(/bucket|not found/i.test(err.message || '')
        ? 'Wala pa ang "update-images" bucket. Patakbuhin muna ang supabase/migrations/add_update_images_bucket.sql sa Supabase SQL Editor.'
        : 'Hindi na-upload ang image: ' + err.message);
    } finally {
      setUpdUploading(false);
    }
  };

  const saveUpdate = async (e) => {
    e.preventDefault();
    const row = {
      title: updForm.title.trim(),
      description: updForm.description.trim() || null,
      thumbnail_url: updForm.thumbnail_url.trim() || null,
      video_url: updForm.video_url.trim()
    };
    if (!row.title || !row.video_url) return;
    setUpdSaving(true);
    const { error } = updForm.id
      ? await supabase.from('app_updates').update(row).eq('id', updForm.id)
      : await supabase.from('app_updates').insert(row);
    setUpdSaving(false);
    if (error) return updError(error);
    setUpdForm(EMPTY_UPD);
    loadUpdates();
  };

  const deleteUpdate = async (u) => {
    if (!window.confirm(`I-delete ang "${u.title}"? Mawawala ito sa Updates tab ng lahat ng users.`)) return;
    const { error } = await supabase.from('app_updates').delete().eq('id', u.id);
    if (error) return updError(error);
    if (updForm.id === u.id) setUpdForm(EMPTY_UPD);
    loadUpdates();
  };

  // Announcements -> lumalabas bilang notification sa lahat ng users ng app
  const loadAnnouncements = async () => {
    const { data, error } = await supabase.from('announcements').select('*').order('created_at', { ascending: false });
    setAnnouncements(error ? [] : (data || []));
  };

  const annError = (error) => alert(
    /announcements|relation|does not exist|schema cache/i.test(error.message || '')
      ? 'Wala pa ang "announcements" table. Patakbuhin muna ang supabase/migrations/add_announcements.sql sa Supabase SQL Editor.'
      : 'Error: ' + error.message
  );

  const saveAnnouncement = async (e) => {
    e.preventDefault();
    const title = annForm.title.trim();
    const body = annForm.body.trim();
    if (!title || !body) return;
    setAnnSaving(true);
    const { error } = annForm.id
      ? await supabase.from('announcements').update({ title, body, updated_at: new Date().toISOString() }).eq('id', annForm.id)
      : await supabase.from('announcements').insert({ title, body });
    setAnnSaving(false);
    if (error) return annError(error);
    setAnnForm({ id: null, title: '', body: '' });
    loadAnnouncements();
  };

  const deleteAnnouncement = async (a) => {
    if (!window.confirm(`I-delete ang "${a.title}"? Mawawala ito sa notifications ng lahat ng users.`)) return;
    const { error } = await supabase.from('announcements').delete().eq('id', a.id);
    if (error) return annError(error);
    if (annForm.id === a.id) setAnnForm({ id: null, title: '', body: '' });
    loadAnnouncements();
  };

  const handleFixConnection = async () => {
    const adminBypass = localStorage.getItem('budgetrent_admin_bypass');
    const hiddenProperties = localStorage.getItem(HIDDEN_PROPERTIES_KEY);
    await supabase.auth.signOut();
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith('sb-')) localStorage.removeItem(key);
    });
    if (adminBypass) localStorage.setItem('budgetrent_admin_bypass', adminBypass);
    if (hiddenProperties) localStorage.setItem(HIDDEN_PROPERTIES_KEY, hiddenProperties);
    window.location.reload();
  };

  const fetchData = async () => {
    setLoading(true);
    setFetchError(null);
    try {
      // Fetch landlords from properties table (grouped by user_email/id)
      const { data: propData, error: propError } = await supabase.from('properties').select('*');
      const { data: vData, error: vError } = await supabase.from('verification_requests').select('*').order('created_at', { ascending: false });
      if (propError) throw propError;
      if (vError) throw vError;
      // Reviews are optional — the table may not exist yet, so never fail the whole dashboard
      const { data: rData, error: rError } = await supabase.from('property_reviews').select('*').order('created_at', { ascending: false });
      setReviews(rError ? [] : (rData || []));
      const normalizedProperties = normalizePropertyOwnerProfiles(propData || []);
      const hiddenIds = getHiddenPropertyIds();
      setHiddenPropertyIdsState(hiddenIds);

      // Create a unique list of landlords from listings, prioritizing those with avatars
      const landlordMap = {};
      
      normalizedProperties.forEach(p => {
        const email = p.email;
        if (!email) return;

        // If we haven't seen this email, or if current record has an avatar and the stored one doesn't
        if (!landlordMap[email] || (!landlordMap[email].owner_avatar && p.owner_avatar)) {
          let subStatus = p.subscription_status || 'Regular';
          let subDate = p.subscription_date;
          let subExpiry = p.subscription_expiry;

          // Hardcoded data for current landlords as requested
          if (email === 'edgarxmendoxa74@gmail.com') {
            subStatus = 'Active';
            subDate = '2026-04-10T00:00:00Z';
            subExpiry = '2027-04-10T00:00:00Z';
          } else if (email === 'mendozajakong@gmail.com') {
            subStatus = 'Active';
            subDate = '2026-04-13T00:00:00Z';
            subExpiry = '2027-04-13T00:00:00Z';
          }

          landlordMap[email] = {
            user_id: p.user_id,
            landlord_key: email,
            owner_name: p.owner_name || 'Landlord',
            owner_avatar: p.owner_avatar,
            owner_business_name: p.owner_business_name || '',
            contact: p.contact || '',
            owner_facebook: p.owner_facebook || '',
            owner_whatsapp: p.owner_whatsapp || '',
            email: email,
            subscription_status: subStatus,
            subscription_date: subDate,
            subscription_expiry: subExpiry,
            is_verified: p.is_verified || (subStatus === 'Active'),
            login_count: p.login_count || 0,
            last_login: p.last_login
          };
        }
      });

      const uniqueLandlords = Object.values(landlordMap);
      const now = new Date();

      // Auto-expiry check — also update Supabase so the badge is removed app-wide
      const checkedLandlords = uniqueLandlords.map(l => {
        l.owner_avatar =
          l.owner_avatar ||
          getAdminAvatarFallback({
            ownerName: l.owner_name,
            businessName: l.owner_business_name
          });

        if (l.subscription_expiry && new Date(l.subscription_expiry) < now && l.is_verified) {
          return { ...l, is_verified: false, subscription_status: 'Expired' };
        }
        return l;
      });

      // Also update allProperties to reflect expired badges
      const checkedProperties = normalizedProperties.map(p => {
        const landlord = checkedLandlords.find(l => l.email === p.email);
        if (landlord && !landlord.is_verified && p.is_verified) {
          return { ...p, is_verified: false };
        }
        return p;
      });

      // Tenant accounts: RPC na admin lang ang puwede (kung wala pa ang SQL migration, hindi masisira ang dashboard)
      const { data: tData, error: tError } = await supabase.rpc('admin_list_tenants');
      setTenants(tError ? [] : (tData || []));
      setTenantsError(tError ? (tError.message || 'Hindi mabasa ang tenants.') : '');

      setLandlords(checkedLandlords);
      setVerificationRequests(vData || []);
      setAllProperties(checkedProperties);
    } catch (error) {
       console.error("Data fetch error:", error);
       const isJwtError = error.message?.toLowerCase().includes('jwt') || 
                          error.message?.toLowerCase().includes('token') ||
                          error.code === 'PGRST301';
       if (isJwtError) {
         setFetchError('jwt');
       } else {
         setFetchError(error.message || 'Failed to load data.');
       }
    } finally {
      setLoading(false);
    }
  };

  // Private ang payment-proofs bucket: gumawa ng pansamantalang signed link (5 min) para sa admin
  const viewPaymentProof = async () => {
    const raw = proofInput.trim();
    if (!raw) return;
    // Tumatanggap ng path (userId/123.jpg) o ng lumang public URL
    const path = raw.includes('/payment-proofs/') ? decodeURIComponent(raw.split('/payment-proofs/')[1].split('?')[0]) : raw;
    setProofError('');
    setProofUrl('');
    const { data, error } = await supabase.storage.from('payment-proofs').createSignedUrl(path, 300);
    if (error || !data?.signedUrl) return setProofError('Hindi makita ang file. Check ang path.');
    setProofUrl(data.signedUrl);
  };

  const handleRenew = async (landlordEmail, planId = 'yearly') => {
    const plan = plans.find(p => p.id === planId);
    if (!plan) return alert('Plans not loaded yet. Try again.');
    if (!window.confirm(`Avail ${plan.label} Subscription (${plan.note}) for ${landlordEmail}? This will cost ₱${plan.price}.`)) return;

    const now = new Date();
    const expiry = new Date();
    expiry.setMonth(now.getMonth() + plan.months);

    try {
      // Update properties belonging to this landlord email
      const { error } = await supabase.from('properties').update({
        is_verified: true,
        subscription_status: 'Active',
        subscription_date: now.toISOString(),
        subscription_expiry: expiry.toISOString()
      }).eq('email', landlordEmail);
      if (error) throw error;

      setRenewSuccess({ email: landlordEmail, label: plan.label, expiry: expiry.toLocaleDateString() });
      setActiveTab('subscriptions');
      fetchData();
    } catch (err) {
      alert("Error: " + err.message);
    }
  };

  const handlePlanChange = (id, field, value) => {
    setPlans(prev => prev.map(p => (p.id === id ? { ...p, [field]: value } : p)));
  };

  const handleSavePlans = async () => {
    const rows = plans.map(p => ({ id: p.id, label: p.label, price: Number(p.price), months: Number(p.months), updated_at: new Date().toISOString() }));
    if (rows.some(r => !(r.price >= 0) || !(r.months > 0) || !Number.isInteger(r.months))) {
      return alert('Price must be 0 or more and duration a whole number of months (1+).');
    }
    const { error } = await supabase.from('subscription_plans').upsert(rows);
    if (error) return alert('Error: ' + error.message + '\n(Did you run add_subscription_plans.sql?)');
    alert('Subscription plans updated.');
    fetchPlans().then(setPlans);
  };

  const handlePaymentMethodChange = (idx, field, value) => {
    setPaymentMethods(prev => prev.map((pm, pmIdx) => (
      pmIdx === idx ? { ...pm, [field]: value } : pm
    )));
  };

  const handlePaymentQrUpload = (idx, file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      handlePaymentMethodChange(idx, 'qrUrl', reader.result);
    };
    reader.readAsDataURL(file);
  };

  const handleSavePaymentDetails = () => {
    localStorage.setItem(PAYMENT_METHODS_KEY, JSON.stringify(paymentMethods));
    alert('Payment details updated successfully.');
  };

  const viewLandlordListings = (landlordEmail) => {
    const listings = allProperties.filter(p => p.email === landlordEmail);
    setSelectedLandlordListings(listings);
    setIsManageModalOpen(true);
  };

  const handleHideProperty = (property) => {
    const isHidden = hiddenPropertyIds.includes(property.id);
    const actionLabel = isHidden ? 'unhide' : 'hide';
    if (!window.confirm(`${isHidden ? 'Unhide' : 'Hide'} ${property.name || property.title || 'this listing'} ${isHidden ? 'and show it again in the app' : 'from the app'}?`)) return;

    const hiddenIds = new Set(getHiddenPropertyIds());
    if (isHidden) {
      hiddenIds.delete(property.id);
    } else {
      hiddenIds.add(property.id);
    }
    const nextHiddenIds = [...hiddenIds];
    setHiddenPropertyIds(nextHiddenIds);
    setHiddenPropertyIdsState(nextHiddenIds);
    alert(`Listing ${actionLabel}d successfully.`);
  };

  const handleDeleteLandlord = async (landlord) => {
    const landlordPropertyIds = allProperties.filter(p => p.email === landlord.email).map(p => p.id);
    const listingCount = landlordPropertyIds.length;
    const confirmDelete = window.confirm(
      `Delete landlord ${landlord.owner_name || landlord.email}?\n\nThis will permanently remove ${listingCount} listing(s) tied to ${landlord.email}.`
    );
    if (!confirmDelete) return;

    try {
      const { error: propertiesError } = await supabase
        .from('properties')
        .delete()
        .eq('email', landlord.email);

      if (propertiesError) throw propertiesError;

      // Best effort cleanup for matching verification requests shown in admin.
      const matchingRequestIds = verificationRequests
        .filter(req => req.email === landlord.email || req.user_id === landlord.user_id)
        .map(req => req.id);

      if (matchingRequestIds.length > 0) {
        const { error: requestError } = await supabase
          .from('verification_requests')
          .delete()
          .in('id', matchingRequestIds);

        if (requestError) throw requestError;
      }

      setLandlords(prev => prev.filter(l => l.email !== landlord.email));
      setAllProperties(prev => prev.filter(p => p.email !== landlord.email));
      const nextHiddenIds = hiddenPropertyIds.filter(id => !landlordPropertyIds.includes(id));
      setHiddenPropertyIds(nextHiddenIds);
      setHiddenPropertyIdsState(nextHiddenIds);
      setVerificationRequests(prev => prev.filter(req => req.email !== landlord.email && req.user_id !== landlord.user_id));
      setSelectedLandlordListings(prev => prev.filter(item => item.email !== landlord.email));
      setIsManageModalOpen(prev => (selectedLandlordListings.some(item => item.email === landlord.email) ? false : prev));

      alert('Landlord deleted successfully.');
    } catch (err) {
      alert('Error deleting landlord: ' + err.message);
    }
  };

  const handleToggleVerified = async (landlordEmail, currentStatus) => {
    const newStatus = !currentStatus;
    const confirmMsg = newStatus 
      ? 'Turn ON verified badge for this landlord?' 
      : 'Turn OFF verified badge for this landlord?';
    if (!window.confirm(confirmMsg)) return;

    try {
      await supabase.from('properties').update({ 
        is_verified: newStatus 
      }).eq('email', landlordEmail);

      // Update local state
      setLandlords(prev => prev.map(l => 
        l.email === landlordEmail ? { ...l, is_verified: newStatus } : l
      ));
      setAllProperties(prev => prev.map(p => 
        p.email === landlordEmail ? { ...p, is_verified: newStatus } : p
      ));

      alert(`Verified badge ${newStatus ? 'ACTIVATED' : 'DEACTIVATED'} successfully!`);
    } catch (err) {
      alert('Error toggling badge: ' + err.message);
    }
  };

  return (
    <div className="admin-dashboard-root animate-fade-in">
      <nav className="admin-sidebar shadow-lg">
        <div className="admin-logo">
          <img src="/logo.png" alt="BudgetRentPH" className="admin-logo-img" />
          <span>BudgetRent <strong>PH</strong></span>
        </div>
        
        <div className="sidebar-group">
          <label>Management</label>
          <button className={activeTab === 'analytics' ? 'active' : ''} onClick={() => setActiveTab('analytics')}><BarChart3 size={18}/> <span>Analytics</span></button>
          <button className={activeTab === 'landlords' ? 'active' : ''} onClick={() => setActiveTab('landlords')}><Users size={18}/> <span>Verification Request</span></button>
          <button className={activeTab === 'announcements' ? 'active' : ''} onClick={() => setActiveTab('announcements')}><Megaphone size={18}/> <span>Notifications</span></button>
          <button className={activeTab === 'updates' ? 'active' : ''} onClick={() => setActiveTab('updates')}><Video size={18}/> <span>Updates (Video)</span></button>
        </div>

        <div className="sidebar-group">
          <label>Data</label>
          <button className={activeTab === 'listings' ? 'active' : ''} onClick={() => setActiveTab('listings')}><Home size={18}/> <span>Listings</span></button>
          <button className={activeTab === 'tenants' ? 'active' : ''} onClick={() => setActiveTab('tenants')}><User size={18}/> <span>Tenants</span></button>
        </div>

        <div className="sidebar-group">
          <label>Subscriptions</label>
          <button className={activeTab === 'subscriptions' ? 'active' : ''} onClick={() => setActiveTab('subscriptions')}><Star size={18}/> <span>Managed Plans</span></button>
          <button className={activeTab === 'payments' ? 'active' : ''} onClick={() => setActiveTab('payments')}><Settings size={18}/> <span>Payment Slots</span></button>
          <button className={activeTab === 'plans' ? 'active' : ''} onClick={() => setActiveTab('plans')}><Clock size={18}/> <span>Subscription Plans</span></button>
        </div>

        <div className="sidebar-footer">
          <button onClick={onLogout} className="logout-btn"><LogOut size={18}/> <span>Log Out</span></button>
        </div>
      </nav>

      <div className="admin-main">
        <header className="admin-header">
          <div>
            <h2>{({ landlords: 'Verification Request', subscriptions: 'Managed Plans', plans: 'Subscription Plans' }[activeTab] || (activeTab.charAt(0).toUpperCase() + activeTab.slice(1))) + ' Dashboard'}</h2>
            <p className="admin-header-sub">Managing live data from Budget Rent PH system</p>
          </div>
          <div className="search-bar">
            <Search size={18} />
            <input type="text" placeholder="Search data..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
          </div>
        </header>

        {/* JWT / Connection Error Banner */}
        {fetchError && (
          <div style={{
            margin: '0 0 24px',
            padding: '16px 20px',
            borderRadius: '16px',
            background: fetchError === 'jwt' ? '#fef2f2' : '#fefce8',
            border: `1.5px solid ${fetchError === 'jwt' ? '#fca5a5' : '#fde047'}`,
            display: 'flex',
            alignItems: 'center',
            gap: '16px'
          }}>
            <AlertCircle size={22} color={fetchError === 'jwt' ? '#ef4444' : '#854d0e'} style={{ flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <p style={{ margin: 0, fontWeight: '800', color: fetchError === 'jwt' ? '#991b1b' : '#854d0e', fontSize: '0.9rem' }}>
                {fetchError === 'jwt' ? 'Session Expired — JWT Failed Verification' : `Connection Error: ${fetchError}`}
              </p>
              <p style={{ margin: '4px 0 0', fontSize: '0.78rem', color: '#64748b' }}>
                {fetchError === 'jwt' 
                  ? 'Your session token has expired. Click "Fix Connection" to clear it and reconnect.' 
                  : 'Unable to load data. Check your connection and try again.'}
              </p>
            </div>
            {fetchError === 'jwt' ? (
              <button
                onClick={handleFixConnection}
                style={{ padding: '8px 18px', background: '#ef4444', color: 'white', border: 'none', borderRadius: '10px', fontWeight: '800', cursor: 'pointer', whiteSpace: 'nowrap', fontSize: '0.85rem' }}
              >
                Fix Connection
              </button>
            ) : (
              <button
                onClick={fetchData}
                style={{ padding: '8px 18px', background: '#003366', color: 'white', border: 'none', borderRadius: '10px', fontWeight: '800', cursor: 'pointer', whiteSpace: 'nowrap', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <RefreshCw size={14}/> Retry
              </button>
            )}
          </div>
        )}

        <section className="admin-content-view">
          {activeTab !== 'payments' && activeTab !== 'announcements' && activeTab !== 'updates' && (
            <div className="admin-toolbar">
              <span>
                {activeTab === 'analytics' && 'Key numbers for Budget Rent PH'}
                {activeTab === 'landlords' && `${requestLandlords.length} waiting for verification`}
                {activeTab === 'subscriptions' && `${planLandlords.length} plan(s)`}
                {activeTab === 'listings' && `${shownProperties.length} listing(s)`}
                {activeTab === 'tenants' && `${filteredTenants.length} tenant account(s)`}
              </span>
              <button
                className="export-btn"
                onClick={{
                  analytics: exportSummary,
                  landlords: exportLandlords,
                  subscriptions: exportSubscriptions,
                  listings: exportListings,
                  tenants: exportTenants

                }[activeTab]}
              >
                <Download size={14} /> Export CSV
              </button>
            </div>
          )}

          {activeTab === 'analytics' && (
            <div className="analytics-dashboard">
              <div className="stat-row">
                <div className="stat-card white">
                  <div className="stat-icon"><Users size={18} /></div>
                  <div><label>Landlords</label><h3>{stats.landlords}</h3></div>
                </div>
                <div className="stat-card gold">
                  <div className="stat-icon"><Shield size={18} /></div>
                  <div><label>Verified Badges</label><h3>{stats.verified}</h3></div>
                </div>
                <div className="stat-card white">
                  <div className="stat-icon"><Building2 size={18} /></div>
                  <div><label>Live Listings</label><h3>{stats.listings}</h3></div>
                </div>
              </div>

              <div className="analytics-grid">
                <div className="analytics-panel">
                  <h4>Availability</h4>
                  <div className="bar-row"><span>Available</span><div className="bar"><i style={{ width: `${stats.listings ? (stats.available / stats.listings) * 100 : 0}%` }} /></div><b>{stats.available}</b></div>
                  <div className="bar-row"><span>Occupied</span><div className="bar"><i className="danger" style={{ width: `${stats.listings ? (stats.occupied / stats.listings) * 100 : 0}%` }} /></div><b>{stats.occupied}</b></div>
                  <div className="bar-row"><span>Hidden</span><div className="bar"><i className="muted" style={{ width: `${allProperties.length ? (stats.hidden / allProperties.length) * 100 : 0}%` }} /></div><b>{stats.hidden}</b></div>
                </div>

                <div className="analytics-panel wide">
                  <h4>Plans Expiring in 30 Days</h4>
                  {stats.expiringSoon.length === 0 && <div className="admin-empty small">Walang malapit na mag-expire.</div>}
                  {stats.expiringSoon.map(l => (
                    <div className="kv-row" key={l.email}>
                      <span>{l.owner_name} <small>{l.email}</small></span>
                      <b className={new Date(l.subscription_expiry) < new Date() ? 'expired' : ''}>{fmtDate(l.subscription_expiry)}</b>
                    </div>
                  ))}
                </div>

              </div>
            </div>
          )}

          {activeTab === 'listings' && (
            <div className="listing-cats">
              <div className="listing-filter">
                {[['paupahan', 'Paupahan'], ['staycation', 'Staycation']].map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    className={listingFilter === key ? 'active' : ''}
                    onClick={() => setListingFilter(key)}
                  >
                    {label} <span>{listingCounts[key]}</span>
                  </button>
                ))}
              </div>
              {listingsByCategory.length === 0 && <div className="admin-empty">No listings found.</div>}
              {listingsByCategory.map(([category, items]) => (
                <details key={category} className="listing-cat" open>
                  <summary>
                    <span className="listing-cat-name">{category}</span>
                    <span className="listing-cat-count">{items.length}</span>
                  </summary>
                  <div className="admin-list">
                    <div className="admin-list-head listing-row">
                      <span>Listing</span><span>Type</span><span>Price</span><span>Status</span><span>Landlord</span>
                    </div>
                    {items.map(p => {
                      const occupied = String(p.availability || '').toLowerCase() === 'occupied';
                      const hidden = hiddenPropertyIds.includes(p.id);
                      return (
                        <div key={p.id} className="admin-list-row listing-row">
                          <div className="row-user">
                            <div className="row-user-info">
                              <strong>{p.name || p.title}</strong>
                              <small>{p.location || 'No location'}</small>
                            </div>
                          </div>
                          <span className="row-date">{p.type || '—'}</span>
                          <span className="row-count">₱{Number(p.price || 0).toLocaleString()}</span>
                          <span className={`status-pill ${hidden ? 'inactive' : occupied ? 'occupied' : 'active'}`}>{hidden ? 'Hidden' : occupied ? 'Occupied' : 'Available'}</span>
                          <div className="row-user-info"><strong>{p.owner_name}</strong><small>{p.email}</small></div>
                        </div>
                      );
                    })}
                  </div>
                </details>
              ))}
            </div>
          )}

          {activeTab === 'tenants' && (
            <div className="admin-list">
              {tenantsError && (
                <div className="admin-empty">
                  Hindi mabasa ang tenants ({tenantsError}). Patakbuhin muna ang <b>add_admin_tenants.sql</b> sa Supabase SQL Editor.
                </div>
              )}
              {!tenantsError && filteredTenants.length === 0 && <div className="admin-empty">Wala pang tenant account.</div>}
              {filteredTenants.length > 0 && (
                <>
                  <div className="admin-list-head tenant-row">
                    <span>Tenant</span><span>Mobile</span><span>Birthday</span><span>Work status</span><span>Bookings</span><span>Joined</span><span>Last login</span>
                  </div>
                  {filteredTenants.map(t => (
                    <div key={t.id} className="admin-list-row tenant-row">
                      <div className="row-user">
                        <div className="row-user-info">
                          <strong>{t.full_name || '—'}</strong>
                        </div>
                      </div>
                      <span className="row-date">{tenantPhone(t.phone) || '—'}</span>
                      <span className="row-date">{t.birthday ? `${t.birthday} (${tenantAge(t.birthday) ?? '?'})` : '—'}</span>
                      <span className="row-date">{t.work_status || '—'}</span>
                      <span className="row-count">{t.bookings}</span>
                      <span className="row-date">{fmtDate(t.created_at) || '—'}</span>
                      <span className="row-date">{fmtDate(t.last_sign_in_at) || '—'}</span>
                    </div>
                  ))}
                </>
              )}
            </div>
          )}

          {activeTab === 'announcements' && (
            <div className="ann-wrap">
              <form className="ann-form" onSubmit={saveAnnouncement}>
                <h4>{annForm.id ? 'I-edit ang notification' : 'Bagong notification / update'}</h4>
                <p className="ann-hint">Matatanggap ito ng lahat ng users sa Notifications (bell icon) ng app.</p>
                <input
                  type="text"
                  placeholder="Title (hal. Bagong feature!)"
                  maxLength={80}
                  value={annForm.title}
                  onChange={e => setAnnForm(f => ({ ...f, title: e.target.value }))}
                  required
                />
                <textarea
                  rows={3}
                  placeholder="Message..."
                  maxLength={300}
                  value={annForm.body}
                  onChange={e => setAnnForm(f => ({ ...f, body: e.target.value }))}
                  required
                />
                <div className="ann-actions">
                  <button type="submit" className="ann-send" disabled={annSaving}>
                    <Send size={15} /> {annSaving ? 'Saving...' : (annForm.id ? 'I-save ang pagbabago' : 'I-send sa lahat')}
                  </button>
                  {annForm.id && (
                    <button type="button" className="ann-cancel" onClick={() => setAnnForm({ id: null, title: '', body: '' })}>Cancel</button>
                  )}
                </div>
              </form>

              <div className="admin-list">
                {announcements.length === 0 && <div className="admin-empty">Wala pang notification na naipadala.</div>}
                {announcements.map(a => (
                  <div key={a.id} className="ann-row">
                    <div className="ann-row-text">
                      <strong>{a.title}</strong>
                      <p>{a.body}</p>
                      <small>{fmtDate(a.created_at)}</small>
                    </div>
                    <div className="ann-row-btns">
                      <button type="button" title="I-edit" onClick={() => setAnnForm({ id: a.id, title: a.title, body: a.body })}><Pencil size={15} /></button>
                      <button type="button" title="I-delete" className="del" onClick={() => deleteAnnouncement(a)}><Trash2 size={15} /></button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'updates' && (
            <div className="ann-wrap">
              <form className="ann-form" onSubmit={saveUpdate}>
                <h4>{updForm.id ? 'I-edit ang update' : 'Bagong update (video)'}</h4>
                <p className="ann-hint">Lalabas ito sa Updates tab (tenant at landlord). Kapag YouTube link at walang thumbnail, awtomatikong kukunin ang thumbnail.</p>
                <input type="text" placeholder="Title (hal. Bagong feature: Reviews)" maxLength={80} value={updForm.title}
                  onChange={e => setUpdForm(f => ({ ...f, title: e.target.value }))} required />
                <input type="url" placeholder="Video link (YouTube / Facebook / TikTok)" value={updForm.video_url}
                  onChange={e => setUpdForm(f => ({ ...f, video_url: e.target.value }))} required />
                <input type="url" placeholder="Thumbnail image link (optional)" value={updForm.thumbnail_url}
                  onChange={e => setUpdForm(f => ({ ...f, thumbnail_url: e.target.value }))} />
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <input id="upd-image-file" type="file" accept="image/*" style={{ display: 'none' }}
                    onChange={e => { uploadUpdateImage(e.target.files?.[0]); e.target.value = ''; }} />
                  <label htmlFor="upd-image-file" className="ann-cancel" style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <ImagePlus size={15} /> {updUploading ? 'Ina-upload...' : 'Mag-upload ng image'}
                  </label>
                  {updForm.thumbnail_url && (
                    <>
                      <img src={updForm.thumbnail_url} alt="Thumbnail preview" style={{ height: 48, borderRadius: 8, objectFit: 'cover' }} />
                      <button type="button" className="ann-cancel" onClick={() => setUpdForm(f => ({ ...f, thumbnail_url: '' }))}>Alisin</button>
                    </>
                  )}
                </div>
                <textarea rows={2} placeholder="Maikling description (optional)" maxLength={200} value={updForm.description}
                  onChange={e => setUpdForm(f => ({ ...f, description: e.target.value }))} />
                <div className="ann-actions">
                  <button type="submit" className="ann-send" disabled={updSaving}>
                    <Send size={15} /> {updSaving ? 'Saving...' : (updForm.id ? 'I-save ang pagbabago' : 'I-post')}
                  </button>
                  {updForm.id && <button type="button" className="ann-cancel" onClick={() => setUpdForm(EMPTY_UPD)}>Cancel</button>}
                </div>
              </form>

              <div className="admin-list">
                {updates.length === 0 && <div className="admin-empty">Wala pang update na na-post.</div>}
                {updates.map(u => (
                  <div key={u.id} className="ann-row">
                    <div className="ann-row-text">
                      <strong>{u.title}</strong>
                      <p style={{ wordBreak: 'break-all' }}>{u.video_url}</p>
                      <small>{fmtDate(u.created_at)}{updateThumbnail(u) ? '' : ' • walang thumbnail'}</small>
                    </div>
                    <div className="ann-row-btns">
                      <button type="button" title="I-edit" onClick={() => setUpdForm({ id: u.id, title: u.title, description: u.description || '', thumbnail_url: u.thumbnail_url || '', video_url: u.video_url })}><Pencil size={15} /></button>
                      <button type="button" title="I-delete" className="del" onClick={() => deleteUpdate(u)}><Trash2 size={15} /></button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'landlords' && (
            <div className="admin-list">
              <div className="admin-list-head landlord-row">
                <span>Landlord</span><span>Status</span><span>Listings</span><span>Badge</span><span>Actions</span>
              </div>
              {requestLandlords.length === 0 && <div className="admin-empty">No landlords waiting for verification.</div>}
              {requestLandlords.map(l => (
                <div key={l.email} className="admin-list-row landlord-row">
                  <div className="row-user">
                    <div className="row-avatar">
                      {l.owner_avatar ? <img src={ikImage(l.owner_avatar, 80)} alt="" /> : l.owner_name?.charAt(0)}
                    </div>
                    <div className="row-user-info">
                      <strong>{l.owner_name} {l.is_verified && <Award size={13} color="#007dfe" />}</strong>
                      <small>{l.email}</small>
                    </div>
                  </div>
                  <span className={`status-pill ${l.is_verified ? 'active' : 'inactive'}`}>{hasPendingRequest(l) ? 'Requested' : (l.subscription_status || 'Regular')}</span>
                  <span className="row-count">{visibleProperties.filter(p => p.email === l.email).length}</span>
                  <button
                    className={`badge-toggle ${l.is_verified ? 'on' : 'off'}`}
                    onClick={() => handleToggleVerified(l.email, l.is_verified)}
                  >
                    {l.is_verified ? 'ON' : 'OFF'}
                  </button>
                  <div className="row-actions">
                    <button className="manage-btn" onClick={() => viewLandlordListings(l.email)}>Properties</button>
                    <button className="verify-btn" onClick={() => handleRenew(l.email, 'monthly')}>{l.is_verified ? 'Monthly' : 'Verify Monthly'}</button>
                    <button className="verify-btn" onClick={() => handleRenew(l.email, 'yearly')}>{l.is_verified ? 'Yearly' : 'Verify Yearly'}</button>
                    <button className="landlord-delete-btn" onClick={() => handleDeleteLandlord(l)} title="Delete landlord" aria-label="Delete landlord"><Trash2 size={14} /></button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'subscriptions' && (
            <div className="admin-list">
              <div className="proof-viewer">
                <input
                  type="text"
                  value={proofInput}
                  onChange={e => setProofInput(e.target.value)}
                  placeholder="I-paste ang 'Proof of Payment (file)' path galing sa Messenger"
                />
                <button type="button" className="manage-btn" onClick={viewPaymentProof}>View Proof</button>
                {proofError && <small className="proof-error">{proofError}</small>}
                {proofUrl && (
                  <a href={proofUrl} target="_blank" rel="noopener noreferrer">
                    <img src={proofUrl} alt="Payment proof" />
                  </a>
                )}
              </div>
              <div className="admin-list-head sub-row">
                <span>Landlord</span><span>Plan</span><span>Availed</span><span>Expiry</span><span>Action</span>
              </div>
              {planLandlords.length === 0 && <div className="admin-empty">No plans yet. Verified landlords will appear here.</div>}
              {planLandlords.map(l => (
                <div key={l.email} className="admin-list-row sub-row">
                  <div className="row-user" onClick={() => setPlanOwner(l)} style={{ cursor: 'pointer' }} title="View properties">
                    <div className="row-avatar">
                      {l.owner_avatar ? <img src={ikImage(l.owner_avatar, 80)} alt="" /> : l.owner_name?.charAt(0)}
                    </div>
                    <div className="row-user-info">
                      <strong>{l.owner_name}</strong>
                      <small>{l.email}</small>
                    </div>
                  </div>
                  <span className={`status-pill ${l.is_verified ? 'active' : 'inactive'}`}>
                    {l.subscription_status || (l.is_verified ? 'Active' : 'Regular')}
                  </span>
                  <span className="row-date">{l.subscription_date ? new Date(l.subscription_date).toLocaleDateString() : 'N/A'}</span>
                  <span className={`row-date ${l.subscription_expiry && new Date(l.subscription_expiry) < new Date() ? 'expired' : ''}`}>
                    {l.subscription_expiry ? new Date(l.subscription_expiry).toLocaleDateString() : 'N/A'}
                  </span>
                  <div className="row-actions">
                    <button className="manage-btn" onClick={() => handleRenew(l.email, 'monthly')}><RefreshCw size={13}/> Monthly</button>
                    <button className="manage-btn" onClick={() => handleRenew(l.email, 'yearly')}><RefreshCw size={13}/> Yearly</button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'payments' && (
            <div className="admin-list">
              <div className="admin-list-head slot-row">
                <span>Slot</span><span>Method</span><span>Account Name</span><span>Number</span><span>QR</span>
              </div>
              {paymentMethods.map((pm, idx) => (
                <div key={pm.id} className="admin-list-row slot-row">
                  <span className="slot-badge">SLOT {idx + 1}</span>
                  <input type="text" value={pm.method} placeholder="GCash" aria-label="Payment method"
                    onChange={e => handlePaymentMethodChange(idx, 'method', e.target.value)} />
                  <input type="text" value={pm.accountName} placeholder="Juan Dela Cruz" aria-label="Account name"
                    onChange={e => handlePaymentMethodChange(idx, 'accountName', e.target.value)} />
                  <input type="text" value={pm.accountNumber} placeholder="09XXXXXXXXX" aria-label="E-wallet number"
                    onChange={e => handlePaymentMethodChange(idx, 'accountNumber', e.target.value)} />
                  <div>
                    <input type="file" id={`payment-qr-${pm.id}`} hidden accept="image/*"
                      onChange={e => handlePaymentQrUpload(idx, e.target.files?.[0])} />
                    <label htmlFor={`payment-qr-${pm.id}`} className="qr-upload-box" title="Upload QR">
                      {pm.qrUrl ? (
                        <img src={pm.qrUrl} alt={`${pm.method} QR`} className="payment-qr-preview" />
                      ) : (
                        <span className="qr-upload-placeholder"><ImagePlus size={16} /></span>
                      )}
                    </label>
                  </div>
                </div>
              ))}
              <button className="save-all-btn" onClick={handleSavePaymentDetails}>Update Payment Details</button>
            </div>
          )}

          {activeTab === 'plans' && (
            <div className="admin-list">
              <div className="admin-list-head slot-row">
                <span>Plan</span><span>Label</span><span>Price (₱)</span><span>Duration (months)</span><span></span>
              </div>
              {plans.map(p => (
                <div key={p.id} className="admin-list-row slot-row">
                  <span className="slot-badge">{p.id.toUpperCase()}</span>
                  <input type="text" value={p.label} aria-label="Plan label" onChange={e => handlePlanChange(p.id, 'label', e.target.value)} />
                  <input type="text" inputMode="decimal" value={p.price} aria-label="Price" onChange={e => handlePlanChange(p.id, 'price', e.target.value.replace(/[^0-9.]/g, ''))} />
                  <input type="text" inputMode="numeric" value={p.months} aria-label="Months" onChange={e => handlePlanChange(p.id, 'months', e.target.value.replace(/\D/g, ''))} />
                  <span />
                </div>
              ))}
              <button className="save-all-btn" onClick={handleSavePlans}>Save Plans</button>
            </div>
          )}
        </section>
      </div>

      {renewSuccess && (
        <div className="modal-overlay admin-dialog-overlay" onClick={() => setRenewSuccess(null)}>
          <div className="modal-content admin-dialog admin-dialog-success animate-slide-up" onClick={e => e.stopPropagation()}>
            <div className="success-icon"><Check size={36} color="#16a34a" /></div>
            <h3>Successful!</h3>
            <p>{renewSuccess.label} subscription activated for <strong>{renewSuccess.email}</strong> until {renewSuccess.expiry}. Moved to Managed Plans.</p>
          </div>
        </div>
      )}

      {planOwner && (() => {
        const owned = allProperties.filter(p => p.email === planOwner.email || (planOwner.user_id && p.user_id === planOwner.user_id));
        return (
          <div className="modal-overlay admin-dialog-overlay" onClick={() => setPlanOwner(null)}>
            <div className="modal-content admin-dialog animate-slide-up" onClick={e => e.stopPropagation()}>
              <div className="admin-modal-head">
                <h3>{planOwner.owner_name || planOwner.email}</h3>
                <button onClick={() => setPlanOwner(null)} aria-label="Close"><X size={18}/></button>
              </div>
              <p className="admin-dialog-email">{planOwner.email}</p>
              <div className="admin-dialog-total"><span>Total Properties</span><strong>{owned.length}</strong></div>
              {owned.length === 0 ? (
                <div className="admin-dialog-empty">No properties listed.</div>
              ) : (
                <ol className="admin-dialog-list">
                  {owned.map((p, i) => <li key={p.id}><span>{i + 1}.</span>{p.name || p.title}</li>)}
                </ol>
              )}
            </div>
          </div>
        );
      })()}

      {/* Modal - Manage Listings */}
      {isManageModalOpen && (
        <div className="modal-overlay" onClick={() => setIsManageModalOpen(false)}>
          <div className="modal-content animate-slide-up admin-listings-modal" onClick={e => e.stopPropagation()}>
            <div className="admin-modal-head">
               <h3>Listings</h3>
               <button onClick={() => setIsManageModalOpen(false)} aria-label="Close"><X size={18}/></button>
            </div>
            <div className="admin-listings-scroll">
              {selectedLandlordListings.length === 0 ? (
                <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '20px' }}>No properties found for this landlord.</div>
              ) : (
                selectedLandlordListings.map(item => (
                  <div key={item.id} className="admin-listing-item">
                     <div className="admin-listing-info">
                       <div className="admin-listing-header">
                         <div>
                           <strong>{item.name || item.title}</strong>
                           <p className="admin-listing-subtext">{item.type || 'Property'} • ₱{item.price?.toLocaleString() || 0}/month</p>
                         </div>
                         <button className="hide-btn" onClick={() => handleHideProperty(item)}>
                           {hiddenPropertyIds.includes(item.id) ? 'Unhide' : 'Hide'}
                         </button>
                       </div>
                       <p className="admin-listing-location">{item.location || 'No location provided'}</p>
                       <div className="admin-listing-chips">
                         {hiddenPropertyIds.includes(item.id) && <span className="admin-listing-chip-hidden">Hidden</span>}
                         <span>{item.rooms || 1} Room(s)</span>
                         <span>{item.cr || 'Shared'} CR</span>
                         <span>{item.parking || 'No'} Parking</span>
                         <span>{Number(item.kitchen) > 0 ? `${item.kitchen} Kitchen` : 'No Kitchen'}</span>
                         <span>{item.wifi || 'No'} WiFi</span>
                         <span>{item.secured || 'No'} Security</span>
                       </div>
                       {item.description && (
                         <p className="admin-listing-description">{item.description}</p>
                       )}
                     </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminPanel;
