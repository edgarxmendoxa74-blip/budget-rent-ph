import React, { useState, useEffect } from 'react';
import { X, Send, CheckCircle, Home, MapPin, Tag, Info, Shield, Zap, TrendingUp, Camera, Loader2, Image as ImageIcon } from 'lucide-react';
import { supabase } from '../lib/supabase';
import './PropertyForm.css';

const PropertyForm = ({ onClose, session, onListingAdded }) => {
  const [submitted, setSubmitted] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    type: 'Boarding House',
    price: '',
    location: '',
    description: '',
    contact: session?.user?.user_metadata?.phone || '',
    wifi: 'No',
    parking: 'No',
    cr: 'Shared',
    rooms: '1',
    secured: 'Yes',
    kitchen: '0',
    email: session?.user?.user_metadata?.business_email || session?.user?.email || '',
    ownerBusinessName: session?.user?.user_metadata?.property_name || '',
    ownerFacebook: session?.user?.user_metadata?.facebook || '',
    ownerWhatsapp: session?.user?.user_metadata?.whatsapp || ''
  });
  const [image, setImage] = useState(null);

  // Sync session data if it changes
  useEffect(() => {
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
    if (!session?.user) return alert('Dapat kang naka-log in!');
    
    setLoading(true);
    
    try {
      const amenities = [];
      if (formData.wifi === 'Yes') amenities.push('WiFi');
      if (formData.parking === 'Yes') amenities.push('Parking');
      if (formData.cr === 'Private') amenities.push('Private CR');
      if (formData.secured === 'Yes') amenities.push('Secured');

      const { error } = await supabase
        .from('properties')
        .insert({
          name: formData.name,
          type: formData.type,
          price: parseFloat(formData.price),
          location: formData.location,
          description: formData.description,
          contact: formData.contact,
          image: image || '/placeholder.png',
          wifi: formData.wifi,
          parking: formData.parking,
          cr: formData.cr,
          rooms: parseInt(formData.rooms),
          secured: formData.secured,
          kitchen: parseInt(formData.kitchen),
          email: formData.email,
          amenities: amenities,
          user_id: session.user.id,
          owner_name: session.user.user_metadata?.full_name || 'Landlord',
          owner_avatar: session.user.user_metadata?.avatar_url || '',
          owner_business_name: formData.ownerBusinessName,
          owner_facebook: formData.ownerFacebook,
          owner_whatsapp: formData.ownerWhatsapp
        });

      if (error) throw error;
      
      setSubmitted(true);
      if (onListingAdded) onListingAdded();
    } catch (error) {
      alert('Error saving listing: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-content text-center animate-slide-up" onClick={e => e.stopPropagation()}>
          <div className="success-view">
            <CheckCircle size={64} className="success-icon" />
            <h2>Sapat na ang impormasyon!</h2>
            <p>Ang iyong property listing ay natanggap na at kasalukuyang sumasailalim sa maikling validation. Mackababalitaan ka namin agad!</p>
            <button className="done-btn" onClick={onClose}>Bumalik sa Home</button>
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
          <h2>I-list ang iyong Property</h2>
          <p>Tulungan kaming makahanap ng bagong tenant para sa iyong paupahan.</p>
        </div>

        <div className="form-grid">
           {/* Benefits Section (unchanged) */}
           <div className="benefits-section">
            <h3>Bakit dito mag-list?</h3>
            <div className="benefit-item">
              <Zap size={20} />
              <div>
                <strong>Mabilis na Visibility</strong>
                <p>Libo-libong students at professionals ang naghahanap dito araw-araw.</p>
              </div>
            </div>
            <div className="benefit-item">
              <Shield size={20} />
              <div>
                <strong>Zero Commission</strong>
                <p>Direktang sa iyo ang lahat ng kikitain. Walang hidden charges.</p>
              </div>
            </div>
            <div className="benefit-item">
              <TrendingUp size={20} />
              <div>
                <strong>Easy Management</strong>
                <p>Simple at diretso ang aming platform para sa mga owners.</p>
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
                <label>Type</label>
                <select name="type" onChange={handleChange}>
                  <option>Boarding House</option>
                  <option>Bed Space</option>
                  <option>Apartment</option>
                  <option>Studio</option>
                </select>
              </div>
              <div className="form-group">
                <label>Monthly Price (₱)</label>
                <input name="price" type="number" placeholder="5000" required onChange={handleChange} />
              </div>
            </div>

            <div className="form-group">
              <label>Location</label>
              <input name="location" placeholder="City or Landmarks" required onChange={handleChange} />
            </div>

            <div className="form-group image-upload-group">
               <label>Main Property Image</label>
               <span className="upload-hint">Mag-upload ng malinaw na litrato para mas madaling mapansin ng mga tenants.</span>
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
            </div>

            <div className="form-group">
              <label>Additional Description</label>
              <textarea name="description" placeholder="Other rules or details..." rows="2" required onChange={handleChange}></textarea>
            </div>

            <div className="form-group">
              <label>Contact Info (Phone/Messenger)</label>
              <input name="contact" placeholder="09XX XXX XXXX" required onChange={handleChange} />
            </div>

            <div className="form-group">
              <label>Email Address</label>
              <input name="email" type="email" placeholder="owner@email.com" required onChange={handleChange} />
            </div>

            <button type="submit" className="submit-listing-btn" disabled={uploading || loading}>
              {loading ? <Loader2 className="animate-spin" /> : 'I-submit ang Listing'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};


export default PropertyForm;
