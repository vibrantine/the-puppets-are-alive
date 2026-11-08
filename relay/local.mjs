// Runs the local Node server used by the paid show. The browser sends a voice
// connection offer, a Director writing request or microphone audio. The relay
// checks the request, adds the server-side OpenAI key and returns the answer
// or cue. Keeping this step here lets the browser run the performance without
// receiving the key. Starting the server alone makes no paid request.

import { readFile } from 'node:fs/promises';
import { parseEnv } from 'node:util';
import { createServer } from 'node:http';
import { pathToFileURL } from 'node:url';
import { privateScriptSchemas, interrogationSchema, segmentDirection, segmentInstructions, openingSchema, openingInstructions, audienceSchema, audienceInstructions, audienceReplySchema, audienceReplyInstructions } from './opening-script.mjs';

const port = 8817;
const origins = new Set(['http://127.0.0.1:8816', 'http://localhost:8816',
  'http://127.0.0.1:8000', 'http://localhost:8000']);
const voices = new Map([['arthur-investigator', 'vesper'], ['patrick-bookkeeper', 'stone'], ['claire-leading-lady', 'gleam'], ['evelyn-stage-manager', 'quartz']]);

// Build the local server without opening a session. Tests inject a fake provider.
export function createRelay(key, requestProvider = fetch) {
  return createServer(async (req, res) => {
    function reply(status, data) {
      res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
      res.end(JSON.stringify(data));
    }
    // Count each upstream request once, including successful session setup.
    // Audio delivery is measured separately in the browser, after setup.
    async function providerRequest(url, options) {
      const start = performance.now();
      const entry = { route: req.url };
      try {
        const response = await requestProvider(url, options);
        entry.status = response.status;
        entry.outcome = response.ok ? 'accepted' : 'rejected';
        if (!response.ok) {
          const detail = await response.json().catch(() => null);
          const code = detail?.error?.code ?? detail?.error?.type;
          entry.code = typeof code === 'string' && /^[a-z0-9_]{1,64}$/.test(code) ? code : 'unknown';
          entry.retryAfter = response.headers.get('retry-after');
          reply(502, { error: 'Provider request failed', status: entry.status,
            code: entry.code, retryAfter: entry.retryAfter });
          return null;
        }
        return response;
      } catch (error) {
        entry.outcome = options.signal.aborted ? options.signal.reason?.name ?? 'aborted' : 'transport error';
        throw error;
      } finally {
        console.info('Theatre API request', { ...entry, ms: Math.round(performance.now() - start) });
      }
    }
    if (!['127.0.0.1:' + port, 'localhost:' + port].includes(req.headers.host)) return reply(403, 'Unexpected host');
    if (req.url === '/health' && req.method === 'GET') return reply(200, { configured: Boolean(key) });
    if (!origins.has(req.headers.origin)) return reply(403, 'Unexpected sketch origin');
    res.setHeader('Access-Control-Allow-Origin', req.headers.origin);
    res.setHeader('Vary', 'Origin');
    if (!['/session', '/opening', '/audience', '/segment', '/transcribe'].includes(req.url)) return reply(404, 'Unknown route');
    if (req.method === 'OPTIONS') {
      res.setHeader('Access-Control-Allow-Methods', 'POST');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
      return reply(200, {});
    }
    // Short microphone recordings stay in memory and are forwarded as multipart audio.
    if (req.url === '/transcribe' && req.method === 'POST') {
      const mime = req.headers['content-type']?.split(';')[0];
      if (!['audio/webm', 'audio/mp4', 'audio/wav'].includes(mime)) return reply(400, 'Unsupported audio format');
      const abort = new AbortController();
      res.on('close', () => abort.abort());
      try {
        const chunks = [];
        let size = 0;
        for await (const chunk of req) {
          size += chunk.length;
          if (size > 4 * 1024 * 1024) return reply(413, 'Recording too large');
          chunks.push(chunk);
        }
        if (!size) return reply(400, 'Empty recording');
        const form = new FormData();
        form.set('model', 'gpt-transcribe');
        form.set('file', new Blob(chunks, { type: mime }), mime === 'audio/wav' ? 'question.wav' : mime === 'audio/webm' ? 'question.webm' : 'question.mp4');
        const result = await providerRequest('https://api.openai.com/v1/audio/transcriptions', {
          method: 'POST', headers: { Authorization: 'Bearer ' + key }, body: form,
          signal: AbortSignal.any([abort.signal, AbortSignal.timeout(25000)])
        });
        if (!result) return;
        const data = await result.json();
        if (typeof data.text !== 'string') return reply(502, 'Invalid transcript');
        return reply(200, { text: data.text });
      } catch {
        if (!res.destroyed) reply(502, 'Transcription unavailable');
        return;
      }
    }
    if (req.method !== 'POST' || req.headers['content-type']?.split(';')[0] !== 'application/json') return reply(400, 'Expected a JSON POST');
    const controller = new AbortController();
    res.on('close', () => controller.abort());
    let body;
    try {
      const chunks = [];
      let size = 0;
      for await (const chunk of req) {
        size += chunk.length;
        if (size > 65536) return reply(413, 'Rehearsal request too large');
        chunks.push(chunk);
      }
      body = JSON.parse(Buffer.concat(chunks));
      if (!body || typeof body !== 'object') return reply(400, 'Expected an object');
    } catch { return reply(400, 'Invalid request'); }

    let path, payload;
    if (req.url === '/session') {
      if (!voices.has(body.actor) || typeof body.sdp !== 'string' || !body.sdp.startsWith('v=0')) return reply(400, 'Expected a cast member and WebRTC offer');
      path = 'live/sessions';
      payload = {
        session: { model: 'gpt-live-1', store: false, audio: { output: { voice: voices.get(body.actor) } },
          instructions: 'Play ' + body.actor + ' in Puppet Theatre. Stay silent until explicitly instructed to speak a line. Immediately perform only the supplied dialogue, exactly once and in character, then wait silently for the next line. Square-bracketed text is director guidance for vocal delivery: perform it, never read it aloud. Guidance may change within the line. Do not speak the guidance or add commentary. Rehearsal context is never a cue to speak.' },
        transport: { type: 'webrtc', sdp: body.sdp }
      };
    } else {
      if (typeof body.prompt !== 'string' || !body.prompt.trim()) return reply(400, 'Expected a script prompt');
      if (req.url === '/audience' && !['reply', 'continuation'].includes(body.phase)) return reply(400, 'Expected an audience writing phase');
      const segment = req.url === '/segment';
      if (segment && !Object.hasOwn(segmentInstructions, body.phase)) return reply(400, 'Unknown segment phase');
      const shortReply = req.url === '/audience' && body.phase === 'reply';
      path = 'responses';
      payload = {
        model: 'gpt-5-mini', store: false, reasoning: { effort: 'minimal' },
        max_output_tokens: shortReply ? 700 : req.url === '/audience' ? 4000 : 6500,
        instructions: segment ? segmentDirection(body.phase) : shortReply ? audienceReplyInstructions : req.url === '/audience' ? audienceInstructions : openingInstructions,
        text: { format: { type: 'json_schema', name: req.url === '/audience' ? 'audience_script' : 'opening_script', strict: true,
          schema: segment ? (privateScriptSchemas[body.phase] ?? (body.phase === 'interrogation' ? interrogationSchema : audienceSchema)) : shortReply ? audienceReplySchema : req.url === '/audience' ? audienceSchema : openingSchema } },
        input: body.prompt
      };
    }

    // Only the server attaches the key. Errors returned to the browser omit private content.
    try {
      const result = await providerRequest('https://api.openai.com/v1/' + path, {
        method: 'POST', redirect: 'error',
        headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload), signal: AbortSignal.any([controller.signal, AbortSignal.timeout(req.url === '/opening' ? 85000 : req.url === '/segment' ? 55000 : 25000)])
      });
      if (!result) return;
      const data = await result.json();
      if (req.url === '/session' && typeof data.transport?.sdp === 'string') return reply(200, { sdp: data.transport.sdp, sessionId: data.session?.id });
      if (req.url === '/opening' || req.url === '/audience' || req.url === '/segment') {
        const text = (data.output ?? []).flatMap(item => item.content ?? []).filter(item => item.type === 'output_text').map(item => item.text).join('\n');
        if (data.status === 'incomplete') return reply(502, { error: 'Incomplete script', reason: data.incomplete_details?.reason });
        if (text) return reply(200, { text, outputTokens: data.usage?.output_tokens });
      }
      reply(502, 'Provider returned an incomplete response');
    } catch {
      if (!res.destroyed) reply(502, 'Provider unavailable');
    }
  });
}

// Launch from this project with node relay/local.mjs. Loading config costs nothing.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const settings = new URL('../.dev.vars', import.meta.url);
  const key = process.env.OPENAI_API_KEY || parseEnv(await readFile(settings, 'utf8').catch(error => {
    if (error.code === 'ENOENT') {
      const sibling = new URL('../../the-puppets-are-alive/.dev.vars', import.meta.url);
      return readFile(sibling, 'utf8').catch(missing => {
        if (missing.code === 'ENOENT') return '';
        throw missing;
      });
    }
    throw error;
  })).OPENAI_API_KEY;
  if (!key) throw new Error('Set OPENAI_API_KEY in .dev.vars beside the launcher or in your environment');
  createRelay(key).listen(port, '127.0.0.1', () => console.log('Local theatre relay listening on 127.0.0.1:' + port));
}
