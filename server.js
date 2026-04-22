// ============================================================
// WhatsApp Webhook Server — Pour Render.com (Gratuit)
// ============================================================

const express = require('express');
const { google } = require('googleapis');
const app = express();

app.use(express.json());

// ============================================================
// CONFIG — Modifie ces valeurs
// ============================================================
const VERIFY_TOKEN = 'rotagaming2024';
const SHEET_ID = 'REMPLACE_PAR_TON_GOOGLE_SHEET_ID';
const SHEET_NAME = 'Prospects';

// Credentials Google (tu vas les obtenir depuis Google Cloud Console)
const GOOGLE_CREDENTIALS = JSON.parse(process.env.GOOGLE_CREDENTIALS || '{}');

// ============================================================
// GET — Vérification Meta (webhook validation)
// ============================================================
app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  console.log('Vérification webhook Meta reçue');

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log('✅ Webhook validé !');
    res.status(200).send(challenge);
  } else {
    console.log('❌ Token invalide');
    res.sendStatus(403);
  }
});

// ============================================================
// POST — Réception des messages WhatsApp
// ============================================================
app.post('/webhook', async (req, res) => {
  // Meta exige une réponse 200 immédiate
  res.sendStatus(200);

  try {
    const body = req.body;
    const entries = body.entry || [];

    for (const entry of entries) {
      for (const change of (entry.changes || [])) {
        const value = change.value || {};

        // Ignorer les statuts de livraison
        if (!value.messages || value.messages.length === 0) continue;

        for (let i = 0; i < value.messages.length; i++) {
          const msg = value.messages[i];
          const contact = (value.contacts || [])[i] || {};

          const telephone = msg.from || '';
          const nom = contact.profile?.name || 'Inconnu';
          const type = msg.type || 'text';

          let contenu = '';
          if (type === 'text') contenu = msg.text?.body || '';
          else if (type === 'image') contenu = '[Image reçue]';
          else if (type === 'audio') contenu = '[Audio reçu]';
          else if (type === 'video') contenu = '[Vidéo reçue]';
          else if (type === 'document') contenu = '[Document reçu]';
          else if (type === 'location') contenu = `[Localisation: ${msg.location?.latitude}, ${msg.location?.longitude}]`;
          else contenu = `[${type}]`;

          const date = new Date().toLocaleString('fr-FR', { timeZone: 'Africa/Abidjan' });

          await sauvegarderDansSheets({ date, nom, telephone, contenu, type, messageId: msg.id });
          console.log(`✅ Prospect sauvegardé: ${nom} (${telephone})`);
        }
      }
    }
  } catch (err) {
    console.error('Erreur:', err.message);
  }
});

// ============================================================
// Sauvegarder dans Google Sheets
// ============================================================
async function sauvegarderDansSheets(data) {
  const auth = new google.auth.GoogleAuth({
    credentials: GOOGLE_CREDENTIALS,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  const sheets = google.sheets({ version: 'v4', auth });

  // Vérifier si les en-têtes existent
  const checkRes = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: `${SHEET_NAME}!A1:G1`,
  });

  if (!checkRes.data.values || checkRes.data.values.length === 0) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: `${SHEET_NAME}!A1`,
      valueInputOption: 'RAW',
      requestBody: {
        values: [['Date & Heure', 'Nom', 'Téléphone', 'Message', 'Type', 'Statut', 'ID Message']]
      }
    });
  }

  // Ajouter la ligne
  await sheets.spreadsheets.values.append({
    spreadsheetId: SHEET_ID,
    range: `${SHEET_NAME}!A:G`,
    valueInputOption: 'RAW',
    requestBody: {
      values: [[data.date, data.nom, data.telephone, data.contenu, data.type, 'Nouveau', data.messageId]]
    }
  });
}

// ============================================================
// Démarrer le serveur
// ============================================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Serveur démarré sur le port ${PORT}`);
  console.log(`✅ Webhook URL: https://TON-APP.onrender.com/webhook`);
});
