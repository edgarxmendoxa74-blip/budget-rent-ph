import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { X, User, Save, Loader2, CheckCircle, Camera, Phone, MessageCircle, Building2, Globe } from 'lucide-react';
import './ProfileModal.css';

const ProfileModal = ({ session, onClose, isEditingInitial = false }) => {
  const [isEditing, setIsEditing] = useState(isEditingInitial);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [formData, setFormData] = useState({
    fullName: session?.user?.user_metadata?.full_name || '',
    email: session?.user?.email || '',
    phone: session?.user?.user_metadata?.phone || '',
    businessEmail: session?.user?.user_metadata?.business_email || session?.user?.email || '',
    facebook: session?.user?.user_metadata?.facebook || '',
    whatsapp: session?.user?.user_metadata?.whatsapp || '',
    propertyName: session?.user?.user_metadata?.property_name || '',
    avatarUrl: session?.user?.user_metadata?.avatar_url || ''
  });

  const userRole = session?.user?.user_metadata?.user_role || 'tenant';

  const handleFileUpload = async (e) => {
    try {
      setUploading(true);
      if (!e.target.files || e.target.files.length === 0) return;
      
      const file = e.target.files[0];
      const fileExt = file.name.split('.').pop();
      const fileName = `${session.user.id}-${Math.random()}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      setFormData(prev => ({ ...prev, avatarUrl: publicUrl }));
      
      // Auto-update metadata for photo
      await supabase.auth.updateUser({
        data: { avatar_url: publicUrl }
      });
    } catch (error) {
      alert('Error: ' + error.message);
    } finally {
      setUploading(false);
    }
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    setLoading(true);
    setSuccess(false);

    try {
      const { error } = await supabase.auth.updateUser({
        data: { 
          full_name: formData.fullName,
          phone: formData.phone,
          business_email: formData.businessEmail,
          facebook: formData.facebook,
          whatsapp: formData.whatsapp,
          property_name: formData.propertyName,
          avatar_url: formData.avatarUrl
        }
      });

      if (error) throw error;
      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        setIsEditing(false); // Switch back to view mode after save
      }, 2000);
    } catch (error) {
      alert(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content profile-modal animate-slide-up" onClick={e => e.stopPropagation()}>
        <button className="close-btn" onClick={onClose}><X size={24} /></button>
        
        <div className="profile-header">
          <div className="profile-avatar">
            {uploading ? (
              <div className="avatar-placeholder"><Loader2 className="animate-spin" /></div>
            ) : (
              <>
                {formData.avatarUrl ? (
                  <img src={formData.avatarUrl} alt="Avatar" className="avatar-img" />
                ) : (
                  <div className="avatar-placeholder">
                    {formData.fullName ? formData.fullName.charAt(0).toUpperCase() : <User />}
                  </div>
                )}
              </>
            )}
            <input type="file" id="avatar-upload" hidden accept="image/*" onChange={handleFileUpload} />
            <label htmlFor="avatar-upload" className="change-photo" title="Upload Photo"><Camera size={16} /></label>
          </div>
          <span className={`role-badge ${userRole}`}>{userRole.toUpperCase()}</span>
          <h2>{isEditing ? 'Edit Profile' : 'Account Details'}</h2>
          <a href={`mailto:${formData.email}`} className="profile-email">{formData.email}</a>
        </div>

        {isEditing ? (
          <form onSubmit={handleUpdate} className="profile-form">
            <div className="form-group">
              <label>Full Name</label>
              <input type="text" value={formData.fullName} onChange={e => setFormData({...formData, fullName: e.target.value})} />
            </div>
            <div className="form-group">
              <label>Contact Number (Call)</label>
              <input type="text" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} />
            </div>
            <div className="form-group">
              <label>Contact Email (for inquiries)</label>
              <input type="email" value={formData.businessEmail} onChange={e => setFormData({...formData, businessEmail: e.target.value})} />
            </div>
            {userRole === 'landlord' && (
              <div className="form-group">
                <label>Business Name</label>
                <input type="text" value={formData.propertyName} onChange={e => setFormData({...formData, propertyName: e.target.value})} />
              </div>
            )}
            <div className="form-group">
              <label>FB / IG Link</label>
              <input type="text" value={formData.facebook} onChange={e => setFormData({...formData, facebook: e.target.value})} />
            </div>
            <div className="form-group">
              <label>WhatsApp Number</label>
              <input type="text" value={formData.whatsapp} onChange={e => setFormData({...formData, whatsapp: e.target.value})} />
            </div>
            <button type="submit" className="save-btn" disabled={loading}>
              {loading ? <Loader2 className="animate-spin" size={20} /> : <><Save size={18} /> Save Changes</>}
            </button>
            {success && <div className="success-msg"><CheckCircle size={16} /> Updated!</div>}
          </form>
        ) : (
          <div className="profile-details">
            <div className="info-group">
              <User size={18} />
              <div className="info-content">
                <label>Full Name</label>
                <p>{formData.fullName || 'Not set'}</p>
              </div>
            </div>
            <div className="info-group">
              <Phone size={18} />
              <div className="info-content">
                <label>Contact Number</label>
                <p>{formData.phone || 'Not set'}</p>
              </div>
            </div>
            {userRole === 'landlord' && (
              <div className="info-group">
                <Building2 size={18} />
                <div className="info-content">
                  <label>Business / Property Name</label>
                  <p>{formData.propertyName || 'Not set'}</p>
                </div>
              </div>
            )}
            <div className="info-grid">
              <div className="info-group">
                <Globe size={18} />
                <div className="info-content">
                  <label>Social Link</label>
                  <p>{formData.facebook || 'Not set'}</p>
                </div>
              </div>
            </div>
            <div className="info-group" style={{marginTop: '12px'}}>
              <MessageCircle size={18} />
              <div className="info-content">
                <label>WhatsApp</label>
                <p>{formData.whatsapp || 'Not set'}</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProfileModal;
