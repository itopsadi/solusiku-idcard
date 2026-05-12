const https = require('https');

const APP_TOKEN = 'kNCIdpaCeVDqeqxyU67MqFUqVIsbiSDXcvWX1P32';
const API_URL = 'glpi.cb2.07.solusiku';

const options = {
  hostname: API_URL,
  port: 443,
  path: '/apirest.php/initSession',
  method: 'GET',
  headers: {
    'App-Token': APP_TOKEN,
    // We don't have valid credentials but we want to see if the server returns 401 or something else
    'Authorization': 'Basic ' + Buffer.from('test:test').toString('base64')
  }
};

const req = https.request(options, (res) => {
  console.log(`STATUS: ${res.statusCode}`);
  console.log(`HEADERS: ${JSON.stringify(res.headers)}`);
  
  res.setEncoding('utf8');
  let body = '';
  res.on('data', (chunk) => {
    body += chunk;
  });
  res.on('end', () => {
    console.log(`BODY: ${body}`);
  });
});

req.on('error', (e) => {
  console.error(`problem with request: ${e.message}`);
});

req.end();
