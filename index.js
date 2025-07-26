import express from 'express';
import fetch from 'node-fetch';
import dotenv from 'dotenv';
import { Buffer } from 'buffer';

dotenv.config();
const app = express();
const PORT = process.env.PORT ?? 3000;


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
  const {
    q,
    page = 0,
    max_results = 20,
    include_sub_categories,
    include_food_images,
    include_food_attributes,
    flag_default_serving,
    region,
    language,
    format = 'json',
  } = req.query;

  if (!q) {
    return res.status(400).json({ error: 'Missing search query (?q=)' });
  }

  try {
    const token = await getAccessToken();

    const params = new URLSearchParams({
      method: 'foods.search.v3',
      search_expression: q,
      page_number: page.toString(),
      max_results: max_results.toString(),
      format,
    });

    if (include_sub_categories !== undefined)
      params.set('include_sub_categories', include_sub_categories);
    if (include_food_images !== undefined)
      params.set('include_food_images', include_food_images);
    if (include_food_attributes !== undefined)
      params.set('include_food_attributes', include_food_attributes);
    if (flag_default_serving !== undefined)
      params.set('flag_default_serving', flag_default_serving);
    if (region) params.set('region', region);
    if (language) params.set('language', language);

    const fatsecretRes = await fetch(
      `https://platform.fatsecret.com/rest/server.api?${params.toString()}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    const data = await fatsecretRes.json();
    res.status(fatsecretRes.status).json(data);
  } catch (err) {
    console.error('FatSecret /search-foods error:', err);
    res.status(500).json({ error: 'Internal error while searching foods' });
  }
});


// /autocomplete-foods?q=chic&max_results=4
app.get('/autocomplete-foods', async (req, res) => {
  const {
    q,
    max_results = 4,
    region,
    format = 'json',
  } = req.query;

  if (!q) {
    return res.status(400).json({ error: 'Missing query (?q=)' });
  }

  try {
    const token = await getAccessToken();

    const params = new URLSearchParams({
      method: 'foods.autocomplete.v2',
      expression: q,
      max_results: max_results.toString(),
      format,
    });

    if (region) params.set('region', region);

    const fatsecretRes = await fetch(`https://platform.fatsecret.com/rest/server.api?${params.toString()}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const data = await fatsecretRes.json();
    res.status(fatsecretRes.status).json(data);
  } catch (err) {
    console.error('Autocomplete error:', err);
    res.status(500).json({ error: 'Internal error while autocompleting foods' });
  }
});

// /find-food-by-barcode?barcode=1234567890123&region=US&language=en
app.get('/find-food-by-barcode', async (req, res) => {
  const {
    barcode,
    region,
    language,
    format = 'json',
  } = req.query;

  if (!barcode || barcode.length !== 13) {
    return res.status(400).json({ error: 'Missing or invalid 13-digit barcode (?barcode=)' });
  }

  try {
    const token = await getAccessToken();

    const params = new URLSearchParams({
      method: 'food.find_id_for_barcode',
      barcode,
      format,
    });

    if (region) params.set('region', region);
    if (language) params.set('language', language);

    const fatsecretRes = await fetch(
      `https://platform.fatsecret.com/rest/server.api?${params.toString()}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    const data = await fatsecretRes.json();
    res.status(fatsecretRes.status).json(data);
  } catch (err) {
    console.error('Barcode lookup error:', err);
    res.status(500).json({ error: 'Internal error while finding food by barcode' });
  }
});

app.get('/food-details', async (req, res) => {
  const {
    id,
    format = 'json',
    include_sub_categories,
    include_food_images,
    include_food_attributes,
    flag_default_serving,
    region,
    language,
  } = req.query;

  if (!id) {
    return res.status(400).json({ error: 'Missing food id (?id=)' });
  }

  try {
    const token = await getAccessToken();

    const params = new URLSearchParams({
      method: 'food.get.v4',
      food_id: id,
      format,
    });

    if (include_sub_categories !== undefined)
      params.set('include_sub_categories', include_sub_categories);
    if (include_food_images !== undefined)
      params.set('include_food_images', include_food_images);
    if (include_food_attributes !== undefined)
      params.set('include_food_attributes', include_food_attributes);
    if (flag_default_serving !== undefined)
      params.set('flag_default_serving', flag_default_serving);
    if (region) params.set('region', region);
    if (language) params.set('language', language);

    const fatsecretRes = await fetch(
      `https://platform.fatsecret.com/rest/server.api?${params.toString()}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    const data = await fatsecretRes.json();
    res.status(fatsecretRes.status).json(data);
  } catch (err) {
    console.error('Food details error:', err);
    res.status(500).json({ error: 'Internal error while getting food details' });
  }
});





