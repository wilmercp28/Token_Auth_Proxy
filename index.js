import express from 'express';
import fetch from 'node-fetch';
import dotenv from 'dotenv';
import { Buffer } from 'buffer';

dotenv.config();
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.post('/get-token', async (req, res) => {
  try {
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

    const data = await response.json();
    res.status(response.status).json(data);
  } catch (error) {
    console.error('Token fetch error:', error);
    res.status(500).json({ error: 'Failed to get access token' });
  }
});

app.listen(PORT, () => {
  console.log(`FatSecret proxy running on port ${PORT}`);
});

