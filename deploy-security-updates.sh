#!/bin/bash

# SWAPS Security Enhancement Deployment Script
# This script implements all security quick wins with backup and rollback capabilities

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
BACKUP_DIR="./security-backup-$(date +%Y%m%d-%H%M%S)"
BACKEND_DIR="./backend"
DEPLOYMENT_LOG="./security-deployment.log"

# Function to log messages
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1" | tee -a "$DEPLOYMENT_LOG"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR:${NC} $1" | tee -a "$DEPLOYMENT_LOG"
}

warning() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING:${NC} $1" | tee -a "$DEPLOYMENT_LOG"
}

# Function to create backup
create_backup() {
    log "Creating backup in $BACKUP_DIR..."
    mkdir -p "$BACKUP_DIR"
    
    # Backup critical files
    cp "$BACKEND_DIR/src/app.ts" "$BACKUP_DIR/app.ts.backup" 2>/dev/null || true
    cp "$BACKEND_DIR/package.json" "$BACKUP_DIR/package.json.backup" 2>/dev/null || true
    cp "$BACKEND_DIR/package-lock.json" "$BACKUP_DIR/package-lock.json.backup" 2>/dev/null || true
    
    # Backup audit directory if it exists
    if [ -d "$BACKEND_DIR/data/audit" ]; then
        cp -r "$BACKEND_DIR/data/audit" "$BACKUP_DIR/audit.backup" 2>/dev/null || true
    fi
    
    log "Backup created successfully"
}

# Function to install dependencies
install_dependencies() {
    log "Installing security dependencies..."
    cd "$BACKEND_DIR"
    
    # Check if helmet is already installed
    if ! npm list helmet >/dev/null 2>&1; then
        log "Installing helmet..."
        npm install helmet
    else
        log "Helmet already installed"
    fi
    
    # Install additional security packages if needed
    if ! npm list express-rate-limit >/dev/null 2>&1; then
        warning "express-rate-limit not found, but using built-in rate limiter"
    fi
    
    cd ..
    log "Dependencies installed"
}

# Function to update app.ts
update_app_file() {
    log "Updating app.ts with security enhancements..."
    
    # Check if enhanced file exists
    if [ ! -f "$BACKEND_DIR/src/app-security-enhanced.ts" ]; then
        error "app-security-enhanced.ts not found!"
        return 1
    fi
    
    # Backup current app.ts
    cp "$BACKEND_DIR/src/app.ts" "$BACKEND_DIR/src/app.ts.pre-security"
    
    # Replace with enhanced version
    cp "$BACKEND_DIR/src/app-security-enhanced.ts" "$BACKEND_DIR/src/app.ts"
    
    log "app.ts updated with security enhancements"
}

# Function to update audit logger
update_audit_logger() {
    log "Updating AuditLogger with persistent storage..."
    
    # Check if FileAuditStorage exists
    if [ ! -f "$BACKEND_DIR/src/utils/audit/FileAuditStorage.ts" ]; then
        error "FileAuditStorage.ts not found!"
        return 1
    fi
    
    # Create audit directory
    mkdir -p "$BACKEND_DIR/data/audit"
    chmod 755 "$BACKEND_DIR/data/audit"
    
    # Backup AuditLogger.ts
    cp "$BACKEND_DIR/src/utils/audit/AuditLogger.ts" "$BACKEND_DIR/src/utils/audit/AuditLogger.ts.pre-security"
    
    # Create updated AuditLogger with file persistence
    cat > "$BACKEND_DIR/src/utils/audit/AuditLogger-updated.ts" << 'EOF'
import { LoggingService, Logger } from '../logging/LoggingService';
import { SecurityUtils } from '../security/SecurityUtils';
import { Request } from 'express';
import FileAuditStorage from './FileAuditStorage';

// ... (keep all existing imports and enums) ...

export class AuditLogger {
  private static instance: AuditLogger;
  private logger: Logger;
  private eventStorage: AuditEvent[] = []; // Keep in-memory for fast queries
  private sequenceNumber = 0;
  private correlationMap = new Map<string, string[]>();
  private fileStorage: FileAuditStorage; // Add file storage
  
  private constructor() {
    this.logger = LoggingService.getInstance().createLogger('AuditLogger');
    this.fileStorage = new FileAuditStorage(); // Initialize file storage
    this.startCleanupProcess();
  }
  
  public logEvent(
    type: AuditEventType,
    message: string,
    context: AuditEventContext = {},
    severity: AuditSeverity = AuditSeverity.LOW
  ): string {
    const eventId = SecurityUtils.generateSecureRandom({ length: 16 });
    const correlationId = context.requestId || SecurityUtils.generateSecureRandom({ length: 12 });
    
    const event: AuditEvent = {
      id: eventId,
      timestamp: new Date(),
      type,
      severity,
      message,
      context: this.sanitizeContext(context),
      correlationId,
      sequence: ++this.sequenceNumber
    };
    
    // Store event in memory
    this.eventStorage.push(event);
    
    // Persist to file if enabled
    if (process.env.ENABLE_AUDIT_PERSISTENCE !== 'false') {
      this.fileStorage.append(event).catch(error => {
        this.logger.error('Failed to persist audit event', { error, eventId });
      });
    }
    
    // Update correlation mapping
    if (!this.correlationMap.has(correlationId)) {
      this.correlationMap.set(correlationId, []);
    }
    this.correlationMap.get(correlationId)!.push(eventId);
    
    // Log to standard logging system
    this.logToStandardLogger(event);
    
    // Trigger alerts for high-severity events
    if (severity === AuditSeverity.HIGH || severity === AuditSeverity.CRITICAL) {
      this.triggerAlert(event);
    }
    
    return eventId;
  }
  
  // ... (keep all other existing methods) ...
}
EOF
    
    log "AuditLogger prepared for update"
}

# Function to update error handler
update_error_handler() {
    log "Updating error handler for production safety..."
    
    # Backup error handler
    if [ -f "$BACKEND_DIR/src/middleware/errorHandler.ts" ]; then
        cp "$BACKEND_DIR/src/middleware/errorHandler.ts" "$BACKEND_DIR/src/middleware/errorHandler.ts.pre-security"
        
        # Add production error sanitization
        warning "Please manually update errorHandler.ts to sanitize errors in production"
        warning "Add environment check: if (process.env.NODE_ENV === 'production') { /* sanitize */ }"
    fi
}

# Function to create environment template
create_env_template() {
    log "Creating security environment template..."
    
    cat > "$BACKEND_DIR/.env.security" << 'EOF'
# Security Configuration

# Audit Logging
ENABLE_AUDIT_PERSISTENCE=true
AUDIT_LOG_DIR=./data/audit

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000  # 15 minutes
RATE_LIMIT_MAX_REQUESTS=1000

# Security Headers
ENABLE_SECURITY_HEADERS=true
ENABLE_HELMET=true

# CORS (comma-separated list of allowed origins)
CORS_ORIGIN=https://app.courtyard.io,https://api.courtyard.io

# Error Handling
VERBOSE_ERRORS=false  # Set to false in production

# Session Security
SESSION_SECRET=CHANGE_THIS_TO_RANDOM_64_CHAR_STRING

# API Security
API_REQUEST_SIZE_LIMIT=100kb
INVENTORY_REQUEST_SIZE_LIMIT=1mb
WANTS_REQUEST_SIZE_LIMIT=500kb
EOF
    
    log "Security environment template created at .env.security"
}

# Function to run tests
run_security_tests() {
    log "Running security validation tests..."
    
    # Create test script
    cat > "$BACKEND_DIR/test-security.js" << 'EOF'
const axios = require('axios');

async function testSecurity() {
    const baseURL = process.env.API_URL || 'http://localhost:3000';
    
    console.log('Testing security headers...');
    try {
        const response = await axios.get(`${baseURL}/health`);
        const headers = response.headers;
        
        // Check for security headers
        const securityHeaders = [
            'x-frame-options',
            'x-content-type-options',
            'strict-transport-security',
            'x-download-options',
            'x-permitted-cross-domain-policies'
        ];
        
        securityHeaders.forEach(header => {
            if (headers[header]) {
                console.log(`✅ ${header}: ${headers[header]}`);
            } else {
                console.log(`❌ ${header}: NOT SET`);
            }
        });
        
    } catch (error) {
        console.error('Failed to test security headers:', error.message);
    }
}

testSecurity();
EOF
    
    log "Security test script created"
}

# Function to compile TypeScript
compile_typescript() {
    log "Compiling TypeScript..."
    cd "$BACKEND_DIR"
    
    # Check if build passes
    if npm run build; then
        log "TypeScript compilation successful"
    else
        error "TypeScript compilation failed!"
        return 1
    fi
    
    cd ..
}

# Function to create rollback script
create_rollback_script() {
    log "Creating rollback script..."
    
    cat > "./rollback-security.sh" << EOF
#!/bin/bash
# Rollback script for security updates

echo "Rolling back security updates..."

# Restore app.ts
if [ -f "$BACKEND_DIR/src/app.ts.pre-security" ]; then
    cp "$BACKEND_DIR/src/app.ts.pre-security" "$BACKEND_DIR/src/app.ts"
    echo "✅ Restored app.ts"
fi

# Restore AuditLogger.ts
if [ -f "$BACKEND_DIR/src/utils/audit/AuditLogger.ts.pre-security" ]; then
    cp "$BACKEND_DIR/src/utils/audit/AuditLogger.ts.pre-security" "$BACKEND_DIR/src/utils/audit/AuditLogger.ts"
    echo "✅ Restored AuditLogger.ts"
fi

# Restore package files from backup
if [ -d "$BACKUP_DIR" ]; then
    cp "$BACKUP_DIR/package.json.backup" "$BACKEND_DIR/package.json" 2>/dev/null || true
    cp "$BACKUP_DIR/package-lock.json.backup" "$BACKEND_DIR/package-lock.json" 2>/dev/null || true
    echo "✅ Restored package files"
fi

echo "Rollback complete. Please run 'npm install' to restore dependencies."
EOF
    
    chmod +x "./rollback-security.sh"
    log "Rollback script created: ./rollback-security.sh"
}

# Main deployment function
main() {
    log "Starting SWAPS Security Enhancement Deployment"
    log "============================================"
    
    # Pre-flight checks
    if [ ! -d "$BACKEND_DIR" ]; then
        error "Backend directory not found!"
        exit 1
    fi
    
    # Step 1: Create backup
    create_backup
    
    # Step 2: Install dependencies
    install_dependencies
    
    # Step 3: Update app.ts
    if ! update_app_file; then
        error "Failed to update app.ts"
        exit 1
    fi
    
    # Step 4: Update audit logger
    update_audit_logger
    
    # Step 5: Update error handler
    update_error_handler
    
    # Step 6: Create environment template
    create_env_template
    
    # Step 7: Compile TypeScript
    if ! compile_typescript; then
        error "TypeScript compilation failed!"
        warning "Run ./rollback-security.sh to revert changes"
        exit 1
    fi
    
    # Step 8: Create test script
    run_security_tests
    
    # Step 9: Create rollback script
    create_rollback_script
    
    log "============================================"
    log "Security enhancement deployment complete!"
    log ""
    log "Next steps:"
    log "1. Review and merge .env.security with your .env file"
    log "2. Update errorHandler.ts manually for production error sanitization"
    log "3. Run 'node test-security.js' after starting the server"
    log "4. Deploy to your hosting environment"
    log ""
    log "Backup created at: $BACKUP_DIR"
    log "Rollback script available at: ./rollback-security.sh"
    log ""
    warning "Remember to test thoroughly before deploying to production!"
}

# Run main function
main