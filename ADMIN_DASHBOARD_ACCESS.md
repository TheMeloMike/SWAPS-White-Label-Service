# SWAPS Admin Dashboard Access

## Overview
The SWAPS Performance Dashboard is a secure admin interface that provides real-time system metrics, performance analytics, and operational insights. This dashboard is **not publicly accessible** and requires admin authentication.

## Access Instructions

### 1. Admin Login
- **URL**: `/admin/login`
- **Default Credentials**:
  - Username: `admin`
  - Password: `swaps-admin-2024`

### 2. Environment Configuration
For production deployment, configure the following environment variables:

```bash
# Backend Environment Variables
ADMIN_USERNAME=your_admin_username
ADMIN_PASSWORD=your_secure_admin_password
JWT_SECRET=your_jwt_secret_key_min_32_chars
JWT_EXPIRES_IN=24h
```

### 3. Security Features
- **JWT Authentication**: Secure token-based authentication
- **Session Management**: 24-hour token expiration (configurable)
- **Request Logging**: Failed login attempts are logged
- **Route Protection**: All dashboard API endpoints require authentication
- **Auto-logout**: Sessions expire automatically

## Dashboard Features

### 📊 Performance Metrics
- **System Health**: Real-time health monitoring with component breakdown
- **KPIs**: Active users, completed trades, success rates, system uptime
- **Memory Analysis**: Detailed memory usage breakdown by component
- **Error Tracking**: Real-time error rates and system alerts

### 🔍 Analytics & Insights
- **Trade Analytics**: Multi-party trade performance and efficiency
- **User Behavior**: User engagement and trading patterns  
- **Business Intelligence**: Revenue, volume, and growth metrics
- **System Insights**: Automated anomaly detection and recommendations

### ⚠️ Alerts & Monitoring
- **Real-time Alerts**: Configurable thresholds for critical metrics
- **System Bottlenecks**: Identification of performance issues
- **Actionable Recommendations**: AI-powered optimization suggestions
- **Health Breakdown**: Component-level system health analysis

## Access Flow
1. Navigate to `/admin/login`
2. Enter admin credentials
3. Successful authentication redirects to `/dashboard`
4. Dashboard displays real-time metrics and analytics
5. Use logout button to end session securely

## Security Notes
- Dashboard access is logged and monitored
- Only authorized personnel should access the admin interface
- Failed login attempts are tracked for security auditing
- All dashboard data is sensitive and should be treated as confidential

## Troubleshooting
- **Login Failed**: Check credentials and ensure backend is running
- **Token Expired**: Re-login through `/admin/login`
- **Access Denied**: Verify admin authentication is properly configured
- **Dashboard Not Loading**: Check network connectivity and backend health

## Technical Details
- **Authentication**: JWT tokens with configurable expiration
- **API Protection**: All `/api/dashboard/*` endpoints require admin auth
- **Storage**: Tokens stored securely in browser localStorage
- **Validation**: Automatic token validation on page load
- **Logout**: Secure token cleanup on logout

---

**⚠️ Important**: This dashboard contains sensitive system information and should only be accessed by authorized administrators. Keep credentials secure and do not share access with unauthorized personnel. 