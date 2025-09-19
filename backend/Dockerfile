# Use Node.js LTS version
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package files first for better caching
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy source code
COPY . .

# ✅ Create storage directory with proper permissions BEFORE creating user
RUN mkdir -p /app/storage && chmod 755 /app/storage

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# ✅ Set ownership of entire app directory to nodejs user
RUN chown -R nodejs:nodejs /app

# ✅ Ensure storage directory has write permissions
RUN chmod 755 /app/storage && chown -R nodejs:nodejs /app/storage

# Switch to non-root user
USER nodejs

# Expose port 5000
EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD node -e "require('http').get('http://localhost:5000/api/health', (res) => process.exit(res.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

# Start the application
CMD ["node", "index.js"]