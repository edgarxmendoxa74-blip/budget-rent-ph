import React, { useState } from 'react';
import { Award, BadgeCheck, Image as ImageIcon, Loader2, Lock, Printer, ShieldCheck, Home, Users, Frame } from 'lucide-react';
import { StepArt } from './certificateArt';
import { buildCertificatePoster } from './certificatePoster';

// Real photo (public/cert-steps/stepN.jpg: totoong tao at totoong phone); kapag wala pa ang file, illustration muna
const StepPhoto = ({ step, alt }) => {
  const [failed, setFailed] = useState(false);
  if (failed) return <StepArt step={step} />;
  return <img className="cert-step-photo" src={`/cert-steps/step${step}.jpg`} alt={alt} loading="lazy" onError={() => setFailed(true)} />;
};

const STEPS = [
  { title: 'Download the image', text: 'Tap "Download Wall Frame Image (PNG)" above to save your certificate to your phone.' },
  { title: 'Print it', text: 'Print the image on A4 paper (or at a photo shop) in color for the best look.' },
  { title: 'Sign it', text: "Use a pen to sign on the \"Landlord's Signature\" line. A signed certificate shows that you personally stand behind your property." },
  { title: 'Put it in a picture frame', text: 'Place the signed print in a frame so it stays clean and looks professional.' },
  { title: 'Hang it on the wall', text: 'Hang it where guests and tenants can see it — at the entrance, living room or front desk of every rental house and staycation.' }
];

const certNo = (userId = '') => `BRPH-${String(userId).replace(/-/g, '').slice(0, 8).toUpperCase() || '00000000'}`;

// Certificate section ng legitimate (verified) landlord: preview, bakit maganda, at PNG na pwedeng i-print/i-post sa paupahan o staycation
const LandlordCertificate = ({ userId, fullName, propertyName, isVerified, onGetVerified }) => {
  const [savingImg, setSavingImg] = useState(false);
  const holder = fullName || 'Landlord';
  const issued = new Date().toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' });
  const no = certNo(userId);

  const handleDownloadImage = async () => {
    setSavingImg(true);
    try {
      const canvas = await buildCertificatePoster({ holder, propertyName, certNo: no, issued });
      const fileName = `BudgetRentPH-Wall-Frame-${no}.png`;
      const { Capacitor } = await import('@capacitor/core');
      if (Capacitor.isNativePlatform()) {
        const { Filesystem, Directory } = await import('@capacitor/filesystem');
        const { Share } = await import('@capacitor/share');
        const saved = await Filesystem.writeFile({ path: fileName, data: canvas.toDataURL('image/png').split(',')[1], directory: Directory.Cache });
        await Share.share({ title: 'BudgetRentPH Wall Frame', url: saved.uri, dialogTitle: 'Save or share image' });
      } else {
        const a = document.createElement('a');
        a.href = canvas.toDataURL('image/png');
        a.download = fileName;
        a.click();
      }
    } catch (err) {
      console.error('Poster save failed:', err);
      alert('Could not create the image. Please try again.');
    } finally {
      setSavingImg(false);
    }
  };

  return (
    <div className="cert-section">
      <h3 className="cert-heading"><Award size={18} /> Certificate</h3>

      <div className={`cert-card ${isVerified ? '' : 'locked'}`}>
        <img src="/logo.png" alt="BudgetRentPH" className="cert-logo" />
        <div className="cert-brand">BudgetRentPH</div>
        <div className="cert-title">Certificate of Verification</div>
        <div className="cert-sub">This certifies that</div>
        <div className="cert-name">{holder} {isVerified && <BadgeCheck size={20} className="cert-check" />}</div>
        <div className="cert-prop">Property Owner</div>
        <div className="cert-text">is a Verified Landlord on BudgetRentPH — a legitimate landlord for rentals and staycations.</div>
        <div className="cert-foot">
          <span>No. {no}</span>
          <span>{issued}</span>
        </div>
        {!isVerified && (
          <div className="cert-lock"><Lock size={22} /><span>Get verified to unlock your certificate</span></div>
        )}
      </div>

      {isVerified ? (
        <button type="button" className="cert-btn" onClick={handleDownloadImage} disabled={savingImg}>
          {savingImg ? <Loader2 className="animate-spin" size={18} /> : <><ImageIcon size={18} /> Download Wall Frame Image (PNG)</>}
        </button>
      ) : onGetVerified && (
        <button type="button" className="cert-btn" onClick={onGetVerified}>
          <BadgeCheck size={18} /> Get Verified to Unlock
        </button>
      )}
      {isVerified && <p className="cert-hint"><Printer size={13} /> Print it, put it in a frame, and hang it where guests can see it.</p>}

      <div className="cert-why">
        <strong>Why it's worth having</strong>
        <ul>
          <li><ShieldCheck size={15} /> <span>Proves you're a real, legitimate landlord — tenants and guests worry less about scams.</span></li>
          <li><Users size={15} /> <span>People inquire and book faster when they trust you.</span></li>
          <li><Home size={15} /> <span>Shows guests at a glance that your place is the real, listed property.</span></li>
        </ul>
      </div>

      <div className="cert-why frame">
        <strong><Frame size={15} /> Put it in a picture frame</strong>
        <p>Print the wall-frame image and hang it in a picture frame at every rental house and staycation — at the entrance, living room or front desk. Guests and tenants see right away that you're verified by BudgetRentPH, so they feel safe, trust your place, and are more likely to leave good reviews and book again.</p>
      </div>

      <div className="cert-steps">
        <strong>How to use your certificate</strong>
        {STEPS.map((st, i) => (
          <div className="cert-step" key={st.title}>
          <StepPhoto step={i + 1} alt={st.title} />
          <div className="cert-step-text"><b>{i + 1}. {st.title}</b><span>{st.text}</span></div>
          </div>
        ))}
      </div>

    </div>
  );
};

export default LandlordCertificate;
