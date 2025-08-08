# NBA Game Logs - Deployment Guide

## Environment Configuration

### Required Environment Variables

Before deploying, you **must** update the following variables in `.env.production`:

#### 🔧 **Mandatory Updates**
```env
# Replace with your actual production backend API URL
REACT_APP_API_BASE_URL=https://your-backend-api.com

# Update with your actual domain
REACT_APP_SITE_URL=https://your-domain.com
REACT_APP_SITE_TITLE=NBA Game Logs - Advanced Basketball Analytics
REACT_APP_SITE_DESCRIPTION=Interactive NBA game logs analysis with advanced filtering, natural language queries, and comprehensive data visualization for basketball statistics.
REACT_APP_SITE_IMAGE=https://your-domain.com/og-image.png
```

#### 📊 **Optional Analytics & Monitoring**
```env
# Google Analytics (replace with your GA4 measurement ID)
REACT_APP_GA_TRACKING_ID=G-XXXXXXXXXX

# Error tracking (replace with your Sentry project DSN)
REACT_APP_SENTRY_DSN=https://your-sentry-dsn@sentry.io/project-id

# Session recording (replace with your LogRocket app ID)
REACT_APP_LOGROCKET_APP_ID=your-app-id/project-name
```

## Deployment Steps

### 1. **Build the Application**
```bash
npm run build
```

### 2. **Deploy to Static Hosting**

#### Option A: Netlify
1. Drag and drop the `build` folder to Netlify
2. Configure environment variables in Netlify dashboard
3. Set up custom domain (optional)

#### Option B: Vercel

1. Add `vercel.json` at project root:
```json
{
  "version": 2,
  "builds": [
    { "src": "package.json", "use": "@vercel/static-build", "config": { "distDir": "build" } }
  ],
  "routes": [
    { "handle": "filesystem" },
    { "src": "/.*", "dest": "/index.html" }
  ]
}
```
2. In Vercel Project → Settings → Environment Variables, set:
   - `REACT_APP_API_BASE_URL=https://your-backend-api.com`
   - Optionally other `REACT_APP_*` vars used by `src/config.js`
3. Deploy via CLI:
```bash
npm install -g vercel
vercel
vercel --prod
```
   Or connect the repo in the Vercel dashboard and deploy from there.

#### Option C: AWS S3 + CloudFront
1. Upload `build` folder contents to S3 bucket
2. Configure S3 for static website hosting
3. Set up CloudFront distribution
4. Configure custom domain with Route 53

#### Option D: GitHub Pages
```bash
npm install --save-dev gh-pages
```
Add to package.json:
```json
{
  "homepage": "https://yourusername.github.io/nba-game-logs",
  "scripts": {
    "predeploy": "npm run build",
    "deploy": "gh-pages -d build"
  }
}
```
Then run: `npm run deploy`

### 3. **Backend API Requirements**

Your backend API must be deployed and accessible at the URL specified in `REACT_APP_API_BASE_URL`. The frontend expects these endpoints:

- `GET /api/players` - List of all players
- `GET /api/teams` - List of all teams  
- `GET /api/game_logs` - Game logs data with filtering
- `GET /api/players/profile` - Player profile data
- `GET /api/teams/stats` - Team statistics
- `POST /api/nl-query` - Natural language query processing

### 4. **CORS Configuration**

Ensure your backend API allows requests from your frontend domain:

```python
# Flask example
from flask_cors import CORS

app = Flask(__name__)
CORS(app, origins=['https://your-domain.com'])
```

## Security Considerations

### 1. **Environment Variables**
- Never commit `.env.production` with real credentials to git
- Use your hosting platform's environment variable settings
- Keep `GENERATE_SOURCEMAP=false` in production

### 2. **Content Security Policy**
Consider adding CSP headers to your hosting configuration:
```
Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' https://your-backend-api.com;
```

### 3. **HTTPS**
- Always use HTTPS in production
- Most hosting platforms provide free SSL certificates
- Update all API URLs to use HTTPS

## Testing Production Build

Before deploying, test the production build locally:

```bash
npm run build
npx serve -s build
```

Visit http://localhost:3000 to test the production build.

## Monitoring & Analytics

After deployment, monitor:
- Application performance
- Error rates
- User analytics
- API response times

## Troubleshooting

### Common Issues:

1. **API Connection Failed**
   - Check `REACT_APP_API_BASE_URL` is correct
   - Verify backend is running and accessible
   - Check CORS configuration

2. **Blank Page After Deployment**
   - Check browser console for errors
   - Verify all environment variables are set
   - Ensure build completed successfully

3. **Routing Issues**
   - Configure your hosting platform for SPA routing
   - Set up redirects to serve `index.html` for all routes

## Performance Optimization

- Enable gzip compression on your hosting platform
- Set up CDN for static assets
- Configure proper cache headers
- Monitor bundle size with webpack-bundle-analyzer

---

**Need Help?** Check the logs in your browser's developer console and your backend API logs for detailed error information.