#!/bin/bash

# SWAPS Security Verification Script
# Run this after deployment to verify all security enhancements are active

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
API_URL="${API_URL:-http://localhost:3000}"
API_KEY="${API_KEY:-swaps_test_security_verification}"

echo -e "${BLUE}SWAPS Security Verification Script${NC}"
echo "=================================="
echo "API URL: $API_URL"
echo ""

# Function to check endpoint
check_endpoint() {
    local endpoint=$1
    local method=${2:-GET}
    local expected_status=${3:-200}
    
    echo -n "Testing $method $endpoint... "
    
    response=$(curl -s -w "\n%{http_code}" -X "$method" \
        -H "X-API-Key: $API_KEY" \
        -H "Content-Type: application/json" \
        "$API_URL$endpoint" 2>/dev/null || echo "000")
    
    status_code=$(echo "$response" | tail -n1)
    headers=$(curl -sI -X "$method" -H "X-API-Key: $API_KEY" "$API_URL$endpoint" 2>/dev/null || echo "")
    
    if [ "$status_code" = "$expected_status" ]; then
        echo -e "${GREEN}✓ ($status_code)${NC}"
    else
        echo -e "${RED}✗ (Got $status_code, expected $expected_status)${NC}"
    fi
    
    echo "$headers" > /tmp/last_headers.txt
}

# Function to check security header
check_header() {
    local header=$1
    local expected_value=$2
    
    echo -n "  Checking $header... "
    
    value=$(grep -i "^$header:" /tmp/last_headers.txt | cut -d' ' -f2- | tr -d '\r\n' || echo "")
    
    if [ -n "$value" ]; then
        if [ -n "$expected_value" ] && [ "$value" != "$expected_value" ]; then
            echo -e "${YELLOW}⚠ Present but unexpected: $value${NC}"
        else
            echo -e "${GREEN}✓ $value${NC}"
        fi
    else
        echo -e "${RED}✗ Not found${NC}"
    fi
}

# Function to test rate limiting
test_rate_limiting() {
    local endpoint=$1
    local limit=$2
    local window=$3
    
    echo -e "\n${BLUE}Testing rate limiting on $endpoint (limit: $limit/$window)${NC}"
    
    success_count=0
    for i in $(seq 1 $((limit + 5))); do
        response=$(curl -s -o /dev/null -w "%{http_code}" -X POST \
            -H "X-API-Key: $API_KEY" \
            -H "Content-Type: application/json" \
            -d '{"test": true}' \
            "$API_URL$endpoint" 2>/dev/null || echo "000")
        
        if [ "$response" = "200" ] || [ "$response" = "201" ] || [ "$response" = "404" ]; then
            ((success_count++))
        elif [ "$response" = "429" ]; then
            echo -e "${GREEN}✓ Rate limit enforced after $success_count requests${NC}"
            return 0
        fi
    done
    
    echo -e "${RED}✗ Rate limit not enforced (got $success_count successful requests)${NC}"
}

# Function to test request size limit
test_size_limit() {
    local endpoint=$1
    local size_kb=$2
    
    echo -e "\n${BLUE}Testing request size limit on $endpoint (${size_kb}KB payload)${NC}"
    
    # Generate payload of specified size
    payload=$(python3 -c "import json; print(json.dumps({'data': 'x' * ($size_kb * 1024)}))" 2>/dev/null || \
              node -e "console.log(JSON.stringify({data: 'x'.repeat($size_kb * 1024)}))")
    
    response=$(curl -s -o /dev/null -w "%{http_code}" -X POST \
        -H "X-API-Key: $API_KEY" \
        -H "Content-Type: application/json" \
        -d "$payload" \
        "$API_URL$endpoint" 2>/dev/null || echo "000")
    
    if [ "$response" = "413" ]; then
        echo -e "${GREEN}✓ Request size limit enforced${NC}"
    else
        echo -e "${RED}✗ Large request accepted (status: $response)${NC}"
    fi
}

# Function to check audit logs
check_audit_logs() {
    echo -e "\n${BLUE}Checking audit log persistence${NC}"
    
    if [ -d "./backend/data/audit" ]; then
        log_count=$(find ./backend/data/audit -name "*.log" -type f | wc -l)
        if [ "$log_count" -gt 0 ]; then
            echo -e "${GREEN}✓ Audit logs found: $log_count file(s)${NC}"
            latest_log=$(ls -t ./backend/data/audit/*.log 2>/dev/null | head -1)
            if [ -n "$latest_log" ]; then
                echo "  Latest log: $(basename "$latest_log")"
                echo "  Size: $(wc -l < "$latest_log") lines"
            fi
        else
            echo -e "${YELLOW}⚠ Audit directory exists but no logs found${NC}"
        fi
    else
        echo -e "${RED}✗ Audit directory not found${NC}"
    fi
}

# Function to test error message sanitization
test_error_sanitization() {
    echo -e "\n${BLUE}Testing error message sanitization${NC}"
    
    # Trigger an error with invalid JSON
    response=$(curl -s -X POST \
        -H "X-API-Key: $API_KEY" \
        -H "Content-Type: application/json" \
        -d '{invalid json}' \
        "$API_URL/api/v1/inventory/submit" 2>/dev/null || echo "{}")
    
    if echo "$response" | grep -q "stack\|SyntaxError.*position\|Unexpected token"; then
        echo -e "${RED}✗ Verbose error details exposed${NC}"
        echo "  Response: $(echo "$response" | head -c 100)..."
    else
        echo -e "${GREEN}✓ Error messages sanitized${NC}"
    fi
}

# Main verification
echo -e "${BLUE}1. Testing Security Headers${NC}"
echo "=============================="

check_endpoint "/health"
check_header "X-Frame-Options" "DENY"
check_header "X-Content-Type-Options" "nosniff"
check_header "X-Download-Options" "noopen"
check_header "X-Permitted-Cross-Domain-Policies" "none"
check_header "Strict-Transport-Security"
check_header "X-XSS-Protection"

echo -e "\n${BLUE}2. Testing API Endpoints${NC}"
echo "========================"

check_endpoint "/api/v1/health"
check_endpoint "/api/v1/inventory/submit" "POST" "400"  # Should fail without body
check_endpoint "/api/v1/wants/submit" "POST" "400"      # Should fail without body
check_endpoint "/api/v1/discovery/trades" "POST" "400"  # Should fail without body

echo -e "\n${BLUE}3. Testing Rate Limiting${NC}"
echo "======================="

test_rate_limiting "/api/v1/discovery/trades" 60 "1 minute"

echo -e "\n${BLUE}4. Testing Request Size Limits${NC}"
echo "============================"

test_size_limit "/api/v1/inventory/submit" 2048  # 2MB should fail for 1MB limit
test_size_limit "/api/v1/wants/submit" 1024     # 1MB should fail for 500KB limit

echo -e "\n${BLUE}5. Testing Audit Logs${NC}"
echo "==================="

check_audit_logs

echo -e "\n${BLUE}6. Testing Error Handling${NC}"
echo "======================="

test_error_sanitization

echo -e "\n${BLUE}7. Summary${NC}"
echo "========="

# Count successes
if [ -f /tmp/last_headers.txt ]; then
    security_headers=$(grep -E "^(X-Frame-Options|X-Content-Type-Options|Strict-Transport-Security):" /tmp/last_headers.txt | wc -l)
    echo -e "Security Headers Active: ${security_headers}/3 minimum required"
fi

echo ""
echo -e "${YELLOW}Note: Some tests may fail if the server is not running or configured differently.${NC}"
echo -e "${YELLOW}Review the output above and address any ${RED}✗${YELLOW} items before production deployment.${NC}"

# Cleanup
rm -f /tmp/last_headers.txt