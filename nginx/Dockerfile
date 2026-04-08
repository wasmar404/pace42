FROM nginx:alpine

RUN apk add --no-cache openssl

# Generate self-signed certificate at build time.
# CN / SAN covers localhost and common LAN patterns — swap for a real cert in production.
RUN mkdir -p /etc/nginx/ssl && \
    openssl req -x509 -nodes -days 3650 -newkey rsa:2048 \
      -keyout /etc/nginx/ssl/key.pem \
      -out  /etc/nginx/ssl/cert.pem \
      -subj "/C=FR/ST=IDF/L=Paris/O=42/CN=localhost" \
      -addext "subjectAltName=IP:127.0.0.1,DNS:localhost,DNS:backend"

COPY nginx.conf /etc/nginx/nginx.conf
