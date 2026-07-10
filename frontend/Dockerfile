# Frontend Dockerfile - build Vite + servizio statico con nginx

# --- Stage 1: build ---
FROM node:20-alpine AS build
WORKDIR /app

# VITE_API_BASE_URL viene "bruciato" nel bundle in fase di build.
ARG VITE_API_BASE_URL=http://localhost:8000
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}

COPY package.json package-lock.json* ./
RUN npm install

COPY . .
RUN npm run build

# --- Stage 2: runtime ---
FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
