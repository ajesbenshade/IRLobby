# Use Node.js 18 Alpine for smaller image size
FROM node:18-alpine

# Force rebuild to ensure client files are created
ARG BUILD_DATE
RUN echo "Build timestamp: $BUILD_DATE"

# Install curl for health checks
RUN apk add --no-cache curl

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (including dev dependencies for build)
RUN npm ci

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Remove dev dependencies to reduce image size
RUN npm prune --production

# Expose port
EXPOSE 4001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:$PORT/api/health || exit 1

# Start the application
CMD ["npm", "start"]
