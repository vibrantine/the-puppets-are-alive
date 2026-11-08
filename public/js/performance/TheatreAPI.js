// Sends voice, writing and transcription requests through the local relay.
// The relay holds the credential. The browser records request outcomes so a
// rejected request can be distinguished from an accepted but silent voice.

class TheatreAPI {
  // Keep transport outcomes in the browser console alongside, but independent
  // of, the audio meter. Log no request bodies, dialogue, or microphone data.
  static async request(route, body, contentType, signal) {
    const start = performance.now();
    const entry = { route, outcome: 'transport error' };
    try {
      const response = await fetch('http://127.0.0.1:8817/' + route, {
        method: 'POST', headers: { 'Content-Type': contentType }, body, signal
      });
      entry.relayStatus = response.status;
      const data = await response.json();
      if (!response.ok) {
        entry.outcome = data?.status ? 'provider rejected' : 'relay error';
        entry.providerStatus = data?.status ?? null;
        entry.code = data?.code ?? null;
        entry.retryAfter = data?.retryAfter ?? null;
        throw new Error('Local relay HTTP ' + response.status +
          (entry.providerStatus ? ' (provider HTTP ' + entry.providerStatus + ', ' + (entry.code ?? 'unknown') + ')' : ''));
      }
      entry.outcome = 'success';
      return data;
    } catch (error) {
      if (signal?.aborted) entry.outcome = signal.reason?.name === 'TimeoutError' ? 'timeout' : 'cancelled';
      throw error;
    } finally {
      console.info('Theatre relay request', { ...entry, ms: Math.round(performance.now() - start) });
    }
  }

  static post(route, body, signal) {
    return this.request(route, JSON.stringify(body), 'application/json', signal);
  }

  static async transcribe(blob, signal) {
    const data = await this.request('transcribe', blob, blob.type,
      AbortSignal.any([signal, AbortSignal.timeout(30000)]));
    if (typeof data.text !== 'string') throw new Error('Invalid transcript.');
    return data.text;
  }

  static requestAudience(prompt, phase, signal) { return this.post('audience', { prompt, phase }, signal); }

  // LiveActor supplies its puppet name and a browser-generated WebRTC offer.
  static startSession(actor, sdp, signal) { return this.post('session', { actor, sdp }, signal); }

  // One explicit paid request writes the opening; generation has a longer deadline.
  static requestOpening(prompt, signal) {
    return this.post('opening', { prompt }, AbortSignal.any([signal, AbortSignal.timeout(90000)]));
  }
}
