/**
 * MSG91 — WhatsApp & SMS Dispatch Utility
 * 
 * Handles sending invoice/estimate notifications via WhatsApp and SMS
 * using MSG91's API. Includes audit logging to bill_dispatch_log table.
 * 
 * Safety: If MSG91 credentials are missing, dispatch is skipped gracefully.
 */

const db = require('../config/db');

const MSG91_BASE = 'https://control.msg91.com/api/v5';

/**
 * Send WhatsApp message via MSG91
 */
async function sendWhatsApp({ to, templateName, params, jobCardId, userId }) {
  const authKey = process.env.MSG91_AUTH_KEY;
  const waNumber = process.env.MSG91_WA_NUMBER;

  if (!authKey || !waNumber) {
    console.warn('[MSG91] WhatsApp credentials not configured — skipping dispatch');
    return { success: false, reason: 'credentials_missing' };
  }

  try {
    const payload = {
      integrated_number: waNumber,
      content_type: 'template',
      payload: {
        to: to.startsWith('91') ? to : `91${to}`,
        type: 'template',
        template: {
          name: templateName || process.env.MSG91_WA_TEMPLATE_NAME || 'invoice_notification',
          language: { code: 'en', policy: 'deterministic' },
          components: params ? [{ type: 'body', parameters: params }] : []
        }
      }
    };

    const response = await fetch(`${MSG91_BASE}/whatsapp/whatsapp/sendMessage`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'authkey': authKey
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    const success = response.ok && data.type !== 'error';

    // Log dispatch
    await logDispatch({
      jobCardId,
      type: 'whatsapp',
      recipientNo: to,
      templateName,
      status: success ? 'sent' : 'failed',
      providerRef: data.id || data.request_id || null,
      errorMessage: success ? null : JSON.stringify(data),
      userId
    });

    return { success, data };
  } catch (err) {
    console.error('[MSG91] WhatsApp error:', err.message);
    await logDispatch({
      jobCardId,
      type: 'whatsapp',
      recipientNo: to,
      templateName,
      status: 'failed',
      providerRef: null,
      errorMessage: err.message,
      userId
    });
    return { success: false, error: err.message };
  }
}

/**
 * Send SMS via MSG91
 */
async function sendSMS({ to, message, jobCardId, userId }) {
  const authKey = process.env.MSG91_AUTH_KEY;
  const senderId = process.env.MSG91_SENDER_ID;
  const templateId = process.env.MSG91_SMS_TEMPLATE_ID;

  if (!authKey || !senderId || !templateId) {
    console.warn('[MSG91] SMS credentials not configured — skipping dispatch');
    return { success: false, reason: 'credentials_missing' };
  }

  try {
    const mobile = to.startsWith('91') ? to : `91${to}`;

    const payload = {
      sender: senderId,
      route: '4', // Transactional
      country: '91',
      DLT_TE_ID: templateId,
      sms: [{
        message,
        to: [mobile]
      }]
    };

    const response = await fetch(`${MSG91_BASE}/flow/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'authkey': authKey
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    const success = response.ok && data.type !== 'error';

    await logDispatch({
      jobCardId,
      type: 'sms',
      recipientNo: to,
      templateName: templateId,
      status: success ? 'sent' : 'failed',
      providerRef: data.request_id || null,
      errorMessage: success ? null : JSON.stringify(data),
      userId
    });

    return { success, data };
  } catch (err) {
    console.error('[MSG91] SMS error:', err.message);
    await logDispatch({
      jobCardId,
      type: 'sms',
      recipientNo: to,
      templateName: templateId,
      status: 'failed',
      providerRef: null,
      errorMessage: err.message,
      userId
    });
    return { success: false, error: err.message };
  }
}

/**
 * Log dispatch event to bill_dispatch_log
 */
async function logDispatch({ jobCardId, type, recipientNo, templateName, status, providerRef, errorMessage, userId }) {
  try {
    await db.execute(
      `INSERT INTO bill_dispatch_log 
        (job_card_id, dispatch_type, recipient_no, template_name, status, provider_ref, error_message, dispatched_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [jobCardId, type, recipientNo, templateName || null, status, providerRef || null, errorMessage || null, userId || null]
    );
  } catch (err) {
    console.error('[MSG91] Failed to log dispatch:', err.message);
  }
}

/**
 * Get dispatch history for a job card
 */
async function getDispatchHistory(jobCardId) {
  const [rows] = await db.query(
    `SELECT bdl.*, au.full_name as dispatched_by_name
     FROM bill_dispatch_log bdl
     LEFT JOIN admin_users au ON bdl.dispatched_by = au.id
     WHERE bdl.job_card_id = ?
     ORDER BY bdl.created_at DESC`,
    [jobCardId]
  );
  return rows;
}

module.exports = {
  sendWhatsApp,
  sendSMS,
  getDispatchHistory
};
