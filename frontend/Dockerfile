# Use official Node.js alpine image
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Install dependencies first (for caching)
COPY package*.json ./
RUN npm install

# Copy the rest of the application
COPY . .

# Expose port (default Next.js)
EXPOSE 3000

# Start development server
CMD ["npm", "run", "dev"]
