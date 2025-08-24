# Use official Node.js runtime as base image
FROM node:alpine

# Set working directory in container
WORKDIR /app

# Copy package.json and package-lock.json (if available)
COPY package*.json ./

# Install dependencies
RUN npm install --only=production

# Copy application code
COPY ddns-updater.js ./

# Create directories for mounted volumes
RUN mkdir -p /app/data

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001
RUN chown -R nodejs:nodejs /app
USER nodejs

# Expose any ports if needed (not required for this service)
# EXPOSE 3000

# Command to run the application
CMD ["node", "ddns-updater.js"]
