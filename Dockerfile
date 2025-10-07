# Production-grade Dockerfile for Browser Agent
# Uses official Playwright image with all browsers pre-installed

FROM mcr.microsoft.com/playwright:v1.47.0-jammy

# Set working directory
WORKDIR /app

# Install Node.js 20 LTS (if not already in image)
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y nodejs

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY src ./src
COPY public ./public

# Build TypeScript
RUN npm run build

# Create directories for outputs
RUN mkdir -p /app/screenshots /app/logs /app/traces

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => {if (r.statusCode !== 200) throw new Error('Unhealthy')})"

# Run in server mode by default
ENV MODE=server
ENV HEADLESS=true
ENV PORT=3000

CMD ["node", "dist/agent/index.js"]

