import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { 
  Users, ClipboardList, Shield, LogOut, Search, 
  Check, X, Building2, Trash2, Star,
  Settings, BarChart3, Clock, Award, AlertCircle, RefreshCw, ImagePlus
} from 'lucide-react';
import './AdminPanel.css';

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

const AdminPanel = ({ onLogout }) => {
  const [activeTab, setActiveTab] = useState('analytics'); 
  const [paymentMethods, setPaymentMethods] = useState(getStoredPaymentMethods);
  
  const [landlords, setLandlords] = useState([]);
  const [verificationRequests, setVerificationRequests] = useState([]);
  const [allProperties, setAllProperties] = useState([]);
  const [hiddenPropertyIds, setHiddenPropertyIdsState] = useState(getHiddenPropertyIds());
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Modals state
  const [isManageModalOpen, setIsManageModalOpen] = useState(false);
  const [selectedLandlordListings, setSelectedLandlordListings] = useState([]);

  const filteredLandlords = useMemo(() => {
    if (!searchQuery) return landlords;
    const lowerQuery = searchQuery.toLowerCase();
    return landlords.filter(l => (l.owner_name || l.email)?.toLowerCase().includes(lowerQuery));
  }, [landlords, searchQuery]);

  const pendingRequests = useMemo(() => {
    return verificationRequests.filter(r => r.status === 'pending');
  }, [verificationRequests]);

  const activeBadgesCount = useMemo(() => {
    return landlords.filter(l => l.is_verified).length;
  }, [landlords]);

  const visibleProperties = useMemo(() => {
    const hiddenSet = new Set(hiddenPropertyIds);
    return allProperties.filter(p => !hiddenSet.has(p.id));
  }, [allProperties, hiddenPropertyIds]);

  useEffect(() => {
    fetchData();
  }, []);

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
      const normalizedProperties = normalizePropertyOwnerProfiles(propData || []);
      const hiddenIds = getHiddenPropertyIds();
      const hiddenPropertyIdSet = new Set(hiddenIds);
      setHiddenPropertyIdsState(hiddenIds);
      const visiblePropertyRows = normalizedProperties.filter(p => !hiddenPropertyIdSet.has(p.id));

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

  const handleRenew = async (landlordEmail) => {
    const confirmRenew = window.confirm(`Avail 1 Year Subscription for ${landlordEmail}? This will cost ₱100.`);
    if (!confirmRenew) return;

    const now = new Date();
    const expiry = new Date();
    expiry.setFullYear(now.getFullYear() + 1);

    try {
      // Update properties belonging to this landlord email
      await supabase.from('properties').update({
        is_verified: true,
        subscription_status: 'Active',
        subscription_date: now.toISOString(),
        subscription_expiry: expiry.toISOString()
      }).eq('email', landlordEmail);
      
      alert("Subscription Activated for 1 Year!");
      fetchData();
    } catch (err) {
      alert("Error: " + err.message);
    }
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

  const approveRequest = async (requestId, userId, userEmail) => {
    try {
      const now = new Date();
      const expiry = new Date();
      expiry.setFullYear(now.getFullYear() + 1);

      await supabase.from('verification_requests').update({ status: 'approved' }).eq('id', requestId);
      await supabase.from('properties').update({ 
        is_verified: true,
        subscription_status: 'Active',
        subscription_date: now.toISOString(),
        subscription_expiry: expiry.toISOString()
      }).eq('user_id', userId);
      
      fetchData();
      alert(`Approved! Subscription started for ${userEmail}`);
    } catch (err) {
      alert("Error approving");
    }
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
          <Shield color="#FFD700" size={32} />
          <span>BudgetRent <strong>PH</strong></span>
        </div>
        
        <div className="sidebar-group">
          <label>Management</label>
          <button className={activeTab === 'analytics' ? 'active' : ''} onClick={() => setActiveTab('analytics')}><BarChart3 size={18}/> Analytics</button>
          <button className={activeTab === 'landlords' ? 'active' : ''} onClick={() => setActiveTab('landlords')}><Users size={18}/> Landlords</button>
          <button className={activeTab === 'requests' ? 'active' : ''} onClick={() => setActiveTab('requests')}><ClipboardList size={18}/> Pending Requests <span className="badge-count">{pendingRequests.length}</span></button>
        </div>

        <div className="sidebar-group">
          <label>Subscriptions</label>
          <button className={activeTab === 'subscriptions' ? 'active' : ''} onClick={() => setActiveTab('subscriptions')}><Star size={18}/> Managed Plans</button>
          <button className={activeTab === 'payments' ? 'active' : ''} onClick={() => setActiveTab('payments')}><Settings size={18}/> Payment Slots</button>
        </div>

        <div className="sidebar-footer">
          <button onClick={onLogout} className="logout-btn"><LogOut size={18}/> Log Out</button>
        </div>
      </nav>

      <div className="admin-main">
        <header className="admin-header">
          <div>
            <h2>{activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} Dashboard</h2>
            <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--admin-text-muted)' }}>Managing live data from Budget Rent PH system</p>
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
          {activeTab === 'analytics' && (
             <div className="analytics-dashboard">
                <div className="stat-row">
                   <div className="stat-card white">
                      <Users size={24} color="#003366" />
                      <div><label>Total Landlords</label><h3>{landlords.length}</h3></div>
                   </div>
                   <div className="stat-card gold">
                      <Shield size={24} color="#003366" />
                      <div><label>Active Badges</label><h3>{activeBadgesCount}</h3></div>
                   </div>
                </div>
                <div className="stat-row" style={{ marginTop: '20px' }}>
                   <div className="stat-card white">
                      <Building2 size={24} color="#003366" />
                      <div><label>Total Listings</label><h3>{visibleProperties.length}</h3></div>
                   </div>
                   <div className="stat-card navy">
                      <RefreshCw size={24} color="#FFD700" />
                      <div><label>Pending Requests</label><h3>{pendingRequests.length}</h3></div>
                   </div>
                </div>
             </div>
          )}

          {activeTab === 'landlords' && (
            <div className="landlord-grid">
              {filteredLandlords.map(l => (
                <div key={l.email} className="premium-card landlord-card">
                  <div className="card-header">
                    <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: '#003366', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', overflow: 'hidden' }}>
                      {l.owner_avatar ? (
                        <img src={l.owner_avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        l.owner_name?.charAt(0)
                      )}
                    </div>
                    <div className="user-info">
                      <h4>{l.owner_name} {l.is_verified && <Award size={14} color="#007dfe" />}</h4>
                      <p>{l.email}</p>
                    </div>
                  </div>
                  <div className="card-stats" style={{ padding: '12px' }}>
                    <div className="stat-item"><span>Status</span><strong style={{color: l.is_verified ? '#10b981' : '#64748b'}}>{l.subscription_status || 'Regular'}</strong></div>
                    <div className="stat-item"><span>Listings</span><strong>{visibleProperties.filter(p => p.email === l.email).length}</strong></div>
                    <div className="stat-item">
                      <span>Badge</span>
                      <button 
                        onClick={() => handleToggleVerified(l.email, l.is_verified)}
                        style={{ 
                          padding: '4px 10px', 
                          borderRadius: '20px', 
                          border: 'none', 
                          fontSize: '0.7rem', 
                          fontWeight: '800', 
                          cursor: 'pointer',
                          background: l.is_verified ? '#10b981' : '#ef4444',
                          color: 'white',
                          transition: 'all 0.2s'
                        }}
                      >
                        {l.is_verified ? 'ON' : 'OFF'}
                      </button>
                    </div>
                  </div>
                  <div className="card-actions">
                    <button className="manage-btn" onClick={() => viewLandlordListings(l.email)}>Properties</button>
                    <button className={l.is_verified ? 'verify-btn verified' : 'verify-btn'} onClick={() => handleRenew(l.email)}>{l.is_verified ? 'Renew Plan' : 'Activate'}</button>
                    <button className="landlord-delete-btn" onClick={() => handleDeleteLandlord(l)}><Trash2 size={15} /> Delete</button>
                  </div>
                </div>
              ))}
            </div>
          )}


          {activeTab === 'subscriptions' && (
             <div className="premium-table-wrapper">
                <table className="premium-table">
                  <thead>
                    <tr><th>Landlord Name</th><th>Plan Status</th><th>Availed Date</th><th>Expiry Date</th><th>Action</th></tr>
                  </thead>
                  <tbody>
                    {filteredLandlords.map(l => (
                      <tr key={l.email}>
                        <td style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#003366', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', flexShrink: 0, overflow: 'hidden' }}>
                            {l.owner_avatar ? (
                              <img src={l.owner_avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            ) : (
                              l.owner_name?.charAt(0)
                            )}
                          </div>
                          <div>
                            <div style={{ fontWeight: '800' }}>{l.owner_name}</div>
                            <small>{l.email}</small>
                          </div>
                        </td>
                        <td>
                          <span className={`status-pill ${l.is_verified ? 'active' : 'inactive'}`}>
                            {l.subscription_status || (l.is_verified ? 'Active' : 'Regular')}
                          </span>
                        </td>
                        <td>{l.subscription_date ? new Date(l.subscription_date).toLocaleDateString() : 'N/A'}</td>
                        <td style={{ color: new Date(l.subscription_expiry) < new Date() ? '#ef4444' : 'inherit' }}>
                          {l.subscription_expiry ? new Date(l.subscription_expiry).toLocaleDateString() : 'N/A'}
                        </td>
                        <td>
                          <button className="refresh-btn" onClick={() => handleRenew(l.email)} style={{ padding: '6px 12px', background: '#003366', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <RefreshCw size={14}/> Renew
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
             </div>
          )}

          {activeTab === 'requests' && (
            <div className="requests-stack">
              {pendingRequests.map(req => {
                const landlord = landlords.find(l => l.user_id === req.user_id);
                const avatar = landlord?.owner_avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(req.full_name)}&background=random`;
                
                return (
                  <div key={req.id} className="premium-card request-item">
                    <div className="req-header">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Clock size={16}/> <span>{new Date(req.created_at).toLocaleDateString()}</span></div>
                      <span className="status-badge pending">PENDING</span>
                    </div>
                    <div style={{ display: 'flex', gap: '20px', alignItems: 'center', margin: '12px 0' }}>
                      <div style={{ width: '60px', height: '60px', borderRadius: '15px', background: 'var(--admin-navy)', overflow: 'hidden', flexShrink: 0 }}>
                         <img src={avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <h3 style={{ margin: '0 0 4px', color: '#003366' }}>{req.full_name}</h3>
                        <p style={{ margin: 0, fontSize: '0.85rem' }}><strong>Property:</strong> {req.property_name}</p>
                      </div>
                      <button className="approve-btn" onClick={() => approveRequest(req.id, req.user_id, landlord?.email || req.full_name)}><Check size={16}/> Approve & Activate Plan</button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* PAYMENTS & STATS VIEW REMAIN (Hidden logic for brevity but keep original) */}
          {activeTab === 'payments' && (
             <div className="payment-config-grid">
                {paymentMethods.map((pm, idx) => (
                   <div key={pm.id} className="premium-card config-slot">
                      <div className="slot-badge">SLOT {idx + 1}</div>
                      <div className="config-form" style={{ marginTop: '16px' }}>
                         <label style={{ fontSize: '0.7rem', fontWeight: '800' }}>PAYMENT METHOD</label>
                         <input
                           type="text"
                           value={pm.method}
                           placeholder="GCash"
                           onChange={e => handlePaymentMethodChange(idx, 'method', e.target.value)}
                         />
                         <label style={{ fontSize: '0.7rem', fontWeight: '800' }}>ACCOUNT NAME</label>
                         <input
                           type="text"
                           value={pm.accountName}
                           placeholder="Juan Dela Cruz"
                           onChange={e => handlePaymentMethodChange(idx, 'accountName', e.target.value)}
                         />
                         <label style={{ fontSize: '0.7rem', fontWeight: '800' }}>E-WALLET NUMBER</label>
                         <input
                           type="text"
                           value={pm.accountNumber}
                           placeholder="09XXXXXXXXX"
                           onChange={e => handlePaymentMethodChange(idx, 'accountNumber', e.target.value)}
                         />
                         <label style={{ fontSize: '0.7rem', fontWeight: '800' }}>QR IMAGE</label>
                         <input
                           type="file"
                           id={`payment-qr-${pm.id}`}
                           hidden
                           accept="image/*"
                           onChange={e => handlePaymentQrUpload(idx, e.target.files?.[0])}
                         />
                         <label htmlFor={`payment-qr-${pm.id}`} className="qr-upload-box">
                           {pm.qrUrl ? (
                             <img src={pm.qrUrl} alt={`${pm.method} QR`} className="payment-qr-preview" />
                           ) : (
                             <span className="qr-upload-placeholder"><ImagePlus size={18} /> Upload QR</span>
                           )}
                         </label>
                      </div>
                   </div>
                ))}
                <button className="save-all-btn" onClick={handleSavePaymentDetails}>Update Payment Details</button>
             </div>
          )}
        </section>
      </div>

      {/* Modal - Manage Listings */}
      {isManageModalOpen && (
        <div className="modal-overlay" onClick={() => setIsManageModalOpen(false)}>
          <div className="modal-content animate-slide-up admin-listings-modal" onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
               <h3 style={{ margin: 0 }}>Listings</h3>
               <button onClick={() => setIsManageModalOpen(false)} style={{ border: 'none', background: 'none' }}><X size={20}/></button>
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
