import React, { useState, useEffect } from 'react';
import { X, Edit3, Trash2, Loader2, Save, MapPin, Camera } from 'lucide-react';
import { supabase } from '../lib/supabase';
import './EditListings.css';

const EditListings = ({ session, onClose, onListingUpdated }) => {
  const [myListings, setMyListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingItem, setEditingItem] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    fetchMyListings();
  }, []);

  const fetchMyListings = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('properties')
        .select('*')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setMyListings(data || []);
    } catch (err) {
      console.error('Error:', err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this listing permanently?')) return;
    setDeleting(id);
    try {
      const { error } = await supabase.from('properties').delete().eq('id', id);
      if (error) throw error;
      setMyListings(prev => prev.filter(p => p.id !== id));
      if (onListingUpdated) onListingUpdated();
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      setDeleting(null);
    }
  };

  const handleEdit = (item) => {
    setEditingItem({ ...item });
  };

  const handleEditChange = (field, value) => {
    setEditingItem(prev => ({ ...prev, [field]: value }));
  };

  const handleImageUpload = async (e) => {
    try {
      setUploading(true);
      const file = e.target.files[0];
      if (!file) return;
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random()}-${Date.now()}.${fileExt}`;
      const filePath = `properties/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file);
      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      handleEditChange('image', publicUrl);
    } catch (error) {
      alert('Error: ' + error.message);
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const amenities = [];
      if (editingItem.wifi === 'Yes') amenities.push('WiFi');
      if (editingItem.parking === 'Yes') amenities.push('Parking');
      if (editingItem.cr === 'Private') amenities.push('Private CR');
      if (editingItem.secured === 'Yes') amenities.push('Secured');

      const { error } = await supabase
        .from('properties')
        .update({
          name: editingItem.name,
          type: editingItem.type,
          price: parseFloat(editingItem.price),
          location: editingItem.location,
          description: editingItem.description,
          contact: editingItem.contact,
          image: editingItem.image,
          wifi: editingItem.wifi,
          parking: editingItem.parking,
          cr: editingItem.cr,
          rooms: parseInt(editingItem.rooms),
          secured: editingItem.secured,
          kitchen: parseInt(editingItem.kitchen),
          email: editingItem.email,
          amenities: amenities,
        })
        .eq('id', editingItem.id);
      if (error) throw error;

      setMyListings(prev => prev.map(p => p.id === editingItem.id ? editingItem : p));
      setEditingItem(null);
      if (onListingUpdated) onListingUpdated();
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="edit-listings-overlay" onClick={onClose}>
      <div className="edit-listings-modal animate-slide-up" onClick={e => e.stopPropagation()}>
        
        <div className="edit-listings-top">
          <div className="edit-listings-header">
            <h2>My Listings</h2>
            <p>I-manage ang iyong mga property listings.</p>
          </div>
          <button className="close-edit-btn" onClick={onClose}><X size={20} /></button>
        </div>

        <div className="edit-listings-body">
          {loading ? (
            <div className="edit-loading"><Loader2 className="animate-spin" size={32} /> Loading...</div>
          ) : myListings.length === 0 ? (
            <div className="edit-empty">
              <p>Wala ka pang listings. Mag-add ng property gamit ang "+" button.</p>
            </div>
          ) : (
            <div className="my-listings-list">
              {myListings.map(item => (
                <div key={item.id} className="my-listing-item">
                  <div className="my-listing-img">
                    <img src={item.image || '/placeholder.png'} alt={item.name} />
                  </div>
                  <div className="my-listing-info">
                    <h4>{item.name}</h4>
                    <span className="my-listing-type">{item.type}</span>
                    <div className="my-listing-meta">
                      <MapPin size={12} /> {item.location}
                    </div>
                    <div className="my-listing-price">₱{item.price?.toLocaleString()}/mo</div>
                  </div>
                  <div className="my-listing-actions">
                    <button className="edit-action-btn edit" onClick={() => handleEdit(item)}>
                      <Edit3 size={16} />
                    </button>
                    <button className="edit-action-btn delete" onClick={() => handleDelete(item.id)} disabled={deleting === item.id}>
                      {deleting === item.id ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Edit Form Modal - rendered outside the main modal */}
      {editingItem && (
        <div className="edit-form-overlay" onClick={(e) => { e.stopPropagation(); setEditingItem(null); }}>
          <div className="edit-form-content animate-slide-up" onClick={e => e.stopPropagation()}>
            <div className="edit-form-header">
              <h3>Edit Listing</h3>
              <button onClick={() => setEditingItem(null)}><X size={20} /></button>
            </div>
            <div className="edit-form-body">
              <div className="edit-form-image">
                {editingItem.image && <img src={editingItem.image} alt="preview" />}
                <input type="file" id="edit-img" accept="image/*" hidden onChange={handleImageUpload} disabled={uploading} />
                <label htmlFor="edit-img" className="change-image-btn">
                  {uploading ? <Loader2 size={14} className="animate-spin" /> : <><Camera size={14} /> Change Photo</>}
                </label>
              </div>
              <div className="edit-form-group">
                <label>Property Name</label>
                <input value={editingItem.name || ''} onChange={e => handleEditChange('name', e.target.value)} />
              </div>
              <div className="edit-form-row">
                <div className="edit-form-group">
                  <label>Type</label>
                  <select value={editingItem.type} onChange={e => handleEditChange('type', e.target.value)}>
                    <option>Boarding House</option>
                    <option>Bed Space</option>
                    <option>Apartment</option>
                    <option>Studio</option>
                  </select>
                </div>
                <div className="edit-form-group">
                  <label>Price (₱/mo)</label>
                  <input type="number" value={editingItem.price || ''} onChange={e => handleEditChange('price', e.target.value)} />
                </div>
              </div>
              <div className="edit-form-group">
                <label>Location</label>
                <input value={editingItem.location || ''} onChange={e => handleEditChange('location', e.target.value)} />
              </div>
              <div className="edit-form-group">
                <label>Description</label>
                <textarea value={editingItem.description || ''} rows={3} onChange={e => handleEditChange('description', e.target.value)} />
              </div>
              <div className="edit-form-row">
                <div className="edit-form-group">
                  <label>WiFi</label>
                  <select value={editingItem.wifi || 'No'} onChange={e => handleEditChange('wifi', e.target.value)}><option>Yes</option><option>No</option></select>
                </div>
                <div className="edit-form-group">
                  <label>Parking</label>
                  <select value={editingItem.parking || 'No'} onChange={e => handleEditChange('parking', e.target.value)}><option>Yes</option><option>No</option></select>
                </div>
                <div className="edit-form-group">
                  <label>CR</label>
                  <select value={editingItem.cr || 'Shared'} onChange={e => handleEditChange('cr', e.target.value)}><option>Shared</option><option>Private</option></select>
                </div>
              </div>
              <div className="edit-form-row">
                <div className="edit-form-group">
                  <label>Rooms</label>
                  <input type="number" min="1" value={editingItem.rooms || 1} onChange={e => handleEditChange('rooms', e.target.value)} />
                </div>
                <div className="edit-form-group">
                  <label>Secured</label>
                  <select value={editingItem.secured || 'Yes'} onChange={e => handleEditChange('secured', e.target.value)}><option>Yes</option><option>No</option></select>
                </div>
              </div>
              <div className="edit-form-group">
                <label>Contact Info</label>
                <input value={editingItem.contact || ''} onChange={e => handleEditChange('contact', e.target.value)} />
              </div>
              <div className="edit-form-group">
                <label>Email Address</label>
                <input type="email" value={editingItem.email || ''} onChange={e => handleEditChange('email', e.target.value)} />
              </div>
              <button className="save-edit-btn" onClick={handleSave} disabled={saving}>
                {saving ? <Loader2 size={18} className="animate-spin" /> : <><Save size={18} /> Save Changes</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EditListings;
