# SWAPS Deployment Guide

This guide will help you deploy the SWAPS application to a public environment.

## Prerequisites

- A GitHub account (for connecting to Vercel, Railway, or Heroku)
- Node.js 16+ installed on your local machine
- Helius API key

## Deployment Options

### Option 1: Vercel (Frontend) + Railway (Backend)

This is the recommended setup for ease of deployment.

#### Frontend Deployment (Vercel)

1. Push your code to a GitHub repository
2. Visit [Vercel](https://vercel.com/) and sign up/login with your GitHub account
3. Click "New Project" and select your repository
4. Configure project:
   - Framework Preset: Next.js
   - Root Directory: frontend
   - Environment Variables: 
     - `NEXT_PUBLIC_API_URL`: Your backend API URL (after deployment)
5. Click "Deploy"

#### Backend Deployment (Railway)

1. Visit [Railway](https://railway.app/) and sign up/login with GitHub
2. Click "New Project" → "Deploy from GitHub repo"
3. Select your repository
4. Configure:
   - Root Directory: backend
   - Environment Variables:
     - `HELIUS_API_KEY`: Your Helius API key
     - `CORS_ORIGIN`: Your frontend URL (e.g., https://swaps-frontend.vercel.app)
     - `NODE_ENV`: production
5. Deploy and note the URL provided
6. Go back to your Vercel project and update the `NEXT_PUBLIC_API_URL` with this URL

### Option 2: Vercel + Heroku

#### Frontend Deployment (Vercel)

Same as Option 1.

#### Backend Deployment (Heroku)

1. Create a [Heroku](https://heroku.com/) account
2. Install the [Heroku CLI](https://devcenter.heroku.com/articles/heroku-cli)
3. Log in and create a new app:
   ```bash
   heroku login
   heroku create swaps-backend
   ```
4. Set environment variables:
   ```bash
   heroku config:set HELIUS_API_KEY=your_api_key
   heroku config:set CORS_ORIGIN=your_frontend_url
   heroku config:set NODE_ENV=production
   ```
5. Deploy:
   ```bash
   git subtree push --prefix backend heroku main
   ```
6. Get your Heroku app URL and update the frontend's `NEXT_PUBLIC_API_URL` in Vercel

## Manual Deployment

If you prefer to deploy to your own server:

### Backend

1. SSH into your server
2. Clone your repository
3. Navigate to the backend directory
4. Create a `.env` file with:
   ```
   HELIUS_API_KEY=your_api_key
   CORS_ORIGIN=your_frontend_url
   PORT=3001
   NODE_ENV=production
   ```
5. Install dependencies and build:
   ```bash
   npm install
   npm run build
   ```
6. Use PM2 to keep the service running:
   ```bash
   npm install -g pm2
   pm2 start dist/index.js --name swaps-backend
   pm2 save
   ```
7. Set up Nginx to proxy requests to your backend

### Frontend

1. Update `.env.production` with:
   ```
   NEXT_PUBLIC_API_URL=your_backend_url
   ```
2. Build the frontend:
   ```bash
   npm run build
   ```
3. Deploy the `.next` directory to your server
4. Set up Nginx to serve the frontend

## Verifying Deployment

Once deployed, test the following:
1. Homepage loads correctly
2. Wallet connection works
3. NFT search functions properly
4. Trade discovery works
5. Trade impact visualization appears

## Troubleshooting

- **CORS errors**: Ensure the `CORS_ORIGIN` in your backend matches your frontend URL exactly
- **API connection issues**: Check the `NEXT_PUBLIC_API_URL` in your frontend settings
- **Image loading problems**: Ensure domain is allowed in `next.config.js`

## Updating the Deployment

To update your application after changes:
1. Push changes to your GitHub repository
2. Vercel and Railway will automatically deploy updates
3. For Heroku, run `git subtree push --prefix backend heroku main` 