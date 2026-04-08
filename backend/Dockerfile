FROM node:20-alpine

WORKDIR /app

RUN apk add --no-cache netcat-openbsd

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

RUN cp ./docker-entrypoint.sh /usr/local/bin/pace42-entrypoint.sh && chmod +x /usr/local/bin/pace42-entrypoint.sh

EXPOSE 3004

ENTRYPOINT ["/bin/sh", "/usr/local/bin/pace42-entrypoint.sh"]
CMD ["npm", "run", "start:dev"]
