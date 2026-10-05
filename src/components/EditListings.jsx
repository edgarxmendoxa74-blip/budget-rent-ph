import React, { useState, useEffect } from 'react';
import { X, Edit3, Trash2, Loader2, Save, MapPin, Camera } from 'lucide-react';
import { supabase } from '../lib/supabase';
import LocationPicker from './LocationPicker';
import { toCoords } from '../lib/geo';
import './EditListings.css';
import { ikImage } from '../lib/imagekit';
import RoomFeeForm from './RoomFeeForm';
import StaycationExtras, { StayFeaturesSelect, MaxChildrenInput, stayPayload, STAY_COLUMNS, STAY_COLUMN_RE } from './StaycationExtras';
import { ConditionSelect, ConditionNotes, GenderSelect, genderPayload, RoomsFields, roomsPayload, conditionPayload, CONDITION_COLUMNS, CONDITION_COLUMN_RE } from './RentalCondition';
import { needsRoomFee, fetchRoomFeeStatus, ROOM_FEE_THRESHOLD, ROOM_FEE_PLAN } from '../lib/roomFee';

const CATEGORIES = ['Paupahan', 'Staycation'];
const normalizeCategory = (type) =>
  CATEGORIES.includes(type)
    ? type
    : String(type || '').toLowerCase().includes('staycation') ? 'Staycation' : 'Paupahan';

const isOccupiedItem = (item) => {
  const value = String(item?.availability || '').toLowerCase().trim();
  return value === 'occupied' || value === 'accommodated' || value === 'rented' || value === 'unavailable';
};

const EditListings = ({ session, onClose, onListingUpdated, initialEditingItem = null }) => {
  const [myListings, setMyListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingItem, setEditingItem] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [roomFeeStatus, setRoomFeeStatus] = useState(null); // 'approved' | 'pending' | null

  useEffect(() => {
    let alive = true;
    if (!editingItem?.id) { setRoomFeeStatus(null); return undefined; }
    fetchRoomFeeStatus(session?.user?.id, editingItem.id).then((s) => { if (alive) setRoomFeeStatus(s); });
    return () => { alive = false; };
  }, [editingItem?.id, session?.user?.id]);

  useEffect(() => {
    fetchMyListings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, initialEditingItem]);

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
      if (initialEditingItem) {
        const matchedItem = (data || []).find(item => item.id === initialEditingItem.id);
        setEditingItem({ ...(matchedItem || initialEditingItem), type: normalizeCategory((matchedItem || initialEditingItem).type) });
      }
    } catch (err) {
      console.error('Error:', err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = (item) => {
    setDeleteConfirm(item);
  };

  const handleConfirmDelete = async () => {
    if (!deleteConfirm) return;
    const id = deleteConfirm.id;
    setDeleting(id);
    try {
      const { error } = await supabase.from('properties').delete().eq('id', id);
      if (error) throw error;
      setMyListings(prev => prev.filter(p => p.id !== id));
      setDeleteConfirm(null);
      if (onListingUpdated) onListingUpdated();
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      setDeleting(null);
    }
  };

  const handleEdit = (item) => {
    setEditingItem({ ...item, type: normalizeCategory(item.type) });
  };

  const handleEditChange = (field, value) => {
    setEditingItem(prev => ({ ...prev, [field]: value }));
  };

  const handleToggleAvailability = async (item) => {
    const next = isOccupiedItem(item) ? 'Available' : 'Occupied';
    try {
      const { error } = await supabase
        .from('properties')
        .update({ availability: next })
        .eq('id', item.id);
      if (error) throw error;

      setMyListings(prev => prev.map(p => p.id === item.id ? { ...p, availability: next } : p));
      setEditingItem(prev => (prev && prev.id === item.id ? { ...prev, availability: next } : prev));
      if (onListingUpdated) onListingUpdated();
    } catch (err) {
      if (err?.code === '42703' || /availability/i.test(err?.message || '')) {
        alert('The "availability" column is missing in the database. Run the SQL migration in the Supabase SQL Editor first.');
      } else {
        alert('Error updating availability: ' + err.message);
      }
    }
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
    if (needsRoomFee(editingItem.rooms) && roomFeeStatus !== 'approved') {
      alert(roomFeeStatus === 'pending'
        ? 'Your ₱50 room fee receipt is still waiting for admin approval.'
        : `Listings with ${ROOM_FEE_THRESHOLD}+ rooms need the ₱${ROOM_FEE_PLAN.price} fee. Please pay and send your receipt first.`);
      return;
    }
    setSaving(true);
    try {
      const amenities = [];
      if (editingItem.wifi === 'Yes') amenities.push('WiFi');
      if (editingItem.parking === 'Yes') amenities.push('Parking');
      if (editingItem.cr === 'Private') amenities.push('Private CR');
      if (editingItem.secured === 'Yes') amenities.push('Secured');

      const payload = {
        name: editingItem.name,
        type: editingItem.type,
        price: parseFloat(editingItem.price || 0),
        advance_months: Math.max(0, parseInt(editingItem.advance_months ?? 1, 10) || 0),
        deposit_months: Math.max(0, parseInt(editingItem.deposit_months ?? 2, 10) || 0),
        location: editingItem.location,
        latitude: toCoords(editingItem)?.lat ?? null,
        longitude: toCoords(editingItem)?.lng ?? null,
        description: editingItem.description,
        contact: editingItem.contact,
        image: editingItem.image,
        wifi: editingItem.wifi,
        parking: editingItem.parking,
        cr: editingItem.cr,
        rooms: parseInt(editingItem.rooms || 1),
        secured: editingItem.secured,
        pets_allowed: /staycation/i.test(editingItem.type || '') ? (editingItem.pets_allowed || 'No') : 'No',
        down_payment: /staycation/i.test(editingItem.type || '') ? Math.max(0, parseFloat(editingItem.down_payment || 0) || 0) : 0,
        ...stayPayload(editingItem, /staycation/i.test(editingItem.type || '')),
        ...conditionPayload(editingItem, !/staycation/i.test(editingItem.type || '')),
        ...genderPayload(editingItem, !/staycation/i.test(editingItem.type || '')),
        ...roomsPayload(editingItem, !/staycation/i.test(editingItem.type || '')),
        kitchen: parseInt(editingItem.kitchen || 0),
        email: editingItem.email,
        availability: editingItem.availability || 'Available',
        amenities: amenities,
        owner_business_name: editingItem.owner_business_name,
        owner_facebook: editingItem.owner_facebook,
        owner_whatsapp: editingItem.owner_whatsapp
      };

      let { error } = await supabase
        .from('properties')
        .update(payload)
        .eq('id', editingItem.id);

      // Fallback kapag wala pa ang availability / latitude / longitude columns sa database
      if (error && (error.code === '42703' || /availability|latitude|longitude|pets_allowed|advance_months|deposit_months|down_payment/i.test(error.message || '') || STAY_COLUMN_RE.test(error.message || '') || CONDITION_COLUMN_RE.test(error.message || ''))) {
        const legacyPayload = { ...payload };
        STAY_COLUMNS.forEach((c) => delete legacyPayload[c]);
        CONDITION_COLUMNS.forEach((c) => delete legacyPayload[c]);
        delete legacyPayload.down_payment;
        delete legacyPayload.pets_allowed;
        delete legacyPayload.advance_months;
        delete legacyPayload.deposit_months;
        delete legacyPayload.availability;
        delete legacyPayload.latitude;
        delete legacyPayload.longitude;
        ({ error } = await supabase
          .from('properties')
          .update(legacyPayload)
          .eq('id', editingItem.id));
        if (!error) alert('Saved, but some details (guest limits, pets, down payment, etc.) could not be saved because the database is missing some columns. Please contact support.');
      }

      if (error) throw error;

      setMyListings(prev => prev.map(p => p.id === editingItem.id ? editingItem : p));
      setEditingItem(null);
      if (onListingUpdated) onListingUpdated();
      if (initialEditingItem) onClose();
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const isDirectEditMode = Boolean(initialEditingItem);

  return (
    <div className="edit-listings-overlay" onClick={onClose}>
      {!isDirectEditMode && (
      <div className="edit-listings-modal animate-slide-up" onClick={e => e.stopPropagation()}>
        
        <div className="edit-listings-top">
          <div className="edit-listings-header">
            <h2>My Listings</h2>
            <p>Manage your property listings.</p>
          </div>
          <button className="close-edit-btn" onClick={onClose}><X size={20} /></button>
        </div>

        <div className="edit-listings-body">
          {loading ? (
            <div className="edit-loading"><Loader2 className="animate-spin" size={32} /> Loading...</div>
          ) : myListings.length === 0 ? (
            <div className="edit-empty">
              <p>You don&apos;t have any listings yet. Add a property using the "+" button.</p>
            </div>
          ) : (
            <div className="my-listings-list">
              {myListings.map(item => (
                <div key={item.id} className="my-listing-item">
                  <div className="my-listing-img">
                    <img src={ikImage(item.image, 480) || '/placeholder.png'} alt={item.name} />
                  </div>
                  <div className="my-listing-info">
                    <div className="my-listing-title-row">
                      <h4>{item.name}</h4>
                      <span className="my-listing-type">{item.type === 'Paupahan' ? 'Rental' : item.type}</span>
                    </div>
                    <div className="my-listing-meta">
                      <MapPin size={12} /> <span>{item.location}</span>
                    </div>
                    <div className="my-listing-bottom-row">
                      <div className="my-listing-price">₱{item.price?.toLocaleString()}/mo</div>
                      <button
                        type="button"
                        className={`avail-toggle ${isOccupiedItem(item) ? 'occupied' : 'available'}`}
                        onClick={(e) => { e.stopPropagation(); handleToggleAvailability(item); }}
                        title="Toggle status: Available / Occupied"
                      >
                        {isOccupiedItem(item) ? 'Occupied' : 'Available'}
                      </button>
                    </div>
                  </div>
                  <div className="my-listing-actions">
                    <button className="edit-action-btn edit" onClick={() => handleEdit(item)}>
                      <Edit3 size={16} />
                    </button>
                    <button className="edit-action-btn delete" onClick={() => handleDelete(item)} disabled={deleting === item.id}>
                      {deleting === item.id ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      )}

      {/* Edit Form Modal - rendered outside the main modal */}
      {editingItem && (
        <div className="edit-form-overlay" onClick={(e) => { e.stopPropagation(); initialEditingItem ? onClose() : setEditingItem(null); }}>
          <div className="edit-form-content animate-slide-up" onClick={e => e.stopPropagation()}>
            <div className="edit-form-header">
              <h3>Edit Listing</h3>
              <button onClick={() => initialEditingItem ? onClose() : setEditingItem(null)}><X size={20} /></button>
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
                  <label>Category</label>
                  <select value={editingItem.type || 'Paupahan'} onChange={e => handleEditChange('type', e.target.value)}>
                    <option value="Paupahan">Rental</option>
                    <option>Staycation</option>
                  </select>
                </div>
                <div className="edit-form-group">
                  <label>{/staycation/i.test(editingItem.type || '') ? 'Price (₱/night)' : 'Price (₱/mo)'}</label>
                  <input type="number" value={editingItem.price || ''} onChange={e => handleEditChange('price', e.target.value)} />
                </div>
              </div>
              {/staycation/i.test(editingItem.type || '') ? (
              <div className="edit-form-group">
                <label>Down Payment (₱)</label>
                <input type="number" min="0" value={editingItem.down_payment ?? ''} onChange={e => handleEditChange('down_payment', e.target.value)} />
              </div>
              ) : (
              <div className="edit-form-row">
                <div className="edit-form-group">
                  <label>Advance (months)</label>
                  <select value={String(editingItem.advance_months ?? 1)} onChange={e => handleEditChange('advance_months', e.target.value)}>
                    {[0, 1, 2, 3, 4, 5, 6].map(n => <option key={n} value={n}>{n === 0 ? 'No advance' : `${n} month${n > 1 ? 's' : ''}`}</option>)}
                  </select>
                </div>
                <div className="edit-form-group">
                  <label>Deposit (months)</label>
                  <select value={String(editingItem.deposit_months ?? 2)} onChange={e => handleEditChange('deposit_months', e.target.value)}>
                    {[0, 1, 2, 3, 4, 5, 6].map(n => <option key={n} value={n}>{n === 0 ? 'No deposit' : `${n} month${n > 1 ? 's' : ''}`}</option>)}
                  </select>
                </div>
              </div>
              )}
              <div className="edit-form-group">
                <label>Location</label>
                <input value={editingItem.location || ''} placeholder="Barangay, Town/City, Province" onChange={e => handleEditChange('location', e.target.value)} />
              </div>
              <div className="edit-form-group">
                <label>Pin on Map</label>
                <LocationPicker
                  key={editingItem.id}
                  value={toCoords(editingItem)}
                  addressHint={editingItem.location}
                  onChange={(lat, lng) => setEditingItem(prev => ({ ...prev, latitude: lat, longitude: lng }))}
                />
              </div>
              <div className="edit-form-group">
                <label>Availability Status</label>
                <select value={editingItem.availability || 'Available'} onChange={e => handleEditChange('availability', e.target.value)}>
                  <option value="Available">Available — has vacancies</option>
                  {!/staycation/i.test(editingItem.type || '') && <option value="House only">Available — 1 house only</option>}
                  <option value="Occupied">Occupied — fully booked</option>
                </select>
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
                {/staycation/i.test(editingItem.type || '') && (
                  <MaxChildrenInput groupClass="edit-form-group" value={editingItem} onChange={(k, v) => handleEditChange(k, v)} />
                )}
                {!/staycation/i.test(editingItem.type || '') && (
                  <ConditionSelect groupClass="edit-form-group" value={editingItem} onChange={(k, v) => handleEditChange(k, v)} />
                )}
              </div>
              <div className="edit-form-row">
                <div className="edit-form-group">
                  <label>How many rooms?</label>
                  <input type="number" min="1" value={editingItem.rooms || 1} onChange={e => handleEditChange('rooms', e.target.value)} />
                </div>
                <div className="edit-form-group">
                  <label>Secured</label>
                  <select value={editingItem.secured || 'Yes'} onChange={e => handleEditChange('secured', e.target.value)}><option>Yes</option><option>No</option></select>
                </div>
                {/staycation/i.test(editingItem.type || '') && (
                  <div className="edit-form-group">
                    <label>Pets Allowed?</label>
                    <select value={editingItem.pets_allowed || 'No'} onChange={e => handleEditChange('pets_allowed', e.target.value)}><option>Yes</option><option>No</option></select>
                  </div>
                )}
                {/staycation/i.test(editingItem.type || '') && (
                  <StayFeaturesSelect groupClass="edit-form-group" value={editingItem} onChange={(k, v) => handleEditChange(k, v)} />
                )}
              </div>
              {!/staycation/i.test(editingItem.type || '') && (
                <div className="edit-form-row">
                  <RoomsFields groupClass="edit-form-group" value={editingItem} onChange={(k, v) => handleEditChange(k, v)} />
                </div>
              )}
              {!/staycation/i.test(editingItem.type || '') && (
                <ConditionNotes groupClass="edit-form-group" value={editingItem} onChange={(k, v) => handleEditChange(k, v)} />
              )}
              {/staycation/i.test(editingItem.type || '') && (
                <StaycationExtras groupClass="edit-form-group" value={editingItem} onChange={(k, v) => handleEditChange(k, v)} />
              )}
              {needsRoomFee(editingItem.rooms) && (
                roomFeeStatus === 'approved' ? (
                  <p style={{ margin: '0 0 12px', padding: '10px 12px', borderRadius: 12, background: '#f0fdf4', color: '#166534', fontSize: '0.8rem', fontWeight: 700 }}>Room fee paid and approved for this listing.</p>
                ) : roomFeeStatus === 'pending' ? (
                  <p style={{ margin: '0 0 12px', padding: '10px 12px', borderRadius: 12, background: '#fffbeb', color: '#92400e', fontSize: '0.8rem', fontWeight: 700 }}>Receipt sent. Waiting for admin approval, then you can save.</p>
                ) : (
                  <RoomFeeForm session={session} listing={editingItem} rooms={editingItem.rooms} onSubmitted={() => setRoomFeeStatus('pending')} />
                )
              )}
              <div className="edit-form-row">
                <div className="edit-form-group">
                  <label>Contact Info</label>
                  <input value={editingItem.contact || ''} onChange={e => handleEditChange('contact', e.target.value)} />
                </div>
                {!/staycation/i.test(editingItem.type || '') && (
                  <GenderSelect groupClass="edit-form-group" value={editingItem} onChange={(k, v) => handleEditChange(k, v)} />
                )}
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

      {/* Custom Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="modal-overlay centered" onClick={() => setDeleteConfirm(null)} style={{ zIndex: 3000 }}>
          <div className="modal-content success-modal animate-fade-in" onClick={e => e.stopPropagation()} style={{ maxWidth: '350px', padding: '30px', textAlign: 'center' }}>
            <div style={{ color: '#ef4444', marginBottom: '20px' }}>
              <Trash2 size={64} style={{ margin: '0 auto' }} />
            </div>
            <h3 style={{ fontSize: '1.25rem', marginBottom: '12px' }}>Are you sure?</h3>
            <p style={{ color: 'var(--text-muted)', marginBottom: '24px', fontSize: '0.95rem' }}>
              Do you really want to delete <strong>{deleteConfirm.name}</strong>? This action cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button 
                className="edit-action-btn" 
                style={{ flex: 1, margin: 0, background: '#f1f5f9', color: 'var(--text-main)', borderRadius: '12px' }}
                onClick={() => setDeleteConfirm(null)}
              >
                Cancel
              </button>
              <button 
                className="edit-action-btn" 
                style={{ flex: 1, margin: 0, background: '#ef4444', color: 'white', borderRadius: '12px' }}
                onClick={handleConfirmDelete}
                disabled={deleting === deleteConfirm.id}
              >
                {deleting === deleteConfirm.id ? <Loader2 className="animate-spin" size={20} /> : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EditListings;
