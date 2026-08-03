FROM node:20-slim

# sharp/canvas-style native deps
RUN apt-get update && apt-get install -y \
    python3 make g++ libvips-dev ffmpeg \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

COPY . .

EXPOSE 3000

CMD ["node", "index.js"]
