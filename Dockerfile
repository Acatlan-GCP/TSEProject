FROM node:22-bookworm-slim
WORKDIR /app
COPY --chown=node:node package.json *.mjs ./
COPY --chown=node:node public ./public
USER node
ENV HOST=0.0.0.0
EXPOSE 8080
CMD ["node", "server.mjs"]
