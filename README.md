# TP Docker – Visit-Counter

App Node.js (Express) + Redis qui compte les visites. Explications détaillées : `Compte_Rendu_TP_Docker.docx`.

## Partie 0 : Environnement

```bash
docker version
docker login
mkdir TP_Docker_NOM_PRENOM
```

## Partie 1 : Dockerfile

```bash
npm init -y
npm install express redis
docker build -t counter-app:1.0 .
docker images counter-app                    # 251 Mo
docker run --rm counter-app:1.0 whoami       # "node" : pas root
```

- Image `node:22-alpine` : légère et moins de failles.
- `package*.json` copié avant le code : cache Docker.
- `RUN` s'exécute au build, `CMD` au démarrage du conteneur.

## Partie 2 : Réseau et Volume

```bash
docker network create app-network
docker volume create redis-data
docker run -d --name db-service --network app-network -v redis-data:/data redis:alpine redis-server --appendonly yes
docker run -d --name web-app --network app-network -p 80:3000 counter-app:1.0
docker network inspect app-network
```

Test de robustesse : `docker rm -f db-service`, puis relancer Redis. Le compteur continue grâce au volume et à `--appendonly yes`.

## Partie 3 : Docker Compose

```bash
docker rm -f web-app db-service              # libérer le port 80
docker compose up -d --build
docker compose up -d --scale web=3           # erreur : port is already allocated
docker compose ps -a
docker compose down
```

**Pourquoi pas 3 instances sur le même port ?** Un port de l'hôte ne peut être pris que par un seul conteneur. `web-1` prend le port 80, `web-2` et `web-3` sont refusés.

**Solution :** un Load Balancer (Nginx) seul sur le port 80, qui répartit les requêtes entre les 3 instances `web` (qui n'exposent plus de port).

## Partie 4 : Publication et Nettoyage

```bash
docker tag counter-app:1.0 emnawalha99/counter-app:1.0
docker push emnawalha99/counter-app:1.0
docker compose down
docker system prune -a                       # deep clean
```

Image publique : https://hub.docker.com/r/emnawalha99/counter-app

⚠️ `docker system prune -a` supprime aussi les images des autres projets. Pour ne nettoyer que ce TP : `docker compose down --rmi all -v --remove-orphans`.

## Partie C : Pipeline (GitHub Actions)

`.github/workflows/ci.yml` se lance à chaque push sur `master` :

1. **test** : `npm ci` + `npm test` (2 tests unitaires avec un faux Redis, `app.test.js`)
2. **docker** (seulement si les tests passent) : build de l'image puis push sur Docker Hub (tags `run_number` et `latest`)

```bash
npm test                                     # lancer les tests en local
git push                                     # déclenche le pipeline
```

Secret GitHub requis : `TP_DEVOPS` = token Docker Hub en **Read & Write**.
