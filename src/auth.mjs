import { createRemoteJWKSet, customFetch, jwtVerify } from 'jose';
import { AcademyError } from '../public/game/course-progress.js';

const TEAM_DOMAIN = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.cloudflareaccess\.com$/;
const AUDIENCE = /^[A-Za-z0-9_-]{16,256}$/;
const LOOPBACK = new Set(['localhost', '127.0.0.1', '[::1]']);

export function accessConfiguration(env) {
  const team = env.ACCESS_TEAM_DOMAIN;
  const audience = env.ACCESS_AUD;
  if (typeof team !== 'string' || !TEAM_DOMAIN.test(team) ||
      typeof audience !== 'string' || !AUDIENCE.test(audience)) {
    throw new AcademyError('access_not_configured',
      'Academy sign-in is not configured. Ask the college administrator to finish Cloudflare Access setup for this address.', 503);
  }
  return { team, audience, issuer: `https://${team}`, jwks: `https://${team}/cdn-cgi/access/certs` };
}

// The optional fetch implementation is used by offline tests to supply a real
// signed JWKS without an HTTP server. Production uses jose's normal fetch.
export function createAuthenticator({ fetchJWKS } = {}) {
  const keySets = new Map();
  return async function authenticate(request, env) {
    const localMode = env.DEV_MODE === 'true';
    if (localMode) {
      const localID = env.DEV_USER_ID;
      if (env.ENVIRONMENT !== 'development' || !LOOPBACK.has(new URL(request.url).hostname) ||
          typeof localID !== 'string' || !/^[A-Za-z0-9_-]{1,80}$/.test(localID)) {
        throw new AcademyError('development_identity_blocked',
          'Development sign-in is allowed only on the configured local development server.', 503);
      }
      return `local:${localID}`;
    }

    const config = accessConfiguration(env);
    const token = request.headers.get('Cf-Access-Jwt-Assertion');
    if (!token || token.length > 16_384) {
      throw new AcademyError('sign_in_required',
        'Sign in through your college’s Cloudflare Access page to load your saved academy.', 401);
    }
    let jwks = keySets.get(config.jwks);
    if (!jwks) {
      jwks = createRemoteJWKSet(new URL(config.jwks), {
        timeoutDuration: 5_000,
        ...(fetchJWKS ? { [customFetch]: fetchJWKS } : {}),
      });
      keySets.set(config.jwks, jwks);
    }
    try {
      const { payload } = await jwtVerify(token, jwks, {
        issuer: config.issuer,
        audience: config.audience,
        algorithms: ['RS256'],
        requiredClaims: ['iss', 'aud', 'sub', 'iat', 'exp'],
        clockTolerance: 5,
      });
      if (typeof payload.sub !== 'string' || !payload.sub.trim() || payload.sub.length > 128) {
        throw new Error('Missing stable user subject');
      }
      // Only the verified JWT subject identifies a student. Neither request
      // bodies, email headers nor the former hosting service's ID are trusted.
      return `access:${config.team}:${payload.sub}`;
    } catch {
      throw new AcademyError('sign_in_required',
        'Your academy sign-in could not be verified. Sign in again through Cloudflare Access.', 401);
    }
  };
}
