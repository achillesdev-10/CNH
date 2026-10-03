/**
 * CNH Service — Mailer module
 * Supports Resend and Brevo via native fetch (no external deps)
 * Configuration via environment variables:
 *   MAIL_PROVIDER=resend|brevo
 *   MAIL_API_KEY=...
 *   MAIL_FROM="CNH Service <noreply@cnhservices.ca>"
 *   NOTIFY_TO="owner@example.com"  // admin notification email
 *   NOTIFY_TO_NAME="CNH Admin"
 */

const MAIL_PROVIDER = process.env.MAIL_PROVIDER || '';
const MAIL_API_KEY = process.env.MAIL_API_KEY || '';
const MAIL_FROM = process.env.MAIL_FROM || 'CNH Service <noreply@cnhservices.ca>';
const NOTIFY_TO = process.env.NOTIFY_TO || '';
const NOTIFY_TO_NAME = process.env.NOTIFY_TO_NAME || 'CNH Admin';

const enabled = MAIL_PROVIDER && MAIL_API_KEY && NOTIFY_TO;

async function sendEmail({ to, toName, subject, html, text }) {
  if (!enabled) {
    console.log('[Mailer] Disabled (missing config), skipping:', subject);
    return { ok: true, skipped: true };
  }

  try {
    let response;
    if (MAIL_PROVIDER === 'resend') {
      response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${MAIL_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: MAIL_FROM,
          to: to,
          subject: subject,
          html: html,
          text: text
        })
      });
    } else if (MAIL_PROVIDER === 'brevo') {
      response = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'api-key': MAIL_API_KEY,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          sender: { email: MAIL_FROM.replace(/.*<(.*)>/, '$1'), name: MAIL_FROM.replace(/<.*/, '').trim() },
          to: [{ email: to, name: toName }],
          subject: subject,
          htmlContent: html,
          textContent: text
        })
      });
    } else {
      throw new Error(`Unknown MAIL_PROVIDER: ${MAIL_PROVIDER}`);
    }

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Mailer error ${response.status}: ${errText}`);
    }

    const data = await response.json();
    console.log('[Mailer] Email sent:', subject, data.id || '');
    return { ok: true, data };
  } catch (err) {
    console.error('[Mailer] Failed to send email:', err.message);
    return { ok: false, error: err.message };
  }
}

// ── High-level helpers ──

async function notifyNewReservation(reservation) {
  const subject = `🔔 Nouvelle réservation #${reservation.id} - CNH Service`;
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
      <h2 style="color:#0ea5e9;">Nouvelle réservation reçue</h2>
      <p><strong>Client :</strong> ${reservation.name}</p>
      <p><strong>Email :</strong> ${reservation.email}</p>
      <p><strong>Téléphone :</strong> ${reservation.phone}</p>
      <p><strong>Service :</strong> ${reservation.service}</p>
      <p><strong>Véhicule :</strong> ${reservation.vehicle_type}${reservation.vehicle_plate ? ' (' + reservation.vehicle_plate + ')' : ''}</p>
      <p><strong>Date :</strong> ${reservation.reservation_date} à ${reservation.reservation_time || 'À convenir'}</p>
      <p><strong>Adresse :</strong> ${reservation.address}, ${reservation.city}${reservation.postal_code ? ' ' + reservation.postal_code : ''}</p>
      ${reservation.extras ? `<p><strong>Extras :</strong> ${reservation.extras}</p>` : ''}
      ${reservation.price_total ? `<p><strong>Total estimé :</strong> ${reservation.price_total.toFixed(2).replace('.', ',')} $</p>` : '<p><em>Prestation sur devis</em></p>'}
      <p><strong>Notes :</strong> ${reservation.notes || '—'}</p>
      <hr style="margin:20px 0;border:none;border-top:1px solid #e2e8f0;">
      <p style="font-size:14px;color:#64748b;"><a href="https://cnhservices.ca/admin" style="color:#0ea5e9;">Voir dans l'admin</a></p>
    </div>
  `;
  const text = `Nouvelle réservation #${reservation.id}\nClient: ${reservation.name}\nEmail: ${reservation.email}\nTel: ${reservation.phone}\nService: ${reservation.service}\nDate: ${reservation.reservation_date} ${reservation.reservation_time || 'À convenir'}\nTotal: ${reservation.price_total ? reservation.price_total.toFixed(2).replace('.', ',') + ' $' : 'Sur devis'}`;

  return sendEmail({ to: NOTIFY_TO, toName: NOTIFY_TO_NAME, subject, html, text });
}

async function notifyNewContact(contact) {
  const subject = `📨 Nouveau message de contact - CNH Service`;
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
      <h2 style="color:#0ea5e9;">Nouveau message de contact</h2>
      <p><strong>Nom :</strong> ${contact.name}</p>
      <p><strong>Email :</strong> ${contact.email}</p>
      <p><strong>Téléphone :</strong> ${contact.phone}</p>
      <p><strong>Service :</strong> ${contact.service}</p>
      <p><strong>Date souhaitée :</strong> ${contact.date_wished || 'Non précisée'}</p>
      <p><strong>Message :</strong></p>
      <div style="background:#f1f5f9;padding:16px;border-radius:8px;white-space:pre-wrap;">${contact.message}</div>
      <hr style="margin:20px 0;border:none;border-top:1px solid #e2e8f0;">
      <p style="font-size:14px;color:#64748b;"><a href="https://cnhservices.ca/admin" style="color:#0ea5e9;">Voir dans l'admin</a></p>
    </div>
  `;
  const text = `Nouveau message de ${contact.name}\nEmail: ${contact.email}\nTel: ${contact.phone}\nService: ${contact.service}\nMessage: ${contact.message}`;

  return sendEmail({ to: NOTIFY_TO, toName: NOTIFY_TO_NAME, subject, html, text });
}

async function sendClientConfirmation(reservation, isContact = false) {
  if (isContact) {
    const subject = `✅ Votre message a bien été reçu - CNH Service`;
    const html = `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
        <h2 style="color:#10b981;">Message bien reçu !</h2>
        <p>Bonjour ${reservation.name},</p>
        <p>Nous avons bien reçu votre demande concernant <strong>${reservation.service}</strong>.</p>
        <p>Notre équipe vous répondra dans les meilleurs délais par courriel ou téléphone.</p>
        <hr style="margin:20px 0;border:none;border-top:1px solid #e2e8f0;">
        <p style="font-size:14px;color:#64748b;">CNH Service — Lavage Auto à Domicile<br>Grand Montréal & Rive-Sud<br>☎ +1 450 230 2509</p>
      </div>
    `;
    return sendEmail({ to: reservation.email, toName: reservation.name, subject, html });
  }

  const subject = `✅ Votre réservation #${reservation.id} est confirmée - CNH Service`;
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
      <h2 style="color:#10b981;">Réservation confirmée !</h2>
      <p>Bonjour ${reservation.name},</p>
      <p>Votre réservation <strong>#${reservation.id}</strong> a bien été enregistrée.</p>
      <div style="background:#f0f9ff;border:1px solid #0ea5e9;border-radius:8px;padding:16px;margin:16px 0;">
        <p><strong>Service :</strong> ${reservation.service}</p>
        <p><strong>Date :</strong> ${reservation.reservation_date} à ${reservation.reservation_time || 'À convenir'}</p>
        <p><strong>Adresse :</strong> ${reservation.address}, ${reservation.city}${reservation.postal_code ? ' ' + reservation.postal_code : ''}</p>
        ${reservation.price_total ? `<p><strong>Total estimé :</strong> ${reservation.price_total.toFixed(2).replace('.', ',')} $</p>` : '<p><em>Prestation sur devis — nous vous contacterons pour le prix final</em></p>'}
      </div>
      <p>Notre équipe vous confirmera l'horaire exact par courriel ou téléphone sous peu.</p>
      <hr style="margin:20px 0;border:none;border-top:1px solid #e2e8f0;">
      <p style="font-size:14px;color:#64748b;">CNH Service — Lavage Auto à Domicile<br>Grand Montréal & Rive-Sud<br>☎ +1 450 230 2509</p>
    </div>
  `;
  return sendEmail({ to: reservation.email, toName: reservation.name, subject, html });
}

module.exports = {
  sendEmail,
  notifyNewReservation,
  notifyNewContact,
  sendClientConfirmation,
  enabled: () => enabled
};