import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Users, BadgeCheck, Shield, Clock, Search, X, CheckCircle, Ban, ArrowLeft, RefreshCw, Star, LogOut } from 'lucide-react';
import './AdminPanel.css';

const AdminPanel = ({ onBack, onLogout }) => {
  const [activeTab, setActiveTab] = useState('landlords'); // 'landlords', 'requests', 'stats'
  const [landlords, setLandlords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [updatingId, setUpdatingId] = useState(null);

  // Mock data for verification requests and login stats until DB tables are ready
  const [verificationRequests, setVerificationRequests] = useState([]);

  useEffect(() => {
    fetchLandlords();
    fetchRequests();
  }, []);

  const fetchRequests = async () => {
    try {
      // Fetch all requests to show in Records, but filter for Pending in the summary
      const { data, error } = await supabase
        .from('verification_requests')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setVerificationRequests(data || []);
    } catch (error) {
      console.error('Error fetching requests:', error);
    }
  };

  const fetchLandlords = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('properties')
        .select('user_id, owner_name, email, contact, owner_avatar, owner_business_name, is_verified')
        .order('owner_name');

      if (error) throw error;

      const uniqueLandlords = [];
      const seen = new Set();
      data.forEach(item => {
        if (!seen.has(item.user_id)) {
          seen.add(item.user_id);
          uniqueLandlords.push({
            ...item,
            subscription_status: 'Active',
            expiry: '2026-07-15',
            login_count: Math.floor(Math.random() * 50) + 1 // New: Mocked login count
          });
        }
      });

      setLandlords(uniqueLandlords);
    } catch (error) {
      console.error('Error fetching landlords:', error);
      if (error.message?.includes('column')) {
        alert('Database Error: The "properties" table is missing columns (e.g. owner_business_name). Please check the SQL migration guide.');
      }
    } finally {
      setLoading(false);
    }
  };

  const toggleVerification = async (landlord) => {
    setUpdatingId(landlord.user_id);
    try {
      const newStatus = !landlord.is_verified;
      const { error } = await supabase
        .from('properties')
        .update({ is_verified: newStatus })
        .eq('user_id', landlord.user_id);

      if (error) throw error;

      setLandlords(prev => prev.map(l => 
        l.user_id === landlord.user_id ? { ...l, is_verified: newStatus } : l
      ));
    } catch (error) {
      console.error('Error toggling verification:', error);
    } finally {
      setUpdatingId(null);
    }
  };

  const approveRequest = async (request) => {
    setUpdatingId(request.user_id);
    try {
      // 1. Update properties table for this user
      const { error: propError } = await supabase
        .from('properties')
        .update({ is_verified: true })
        .eq('user_id', request.user_id);
      
      if (propError) throw propError;

      // 2. Mark request as approved
      const { error: reqError } = await supabase
        .from('verification_requests')
        .update({ status: 'approved' })
        .eq('id', request.id);

      if (reqError) throw reqError;

      // Update local state instead of filtering out
      setVerificationRequests(prev => prev.map(r => 
        r.id === request.id ? { ...r, status: 'approved' } : r
      ));
      
      fetchLandlords(); // Refresh landlord list to show the new checkmark
      alert('Verification Approved! Landlord is now Qualified.');
    } catch (error) {
      console.error('Error approving request:', error);
      alert(`Approval failed: ${error.message || 'Check your database columns and RLS policies.'}`);
    } finally {
      setUpdatingId(null);
    }
  };

  const filteredLandlords = landlords.filter(l => 
    l.owner_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    l.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    l.owner_business_name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalLogins = landlords.reduce((acc, curr) => acc + (curr.login_count || 0), 0);

  return (
    <div className="admin-panel animate-fade-in">
      <header className="admin-header">
        <button className="back-btn" onClick={onBack} title="Go Back"><ArrowLeft size={24} /></button>
        <div className="header-title">
          <Shield className="admin-icon" />
          <div>
            <h2>Admin Dashboard</h2>
            <p>System Management</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button className="admin-logout-btn" onClick={() => { fetchLandlords(); fetchRequests(); }} title="Refresh Data" style={{ background: 'rgba(0,51,102,0.05)', color: 'var(--primary)' }}>
            <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
          </button>
          <button className="admin-logout-btn" onClick={onLogout} title="Sign Out">
            <LogOut size={20} />
          </button>
        </div>
      </header>

      <div className="admin-stats">
        <div className="stat-card">
          <div className="icon-container-mini"><Users size={18} /></div>
          <div className="stat-info">
            <label>Total Landlords</label>
            <p>{landlords.length}</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="icon-container-mini secondary-icon"><Clock size={18} /></div>
          <div className="stat-info">
            <label>Pending</label>
            <p>{verificationRequests.filter(r => r.status === 'pending').length}</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="icon-container-mini" style={{ background: '#16a34a' }}><CheckCircle size={18} /></div>
          <div className="stat-info">
            <label>Total Logins</label>
            <p>{totalLogins}</p>
          </div>
        </div>
      </div>

      <div className="admin-tabs">
        <button 
          className={`tab-btn ${activeTab === 'landlords' ? 'active' : ''}`}
          onClick={() => setActiveTab('landlords')}
        >
          Landlords
        </button>
        <button 
          className={`tab-btn ${activeTab === 'requests' ? 'active' : ''}`}
          onClick={() => setActiveTab('requests')}
        >
          Pending <span className="tab-badge">{verificationRequests.filter(r => r.status === 'pending').length}</span>
        </button>
        <button 
          className={`tab-btn ${activeTab === 'records' ? 'active' : ''}`}
          onClick={() => setActiveTab('records')}
        >
          Records
        </button>
        <button 
          className={`tab-btn ${activeTab === 'stats' ? 'active' : ''}`}
          onClick={() => setActiveTab('stats')}
        >
          Login Stats
        </button>
      </div>

      <div className="admin-controls">
        {activeTab === 'landlords' && (
          <div className="admin-search">
            <Search size={20} />
            <input 
              type="text" 
              placeholder="Search landlords..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        )}
      </div>

      <main className="landlord-list">
        {loading ? (
          <div className="text-center py-10"><RefreshCw className="animate-spin" /> Fetching data...</div>
        ) : activeTab === 'landlords' ? (
          filteredLandlords.length === 0 ? (
            <div className="empty-state">No landlords found.</div>
          ) : (
            filteredLandlords.map(landlord => (
              <div key={landlord.user_id} className="landlord-admin-card shadow-sm">
                <div className="card-header">
                  <div className="landlord-profile-info">
                    {landlord.owner_avatar ? (
                      <img src={landlord.owner_avatar} alt="" className="admin-landlord-avatar" />
                    ) : (
                      <div className="admin-landlord-placeholder">
                        {landlord.owner_name?.charAt(0)}
                      </div>
                    )}
                    <div>
                      <h4 className="flex items-center gap-1">
                        {landlord.owner_name} 
                        {landlord.is_verified && <BadgeCheck size={16} className="verified-badge" />}
                      </h4>
                      <span className="business-name">{landlord.owner_business_name || 'Individual Owner'}</span>
                    </div>
                  </div>
                  <div className="status-tag active">Active</div>
                </div>

                <div className="card-details">
                  <div className="detail-item">
                    <label>Logins</label>
                    <span>{landlord.login_count}</span>
                  </div>
                  <div className="detail-item">
                    <label>Subscription</label>
                    <span style={{ color: '#059669' }}>{landlord.subscription_status}</span>
                  </div>
                </div>

                <div className="card-actions">
                  <button 
                    className={`admin-action-btn ${landlord.is_verified ? 'unverify' : 'verify'}`}
                    onClick={() => toggleVerification(landlord)}
                    disabled={updatingId === landlord.user_id}
                  >
                    {updatingId === landlord.user_id ? <RefreshCw className="animate-spin" size={16} /> : 
                     (landlord.is_verified ? <><Ban size={16} /> Unverify</> : <><CheckCircle size={16} /> Verify Account</>)}
                  </button>
                  <button className="admin-action-btn sub">
                    <Star size={16} /> Manage
                  </button>
                </div>
              </div>
            ))
          )
        ) : activeTab === 'requests' ? (
          verificationRequests.filter(r => r.status === 'pending').length === 0 ? (
            <div className="empty-state">No pending verification requests.</div>
          ) : (
            verificationRequests.filter(r => r.status === 'pending').map(req => (
              <div key={req.id} className="landlord-admin-card request-card shadow-sm" style={{ borderLeft: '4px solid var(--secondary)' }}>
                <div className="request-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <div className="request-user" style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <div className="admin-landlord-placeholder" style={{ width: '32px', height: '32px', fontSize: '0.9rem' }}>{req.full_name?.charAt(0)}</div>
                    <div>
                      <h4 style={{ fontSize: '0.95rem', margin: 0 }}>{req.full_name}</h4>
                      <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>{req.email}</p>
                    </div>
                  </div>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{new Date(req.created_at).toLocaleDateString()}</span>
                </div>
                <div className="request-body" style={{ padding: '8px 0', borderTop: '1px solid var(--border)' }}>
                  <p style={{ margin: '8px 0 4px', fontSize: '0.9rem' }}>Business/Property: <strong>{req.property_name}</strong></p>
                  <p style={{ margin: '0 0 8px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>Contact: {req.contact_number}</p>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-main)', margin: 0, padding: '8px', background: 'var(--background)', borderRadius: '8px', fontStyle: 'italic' }}>
                    "{req.message || 'No additional message provided.'}"
                  </p>
                </div>
                <div className="request-footer" style={{ marginTop: '16px', display: 'flex', gap: '8px' }}>
                  <button 
                    className="admin-action-btn verify" 
                    style={{ flex: 1, justifyContent: 'center' }}
                    onClick={() => approveRequest(req)}
                    disabled={updatingId === req.user_id}
                  >
                    {updatingId === req.user_id ? <RefreshCw className="animate-spin" size={16} /> : 'Qualified (Approve)'}
                  </button>
                  <button className="admin-action-btn unverify" style={{ flex: 1, justifyContent: 'center' }}>Decline</button>
                </div>
              </div>
            ))
          )
        ) : activeTab === 'records' ? (
          <div className="stats-view">
            <div className="stats-scroll">
              <table className="stats-table">
                <thead>
                  <tr>
                    <th>Landlord</th>
                    <th>Business</th>
                    <th>Date</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {verificationRequests.map(req => (
                    <tr key={req.id}>
                      <td>{req.full_name}</td>
                      <td>{req.property_name}</td>
                      <td>{new Date(req.created_at).toLocaleDateString()}</td>
                      <td>
                        <span className={`status-badge ${req.status}`}>
                          {req.status.charAt(0).toUpperCase() + req.status.slice(1)}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {verificationRequests.length === 0 && (
                    <tr><td colSpan="4" className="text-center py-4">No records found.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="stats-view">
            <div className="stats-scroll">
              <table className="stats-table">
                <thead>
                  <tr>
                    <th>Landlord</th>
                    <th>Recent Logins</th>
                    <th>Last Active</th>
                  </tr>
                </thead>
                <tbody>
                  {landlords.map(l => (
                    <tr key={l.user_id}>
                      <td>
                        <div className="stat-user">
                          {l.owner_name}
                          <span>{l.email}</span>
                        </div>
                      </td>
                      <td className="text-center font-bold">{l.login_count}</td>
                      <td className="text-muted text-sm">Today, 10:45 AM</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default AdminPanel;
