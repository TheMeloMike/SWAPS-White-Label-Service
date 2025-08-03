# SWAPS Security Deployment Checklist

## Pre-Deployment Steps

### 1. **Backup Current System** ⚠️
- [ ] Backup current `app.ts`
- [ ] Backup `package.json` and `package-lock.json`
- [ ] Backup any existing audit logs
- [ ] Note current npm package versions

### 2. **Review Changes**
- [ ] Review `app-security-enhanced.ts` for compatibility
- [ ] Check for any custom modifications in current `app.ts`
- [ ] Verify TypeScript version compatibility

## Deployment Steps

### 3. **Run Deployment Script**
```bash
chmod +x deploy-security-updates.sh
./deploy-security-updates.sh
```

### 4. **Manual Updates Required**

#### Update Error Handler
In `backend/src/middleware/errorHandler.ts`, find the error response section and update:

```typescript
// In the handle method, add production check:
if (process.env.NODE_ENV === 'production') {
  // Don't expose sensitive details in production
  const sanitizedError = {
    error: error.isOperational ? error.name : 'Internal Server Error',
    message: error.isOperational ? error.message : 'An error occurred',
    statusCode: statusCode,
    requestId: (req as any).id
  };
  
  res.status(statusCode).json(sanitizedError);
} else {
  // Development - full error details
  res.status(statusCode).json({
    error: error.name,
    message: error.message,
    stack: error.stack,
    statusCode: statusCode,
    ...error
  });
}
```

#### Update AuditLogger
The deployment script creates an updated version. You need to:
1. Review the changes in `AuditLogger-updated.ts`
2. Merge with your current `AuditLogger.ts`
3. Add the import: `import FileAuditStorage from './FileAuditStorage';`

### 5. **Environment Configuration**
Merge `.env.security` settings into your `.env`:

```bash
# Security Settings (add to .env)
ENABLE_AUDIT_PERSISTENCE=true
AUDIT_LOG_DIR=./data/audit
ENABLE_SECURITY_HEADERS=true
ENABLE_HELMET=true
VERBOSE_ERRORS=false  # Set false in production
```

## Post-Deployment Verification

### 6. **Compile and Test**
```bash
cd backend
npm run build  # Ensure TypeScript compiles
npm test       # Run existing tests
```

### 7. **Start Server and Verify**
```bash
npm start

# In another terminal:
chmod +x verify-security-deployment.sh
./verify-security-deployment.sh
```

### 8. **Check Security Headers**
```bash
curl -I http://localhost:3000/health

# Should see:
# X-Frame-Options: DENY
# X-Content-Type-Options: nosniff
# Strict-Transport-Security: max-age=...
```

### 9. **Verify Audit Logs**
```bash
# Make some API calls
curl -X POST http://localhost:3000/api/v1/discovery/trades \
  -H "X-API-Key: your-test-key" \
  -H "Content-Type: application/json" \
  -d '{"walletId": "test"}'

# Check logs exist
ls -la backend/data/audit/
cat backend/data/audit/audit-*.log | tail
```

### 10. **Test Rate Limiting**
```bash
# Run multiple requests quickly
for i in {1..10}; do
  curl -X POST http://localhost:3000/api/v1/discovery/trades \
    -H "X-API-Key: test-key" \
    -H "Content-Type: application/json" \
    -d '{"test": true}'
done

# Should see 429 errors after limit
```

## Production Deployment

### 11. **Update Deployment Platform**
- [ ] Set `NODE_ENV=production`
- [ ] Update environment variables
- [ ] Ensure audit directory permissions (writable)
- [ ] Configure log rotation if needed

### 12. **Monitor After Deployment**
- [ ] Check application logs for errors
- [ ] Verify audit logs are being written
- [ ] Monitor rate limit effectiveness
- [ ] Check memory usage (shouldn't increase significantly)

## Rollback Plan

If issues occur:
```bash
./rollback-security.sh
cd backend
npm install  # Restore original dependencies
npm run build
npm start
```

## Security Improvements Checklist

### Implemented by this deployment:
- [x] Helmet middleware for security headers
- [x] Custom security headers middleware
- [x] Global rate limiting
- [x] Endpoint-specific rate limits
- [x] Request size limits
- [x] Persistent audit logging
- [x] Error message sanitization
- [x] Security monitoring hooks

### Still needs manual implementation:
- [ ] Redis for distributed rate limiting
- [ ] Encryption at rest
- [ ] API key rotation
- [ ] Automated security scanning
- [ ] WAF configuration

## Notes

1. **Audit Logs**: Will create daily rotating files in `backend/data/audit/`
2. **Rate Limits**: Currently in-memory, will reset on restart
3. **Performance**: Security headers add <1ms latency
4. **Storage**: Audit logs will grow ~1MB per 10,000 requests

## Support

If you encounter issues:
1. Check `security-deployment.log`
2. Run `./verify-security-deployment.sh` for diagnostics
3. Review TypeScript compilation errors
4. Use rollback script if needed