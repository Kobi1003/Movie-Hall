// EmailJS Client Integration
export const EMAILJS_CONFIG = {
  serviceId: import.meta.env.VITE_EMAILJS_SERVICE_ID || 'service_x7p0m0w',
  publicKey: import.meta.env.VITE_EMAILJS_PUBLIC_KEY || '',
  templateId: import.meta.env.VITE_EMAILJS_TEMPLATE_ID || ''
};

export async function sendEmailViaEmailJS({
  templateId,
  templateParams = {},
  publicKey = EMAILJS_CONFIG.publicKey
}) {
  const serviceId = EMAILJS_CONFIG.serviceId;
  const tid = templateId || EMAILJS_CONFIG.templateId || 'template_default';

  if (!publicKey) {
    console.info('[EmailJS] Public key not set yet. Email logged to console:', {
      serviceId,
      templateId: tid,
      templateParams
    });
    return { success: true, simulated: true };
  }

  try {
    const res = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        service_id: serviceId,
        template_id: tid,
        user_id: publicKey,
        template_params: templateParams
      })
    });

    if (!res.ok) {
      const err = await res.text();
      console.warn('[EmailJS] API Response:', res.status, err);
      return { success: false, error: err };
    }
    return { success: true, delivered: true };
  } catch (err) {
    console.error('[EmailJS] Network error:', err);
    return { success: false, error: err.message };
  }
}

