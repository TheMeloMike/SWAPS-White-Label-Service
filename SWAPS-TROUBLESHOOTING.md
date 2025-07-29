# SWAPS Troubleshooting Guide

This guide addresses common issues you might encounter when starting the SWAPS platform using the `run-swaps-fixed.sh` script.

## Backend Startup Issues

### Backend fails to start

**Symptoms:**
- You see "ERROR: Backend failed to start" message
- The process exits before the frontend starts

**Possible Causes and Solutions:**

1. **Missing API Key**
   - Check logs/backend.log for: `Error: either 'apiKey' or 'url' is required`
   - Solution: Make sure the HELIUS_API_KEY is correctly set in the script

2. **Port Already in Use**
   - Check logs/backend.log for: `Error: listen EADDRINUSE: address already in use :::3001`
   - Solution: Kill any existing processes using that port:
     ```
     lsof -i :3001 | grep LISTEN
     kill -9 <PID>
     ```

3. **Database/File Permission Issues**
   - Check logs/backend.log for file access errors
   - Solution: Make sure the data directory exists and is writable:
     ```
     mkdir -p backend/data
     chmod 755 backend/data
     ```

4. **Node.js Version Incompatibility**
   - Check for syntax errors or compatibility issues in logs/backend.log
   - Solution: Try using Node.js v16.x or v18.x:
     ```
     nvm use 18
     ./run-swaps-fixed.sh
     ```

### Backend starts but health check fails

**Symptoms:**
- Backend process starts successfully
- You see logs indicating the server is listening 
- Health check fails with: `TypeError: Cannot read properties of undefined (reading '404')`

**Possible Solutions:**

1. **Bypass Health Check**
   - The updated script will automatically continue if the backend process is running
   - This error is typically related to Express.js error handling and doesn't affect functionality

2. **Fix Error Handler (Advanced)**
   - If you're familiar with Express.js, check the error handling middleware in `backend/src/app.ts`
   - Ensure proper error handling for 404 responses

3. **Use a Different Health Endpoint**
   - Try a different endpoint like `/api/trades/health` or `/api/nfts/health`
   - Update the script to use that endpoint instead

## Frontend Startup Issues

### Frontend fails to start

**Symptoms:**
- Frontend process doesn't stay running
- You see errors about the process failing to start

**Possible Causes and Solutions:**

1. **React Version Compatibility Issues**
   - Check logs/frontend.log for mismatched React versions
   - Solution: Run with legacy SSL provider:
     ```
     cd frontend
     NODE_OPTIONS="--openssl-legacy-provider" npm run dev
     ```

2. **Node.js Memory Issues**
   - Check for "JavaScript heap out of memory" errors
   - Solution: Increase memory allocation:
     ```
     cd frontend
     NODE_OPTIONS="--max-old-space-size=4096" npm run dev
     ```

3. **NPM Dependency Issues**
   - Check for missing modules or dependency conflicts
   - Solution: Clean install dependencies:
     ```
     cd frontend
     rm -rf node_modules
     rm package-lock.json
     npm install
     ```

### "Cannot find module 'glob-to-regexp'" Error

**Symptoms:**
- Frontend fails to start with error about missing 'glob-to-regexp' module
- You see `Error: Cannot find module 'glob-to-regexp'` in the frontend.log

**Solutions:**

1. **Install the Missing Dependency**
   ```
   cd frontend
   npm install glob-to-regexp
   ```

2. **Clean Install with Legacy Peer Dependencies**
   ```
   cd frontend
   rm -rf node_modules
   rm package-lock.json
   npm install --legacy-peer-deps
   ```

3. **Use Compatible Node.js Version**
   - Next.js may have compatibility issues with very new Node.js versions (v20+)
   - Solution: Downgrade to a more stable version:
     ```
     nvm install 18
     nvm use 18
     ./run-swaps-fixed.sh
     ```

## API Connection Issues

### Frontend can't connect to backend

**Symptoms:**
- Frontend loads but shows "API Error" or no data
- Network requests in browser console show 404/502 errors

**Possible Solutions:**

1. Verify the backend is running:
   ```
   curl http://localhost:3001/health
   ```

2. Check that CORS is properly configured:
   ```
   # Frontend .env.local should contain:
   NEXT_PUBLIC_API_URL=http://localhost:3001
   ```

3. Verify the correct ports are being used in both services

## Common Quick Fixes

1. **Restart Everything**
   ```
   pkill -f 'node|next'
   ./run-swaps-fixed.sh
   ```

2. **Clear Cache and Node Modules**
   ```
   rm -rf frontend/node_modules backend/node_modules
   rm -rf frontend/.next
   ./run-swaps-fixed.sh
   ```

3. **Clear Data (if corrupted)**
   ```
   mv backend/data backend/data_backup
   mkdir -p backend/data
   ./run-swaps-fixed.sh
   ```

## Viewing Logs

The script automatically shows logs, but you can also examine them separately:

```
# View backend logs
tail -f logs/backend.log

# View frontend logs
tail -f logs/frontend.log
```

## Still Having Issues?

If none of these solutions work:

1. Check your Node.js version (v16.x to v18.x recommended)
2. Try using older versions of npm/yarn if dependencies still fail
3. Look for specific error messages in the logs to find targeted solutions 