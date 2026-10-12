const test = require('node:test');
const assert = require('node:assert');
const { createApp } = require('./app');

// Lance l'app avec un faux Redis et renvoie la réponse de la page "/"
async function visiter(fakeRedis) {
  const server = createApp(fakeRedis).listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  const res = await fetch(`http://127.0.0.1:${server.address().port}/`);
  const text = await res.text();
  server.close();
  return { status: res.status, text };
}

test('affiche le nombre de visites', async () => {
  const { status, text } = await visiter({ incr: async () => 5 });
  assert.strictEqual(status, 200);
  assert.match(text, /vue 5 fois/);
});

test('renvoie une erreur 500 si Redis ne répond pas', async () => {
  const { status } = await visiter({ incr: async () => { throw new Error('Redis absent'); } });
  assert.strictEqual(status, 500);
});
