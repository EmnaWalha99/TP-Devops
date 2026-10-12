FROM node:22-alpine

ENV NODE_ENV=production
ENV PORT=3000

WORKDIR /app

# on copie seulement les fichiers de dependances pour le cache
COPY package*.json ./

# Installation des dépendances de production uniquement (npm ci = versions exactes du lock)
# puis suppression du cache npm
RUN npm ci --omit=dev && npm cache clean --force

COPY . .

USER node

# Port utilisé par l'application
EXPOSE 3000

CMD ["node", "app.js"]
