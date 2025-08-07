import express from 'express';
import fetch from 'node-fetch';
import dotenv from 'dotenv';
import { Buffer } from 'buffer';

dotenv.config();

const app = express();
const PORT = process.env.PORT ?? 3000;

const {
  CLIENT_ID,
  CLIENT_SECRET,
  OAUTH_URL,
  SCOPE,
} = process.env;

if (!CLIENT_ID || !CLIENT_SECRET || !OAUTH_URL || !SCOPE) {
  throw new Error('Missing required environment variables');
}

let cachedToken = null;
let tokenExpiresAt = 0;

async function getAccessToken() {
  const now = Date.now();

  if (cachedToken && now < tokenExpiresAt) return cachedToken;

  const auth = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64');

  const response = await fetch(OAUTH_URL, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      scope: SCOPE,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Failed to fetch token: ${response.status} ${errText}`);
  }

  const data = await response.json();
  cachedToken = data.access_token;
  tokenExpiresAt = now + data.expires_in * 1000 - 10000;
  return cachedToken;
}

async function fatsecretRestRequest(path, query = {}) {
  const token = await getAccessToken();

  const url = new URL(`https://platform.fatsecret.com/rest/${path}`);
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined) {
      url.searchParams.set(key, String(value));
    }
  });

  const response = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const data = await response.json();
  return { status: response.status, data };
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

  const cappedMaxResults = Math.min(Number(max_results) || 20, 50);

  try {
    const { status, data } = await fatsecretRestRequest('foods/search/v3', {
      search_expression: q,
      page_number: page,
      max_results: cappedMaxResults,
      include_sub_categories,
      include_food_images,
      include_food_attributes,
      flag_default_serving,
      region,
      language,
      format,
    });

    res.status(status).json(data);
  } catch (err) {
    console.error('FatSecret /search-foods REST error:', err);
    res.status(500).json({ error: 'Internal error while searching foods' });
  }
});

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

  const cappedMaxResults = Math.min(Number(max_results) || 4, 10); 

  try {
    const { status, data } = await fatsecretRestRequest('food/autocomplete/v2', {
      expression: q,
      max_results: cappedMaxResults,
      region,
      format,
    });

    res.status(status).json(data);
  } catch (err) {
    console.error('FatSecret /autocomplete-foods REST error:', err);
    res.status(500).json({ error: 'Internal error while autocompleting foods' });
  }
});

app.get('/find-food-by-barcode', async (req, res) => {
  const {
    barcode,
    region,
    language,
    format = 'json',
  } = req.query;

  if (!barcode || barcode.toString().length !== 13) {
    return res.status(400).json({ error: 'Missing or invalid 13-digit barcode (?barcode=)' });
  }

  try {
    const { status, data } = await fatsecretRestRequest('food/barcode/find-by-id/v1', {
      barcode,
      region,
      language,
      format,
    });

    res.status(status).json(data);
  } catch (err) {
    console.error('FatSecret /find-food-by-barcode REST error:', err);
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
    const { status, data } = await fatsecretRestRequest('food/v4', {
      food_id: id,
      format,
      include_sub_categories,
      include_food_images,
      include_food_attributes,
      flag_default_serving,
      region,
      language,
    });

    res.status(status).json(data);
  } catch (err) {
    console.error('FatSecret /food-details REST error:', err);
    res.status(500).json({ error: 'Internal error while getting food details' });
  }
});

app.get('/food-brands', async (req, res) => {
  const {
    starts_with,
    brand_type,
    region,
    language,
    format = 'json',
  } = req.query;

  if (!starts_with) {
    return res.status(400).json({ error: 'Missing required parameter (?starts_with=)' });
  }

  try {
    const { status, data } = await fatsecretRestRequest('brands/v2', {
      starts_with,
      brand_type,
      region,
      language,
      format,
    });

    res.status(status).json(data);
  } catch (err) {
    console.error('FatSecret /food-brands REST error:', err);
    res.status(500).json({ error: 'Internal error while fetching food brands' });
  }
});

app.get('/food-categories', async (req, res) => {
  const {
    region,
    language,
    format = 'json',
  } = req.query;

  try {
    const { status, data } = await fatsecretRestRequest('food-categories/v2', {
      region,
      language,
      format,
    });

    res.status(status).json(data);
  } catch (err) {
    console.error('FatSecret /food-categories REST error:', err);
    res.status(500).json({ error: 'Internal error while fetching food categories' });
  }
});

app.get('/food-sub-categories', async (req, res) => {
  const {
    food_category_id,
    region,
    language,
    format = 'json',
  } = req.query;

  if (!food_category_id) {
    return res.status(400).json({ error: 'Missing required parameter (?food_category_id=)' });
  }

  try {
    const { status, data } = await fatsecretRestRequest('food-sub-categories/v2', {
      food_category_id,
      region,
      language,
      format,
    });

    res.status(status).json(data);
  } catch (err) {
    console.error('FatSecret /food-sub-categories REST error:', err);
    res.status(500).json({ error: 'Internal error while fetching food sub-categories' });
  }
});

app.get('/recipe-details', async (req, res) => {
  const {
    id,
    region,
    format = 'json',
  } = req.query;

  if (!id) {
    return res.status(400).json({ error: 'Missing recipe id (?id=)' });
  }

  try {
    const { status, data } = await fatsecretRestRequest('recipe/v2', {
      recipe_id: id,
      region,
      format,
    });

    res.status(status).json(data);
  } catch (err) {
    console.error('FatSecret /recipe-details REST error:', err);
    res.status(500).json({ error: 'Internal error while getting recipe details' });
  }
});

app.get('/search-recipes', async (req, res) => {
  const {
    q,
    recipe_types,
    recipe_types_matchall,
    must_have_images,
    'calories.from': caloriesFrom,
    'calories.to': caloriesTo,
    'carb_percentage.from': carbFrom,
    'carb_percentage.to': carbTo,
    'protein_percentage.from': proteinFrom,
    'protein_percentage.to': proteinTo,
    'fat_percentage.from': fatFrom,
    'fat_percentage.to': fatTo,
    'prep_time.from': prepTimeFrom,
    'prep_time.to': prepTimeTo,
    sort_by,
    page = 0,
    max_results = 20,
    region,
    format = 'json',
  } = req.query;

  const cappedMaxResults = Math.min(Number(max_results) || 20, 50);

  try {
    const { status, data } = await fatsecretRestRequest('recipes/search/v3', {
      search_expression: q,
      recipe_types,
      recipe_types_matchall,
      must_have_images,
      'calories.from': caloriesFrom,
      'calories.to': caloriesTo,
      'carb_percentage.from': carbFrom,
      'carb_percentage.to': carbTo,
      'protein_percentage.from': proteinFrom,
      'protein_percentage.to': proteinTo,
      'fat_percentage.from': fatFrom,
      'fat_percentage.to': fatTo,
      'prep_time.from': prepTimeFrom,
      'prep_time.to': prepTimeTo,
      sort_by,
      page_number: page,
      max_results: cappedMaxResults,
      region,
      format,
    });

    res.status(status).json(data);
  } catch (err) {
    console.error('FatSecret /search-recipes REST error:', err);
    res.status(500).json({ error: 'Internal error while searching recipes' });
  }
});

app.get('/recipe-types', async (req, res) => {
  const { format = 'json' } = req.query;

  try {
    const { status, data } = await fatsecretRestRequest('recipe-types/v2', {
      format,
    });

    res.status(status).json(data);
  } catch (err) {
    console.error('FatSecret /recipe-types REST error:', err);
    res.status(500).json({ error: 'Internal error while fetching recipe types' });
  }
});

app.post('/nlp', express.json(), async (req, res) => {
  const {
    user_input,
    include_food_data,
    eaten_foods,
    region,
    language,
  } = req.body;

  if (!user_input || typeof user_input !== 'string') {
    return res.status(400).json({ error: 'Missing or invalid user_input (required)' });
  }

  try {
    const token = await getAccessToken();
    const url = 'https://platform.fatsecret.com/rest/natural-language-processing/v1';

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        user_input,
        include_food_data,
        eaten_foods,
        region,
        language,
      }),
    });

    const data = await response.json();
    res.status(response.status).json(data);
  } catch (err) {
    console.error('FatSecret /nlp REST error:', err);
    res.status(500).json({ error: 'Internal error while processing natural language input' });
  }
});

app.post('/image-recognition', express.json({ limit: '2mb' }), async (req, res) => {
  const {
    image_b64,
    include_food_data,
    eaten_foods,
    region,
    language,
  } = req.body;

  if (!image_b64 || typeof image_b64 !== 'string') {
    return res.status(400).json({ error: 'Missing or invalid image_b64 (Base64 string required)' });
  }

  try {
    const token = await getAccessToken();
    const url = 'https://platform.fatsecret.com/rest/image-recognition/v2';

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        image_b64,
        include_food_data,
        eaten_foods,
        region,
        language,
      }),
    });

    const data = await response.json();
    res.status(response.status).json(data);
  } catch (err) {
    console.error('FatSecret /image-recognition REST error:', err);
    res.status(500).json({ error: 'Internal error while processing image' });
  }
});

app.listen(PORT, () => {
  console.log(` FatSecret Proxy running on port ${PORT}`);
});



