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

# Enable required modules for SPA routing and Reverse Proxy
RUN sed -i '/LoadModule rewrite_module/s/^#//g' /usr/local/apache2/conf/httpd.conf && \
    sed -i '/LoadModule proxy_module/s/^#//g' /usr/local/apache2/conf/httpd.conf && \
    sed -i '/LoadModule proxy_http_module/s/^#//g' /usr/local/apache2/conf/httpd.conf && \
    sed -i '/LoadModule ssl_module/s/^#//g' /usr/local/apache2/conf/httpd.conf && \
    sed -i 's/AllowOverride None/AllowOverride All/g' /usr/local/apache2/conf/httpd.conf

# Inject Reverse Proxy Config to bypass SSL (Server-Side)
RUN echo "SSLProxyEngine on" >> /usr/local/apache2/conf/httpd.conf && \
    echo "SSLProxyVerify none" >> /usr/local/apache2/conf/httpd.conf && \
    echo "SSLProxyCheckPeerCN off" >> /usr/local/apache2/conf/httpd.conf && \
    echo "SSLProxyCheckPeerName off" >> /usr/local/apache2/conf/httpd.conf && \
    echo "SSLProxyCheckPeerExpire off" >> /usr/local/apache2/conf/httpd.conf && \
    echo "ProxyPass /glpi-proxy https://glpi.cb2.07.solusiku/api.php/v1" >> /usr/local/apache2/conf/httpd.conf && \
    echo "ProxyPassReverse /glpi-proxy https://glpi.cb2.07.solusiku/api.php/v1" >> /usr/local/apache2/conf/httpd.conf

EXPOSE 80
