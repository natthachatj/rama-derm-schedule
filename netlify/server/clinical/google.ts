import * as oidc from 'openid-client';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { getStore } from '@netlify/blobs';
import { cookies, cookie, signPayload, verifyPayload, siteOrigin, getAuthenticatedUser, googleConfig } from '../auth';
import type { AppUser } from '../../../lib/schedule-api';
const secrets = () => getStore({ name: 'rama-derm-clinical-secrets', consistency: 'strong' });
export function clinicalOwner(user: AppUser | null) { return !!user && !user.localAccess && /^\d+$/.test(user.userId) && !!process.env.CLINICAL_OWNER_EMAIL && user.email.toLowerCase() === process.env.CLINICAL_OWNER_EMAIL.trim().toLowerCase() && (!process.env.CLINICAL_OWNER_GOOGLE_SUB || user.userId === process.env.CLINICAL_OWNER_GOOGLE_SUB); }
function key() { if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32)
    throw Error('Clinical encryption is not configured.'); return createHash('sha256').update('clinical-google-v1:' + process.env.SESSION_SECRET).digest(); }
export function encrypt(value: string) { const iv = randomBytes(12), c = createCipheriv('aes-256-gcm', key(), iv); const data = Buffer.concat([c.update(value, 'utf8'), c.final()]); return Buffer.concat([iv, c.getAuthTag(), data]).toString('base64'); }
export function decrypt(value: string) { const data = Buffer.from(value, 'base64'), d = createDecipheriv('aes-256-gcm', key(), data.subarray(0, 12)); d.setAuthTag(data.subarray(12, 28)); return Buffer.concat([d.update(data.subarray(28)), d.final()]).toString('utf8'); }
export async function connectionInfo() { const value = await secrets().get('google', { type: 'json' }) as any; return { connected: !!value, ownerEmail: value?.email || null }; }
export async function clinicalGoogleStart(request: Request) { if (process.env.CONTEXT && process.env.CONTEXT !== 'production')
    return new Response('Production clinical connection only.', { status: 403 }); const user = await getAuthenticatedUser(request); if (!clinicalOwner(user))
    return Response.json({ error: 'Clinical-owner Google sign-in required.' }, { status: 403 }); if (new URL(request.url).origin !== siteOrigin())
    return new Response(null, { status: 403 }); const verifier = oidc.randomPKCECodeVerifier(), state = oidc.randomState(), nonce = oidc.randomNonce(); const location = oidc.buildAuthorizationUrl(await googleConfig(), { redirect_uri: siteOrigin() + '/auth/clinical/google/callback', scope: 'openid email profile https://www.googleapis.com/auth/drive https://www.googleapis.com/auth/spreadsheets', access_type: 'offline', prompt: 'consent', login_hint: user!.email, code_challenge: await oidc.calculatePKCECodeChallenge(verifier), code_challenge_method: 'S256', state, nonce }); return new Response(null, { status: 302, headers: { Location: location.href, 'Set-Cookie': cookie('__Host-rama_clinical_oauth', await signPayload({ verifier, state, nonce, sub: user!.userId }, 'clinical-oauth', 600), 600), 'Cache-Control': 'no-store' } }); }
export async function clinicalGoogleCallback(request: Request) { if (process.env.CONTEXT && process.env.CONTEXT !== 'production')
    return new Response('Production clinical connection only.', { status: 403 }); const headers = new Headers({ 'Cache-Control': 'no-store', 'Set-Cookie': cookie('__Host-rama_clinical_oauth', '', 0) }); try {
    const user = await getAuthenticatedUser(request);
    if (!clinicalOwner(user) || new URL(request.url).origin !== siteOrigin())
        throw Error();
    const tx = await verifyPayload(cookies(request).__Host_rama_clinical_oauth || cookies(request)['__Host-rama_clinical_oauth'] || '', 'clinical-oauth');
    if (tx.sub !== user!.userId || typeof tx.verifier !== 'string' || typeof tx.state !== 'string' || typeof tx.nonce !== 'string')
        throw Error();
    const tokens = await oidc.authorizationCodeGrant(await googleConfig(), new URL(request.url), { pkceCodeVerifier: tx.verifier, expectedState: tx.state, expectedNonce: tx.nonce });
    const claims = tokens.claims();
    if (claims?.sub !== user!.userId || claims.email_verified !== true || String(claims.email).toLowerCase() !== user!.email.toLowerCase() || !tokens.refresh_token)
        throw Error();
    const scopes = String(tokens.scope || '').split(' ');
    if (!scopes.includes('https://www.googleapis.com/auth/drive') || !scopes.includes('https://www.googleapis.com/auth/spreadsheets'))
        throw Error();
    await secrets().setJSON('google', { sub: user!.userId, email: user!.email, refresh: encrypt(tokens.refresh_token), at: new Date().toISOString() });
    headers.set('Location', siteOrigin() + '/?clinical=connected');
}
catch {
    headers.set('Location', siteOrigin() + '/?clinical=connection-failed');
} return new Response(null, { status: 302, headers }); }
export async function accessToken() { const value = await secrets().get('google', { type: 'json' }) as any; if (!value || value.email.toLowerCase() !== process.env.CLINICAL_OWNER_EMAIL?.trim().toLowerCase() || process.env.CLINICAL_OWNER_GOOGLE_SUB && value.sub !== process.env.CLINICAL_OWNER_GOOGLE_SUB)
    throw Error('Connect the clinical-owner Google account in Registry settings.'); const r = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ client_id: process.env.GOOGLE_CLIENT_ID || '', client_secret: process.env.GOOGLE_CLIENT_SECRET || '', refresh_token: decrypt(value.refresh), grant_type: 'refresh_token' }), signal: AbortSignal.timeout(15000) }); if (!r.ok)
    throw Error('Google authorization expired. Reconnect in Registry settings.'); return (await r.json()).access_token as string; }
export class GoogleClient {
    constructor(private token: string) { }
    async request(path: string, method = 'GET', body?: unknown, raw = false) { const r = await fetch('https://www.googleapis.com/' + path, { method, headers: { Authorization: 'Bearer ' + this.token, ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(20000) }); if (!r.ok)
        throw Error(`Google request failed (${r.status}). Check connection, permissions and retry.`); return raw ? r : r.status === 204 ? null : r.json(); }
    async values(id: string, range: string) { return (await this.request(`sheets/v4/spreadsheets/${id}/values/${encodeURIComponent(range)}?valueRenderOption=FORMATTED_VALUE`)).values || []; }
    async update(id: string, range: string, values: unknown[][]) { return this.request(`sheets/v4/spreadsheets/${id}/values/${encodeURIComponent(range)}?valueInputOption=RAW`, 'PUT', { values }); }
    async append(id: string, range: string, values: unknown[][]) { return this.request(`sheets/v4/spreadsheets/${id}/values/${encodeURIComponent(range)}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`, 'POST', { values }); }
    async uploadPdf(parent: string, id: string, bytes: Uint8Array) { const list = await this.request(`drive/v3/files?q=${encodeURIComponent(`'${parent}' in parents and trashed=false and appProperties has {key='registryPdf' and value='${id}'}`)}&fields=files(id)`); let file = list.files?.[0]; if (!file)
        file = await this.request('drive/v3/files?fields=id', 'POST', { name: 'Case-summary.pdf', parents: [parent], mimeType: 'application/pdf', appProperties: { registryPdf: id } }); const r = await fetch(`https://www.googleapis.com/upload/drive/v3/files/${file.id}?uploadType=media`, { method: 'PATCH', headers: { Authorization: 'Bearer ' + this.token, 'Content-Type': 'application/pdf' }, body: bytes as BodyInit, signal: AbortSignal.timeout(20000) }); if (!r.ok)
        throw Error('PDF upload failed. Retry processing.'); return file.id as string; }
}
export function privatePermissions(permissions: any[], email: string) { return Array.isArray(permissions) && permissions.length > 0 && permissions.every(p => p.type === 'user' && typeof p.emailAddress === 'string' && p.emailAddress.toLowerCase() === email.trim().toLowerCase()); }
export async function inspectClinicalPrivacy(client: GoogleClient) { const { SOURCES, DRIVE_PARENT } = await import('../../../lib/clinical/catalog'); return Promise.all([{ id: SOURCES.ravc.sheetId, label: 'RAVC response spreadsheet' }, { id: SOURCES.nodule.sheetId, label: 'Nodule response spreadsheet' }, { id: DRIVE_PARENT, label: 'Complications - U/S parent folder' }].map(async (item) => { const data = await client.request(`drive/v3/files/${item.id}?fields=id,trashed,permissions(type,role,emailAddress)&supportsAllDrives=true`); return { ...item, privateToOwner: !data.trashed && privatePermissions(data.permissions, process.env.CLINICAL_OWNER_EMAIL || '') }; })); }
