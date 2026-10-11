# TP Docker – Visit-Counter

App web qui compte les visites, avec deux conteneurs :

- **web** : l'app Node.js (Express)
- **db-service** : Redis, qui garde le compteur

---

## Partie 0 : Environnement

```bash
docker version                # vérifier que Docker est installé
docker login                  # se connecter à Docker Hub
mkdir TP_Docker_NOM_PRENOM    # créer le dossier du TP
```

---

## Partie 1 : Application et Dockerfile

**Installer les dépendances**

```bash
npm init -y
npm install express redis
```

**`app.js`** se connecte à Redis (`db-service`), ajoute 1 à la clé `hits` à chaque visite et affiche le compteur avec l'ID du conteneur.

**Dockerfile**

- `node:22-alpine` : Alpine est un Linux très léger, donc l'image est plus petite.
- On copie `package*.json` avant le code pour profiter du cache Docker.
- `USER node` : l'app ne tourne pas en root.

**`.dockerignore`** : évite de mettre `node_modules`, `.env` et `.git` dans l'image.

**Construire l'image et vérifier sa taille**

```bash
docker build -t counter-app:1.0 .            # construire l'image
docker images counter-app                    # voir la taille
docker run --rm counter-app:1.0 whoami       # doit afficher "node" (pas root)
```

Taille : **251 Mo** (62 Mo compressée sur Docker Hub).

**RUN vs CMD**

- `RUN` : exécuté pendant la construction de l'image.
- `CMD` : exécuté au démarrage du conteneur.

---

## Partie 2 : Réseau et Volume

**Créer le réseau et le volume**

```bash
docker network create app-network
docker volume create redis-data
```

**Lancer Redis puis l'app**

```bash
docker run -d --name db-service --network app-network -v redis-data:/data redis:alpine redis-server --appendonly yes
docker run -d --name web-app --network app-network -p 80:3000 counter-app:1.0
```

`--appendonly yes` : Redis écrit chaque modification sur le disque, donc le compteur n'est pas perdu si le conteneur est supprimé.

**Tester**

Ouvrir http://localhost (ou `curl http://localhost`) : le compteur monte à chaque visite.

```bash
docker network inspect app-network    # db-service et web-app doivent apparaître
```

**Test de robustesse**

```bash
docker rm -f db-service
docker run -d --name db-service --network app-network -v redis-data:/data redis:alpine redis-server --appendonly yes
```

Après la relance, le compteur continue au lieu de repartir à 1 : les données sont dans le volume `redis-data`.

**En cas de problème**

```bash
docker logs web-app                   # voir les messages de l'app
docker rm -f web-app db-service       # tout supprimer pour recommencer
```

---

## Partie 3 : Docker Compose

### Commandes

```bash
docker rm -f web-app db-service        # libérer le port 80 (conteneurs de la Partie 2)
docker compose config                  # vérifier le YAML avec les variables du .env remplacées
docker compose up -d --build           # construire l'image et lancer web + db-service
docker compose ps                      # voir les conteneurs
docker compose logs -f                 # suivre les logs (Ctrl+C pour quitter)
curl http://localhost                  # tester l'app
docker compose up -d --scale web=3     # lancer 3 instances de web
docker compose ps -a                   # web-1 "Up", web-2 et web-3 "Created" (non démarrés)
docker compose down                    # tout arrêter (le volume est gardé)
docker compose down -v                 # tout arrêter + supprimer le volume
```

### Fichiers

- `docker-compose.yml` : services `web` et `db-service`, réseau `app-network`, volume `redis-data`, variables d'environnement.
- `.env` : `HOST_PORT=80`, `APP_PORT=3000`, `REDIS_HOST=db-service`. Dans le YAML : `"${HOST_PORT}:${APP_PORT}"`.
- `.env.example` : copie du `.env` envoyée sur Git (le `.env` est dans le `.gitignore`). Après un clone : `copy .env.example .env`.

Le compteur repart à 1 : Compose crée son propre volume (`visit-counter_redis-data`), différent de celui de la Partie 2.

### Question : pourquoi ne peut-on pas accéder aux 3 instances sur le même port hôte ?

Avec `ports: "80:3000"`, **chaque** instance demande à Docker de réserver le port 80 de la machine hôte.
Or un port de l'hôte ne peut être ouvert que par **un seul** conteneur à la fois :

1. `web-1` démarre et prend le port 80.
2. `web-2` et `web-3` demandent aussi le port 80, Docker refuse :

```
Bind for 0.0.0.0:80 failed: port is already allocated
```

3. `docker compose ps -a` montre `web-1` en `Up`, `web-2` et `web-3` en `Created` : ils ne démarrent jamais.

Et même si c'était possible, l'hôte ne saurait pas à quel conteneur envoyer chaque requête arrivant sur le port 80.

> Autre option sans Load Balancer : `ports: "80-82:3000"` donne un port différent à chaque instance (80, 81, 82). Ça marche, mais ce n'est plus **un seul** port.

### Question : solution théorique (Load Balancer)

On met un **Nginx** devant les instances. **Lui seul** prend le port 80 de l'hôte, et il répartit les requêtes entre les 3 `web` à tour de rôle (round-robin).

```
                         ┌─> web-1:3000
Navigateur -> Nginx:80 ──┼─> web-2:3000
                         └─> web-3:3000
```

Changements dans `docker-compose.yml` :

```yaml
services:
  web:
    build: .
    image: counter-app:1.0
    expose:
      - "${APP_PORT}"                  # plus de "ports" : web n'est plus sur l'hôte
    # ... le reste ne change pas

  lb:
    image: nginx:alpine
    ports:
      - "${HOST_PORT}:80"              # seul le load balancer est exposé
    volumes:
      - ./nginx.conf:/etc/nginx/conf.d/default.conf:ro
    depends_on:
      - web
    networks:
      - app-network
```

`nginx.conf` :

```nginx
upstream web_servers {
    server web:3000;    # "web" = les 3 instances (le DNS Docker renvoie leurs 3 IP)
}

server {
    listen 80;
    location / {
        proxy_pass http://web_servers;
    }
}
```

Résultat attendu : `docker compose up -d --scale web=3` démarre les 3 instances sans erreur, et à chaque rafraîchissement de http://localhost l'ID du conteneur change.

---

## Partie 4 : Publication et Nettoyage

### Publier l'image sur Docker Hub

```bash
docker login                                                    # se connecter à Docker Hub
docker tag counter-app:1.0 emnawalha99/counter-app:1.0          # nommer l'image avec son compte
docker push emnawalha99/counter-app:1.0                         # envoyer sur Docker Hub
docker images emnawalha99/counter-app                           # vérifier le tag en local
```

Pourquoi taguer ? Docker Hub range les images par compte : le nom doit commencer par `emnawalha99/`, sinon le push est refusé.

Vérifier que ça marche depuis Docker Hub :

```bash
docker rmi emnawalha99/counter-app:1.0                          # supprimer la copie locale
docker pull emnawalha99/counter-app:1.0                         # la retélécharger depuis Docker Hub
```

**Lien Docker Hub (public) :** https://hub.docker.com/r/emnawalha99/counter-app

### Nettoyage industriel (Deep Clean)

On arrête d'abord le stack, car `prune` ne supprime pas les conteneurs qui tournent :

```bash
docker compose down
```

Puis **une seule commande** :

```bash
docker system prune -a
```

Elle supprime :

- tous les conteneurs arrêtés
- tous les réseaux qui ne sont utilisés par aucun conteneur
- toutes les images qui ne sont utilisées par aucun conteneur (`-a` : pas seulement les images sans nom)
- le cache de build

Options utiles :

- `--volumes` : supprime aussi les volumes anonymes. Les volumes nommés (`redis-data`) sont gardés, il faut `docker volume prune -a` pour eux.
- `-f` : ne pas demander de confirmation.

⚠️ `docker system prune -a` agit sur **tout Docker**, pas seulement sur ce TP : les images des autres projets sont supprimées aussi (il faudra les retélécharger ou les reconstruire).

Version qui ne supprime **que** ce TP :

```bash
docker compose down --rmi all -v --remove-orphans
```

- `--rmi all` : supprime les images du projet
- `-v` : supprime les volumes du projet
- `--remove-orphans` : supprime les conteneurs du projet qui ne sont plus dans le YAML

Ce qui a été créé à la main en Partie 2 n'appartient pas à Compose, il faut le supprimer à part :

```bash
docker rm -f web-app db-service
docker network rm app-network
docker volume rm redis-data
```

Vérifier que tout est propre :

```bash
docker ps -a
docker images
docker network ls
docker volume ls
```
