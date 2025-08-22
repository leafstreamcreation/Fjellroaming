const axios = require('axios');
const { kMaxLength } = require('buffer');
const fs = require('fs');
require('dotenv').config();

// Configuration - Update these values for your setup
const config = {
  porkbun: {
    apiKey: process.env.PORKBUN_API_KEY || 'your-porkbun-api-key',
    secretKey: process.env.PORKBUN_SECRET_KEY || 'your-porkbun-secret-key'
  },
  domains: [
    {
      domain: 'fjellworks.dev',
      subdomain: '' // Leave empty for root domain, or specify subdomain
    },
    {
        domain: '*.fjellworks.dev',
        subdomain: '' // Leave empty for root domain, or specify subdomain
    },
    {
        domain: 'mail.fjellworks.dev',
        subdomain: '' // Leave empty for root domain, or specify subdomain
    }
  ],
  files: {
    lastIp: './last-ip.txt',
    log: './ddns-updater.log'
  },
};

// Utility functions
function log(message, level = 'INFO') {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] [${level}] ${message}\n`;
  
  console.log(logMessage.trim());
  
  // Append to log file
  fs.appendFile(config.files.log, logMessage, (err) => {
    if (err) console.error('Failed to write to log file:', err);
  });
}

function getStoredIp() {
  try {
    if (fs.existsSync(config.files.lastIp)) {
      return fs.readFileSync(config.files.lastIp, 'utf8').trim();
    }
  } catch (error) {
    log(`Error reading stored IP: ${error.message}`, 'ERROR');
  }
  return null;
}

function storeIp(ip) {
  try {
    fs.writeFileSync(config.files.lastIp, ip);
    log(`Stored new IP: ${ip}`);
  } catch (error) {
    log(`Error storing IP: ${error.message}`, 'ERROR');
  }
}

async function getRouterPublicIp() {
  log('Attempting to detect router public IP...');
    try {
    const response = await axios.get(process.env.DDNS_PROVIDER, {
        headers: {
            'Accept': 'application/json',
            'API-Key': process.env.DDNS_API_KEY
        },
        timeout: 10000
    });
    log(`Detected public IP via external service: ${response.data}`);
    return response.data.domains[0].ipv4Address;
  } catch (error) {
    log(`All IP detection methods failed: ${error.message}`, 'ERROR');
    return null;
  }
}

async function updatePorkbunDns(domain, ip) {
  try {
    // First, get the record ID
    const response = await axios.post('https://porkbun.com/api/json/v3/dns/retrieve/' + domain.domain, {
      apikey: config.porkbun.apiKey,
      secretapikey: config.porkbun.secretKey
    });
    
    if (response.data.status !== 'SUCCESS') {
      throw new Error('Failed to retrieve DNS records');
    }
    
    let recordId = null;
    const records = response.data.records;
    for (const record of records) {
      if (record.type === 'A' && record.name === (domain.subdomain ? domain.subdomain + '.' + domain.domain : domain.domain)) {
        recordId = record.id;
        break;
      }
    }
    
    if (!recordId) {
      // Record doesn't exist, create it
      const createResponse = await axios.post('https://porkbun.com/api/json/v3/dns/create/' + domain.domain, {
        apikey: config.porkbun.apiKey,
        secretapikey: config.porkbun.secretKey,
        name: domain.subdomain,
        type: 'A',
        content: ip,
        ttl: '600'
      });
      
      if (createResponse.data.status === 'SUCCESS') {
        log(`Created A record for ${domain.subdomain || '@'}.${domain.domain} with IP: ${ip}`);
        return true;
      } else {
        throw new Error(createResponse.data.message || 'Failed to create DNS record');
      }
    } else {
      // Update existing record
      const updateResponse = await axios.post('https://porkbun.com/api/json/v3/dns/edit/' + domain.domain + '/' + recordId, {
        apikey: config.porkbun.apiKey,
        secretapikey: config.porkbun.secretKey,
        name: domain.subdomain,
        type: 'A',
        content: ip,
        ttl: '600'
      });
      
      if (updateResponse.data.status === 'SUCCESS') {
        log(`Updated A record for ${domain.subdomain || '@'}.${domain.domain} to IP: ${ip}`);
        return true;
      } else {
        throw new Error(updateResponse.data.message || 'Failed to update DNS record');
      }
    }
  } catch (error) {
    log(`Error updating DNS record: ${error.message}`, 'ERROR');
    return false;
  }
}

// Main function
async function checkAndUpdateDns() {
  log('Starting DNS update check...');
  
  // Get current router IP
  const currentIp = await getRouterPublicIp();
  if (!currentIp) {
    log('Failed to determine current IP address', 'ERROR');
    return;
  }
  
  // Get last stored IP
  const storedIp = getStoredIp();
  
  // If IP hasn't changed, no update needed
  if (storedIp === currentIp) {
    log('IP address unchanged, no update needed');
    return;
  }
  
  log(`IP change detected: ${storedIp || 'None'} -> ${currentIp}`);
  
  // Update all configured domains
  let allUpdatesSuccessful = true;
  
  for (const domain of config.domains) {
    
    // Update DNS record
    const success = await updatePorkbunDns(domain, currentIp);
    if (!success) {
      allUpdatesSuccessful = false;
    }
  }
  
  // Store new IP if all updates were successful
  if (allUpdatesSuccessful) {
    storeIp(currentIp);
    log('All DNS records updated successfully');
  } else {
    log('Some DNS updates failed, will retry on next check', 'WARNING');
  }
}

// Initialize and schedule the job
log('Porkbun DDNS Updater started');
log(`Configuration: ${JSON.stringify(config, null, 2)}`);

// Run immediately on startup
checkAndUpdateDns();