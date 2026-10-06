import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { HeroBudi } from './MascotSplash';
import LandlordCertificate from './LandlordCertificate';
import './PaymentMethods.css';

// Menu > Certificate: certificate ng verified landlord (may lock kung hindi pa verified)
const CertificatePage = ({ session, onGetVerified }) => {
  const userId = session?.user?.id;
  const meta = session?.user?.user_metadata || {};
  const [isVerified, setIsVerified] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;
    supabase.from('properties').select('is_verified').eq('user_id', userId).limit(1)
      .then(({ data }) => setIsVerified(Boolean(data?.[0]?.is_verified)))
      .finally(() => setLoading(false));
  }, [userId]);

  return (
    <div className="page-section animate-fade-in">
    <header className="hero branding-hero">
      <HeroBudi message="Show off your verified badge! Print this and hang it in your rentals. 🏅" />
      <div className="hero-content">
        <span className="branding-kicker">Landlord Tools</span>
        <h2>Certificate</h2>
      </div>
    </header>
    <div className="pm-container">
      {loading ? (
        <div className="text-center py-10"><Loader2 className="animate-spin text-primary mx-auto" size={32} /></div>
      ) : (
        <LandlordCertificate
          userId={userId}
          fullName={meta.full_name}
          propertyName={meta.property_name}
          isVerified={isVerified}
          onGetVerified={onGetVerified}
        />
      )}
    </div>
    </div>
  );
};

export default CertificatePage;
