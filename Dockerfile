FROM node:22-alpine AS builder
WORKDIR /app

# Install native dependencies required by some node packages (like bcrypt)
RUN apk add --no-cache libc6-compat python3 make g++

# Copy root configs
COPY package.json package-lock.json* ./

# Copy the entire workspace
COPY . .

# Install all dependencies (this installs shared-types symlinks correctly)
RUN npm install

# Build the backend
RUN npm --workspace=apps/os-backend run build

# Build the frontend (Disable Next metrics)
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm --workspace=apps/os-frontend run build

# ---
# Runner Stage
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Install concurrently to run both backend and frontend from one container
RUN npm install -g concurrently

# Copy node_modules and configurations from the builder
COPY --from=builder /app/package.json ./
COPY --from=builder /app/package-lock.json* ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages ./packages

# Copy Built Backend
COPY --from=builder /app/apps/os-backend/package.json ./apps/os-backend/
COPY --from=builder /app/apps/os-backend/dist ./apps/os-backend/dist

# Ensure backend runtime folders exist (e.g., uploads if any)
RUN mkdir -p /app/apps/os-backend/uploads

# Copy Built Frontend
COPY --from=builder /app/apps/os-frontend/package.json ./apps/os-frontend/
COPY --from=builder /app/apps/os-frontend/.next ./apps/os-frontend/.next
COPY --from=builder /app/apps/os-frontend/public ./apps/os-frontend/public

# Expose mapping ports
EXPOSE 3000
EXPOSE 3001

# Start both servers
CMD ["concurrently", "-n", "backend,frontend", "-c", "bgBlue,bgGreen", "\"npm --workspace=apps/os-backend run start:prod\"", "\"npm --workspace=apps/os-frontend run start\""]
