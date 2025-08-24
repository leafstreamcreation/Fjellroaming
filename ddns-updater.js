const axios = require('axios');
const fs = require('fs');
require('dotenv').config();

// Configuration - Update these values for your setup
const config = {
  dnsProvider: {
    endpoint: process.env.DNSP_ENDPOINT || 'https://api.dnsprovider.com/v1', // Example endpoint
    apiKey: process.env.DNSP_API_KEY || 'your-dns-provider-api-key',
    secretKey: process.env.DNSP_API_SECRET || 'your-dns-provider-secret-key'
  },
  ddnsProvider: {
    endpoint: process.env.DDNSP_ENDPOINT || 'https://api.dnsprovider.com/v1/getip', // Example endpoint
    apiKey: process.env.DDNSP_API_KEY || 'your-ddns-provider-api-key'
  },
  domain: process.env.DOMAIN || 'yourdomain.com',
  subDomains: process.env.SUBDOMAINS ? process.env.SUBDOMAINS.split(',') : [''], // Comma-separated list of subdomains
  files: {
    lastIp: process.env.LAST_IP_FILE || './last-ip.txt',
    log: process.env.LOG_FILE || './ddns-updater.log'
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
  log(`Attempting to detect router public IP: ${config.ddnsProvider.endpoint}`);
  try {
    const response = await axios.get(config.ddnsProvider.endpoint, {
        headers: {
            'Accept': 'application/json',
            'API-Key': config.ddnsProvider.apiKey
        },
        timeout: 10000
    });
    log(`Detected public IP via external service: ${response.data.domains[0].ipv4Address}`);
    return response.data.domains[0].ipv4Address;
  } catch (error) {
    log(`IP detection failed: ${error.message}`, 'ERROR');
    return null;
  }
}

async function updateDnsRecord(subdomain, ip) {
  log(`Updating DNS record: ${config.dnsProvider.endpoint}/${config.domain}/A/${subdomain} -> ${ip}`);
  try {
    const response = await axios.post(`${config.dnsProvider.endpoint}/${config.domain}/A/${subdomain}`, {
      apikey: config.dnsProvider.apiKey,
      secretapikey: config.dnsProvider.secretKey,
      content: ip,
      ttl: '600'
    });
    
    if (response.data.status !== 'SUCCESS') {
      throw new Error('Failed to update DNS record : ' + JSON.stringify(response.data.message));
    }
    
    log(`DNS record updated successfully for ${subdomain}.${config.domain} -> ${ip}`);
    return true;
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
  if (!storedIp) {
    log('No stored IP found, assuming first run');
  }
  
  // If IP hasn't changed, no update needed
  if (storedIp === currentIp) {
    log('IP address unchanged, no update needed');
    return;
  }
  
  log(`IP change detected: ${storedIp || 'None'} -> ${currentIp}`);
  
  // Update all configured domains
  let allUpdatesSuccessful = true;

  for (const subdomain of config.subDomains) {

    // Update DNS record
    const success = await updateDnsRecord(subdomain, currentIp);
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

// Run immediately on startup
checkAndUpdateDns();
const id = setInterval(checkAndUpdateDns, process.env.CHECK_INTERVAL || 600000); // Every 10 minutes

process.on('SIGINT', () => {
  clearInterval(id);
  log('Shutting down DDNS updater');
  process.exit();
});