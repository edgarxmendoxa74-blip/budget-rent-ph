// Shared payment details + subscription plans (VerificationPage at SubscriptionLock)
export const PAYMENT_METHODS = [
  { method: 'GCash', name: 'EDGAR M.', number: '0917 123 4567', color: '#007dfe', qr: 'https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=GCash-09171234567' },
  { method: 'Maya', name: 'EDGAR M.', number: '0917 123 4567', color: '#c335e5', qr: 'https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=Maya-09171234567' },
  { method: 'Bank', name: 'EDGAR M.', number: '1234-5678-90', color: '#1e293b', qr: '' }
];

export const SUBSCRIPTION_PLANS = [
  { id: 'monthly', label: 'Monthly', price: 20, note: '30 days' },
  { id: 'yearly', label: 'Yearly', price: 100, note: '12 months' }
];

// Facebook page na tumatanggap ng payment proofs (Messenger)
export const PAYMENT_PAGE_ID = '61592163454566';
