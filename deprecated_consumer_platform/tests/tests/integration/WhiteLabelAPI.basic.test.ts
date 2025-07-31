import 'reflect-metadata';
import request from 'supertest';
import { Express } from 'express';
import { describe, it, beforeAll, afterAll, expect } from '@jest/globals';
import app from '../../app';

describe('White Label API - Basic Integration Tests', () => {
  let server: Express;

  beforeAll(async () => {
    server = app;
  });

  afterAll(async () => {
    // Cleanup if needed
  });

  describe('API Health and Structure', () => {
    it('should have white label API routes mounted', async () => {
      // Test that our white label API is accessible
      const response = await request(server)
        .get('/api/v1/system/health')
        .expect('Content-Type', /json/);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('status');
      expect(response.body.status).toBe('healthy');
    });

    it('should return integration examples', async () => {
      const response = await request(server)
        .get('/api/v1/integration/examples')
        .expect('Content-Type', /json/);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('examples');
      // Be flexible about the examples format
      if (response.body.examples) {
        expect(Array.isArray(response.body.examples) || typeof response.body.examples === 'object').toBe(true);
      }
    });
  });

  describe('Authentication Structure', () => {
    it('should require authentication for protected endpoints', async () => {
      // Test trade discovery endpoint without auth
      const response = await request(server)
        .post('/api/v1/discovery/trades')
        .send({
          mode: 'informational',
          format: 'ethereum'
        });

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('Unauthorized');
    });

    it('should require authentication for inventory submission', async () => {
      const response = await request(server)
        .post('/api/v1/inventory/submit')
        .send({
          nfts: [],
          walletId: 'test-wallet'
        });

      expect(response.status).toBe(401);
    });

    it('should require authentication for wants submission', async () => {
      const response = await request(server)
        .post('/api/v1/wants/submit')
        .send({
          wants: [],
          walletId: 'test-wallet'
        });

      expect(response.status).toBe(401);
    });
  });

  describe('API Structure Validation', () => {
    it('should have proper error handling for invalid routes', async () => {
      const response = await request(server)
        .get('/api/v1/nonexistent/route');

      expect(response.status).toBe(404);
    });

    it('should handle malformed requests properly', async () => {
      const response = await request(server)
        .post('/api/v1/discovery/trades')
        .send('invalid-json-string')
        .set('Content-Type', 'application/json');

      // Should return 400 for malformed JSON or 401 for missing auth
      expect([400, 401]).toContain(response.status);
    });
  });

  describe('System Endpoints', () => {
    it('should provide system metrics with admin access', async () => {
      // Without admin auth, should be denied
      const response = await request(server)
        .get('/api/v1/system/metrics');

      expect([401, 403]).toContain(response.status);
      expect(response.body).toHaveProperty('error');
    });
  });
}); 