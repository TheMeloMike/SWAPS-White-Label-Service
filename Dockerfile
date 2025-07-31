# SWAPS White Label API - Production Dockerfile
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Install dependencies
COPY backend/package*.json ./
RUN npm install --only=production

# Copy application code
COPY backend/src ./src
COPY backend/tests ./tests
COPY backend/.env.example ./.env.example
COPY backend/tsconfig.json ./tsconfig.json
COPY backend/jest.config.js ./jest.config.js

# Create data directory for persistence
RUN mkdir -p ./data

# Set production environment
ENV NODE_ENV=production
ENV PORT=3000
ENV LOG_LEVEL=info
ENV ENABLE_PERSISTENCE=true
ENV DATA_DIR=./data

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD curl -f http://localhost:3000/api/v1/health || exit 1

# Start the application
CMD ["npm", "start"] 