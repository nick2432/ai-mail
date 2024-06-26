const fs = require('fs');
const path = require('path');
const { ConfidentialClientApplication } = require('@azure/msal-node');
const fetch = require('node-fetch'); // Make sure to install node-fetch
const open = require('./open_wraper');

const SCOPES = ['user.read', 'mail.read'];
const TOKEN_PATH = path.join(__dirname, 'token_outlook.json');
const msalConfig = {
  auth: {
    clientId: '39a0e384-a20c-4cfb-bf31-b722b8c48b46',
    authority: 'https://login.microsoftonline.com/f8cdef31-a31e-4b4a-93e4-5f571e91255a',
    clientSecret: 'cd81783d-2881-4532-b155-4a46b7be8551',
  },
};
const REDIRECT_URI = 'http://localhost:5000/redirect_outlook';
const msalClient = new ConfidentialClientApplication(msalConfig);
let lastMessageId = null;

function startOutlookAuth(app, res) {
  const authCodeUrlParameters = {
    scopes: SCOPES,
    redirectUri: REDIRECT_URI,
  };

  msalClient.getAuthCodeUrl(authCodeUrlParameters).then((response) => {
    res.redirect(response);
  }).catch((error) => {
    console.log(JSON.stringify(error));
  });
}

function handleOutlookRedirect(app) {
  app.get('/redirect_outlook', (req, res) => {
    const tokenRequest = {
      code: req.query.code,
      scopes: SCOPES,
      redirectUri: REDIRECT_URI,
    };

    msalClient.acquireTokenByCode(tokenRequest).then((response) => {
      const token = response.accessToken;
      fs.writeFile(TOKEN_PATH, JSON.stringify(token), (err) => {
        if (err) return console.error(err);
        console.log('Outlook token stored to', TOKEN_PATH);
      });

      res.send('Outlook authentication successful! You can close this tab.');
      startOutlookServer(token);
    }).catch((error) => console.log(JSON.stringify(error)));
  });
}

function startOutlookServer(token) {
  console.log('Outlook server authenticated.');
  setInterval(() => {
    checkForNewOutlookEmails(token);
  }, 1000); // Check every 60 seconds
}

function checkForNewOutlookEmails(token) {
  const options = {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  };

  fetch('https://graph.microsoft.com/v1.0/me/mailFolders/Inbox/messages?$filter=isRead eq false&$top=1', options)
    .then(response => response.json())
    .then(data => {
      if (data.value && data.value.length > 0) {
        const messageId = data.value[0].id;
        if (messageId !== lastMessageId) {
          lastMessageId = messageId;
          console.log('New Outlook email arrived!');
          getOutlookMessageDetails(token, messageId);
        }
      } else {
        console.log('No new Outlook emails.');
      }
    })
    .catch(error => console.log('Error fetching Outlook emails:', error));
}

function getOutlookMessageDetails(token, messageId) {
  const options = {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  };

  fetch(`https://graph.microsoft.com/v1.0/me/messages/${messageId}`, options)
    .then(response => response.json())
    .then(data => {
      const subject = data.subject;
      console.log(`New Outlook email with subject: ${subject}`);
    })
    .catch(error => console.log('Error fetching Outlook email details:', error));
}
console.log('uyfuyfguy');
module.exports = { startOutlookAuth, handleOutlookRedirect };
