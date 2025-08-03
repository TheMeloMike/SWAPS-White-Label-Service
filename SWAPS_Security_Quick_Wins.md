# SWAPS Security Quick Wins - Low Hanging Fruit

## 🍎 Immediate Fixes (< 1 Hour Each)

### 1. Enable Security Headers Middleware ⚡
**Impact**: HIGH | **Effort**: 5 minutes

The code already exists in `backend/src/middleware/securityHeaders.ts` but isn't enabled!

**Fix in `app.ts`**:
```typescript
import { SecurityHeaders } from './middleware/securityHeaders';

// Add after CORS configuration (line 66)
app.use(SecurityHeaders.api());
```

**What this prevents**:
- ✅ Clickjacking attacks (X-Frame-Options)
- ✅ MIME type sniffing (X-Content-Type-Options)
- ✅ XSS attacks (additional layer)

---

### 2. Add Helmet Middleware 🪖
**Impact**: HIGH | **Effort**: 10 minutes

**Install and configure**:
```bash
npm install helmet
```

**Add to `app.ts`**:
```typescript
import helmet from 'helmet';

// Add after CORS (line 66)
app.use(helmet({
  contentSecurityPolicy: false, // Not needed for API
  crossOriginEmbedderPolicy: false // Not needed for API
}));
```

**What Helmet adds**:
- ✅ X-DNS-Prefetch-Control
- ✅ X-Download-Options  
- ✅ X-Permitted-Cross-Domain-Policies
- ✅ Strict-Transport-Security (HSTS)
- ✅ Hide X-Powered-By header

---

### 3. Make Audit Logs Persistent 📝
**Impact**: CRITICAL | **Effort**: 30 minutes

Currently logs are in-memory only! Add file persistence:

**Create `backend/src/utils/audit/FileAuditStorage.ts`**:
```typescript
import * as fs from 'fs/promises';
import * as path from 'path';
import { AuditEvent } from './AuditLogger';

export class FileAuditStorage {
  private auditDir: string;
  
  constructor() {
    this.auditDir = process.env.AUDIT_LOG_DIR || './data/audit';
    this.ensureDirectoryExists();
  }
  
  async append(event: AuditEvent): Promise<void> {
    const date = new Date().toISOString().split('T')[0];
    const filename = `audit-${date}.log`;
    const filepath = path.join(this.auditDir, filename);
    
    const logLine = JSON.stringify({
      ...event,
      timestamp: event.timestamp.toISOString()
    }) + '\n';
    
    await fs.appendFile(filepath, logLine, 'utf8');
  }
  
  private async ensureDirectoryExists(): Promise<void> {
    try {
      await fs.mkdir(this.auditDir, { recursive: true });
    } catch (error) {
      // Directory might already exist
    }
  }
}
```

**Update `AuditLogger.ts` to use file storage**:
```typescript
// Add to logEvent method after line 180
if (process.env.ENABLE_AUDIT_PERSISTENCE !== 'false') {
  const fileStorage = new FileAuditStorage();
  await fileStorage.append(event);
}
```

---

### 4. Add Request Size Limits 📏
**Impact**: MEDIUM | **Effort**: 5 minutes

Currently using 10MB limit - too generous!

**Update in `app.ts`**:
```typescript
// Replace line 73
app.use('/api/v1/inventory', express.json({ limit: '1mb' }));
app.use('/api/v1/wants', express.json({ limit: '500kb' }));
app.use('/api/v1', express.json({ limit: '100kb' })); // Default for others
```

---

### 5. Reduce Error Verbosity in Production 🤐
**Impact**: MEDIUM | **Effort**: 15 minutes

**Update `backend/src/middleware/errorHandler.ts`**:
```typescript
// In the handle method, check environment
if (process.env.NODE_ENV === 'production') {
  // Don't expose stack traces or internal errors
  const sanitizedError = {
    error: 'Internal Server Error',
    message: error.isOperational ? error.message : 'An error occurred',
    requestId: (req as any).id
  };
  res.status(statusCode).json(sanitizedError);
} else {
  // Development - full error details
  res.status(statusCode).json({
    error: error.name,
    message: error.message,
    stack: error.stack,
    ...error
  });
}
```

---

### 6. Enable Rate Limiting on All Routes 🚦
**Impact**: HIGH | **Effort**: 10 minutes

Rate limiting exists but isn't applied everywhere!

**Update `backend/src/routes/whiteLabelApi.routes.ts`**:
```typescript
import { RateLimiters } from '../middleware/enhancedRateLimit';

// Apply to all routes
router.use(RateLimiters.standard);

// Add stricter limits for specific endpoints
router.post('/inventory/submit', RateLimiters.heavy, ...);
router.post('/wants/submit', RateLimiters.heavy, ...);
```

---

### 7. Add Security Event Monitoring 📊
**Impact**: MEDIUM | **Effort**: 20 minutes

**Create `backend/src/utils/security/SecurityMonitor.ts`**:
```typescript
export class SecurityMonitor {
  private static failures = new Map<string, number>();
  
  static recordFailure(key: string, type: 'auth' | 'rate_limit' | 'validation') {
    const count = this.failures.get(key) || 0;
    this.failures.set(key, count + 1);
    
    // Alert on suspicious activity
    if (count > 10) {
      logger.warn('Suspicious activity detected', {
        key,
        type,
        failures: count
      });
    }
  }
}
```

---

## 🎯 Implementation Priority

1. **Enable Security Headers** (5 min) - Biggest bang for buck
2. **Add Helmet** (10 min) - Industry standard protection
3. **Persistent Audit Logs** (30 min) - Critical for investigations
4. **Rate Limiting Everywhere** (10 min) - Prevent abuse
5. **Request Size Limits** (5 min) - Prevent DoS
6. **Error Message Sanitization** (15 min) - Don't leak info
7. **Security Monitoring** (20 min) - Detect attacks

**Total Time: ~1.5 hours** for significant security improvements!

---

## 📋 Quick Testing After Implementation

```bash
# Test security headers
curl -I https://your-api.com/health

# Should see:
# X-Frame-Options: DENY
# X-Content-Type-Options: nosniff
# Strict-Transport-Security: max-age=...

# Test rate limiting
for i in {1..100}; do curl -X POST https://your-api.com/api/v1/discovery/trades; done

# Test audit logging
tail -f ./data/audit/audit-2025-01-28.log
```

---

## 🚀 Next Steps After Quick Wins

Once these are done, consider:
- Redis for distributed rate limiting
- Encryption at rest for sensitive data
- API key rotation mechanism
- Automated security scanning
- WAF (Web Application Firewall) at CDN level

These quick wins will dramatically improve your security posture with minimal effort!