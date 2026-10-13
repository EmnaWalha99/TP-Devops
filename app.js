const express = require('express');
const { createClient } = require('redis');
const os = require('os');

// L'app reçoit le client Redis en paramètre : on peut ainsi la tester avec un faux Redis
function createApp(client) {
  //express app
  const app = express();

  app.get('/', async (req, res) => {
    try {
      const hits = await client.incr('hits');
      res.send(`Bonjour ! Cette page a été vue ${hits} fois. Je suis le conteneur ${os.hostname()}\n`);
    } catch (err) {
      console.error('Erreur lors de l’incrémentation Redis:', err.message);
      res.status(500).send('Erreur serveur');
    }
  });

  return app;
}

// Démarre le serveur seulement si on lance "node app.js" (pas pendant les tests)
if (require.main === module) {
  const port = Number(process.env.PORT) || 3000;
  const REDIS_HOST = process.env.REDIS_HOST || 'db-service';

  const client = createClient({
    url: `redis://${REDIS_HOST}:6379`
  });

  client.on('error', (err) => console.error('Erreur Redis:', err.message));

  (async () => {
    try {
      await client.connect();
      createApp(client).listen(port, () => console.log(`Serveur démarré sur le port ${port}`));
    } catch (err) {
      console.error('Impossible de se connecter à Redis:', err.message);
      process.exit(1);
    }
  })();
}

module.exports = { createApp };
