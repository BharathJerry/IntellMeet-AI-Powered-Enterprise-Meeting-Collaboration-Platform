# ---- stage 1: build the React app ----
FROM node:20-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci || npm install
COPY . .
# Vite bakes these in at build time
ARG VITE_API_URL
ARG VITE_GOOGLE_CLIENT_ID
ARG VITE_TURN_URL
ARG VITE_TURN_USER
ARG VITE_TURN_PASS
ENV VITE_API_URL=$VITE_API_URL VITE_GOOGLE_CLIENT_ID=$VITE_GOOGLE_CLIENT_ID \
    VITE_TURN_URL=$VITE_TURN_URL VITE_TURN_USER=$VITE_TURN_USER VITE_TURN_PASS=$VITE_TURN_PASS
RUN npm run build

# ---- stage 2: serve the static files with nginx ----
FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
