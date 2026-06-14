// Vercel Serverless Function — Zoho CRM Lead Creation Proxy
// Roda server-side, sem CORS. Chamado pelo frontend via POST /api/create-lead

const ZOHO_CLIENT_ID     = '1000.1S3YD453I23MVTZ2PFD8RC7VGTJCCK';
const ZOHO_CLIENT_SECRET = '257fa68012e1822641e4f90da3548e7c831a4ec5a5';
const ZOHO_REFRESH_TOKEN = '1000.ebcf39b9f915bb5781db24f5e0d68d73.14d6a6d0ae54735c91c2bb9e0eb8d15c';
const ZOHO_ACCOUNTS_URL  = 'https://accounts.zoho.com';
const ZOHO_API_DOMAIN    = 'https://www.zohoapis.com';

async function getAccessToken() {
  const params = new URLSearchParams({
    refresh_token: ZOHO_REFRESH_TOKEN,
    client_id:     ZOHO_CLIENT_ID,
    client_secret: ZOHO_CLIENT_SECRET,
    grant_type:    'refresh_token',
  });

  const res = await fetch(`${ZOHO_ACCOUNTS_URL}/oauth/v2/token`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body:    params.toString(),
  });

  const data = await res.json();
  if (!data.access_token) {
    throw new Error(`Token error: ${data.error || JSON.stringify(data)}`);
  }
  return data.access_token;
}

export default async function handler(req, res) {
  // Allow only POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // CORS headers (allow requests from the portal domain)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const { name, email, message } = req.body;

    if (!name || !email) {
      return res.status(400).json({ error: 'Name and email are required' });
    }

    // Split name into First / Last
    const parts     = name.trim().split(' ');
    const lastName  = parts.length > 1 ? parts.slice(1).join(' ') : parts[0];
    const firstName = parts.length > 1 ? parts[0] : '';

    const accessToken = await getAccessToken();

    const crmRes = await fetch(`${ZOHO_API_DOMAIN}/crm/v7/Leads`, {
      method:  'POST',
      headers: {
        'Authorization': `Zoho-oauthtoken ${accessToken}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({
        data: [{
          Last_Name:   lastName,
          First_Name:  firstName,
          Email:       email,
          Description: message || '',
          Lead_Source: 'Web Site',
          Company:     name,
        }],
      }),
    });

    const crmData = await crmRes.json();
    const record  = crmData.data?.[0];

    if (record?.status === 'error') {
      return res.status(422).json({ error: record.message || 'CRM rejected the lead' });
    }

    return res.status(200).json({ success: true, id: record?.details?.id });

  } catch (err) {
    console.error('[create-lead] Error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
