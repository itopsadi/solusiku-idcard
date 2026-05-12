# Stage 1: Build the Vite app
FROM node:20-alpine AS builder
WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci

# Copy source code and build
COPY . .
# Perhatian: Pastikan .env sudah ada bersama file source code di server sebelum build berjalan
RUN npm run build

# Stage 2: Serve with Apache HTTPD (Super Lightweight)
FROM httpd:alpine

# Copy built static files to Apache DocumentRoot
COPY --from=builder /app/dist/ /usr/local/apache2/htdocs/

# Enable mod_rewrite and AllowOverride so .htaccess can process SPA routing
RUN sed -i '/LoadModule rewrite_module/s/^#//g' /usr/local/apache2/conf/httpd.conf && \
    sed -i 's/AllowOverride None/AllowOverride All/g' /usr/local/apache2/conf/httpd.conf

EXPOSE 80
