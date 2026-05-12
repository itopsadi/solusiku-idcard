const WEBHOOK_URL = import.meta.env.VITE_N8N_WEBHOOK_URL || '';

/**
 * Send webhook trigger to n8n
 */
export async function triggerWebhook(eventType, payload) {
  if (!WEBHOOK_URL) {
    console.log(`[Webhook Skipped] ${eventType}:`, payload);
    return { success: true, skipped: true };
  }

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const response = await fetch(WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event: eventType,
          timestamp: new Date().toISOString(),
          ...payload,
        }),
      });

      if (response.ok) {
        return { success: true, data: await response.json().catch(() => ({})) };
      }
    } catch (err) {
      console.warn(`Webhook attempt ${attempt} failed:`, err.message);
      if (attempt < 3) await new Promise(r => setTimeout(r, 1000 * attempt));
    }
  }

  return { success: false, error: 'Webhook failed after 3 attempts' };
}
