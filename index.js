const fs = require('fs');
const path = require('path');
const express = require('express');
const { google } = require('googleapis');
const open = require('./open_wraper');

const SCOPES = ['https://www.googleapis.com/auth/gmail.readonly'];
const TOKEN_PATH = path.join(__dirname, 'token.json');

const app = express();
const PORT = 5000;
let lastMessageId = null;

// Function to check if JSON content is valid
const isJsonString = (str) => {
  try {
    JSON.parse(str);
    return true;
  } catch (e) {
    return false;
  }
};

// Load client secrets from a local file.
fs.readFile('credentials.json', (err, content) => {
  if (err) {
    console.error('Error loading client secret file:', err);
    process.exit(1);
  }

  if (!isJsonString(content)) {
    console.error('Invalid JSON content in credentials.json.');
    process.exit(1);
  }

  const credentials = JSON.parse(content);
  authorize(credentials, startServer);
});

function authorize(credentials, callback) {
  const { client_secret, client_id, redirect_uris } = credentials.installed;
  const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);

  // Check if we have previously stored a token.
  fs.readFile(TOKEN_PATH, (err, token) => {
    if (err || !isJsonString(token) || token.trim() === '') {
      return getNewToken(oAuth2Client, callback);
    }

    try {
      oAuth2Client.setCredentials(JSON.parse(token));
      callback(oAuth2Client);
    } catch (e) {
      console.error('Error setting credentials:', e);
      getNewToken(oAuth2Client, callback);
    }
  });
}

function getNewToken(oAuth2Client, callback) {
  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
  });
  console.log('Authorize this app by visiting this url:', authUrl);

  (async () => {
    await open(authUrl);
  })();

  app.get('/oauth2callback', (req, res) => {
    const code = req.query.code;
    oAuth2Client.getToken(code, (err, token) => {
      if (err) return console.error('Error retrieving access token', err);

      try {
        oAuth2Client.setCredentials(token);
        fs.writeFile(TOKEN_PATH, JSON.stringify(token), (err) => {
          if (err) return console.error(err);
          console.log('Token stored to', TOKEN_PATH);
        });
      } catch (e) {
        console.error('Error storing token:', e);
      }

      res.send('Authentication successful! You can close this tab.');
      callback(oAuth2Client);
    });
  });
}

function startServer(auth) {
  console.log(`Server running on http://localhost:${PORT}`);
  listLabels(auth);

  // Start polling for new emails
  setInterval(() => {
    checkForNewEmails(auth);
  }, 1000); // Check every 60 seconds
}

function listLabels(auth) {
  const gmail = google.gmail({ version: 'v1', auth });
  gmail.users.labels.list({
    userId: 'me',
  }, (err, res) => {
    if (err) return console.log('The API returned an error: ' + err);
    const labels = res.data.labels;
    if (labels.length) {
      console.log('Labels:');
      labels.forEach((label) => {
        console.log(`- ${label.name}`);
      });
    } else {
      console.log('No labels found.');
    }
  });
}

function checkForNewEmails(auth) {
  const gmail = google.gmail({ version: 'v1', auth });
  gmail.users.messages.list({
    userId: 'me',
    labelIds: ['INBOX'],
    maxResults: 1,
    q: 'is:unread'
  }, (err, res) => {
    if (err) return console.log('The API returned an error: ' + err);
    const messages = res.data.messages;
    if (messages && messages.length) {
      const messageId = messages[0].id;
      if (messageId !== lastMessageId) {
        lastMessageId = messageId;
        console.log('New email arrived!');
        getMessageDetails(auth, messageId);
      }
    } else {
      console.log('No new emails.');
    }
  });
}

function getMessageDetails(auth, messageId) {
  const gmail = google.gmail({ version: 'v1', auth });
  gmail.users.messages.get({
    userId: 'me',
    id: messageId
  }, (err, res) => {
    if (err) return console.log('The API returned an error: ' + err);
    const message = res.data;
    const subject = message.payload.headers.find(header => header.name === 'Subject').value;
    console.log(`New email with subject: ${subject}`);
  });
}

app.listen(PORT, () => {
  console.log(`Visit http://localhost:${PORT} to initiate authentication.`);
});
