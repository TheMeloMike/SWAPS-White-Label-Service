# SWAPS Shell Scripts Organization

This directory contains all shell scripts for the SWAPS White Label API, organized by functionality for easy maintenance and execution.

## Directory Structure

### 🚀 **deployment/** (3 files)
Deployment and infrastructure automation scripts:
- Production deployment automation
- Railway platform deployment
- Local deployment testing

**Scripts:**
- `deploy-simple.sh` - Simple production deployment
- `deploy-to-railway.sh` - Railway platform deployment automation
- `test-local-deployment.sh` - Local deployment validation

### 🧪 **testing/** (3 files)
Testing automation and validation scripts:
- Comprehensive test suite execution
- Algorithm testing automation
- Development server testing

**Scripts:**
- `run-all-tests.sh` - Execute complete test suite
- `test-canonical-engine.sh` - Test canonical algorithm engine
- `test-dev-server.sh` - Development server validation

### 🔒 **security/** (2 files)
Security enhancement and validation scripts:
- Security update deployment
- Security configuration verification

**Scripts:**
- `deploy-security-updates.sh` - Deploy security enhancements
- `verify-security-deployment.sh` - Verify security implementations

### ⚙️ **setup/** (1 file)
System setup and configuration scripts:
- Infrastructure component setup
- Environment configuration

**Scripts:**
- `setup-kafka-local.sh` - Local Kafka environment setup

## Usage Guidelines

### Making Scripts Executable
```bash
chmod +x scripts/[category]/[script-name].sh
```

### Running Scripts
```bash
# From project root
./scripts/[category]/[script-name].sh

# Example: Run deployment
./scripts/deployment/deploy-to-railway.sh

# Example: Run all tests
./scripts/testing/run-all-tests.sh
```

### Script Dependencies

**Common Requirements:**
- Unix-like environment (macOS, Linux, WSL)
- Node.js and npm installed
- Environment variables configured (.env file)

**Specific Requirements:**

**Deployment Scripts:**
- Railway CLI (for Railway deployment)
- Docker (for containerized deployment)
- Production environment variables

**Testing Scripts:**
- Test data and fixtures
- `ADMIN_API_KEY` environment variable
- Live API access (for integration tests)

**Security Scripts:**
- Admin privileges (for system-level changes)
- Security environment variables
- TypeScript compiler (`npm install typescript`)

**Setup Scripts:**
- Docker and Docker Compose
- System package managers (brew, apt, etc.)

## Script Descriptions

### Deployment Scripts

#### `deploy-simple.sh`
- **Purpose**: Simple production deployment
- **Usage**: Quick deployment for updates
- **Requirements**: Production credentials configured

#### `deploy-to-railway.sh`
- **Purpose**: Railway platform deployment automation
- **Usage**: Automated Railway deployment pipeline
- **Requirements**: Railway CLI configured

#### `test-local-deployment.sh`
- **Purpose**: Validate local deployment setup
- **Usage**: Test deployment process locally
- **Requirements**: Docker and local environment

### Testing Scripts

#### `run-all-tests.sh`
- **Purpose**: Execute comprehensive test suite
- **Usage**: Complete system validation
- **Requirements**: All test dependencies installed

#### `test-canonical-engine.sh`
- **Purpose**: Test canonical algorithm engine
- **Usage**: Validate core algorithm functionality
- **Requirements**: Algorithm test data

#### `test-dev-server.sh`
- **Purpose**: Development server validation
- **Usage**: Quick development environment testing
- **Requirements**: Development dependencies

### Security Scripts

#### `deploy-security-updates.sh`
- **Purpose**: Deploy security enhancements
- **Usage**: Automated security feature deployment
- **Requirements**: TypeScript, security environment variables

#### `verify-security-deployment.sh`
- **Purpose**: Verify security implementations
- **Usage**: Validate security features are working
- **Requirements**: curl, jq, admin API access

### Setup Scripts

#### `setup-kafka-local.sh`
- **Purpose**: Local Kafka environment setup
- **Usage**: Configure Kafka for development/testing
- **Requirements**: Docker, Docker Compose

## Best Practices

### Before Running Scripts
1. **Review the script contents** to understand what it does
2. **Backup important data** before running deployment/setup scripts
3. **Test in development** before running in production
4. **Check requirements** are met for each script

### Environment Variables
Many scripts require environment variables. Common ones include:
```bash
# API Configuration
ADMIN_API_KEY=your_admin_key
API_BASE_URL=https://your-api-url

# Security Configuration
ENCRYPTION_MASTER_KEY=your_encryption_key
VERBOSE_ERRORS=false

# Deployment Configuration
RAILWAY_TOKEN=your_railway_token
```

### Error Handling
- Scripts include error checking and validation
- Check script output for success/failure indicators
- Logs are typically written to console and/or log files

## Script Execution Examples

### Full System Deployment
```bash
# 1. Deploy security updates
./scripts/security/deploy-security-updates.sh

# 2. Verify security deployment
./scripts/security/verify-security-deployment.sh

# 3. Deploy to Railway
./scripts/deployment/deploy-to-railway.sh

# 4. Run comprehensive tests
./scripts/testing/run-all-tests.sh
```

### Development Workflow
```bash
# 1. Set up local environment
./scripts/setup/setup-kafka-local.sh

# 2. Test development server
./scripts/testing/test-dev-server.sh

# 3. Test local deployment
./scripts/deployment/test-local-deployment.sh
```

### Security Update Workflow
```bash
# 1. Deploy security updates
./scripts/security/deploy-security-updates.sh

# 2. Verify deployment worked
./scripts/security/verify-security-deployment.sh

# 3. Run algorithm tests to ensure no regressions
./scripts/testing/test-canonical-engine.sh
```

## Maintenance Notes

- **Scripts are version controlled** with the rest of the codebase
- **Test scripts locally** before committing changes
- **Update documentation** when adding new scripts or changing functionality
- **Use consistent error handling** patterns across all scripts
- **Include usage examples** in script headers when possible

## Historical Context

These scripts were developed to automate various aspects of the SWAPS system:

1. **Deployment Scripts**: Created for reliable, repeatable deployments
2. **Testing Scripts**: Developed during algorithm optimization phase
3. **Security Scripts**: Built during enterprise security implementation
4. **Setup Scripts**: Created for development environment consistency

**Total Scripts Organized**: 9 files across 4 categories

## Getting Help

For script-specific help, most scripts support the `--help` flag:
```bash
./scripts/[category]/[script-name].sh --help
```

Or review the script header comments for detailed usage information.