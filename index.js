import express from 'express';
import fetch from 'node-fetch';
import dotenv from 'dotenv';
import { Buffer } from 'buffer';

dotenv.config();
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

let cachedToken = null;
let tokenExpiresAt = 0;

async function getAccessToken() {
  const now = Date.now();

  if (cachedToken && now < tokenExpiresAt) {
    return cachedToken;
  }

  const { CLIENT_ID, CLIENT_SECRET, OAUTH_URL, SCOPE } = process.env;

  const response = await fetch(OAUTH_URL, {
    method: 'POST',
    headers: {
      'Authorization': 'Basic ' + Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64'),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      scope: SCOPE,
    }),
  });

  if (!response.ok) throw new Error('Failed to fetch token');

  const data = await response.json();
  cachedToken = data.access_token;
  tokenExpiresAt = now + data.expires_in * 1000 - 10000;

  return cachedToken;
}

app.get('/search-foods', async (req, res) => {
  const query = req.query.q;
  if (!query) return res.status(400).json({ error: 'Missing search query (?q=)' });

  try {
    const token = await getAccessToken();

    const fatsecretRes = await fetch(`https://platform.fatsecret.com/rest/server.api?method=foods.search&search_expression=${encodeURIComponent(query)}&format=json`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const data = await fatsecretRes.json();
    res.status(fatsecretRes.status).json(data);
  } catch (err) {
    console.error('Proxy error:', err);
    res.status(500).json({ error: 'Internal error while searching foods' });
  }
});

app.listen(PORT, () => {
  console.log(`Proxy running securely on port ${PORT}`);
});

