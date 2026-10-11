const express = require('express');
const { createClient } = require('redis');
const os = require('os');

const app = express();
const port = Number(process.env.PORT) || 3000;
const REDIS_HOST = process.env.REDIS_HOST || 'db-service';

const client = createClient({
  url: `redis://${REDIS_HOST}:6379`
});

client.on('error', (err) => console.error('Erreur Redis:', err.message));

app.get('/', async (req, res) => {
  try {
    const hits = await client.incr('hits');
    res.send(`Bonjour ! Cette page a été vue ${hits} fois. Je suis le conteneur ${os.hostname()}\n`);
  } catch (err) {
    console.error('Erreur lors de l’incrémentation Redis:', err.message);
    res.status(500).send('Erreur serveur');
  }
});

(async () => {
  try {
    await client.connect();
    app.listen(port, () => console.log(`Serveur démarré sur le port ${port}`));
  } catch (err) {
    console.error('Impossible de se connecter à Redis:', err.message);
    process.exit(1);
  }
})();