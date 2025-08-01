/**
 * Jest Test Setup Configuration
 * Configures environment variables for testing
 */

import 'jest';

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'error'; // Reduce noise in tests
process.env.ENABLE_KAFKA = 'false'; // Disable Kafka for tests
process.env.ADMIN_API_KEY = 'test-admin-key'; 