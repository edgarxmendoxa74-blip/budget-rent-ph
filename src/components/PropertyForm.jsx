import React, { useState, useEffect } from 'react';
import { X, Send, CheckCircle, Home, MapPin, Tag, Info, Shield, Zap, TrendingUp, Camera, Loader2, Image as ImageIcon } from 'lucide-react';
import { supabase } from '../lib/supabase';
import LocationPicker from './LocationPicker';
import StaycationExtras, { StayFeaturesSelect, MaxChildrenInput, stayPayload, STAY_COLUMNS, STAY_COLUMN_RE } from './StaycationExtras';
import { ConditionSelect, ConditionNotes, GenderSelect, genderPayload, RoomsFields, roomsPayload, conditionPayload, CONDITION_COLUMNS, CONDITION_COLUMN_RE } from './RentalCondition';
import { countMyListings, fetchMyPlan, listingLimitFor, isProActive, isLimitError, PRO_PLAN, PRO_LISTING_LIMIT, FREE_LISTING_LIMIT } from '../lib/listingPlan';
import './PropertyForm.css';

const PropertyForm = ({ onClose, session, onListingAdded, onUpgrade }) => {
  const [submitted, setSubmitted] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    type: 'Paupahan',
    price: '',
    availability: 'Available',
    advanceMonths: '1',
    depositMonths: '2',
    location: '',
    description: '',
    contact: session?.user?.user_metadata?.phone || '',
    wifi: 'No',
    parking: 'No',
    cr: 'Shared',
    rooms: '1',
    secured: 'Yes',
    petsAllowed: 'No',
    downPayment: '',
    max_adults: '',
    max_children: '',
    stay_features: [],
    house_rules: '',
    cancellation_policy: '',
    house_condition: '',
    condition_notes: '',
    allowed_gender: 'both',
    rental_mode: 'rooms',
    occupied_rooms: 0,
    kitchen: '0',
    email: session?.user?.user_metadata?.business_email || session?.user?.email || '',
    ownerBusinessName: session?.user?.user_metadata?.property_name || '',
    ownerFacebook: session?.user?.user_metadata?.facebook || '',
    ownerWhatsapp: session?.user?.user_metadata?.whatsapp || ''
  });
  const [image, setImage] = useState(null);
  const [coords, setCoords] = useState(null);
  const [isVerified, setIsVerified] = useState(false);
  // Libre ang 5 listings; 6-10 ay para sa Pro Listings plan. { count, limit, pro } o null habang nilo-load
  const [limitInfo, setLimitInfo] = useState(null);

  useEffect(() => {
    const uid = session?.user?.id;
    if (!uid) return undefined;
    let alive = true;
    Promise.all([countMyListings(uid), fetchMyPlan(uid)]).then(([count, plan]) => {
      if (alive) setLimitInfo({ count, limit: listingLimitFor(plan), pro: isProActive(plan) });
    });
    return () => { alive = false; };
  }, [session?.user?.id]);

  const getVerificationRow = async () => {
    // Standard query for landlord verification status
    // Requesting only is_verified first to avoid 400 errors if subscription_expiry is missing
    const { data, error } = await supabase
      .from('properties')
      .select('is_verified')
      .eq('user_id', session.user.id)
      .limit(1);

    if (error) throw error;
    return { data, error: null };
  };

  // Sync session data if it changes
  useEffect(() => {
    if (session?.user?.id) {
      getVerificationRow().then(async ({ data, error }) => {
         if (error) throw error;
         const latestProperty = data?.[0];
         if (!latestProperty) return;

         const isExpired = latestProperty.subscription_expiry && new Date(latestProperty.subscription_expiry) < new Date();
         if (latestProperty.is_verified && isExpired) {
           setIsVerified(false);
           await supabase
             .from('properties')
             .update({ is_verified: false, subscription_status: 'Expired' })
             .eq('user_id', session.user.id);
           return;
         }

         if (latestProperty.is_verified) setIsVerified(true);
      }).catch((err) => {
        console.error('Error checking property verification:', err);
      });
    }

    if (session?.user?.user_metadata) {
      setFormData(prev => ({
        ...prev,
        contact: prev.contact || session.user.user_metadata.phone || '',
        email: prev.email || session.user.user_metadata.business_email || session.user.email || '',
        ownerBusinessName: prev.ownerBusinessName || session.user.user_metadata.property_name || '',
        ownerFacebook: prev.ownerFacebook || session.user.user_metadata.facebook || '',
        ownerWhatsapp: prev.ownerWhatsapp || session.user.user_metadata.whatsapp || ''
      }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
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

      setImage(publicUrl);
    } catch (error) {
      alert('Error: ' + error.message);
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!session?.user) return alert('You need to be logged in!');
    if (!image) return alert('Please upload a photo of your property first!');
    if (!coords) return alert('Please pin the property location on the map first so tenants can find it on the radar.');
    
    setLoading(true);
    
    try {
      const amenities = [];
      if (formData.wifi === 'Yes') amenities.push('WiFi');
      if (formData.parking === 'Yes') amenities.push('Parking');
      if (formData.cr === 'Private') amenities.push('Private CR');
      if (formData.secured === 'Yes') amenities.push('Secured');

      const payload = {
        name: formData.name,
        type: formData.type,
        price: parseFloat(formData.price || 0),
        availability: formData.availability || 'Available',
        advance_months: parseInt(formData.advanceMonths || 1),
        deposit_months: parseInt(formData.depositMonths || 2),
        location: formData.location,
        latitude: coords.lat,
        longitude: coords.lng,
        description: formData.description,
        contact: formData.contact,
        image: image || '/placeholder.png',
        wifi: formData.wifi,
        parking: formData.parking,
        cr: formData.cr,
        rooms: parseInt(formData.rooms || 1),
        secured: formData.secured,
        pets_allowed: formData.type === 'Staycation' ? formData.petsAllowed : 'No',
        down_payment: formData.type === 'Staycation' ? Math.max(0, parseFloat(formData.downPayment || 0) || 0) : 0,
        ...stayPayload(formData, formData.type === 'Staycation'),
        ...conditionPayload(formData, formData.type !== 'Staycation'),
        ...genderPayload(formData, formData.type !== 'Staycation'),
        ...roomsPayload(formData, formData.type !== 'Staycation'),
        kitchen: parseInt(formData.kitchen || 0),
        email: formData.email,
        amenities: amenities,
        user_id: session.user.id,
        is_verified: isVerified,
        owner_name: session.user.user_metadata?.full_name || 'Landlord',
        owner_avatar: session.user.user_metadata?.avatar_url || '',
        owner_business_name: formData.ownerBusinessName,
        owner_facebook: formData.ownerFacebook,
        owner_whatsapp: formData.ownerWhatsapp
      };

      let { error } = await supabase.from('properties').insert(payload);

      // Fallback kapag wala pa ang availability / latitude / longitude columns sa database
      if (error && (error.code === '42703' || /availability|latitude|longitude|pets_allowed|down_payment/i.test(error.message || '') || STAY_COLUMN_RE.test(error.message || '') || CONDITION_COLUMN_RE.test(error.message || ''))) {
        const legacyPayload = { ...payload };
        STAY_COLUMNS.forEach((c) => delete legacyPayload[c]);
        CONDITION_COLUMNS.forEach((c) => delete legacyPayload[c]);
        delete legacyPayload.pets_allowed;
        delete legacyPayload.down_payment;
        delete legacyPayload.availability;
        delete legacyPayload.latitude;
        delete legacyPayload.longitude;
        console.warn('Missing map columns; run supabase/migrations/add_property_coordinates.sql');
        ({ error } = await supabase.from('properties').insert(legacyPayload));
      }

      if (error) throw error;
      
      setSubmitted(true);
      if (onListingAdded) onListingAdded();
    } catch (error) {
      console.error('Save error:', error);
      if (isLimitError(error)) {
        setLimitInfo((info) => ({ count: info?.limit ?? FREE_LISTING_LIMIT, limit: info?.limit ?? FREE_LISTING_LIMIT, pro: Boolean(info?.pro) }));
      } else if (error.message?.includes('column')) {
        alert('Database Error: Some columns are missing in the Supabase "properties" table. Please run the migration SQL provided in the fix plan.');
      } else {
        alert('Error saving listing: ' + error.message);
      }
    } finally {
      setLoading(false);
    }
  };

  // Naabot na ang limit: ipakita ang upgrade (o ang max) sa halip na ang form
  if (limitInfo && limitInfo.count >= limitInfo.limit) {
    const atMax = limitInfo.limit >= PRO_LISTING_LIMIT;
    return (
      <div className="modal-overlay centered" onClick={onClose}>
        <div className="modal-content property-modal success-modal animate-fade-in" onClick={e => e.stopPropagation()}>
          <div className="success-view">
            <Info size={56} className="success-icon" />
            <h2>{atMax ? 'You’ve reached 10 listings' : `You’ve used your ${FREE_LISTING_LIMIT} free listings`}</h2>
            <p>
              {atMax
                ? 'Pro Listings allows up to 10 properties. Need more? Contact us through Customer Support and we’ll help you.'
                : `Get ${PRO_PLAN.label} for ₱${PRO_PLAN.price} per ${PRO_PLAN.note} to list up to ${PRO_LISTING_LIMIT} properties. Your first ${FREE_LISTING_LIMIT} listings stay free.`}
            </p>
            {!atMax && onUpgrade && (
              <button className="done-btn" onClick={onUpgrade}>Get Pro Listings — ₱{PRO_PLAN.price} / {PRO_PLAN.note}</button>
            )}
            <button className="done-btn" style={{ marginTop: 10, background: '#eef2f7', color: '#334155' }} onClick={onClose}>Close</button>
          </div>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="modal-overlay centered" onClick={onClose}>
        <div className="modal-content property-modal success-modal animate-fade-in" onClick={e => e.stopPropagation()}>
          <div className="success-view">
            <CheckCircle size={64} className="success-icon" />
            <h2>All set!</h2>
            <p>We&apos;ve received your property listing and it&apos;s now going through a quick validation. We&apos;ll get back to you soon!</p>
            <button className="done-btn" onClick={onClose}>Back to Home</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content animate-slide-up property-modal" onClick={e => e.stopPropagation()}>
        <button className="close-btn" onClick={onClose}><X size={24} /></button>
        
        <div className="modal-header-section">
          <span className="badge">Landlord Portal</span>
          <h2>List your Property</h2>
          <p>Let us help you find new tenants for your rental.</p>
        </div>

        <div className="form-grid">
           {/* Benefits Section (unchanged) */}
           <div className="benefits-section">
            <h3>Why list here?</h3>
            <div className="benefit-item">
              <Zap size={20} />
              <div>
                <strong>Fast Visibility</strong>
                <p>Thousands of students and professionals search here every day.</p>
              </div>
            </div>
            <div className="benefit-item">
              <Shield size={20} />
              <div>
                <strong>Zero Commission</strong>
                <p>All earnings go directly to you. No hidden charges.</p>
              </div>
            </div>
            <div className="benefit-item">
              <TrendingUp size={20} />
              <div>
                <strong>Easy Management</strong>
                <p>Our platform is simple and straightforward for owners.</p>
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="property-listing-form">
            <div className="form-group">
              <label>Property Name</label>
              <input name="name" placeholder="e.g. Budget Dorm Room 101" required onChange={handleChange} />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Category</label>
                <select name="type" value={formData.type} onChange={handleChange}>
                  <option value="Paupahan">Rental</option>
                  <option>Staycation</option>
                </select>
              </div>
              <div className="form-group">
                <label>{formData.type === 'Staycation' ? 'Price per Night (₱)' : 'Monthly Price (₱)'}</label>
                <input name="price" type="number" placeholder="5000" required onChange={handleChange} />
              </div>
            </div>

            {formData.type === 'Staycation' && (
              <div className="form-group">
                <label>Down Payment (₱)</label>
                <input name="downPayment" type="number" min="0" placeholder="1000" value={formData.downPayment} onChange={handleChange} />
              </div>
            )}

            <div className="form-group">
              <label>Location</label>
              <input name="location" placeholder="Barangay, Town/City, Province (e.g. Bonuan, Dagupan, Pangasinan)" required onChange={handleChange} />
              <span className="upload-hint">Include the town and province so tenants searching that area can find you.</span>
            </div>

            <div className="form-group">
              <label>Pin on Map <span style={{ color: '#ef4444' }}>(Required)</span></label>
              <LocationPicker
                value={coords}
                addressHint={formData.location}
                onChange={(lat, lng) => setCoords({ lat, lng })}
              />
            </div>

            <div className="form-group">
              <label>Availability Status</label>
              <select name="availability" value={formData.availability} onChange={handleChange}>
                <option value="Available">Available — has vacancies</option>
                {formData.type !== 'Staycation' && <option value="House only">Available — 1 house only</option>}
                <option value="Occupied">Occupied — fully booked</option>
              </select>
              <span className="upload-hint">Update this when the unit fills up or becomes vacant.</span>
            </div>

            <div className="form-group image-upload-group">
               <label>Main Property Image <span style={{ color: '#ef4444' }}>(Required)</span></label>
               <span className="upload-hint">Upload a clear photo so tenants notice your listing more easily.</span>
               <div className="image-upload-container">
                  <input type="file" id="prop-image" accept="image/*" hidden onChange={handleImageUpload} disabled={uploading} />
                  <label htmlFor="prop-image" className={`upload-box ${uploading ? 'disabled' : ''}`}>
                    {uploading ? <Loader2 className="animate-spin" /> : (
                      image ? (
                        <div className="preview-single">
                           <img src={image} alt="preview" />
                           <div className="change-overlay"><Camera size={16} /> Tap to change</div>
                        </div>
                      ) : (
                        <><Camera size={24} /> <span>Upload Image</span></>
                      )
                    )}
                  </label>
               </div>
            </div>

            <div className="amenities-form-grid">
              <div className="form-group">
                <label>WiFi</label>
                <select name="wifi" value={formData.wifi} onChange={handleChange}>
                  <option>Yes</option>
                  <option>No</option>
                </select>
              </div>
              <div className="form-group">
                <label>Parking</label>
                <select name="parking" value={formData.parking} onChange={handleChange}>
                  <option>Yes</option>
                  <option>No</option>
                </select>
              </div>
              <div className="form-group">
                <label>CR (Bathroom)</label>
                <select name="cr" value={formData.cr} onChange={handleChange}>
                  <option>Shared</option>
                  <option>Private</option>
                </select>
              </div>
              {formData.type !== 'Staycation' && (
                <RoomsFields value={formData} onChange={(k, v) => setFormData((prev) => ({ ...prev, [k]: v }))} />
              )}
              {formData.type === 'Staycation' && (
                <MaxChildrenInput value={formData} onChange={(k, v) => setFormData((prev) => ({ ...prev, [k]: v }))} />
              )}
              {formData.type !== 'Staycation' && (
                <ConditionSelect value={formData} onChange={(k, v) => setFormData((prev) => ({ ...prev, [k]: v }))} selectProps={{ name: 'house_condition' }} />
              )}
              <div className="form-group">
                <label>Rooms</label>
                <input type="number" name="rooms" min="1" value={formData.rooms} onChange={handleChange} />
              </div>
              <div className="form-group">
                <label>Secured/Gated</label>
                <select name="secured" value={formData.secured} onChange={handleChange}>
                  <option>Yes</option>
                  <option>No</option>
                </select>
              </div>
              <div className="form-group">
                <label>Kitchen</label>
                <input type="number" name="kitchen" min="0" value={formData.kitchen} onChange={handleChange} placeholder="0" />
              </div>
              {formData.type === 'Staycation' && (
                <div className="form-group">
                  <label>Pets Allowed?</label>
                  <select name="petsAllowed" value={formData.petsAllowed} onChange={handleChange}>
                    <option value="No">No</option>
                    <option value="Yes">Yes</option>
                  </select>
                </div>
              )}
              {formData.type === 'Staycation' && (
                <StayFeaturesSelect value={formData} onChange={(k, v) => setFormData((prev) => ({ ...prev, [k]: v }))} />
              )}
            </div>

            {formData.type !== 'Staycation' && (
              <ConditionNotes value={formData} onChange={(k, v) => setFormData((prev) => ({ ...prev, [k]: v }))} />
            )}

            {formData.type === 'Staycation' && (
              <StaycationExtras value={formData} onChange={(k, v) => setFormData((prev) => ({ ...prev, [k]: v }))} />
            )}

            <div className="form-group">
              <label>Additional Description</label>
              <textarea name="description" placeholder="Other rules or details..." rows="2" required onChange={handleChange}></textarea>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Contact Info (Phone/Messenger)</label>
                <input name="contact" placeholder="09XX XXX XXXX" required onChange={handleChange} />
              </div>
              {formData.type !== 'Staycation' && (
                <GenderSelect value={formData} onChange={(k, v) => setFormData((prev) => ({ ...prev, [k]: v }))} selectProps={{ name: 'allowed_gender' }} />
              )}
            </div>

            <div className="form-group">
              <label>Email Address</label>
              <input name="email" type="email" placeholder="owner@email.com" required onChange={handleChange} />
            </div>

            <button type="submit" className="submit-listing-btn" disabled={uploading || loading}>
              {loading ? <Loader2 className="animate-spin" /> : 'Submit Listing'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};


export default PropertyForm;
