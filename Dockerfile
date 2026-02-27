FROM node:20-slim

WORKDIR /app

RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json* ./
RUN npm install

COPY . .
RUN sed -i '1s/^\xEF\xBB\xBF//' package.json prisma/schema.prisma && ./node_modules/.bin/prisma generate

EXPOSE 3050
CMD ["sh", "-c", "./node_modules/.bin/prisma db push && npm run dev -- --hostname 0.0.0.0 --port 3050"]
