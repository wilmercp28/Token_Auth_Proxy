import express from 'express';
import fetch from 'node-fetch';
import dotenv from 'dotenv';
import axios from 'axios';
import { Buffer } from 'buffer';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Token cache
let cachedToken = null;
let tokenExpiration = 0; // epoch millis

async function getAccessToken() {
  if (cachedToken && Date.now() < tokenExpiration - 60000) {
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

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Token fetch failed: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  cachedToken = data.access_token;
  tokenExpiration = Date.now() + (data.expires_in * 1000);
  return cachedToken;
}

// Basic test route
app.get('/', (req, res) => {
  res.send('FatSecret proxy is up. Use GET /search-foods');
});

// Search endpoint that proxies to FatSecret
app.get('/search-foods', async (req, res) => {
  try {
    const token = await getAccessToken();

    const fatsecretRes = await axios.get('https://platform.fatsecret.com/rest/foods/search/v3', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      params: {
        search_expression: req.query.query,
        page_number: req.query.page || 0,
        max_results: req.query.maxResults || 10,
        format: 'json',
      },
    });

    res.json(fatsecretRes.data);
  } catch (err) {
    console.error('Error searching foods:', err.message);
    res.status(500).json({ error: 'Failed to fetch foods' });
  }
});

app.listen(PORT, () => {
  console.log(`FatSecret proxy running on port ${PORT}`);
});
