# Stage 1: Build
FROM node:22-alpine AS build

WORKDIR /app

# Copy package files plus the local .npmrc so npm honours
# `min-release-age` (npm 11.10+) during install.
# Literal .npmrc (not glob) — fail loudly if the file goes missing.
COPY package*.json .npmrc ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Vite inlines env vars at BUILD time, so the API base must be baked in here —
# a runtime `environment:` var on the served static bundle has no effect. The
# compose file passes this as a build arg pointing at the local engine; it
# defaults to the public Fabraix API (api.fabraix.com) for a plain `docker build`.
ARG VITE_API_URL=https://api.fabraix.com/v1
ENV VITE_API_URL=$VITE_API_URL

# Build the application
RUN npm run build

# Stage 2: Serve
FROM node:22-alpine AS production

WORKDIR /app

# .npmrc carries the min-release-age policy into the global install below.
# Literal .npmrc (not glob) — fail loudly if the file goes missing.
COPY .npmrc ./

# Install serve globally — pinned to a 7+ day-old version.
RUN npm install -g serve@14.2.6

# Copy built assets from build stage
COPY --from=build /app/dist ./dist

# Expose the static server port
EXPOSE 8080

USER node

# Run the static server
CMD ["serve", "-s", "dist", "-l", "8080"]