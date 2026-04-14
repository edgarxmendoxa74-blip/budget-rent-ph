import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { 
  Users, ClipboardList, TrendingUp, Shield, LogOut, Search, 
  MapPin, Check, X, Building2, Trash2, Wifi, Star, CreditCard,
  Settings, Zap, BarChart3, Clock, Mail, Phone, Award, AlertCircle, RefreshCw
} from 'lucide-react';
import './AdminPanel.css';

const AdminPanel = ({ onBack, onLogout }) => {
  const [activeTab, setActiveTab] = useState('analytics'); 
  const [paymentMethods, setPaymentMethods] = useState([
    { id: 1, method: 'GCash', name: 'EDGAR M.', number: '09171234567', qrUrl: 'https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=GCash-09171234567' },
    { id: 2, method: 'Maya', name: 'EDGAR M.', number: '09171234567', qrUrl: 'https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=Maya-09171234567' },
    { id: 3, method: 'Bank Transfer', name: 'EDGAR M.', number: '1234-5678-90', qrUrl: '' }
  ]);
  
  const [landlords, setLandlords] = useState([]);
  const [tenants, setTenants] = useState([]);
  const [verificationRequests, setVerificationRequests] = useState([]);
  const [allProperties, setAllProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Modals state
  const [isManageModalOpen, setIsManageModalOpen] = useState(false);
  const [selectedLandlordListings, setSelectedLandlordListings] = useState([]);
  const [updatingId, setUpdatingId] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  const handleFixConnection = async () => {
    const adminBypass = localStorage.getItem('budgetrent_admin_bypass');
    await supabase.auth.signOut();
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith('sb-')) localStorage.removeItem(key);
    });
    if (adminBypass) localStorage.setItem('budgetrent_admin_bypass', adminBypass);
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

      // Create a unique list of landlords from listings, prioritizing those with avatars
      const landlordMap = {};
      
      (propData || []).forEach(p => {
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
        // Specific Fallback Avatars for different accounts to ensure they look magkaiba (different)
        if (!l.owner_avatar) {
          if (l.email === 'edgarxmendoxa74@gmail.com') {
            l.owner_avatar = 'https://ui-avatars.com/api/?name=Edgar+M&background=003366&color=fff&bold=true';
          } else if (l.email === 'mendozajakong@gmail.com') {
            l.owner_avatar = 'https://ui-avatars.com/api/?name=Mendoza+J&background=FFD700&color=003366&bold=true';
          } else {
            l.owner_avatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(l.owner_name)}&background=random`;
          }
        }

        if (l.subscription_expiry && new Date(l.subscription_expiry) < now && l.is_verified) {
          // Push the deactivation to Supabase (fire and forget)
          supabase.from('properties').update({ is_verified: false }).eq('email', l.email);
          return { ...l, is_verified: false, subscription_status: 'Expired' };
        }
        return l;
      });

      // Also update allProperties to reflect expired badges
      const checkedProperties = (propData || []).map(p => {
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

  const handleAdminDeleteProperty = async (propertyId) => {
    if (!window.confirm("Are you sure you want to permanently delete this listing?")) return;
    try {
      const { error } = await supabase.from('properties').delete().eq('id', propertyId);
      if (error) throw error;
      
      // Update states
      setAllProperties(prev => prev.filter(p => p.id !== propertyId));
      setSelectedLandlordListings(prev => prev.filter(p => p.id !== propertyId));
      alert("Listing deleted successfully!");
    } catch (err) {
      alert("Error deleting property: " + err.message);
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
          <button className={activeTab === 'requests' ? 'active' : ''} onClick={() => setActiveTab('requests')}><ClipboardList size={18}/> Pending Requests <span className="badge-count">{verificationRequests.filter(r => r.status === 'pending').length}</span></button>
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
                      <div><label>Active Badges</label><h3>{landlords.filter(l => l.is_verified).length}</h3></div>
                   </div>
                </div>
                <div className="stat-row" style={{ marginTop: '20px' }}>
                   <div className="stat-card white">
                      <Building2 size={24} color="#003366" />
                      <div><label>Total Listings</label><h3>{allProperties.length}</h3></div>
                   </div>
                   <div className="stat-card navy">
                      <RefreshCw size={24} color="#FFD700" />
                      <div><label>Pending Requests</label><h3>{verificationRequests.filter(r => r.status === 'pending').length}</h3></div>
                   </div>
                </div>
             </div>
          )}

          {activeTab === 'landlords' && (
            <div className="landlord-grid">
              {landlords.filter(l => (l.owner_name || l.email)?.toLowerCase().includes(searchQuery.toLowerCase())).map(l => (
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
                    <div className="stat-item"><span>Listings</span><strong>{allProperties.filter(p => p.email === l.email).length}</strong></div>
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
                    {landlords.filter(l => (l.owner_name || l.email)?.toLowerCase().includes(searchQuery.toLowerCase())).map(l => (
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
              {verificationRequests.filter(r => r.status === 'pending').map(req => {
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
                         <label style={{ fontSize: '0.7rem', fontWeight: '800' }}>ACCOUNT NUMBER</label>
                         <input type="text" value={pm.number} onChange={e => {
                           const n = [...paymentMethods]; n[idx].number = e.target.value; setPaymentMethods(n);
                         }} />
                      </div>
                   </div>
                ))}
                <button className="save-all-btn" onClick={() => alert('Saved!')}>Update Payment Details</button>
             </div>
          )}
        </section>
      </div>

      {/* Modal - Manage Listings */}
      {isManageModalOpen && (
        <div className="modal-overlay" onClick={() => setIsManageModalOpen(false)}>
          <div className="modal-content animate-slide-up" style={{ width: '400px', padding: '24px' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
               <h3 style={{ margin: 0 }}>Listings</h3>
               <button onClick={() => setIsManageModalOpen(false)} style={{ border: 'none', background: 'none' }}><X size={20}/></button>
            </div>
            <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
              {selectedLandlordListings.length === 0 ? (
                <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '20px' }}>No properties found for this landlord.</div>
              ) : (
                selectedLandlordListings.map(item => (
                  <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '12px', borderBottom: '1px solid #f1f5f9' }}>
                     <div><strong>{item.name || item.title}</strong></div>
                     <button className="delete-btn" onClick={() => handleAdminDeleteProperty(item.id)}><Trash2 size={16}/></button>
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
