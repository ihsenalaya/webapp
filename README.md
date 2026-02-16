# Azure WebApp Deployment Notes

This repository contains a built static single-page app (`index.html` + `*.js` + `*.css`).

If Azure Web App shows only the default Azure page, the app files are usually not served from `wwwroot` root, or `index.html` is not selected as default.

## Files added for Azure App Service (Windows/IIS)

- `web.config`: sets `index.html` as default document and rewrites SPA routes to `index.html`.
- `server.js` + `package.json`: starts a static SPA server for Linux App Service Node runtime.

## Security hardening included

- Security headers (CSP, HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy).
- Method restriction to `GET`, `HEAD`, `OPTIONS` on `server.js`.
- Cache policy: `index.html` is `no-store`, hashed static assets are cached with `immutable`.
- Frontend bundle patch: MSAL cache changed from LocalStorage to SessionStorage and token preview logging removed.

## Deploy checklist

1. Deploy files at the root of `wwwroot` (not inside a subfolder like `dist/`).
2. Confirm `index.html` exists in `/site/wwwroot`.
3. If your Web App is **Linux + Node**, set Runtime Stack to Node 20 LTS.
4. For Linux, either:
   - leave Startup Command empty and let Azure run `npm start`, or
   - set Startup Command explicitly to `node server.js`.
5. If you prefer PM2 instead of `server.js`, use:
   - `pm2 serve /home/site/wwwroot --no-daemon --spa --port 8080`
6. Restart the Web App after deployment.
