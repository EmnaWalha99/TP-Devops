# Jenkins + Node.js (pour les tests) + Docker CLI (pour build/push l'image)
FROM jenkins/jenkins:lts
COPY --from=node:22-bookworm-slim /usr/local/ /usr/local/
COPY --from=docker:cli /usr/local/bin/docker /usr/local/bin/docker
COPY --from=docker:cli /usr/local/libexec/docker/cli-plugins/docker-buildx /usr/local/libexec/docker/cli-plugins/docker-buildx
