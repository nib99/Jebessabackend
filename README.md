# JHS Engineering and Trade Website Deployment

## Local Setup
1. Clone repo: `git clone <repo-url>`
2. Install backend deps: `cd backend && npm install`
3. Copy `.env.example` to `.env` and fill values.
4. Run Mongo locally or use Atlas.
5. Start: `npm run dev` (dev) or `npm start` (prod).
6. Access: Site at http://localhost:5000, Admin at http://localhost:5000/admin

## Deployment to Render.com (Recommended - Free Tier)
1. Create Render account (render.com).
2. New Web Service > Build from Git repo.
3. Settings:
   - Root Directory: `.` (full repo)
   - Build Command: `cd backend && npm install`
   - Start Command: `cd backend && npm start`
   - Environment: Node
   - Add .env vars from your .env file.
4. Deploy! Custom domain: Add via Render DNS.
5. Mongo: Use MongoDB Atlas (free tier) - add MONGO_URI to env.

## Alternatives
- **Heroku**: Similar to Render, but dyno sleeps on free tier.
- **AWS**: EC2 for backend, S3 for static frontend if separated.
- **Vercel**: For frontend only (static) + separate backend on Render.

## Post-Deployment
- Upload images via AdminJS.
- Test password reset: Visit /forgot-password.html
- Monitor: Add logging (e.g., Winston) if needed.
- SSL: Render provides free HTTPS.
- Backup: Schedule Mongo dumps.

Contact for issues: info@jhsengineering.com
