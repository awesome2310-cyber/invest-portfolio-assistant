FROM node:22-bookworm-slim
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build
RUN npm install --no-save serve
ENV NODE_ENV=production
EXPOSE 43123
CMD ["npx", "serve", "out", "-l", "43123"]
