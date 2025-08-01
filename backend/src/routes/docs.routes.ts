/**
 * Documentation Routes
 * Serves OpenAPI/Swagger documentation for the SWAPS White Label API
 */

import { Router } from 'express';
import swaggerJSDoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import { swaggerDefinition, apiPaths } from '../utils/docs/swagger';

const router = Router();

// Combine the swagger definition with the paths
const swaggerSpec = {
  ...swaggerDefinition,
  paths: apiPaths
};

// Generate the final swagger documentation
const swaggerDocs = swaggerJSDoc({
  definition: swaggerSpec,
  apis: [] // We're defining paths manually
});

// Serve swagger documentation
router.use('/docs', swaggerUi.serve);
router.get('/docs', swaggerUi.setup(swaggerDocs, {
  customCss: `
    .swagger-ui .topbar { display: none; }
    .swagger-ui .info { margin: 50px 0; }
    .swagger-ui .info .title { color: #3b82f6; }
    .swagger-ui .scheme-container { background: #f8fafc; }
  `,
  customSiteTitle: 'SWAPS White Label API Documentation',
  swaggerOptions: {
    persistAuthorization: true,
    displayRequestDuration: true,
    docExpansion: 'list',
    filter: true,
    showExtensions: true,
    showCommonExtensions: true
  }
}));

// Serve raw OpenAPI JSON
router.get('/docs.json', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(swaggerDocs);
});

// Redirect /api-docs to /docs for compatibility
router.get('/api-docs', (req, res) => {
  res.redirect('/docs');
});

export default router; 