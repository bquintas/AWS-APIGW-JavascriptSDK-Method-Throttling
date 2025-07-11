const crypto = require('crypto');
const https = require('https');
require('dotenv').config();

// AWS credentials from environment
const accessKey = process.env.AWS_ACCESS_KEY_ID;
const secretKey = process.env.AWS_SECRET_ACCESS_KEY;
const sessionToken = process.env.AWS_SESSION_TOKEN;
const region = process.env.AWS_REGION || 'us-east-1';

// API Gateway details from environment
const usagePlanId = process.env.USAGE_PLAN_ID; // Add this to your .env

if (!accessKey || !secretKey) {
    console.error('AWS credentials not found in environment variables');
    process.exit(1);
}

if (!usagePlanId) {
    console.error('USAGE_PLAN_ID not found in environment variables');
    process.exit(1);
}

// AWS Signature V4 signing functions
function sign(key, msg) {
    return crypto.createHmac('sha256', key).update(msg).digest();
}

function getSignatureKey(key, dateStamp, regionName, serviceName) {
    const kDate = sign('AWS4' + key, dateStamp);
    const kRegion = sign(kDate, regionName);
    const kService = sign(kRegion, serviceName);
    const kSigning = sign(kService, 'aws4_request');
    return kSigning;
}

function createSignedRequest(method, path, body = '') {
    const service = 'apigateway';
    const host = `apigateway.${region}.amazonaws.com`;
    
    // Create timestamp
    const t = new Date();
    const amzDate = t.toISOString().replace(/[:\-]|\.\d{3}/g, '');
    const dateStamp = amzDate.substr(0, 8);
    
    // Create canonical request
    const algorithm = 'AWS4-HMAC-SHA256';
    const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
    
    const canonicalHeaders = `host:${host}\nx-amz-date:${amzDate}\n` + 
                           (sessionToken ? `x-amz-security-token:${sessionToken}\n` : '');
    const signedHeaders = 'host;x-amz-date' + (sessionToken ? ';x-amz-security-token' : '');
    
    const payloadHash = crypto.createHash('sha256').update(body).digest('hex');
    
    const canonicalRequest = `${method}\n${path}\n\n${canonicalHeaders}\n${signedHeaders}\n${payloadHash}`;
    
    // Create string to sign
    const stringToSign = `${algorithm}\n${amzDate}\n${credentialScope}\n${crypto.createHash('sha256').update(canonicalRequest).digest('hex')}`;
    
    // Calculate signature
    const signingKey = getSignatureKey(secretKey, dateStamp, region, service);
    const signature = crypto.createHmac('sha256', signingKey).update(stringToSign).digest('hex');
    
    // Create authorization header
    const authorizationHeader = `${algorithm} Credential=${accessKey}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
    
    return {
        host,
        path,
        method,
        headers: {
            'Host': host,
            'X-Amz-Date': amzDate,
            'Authorization': authorizationHeader,
            'Content-Type': 'application/json',
            ...(sessionToken && { 'X-Amz-Security-Token': sessionToken })
        },
        body
    };
}

function makeRequest(requestOptions) {
    return new Promise((resolve, reject) => {
        const req = https.request({
            hostname: requestOptions.host,
            path: requestOptions.path,
            method: requestOptions.method,
            headers: requestOptions.headers
        }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                console.log(`Response Status: ${res.statusCode}`);
                console.log('Response:', data);
                resolve({ statusCode: res.statusCode, body: data });
            });
        });
        
        req.on('error', reject);
        
        if (requestOptions.body) {
            req.write(requestOptions.body);
        }
        req.end();
    });
}

async function updateMethodThrottling(resourcePath, httpMethod, rateLimit, burstLimit) {
    const path = `/usageplans/${usagePlanId}`;
    const apiId = process.env.API_GATEWAY_ID;
    const stageName = 'dev';
    
    const patchOperations = [
        {
            op: 'replace',
            path: `/apiStages/${apiId}:${stageName}/throttle/${resourcePath}/${httpMethod}/rateLimit`,
            value: rateLimit.toString()
        },
        {
            op: 'replace',
            path: `/apiStages/${apiId}:${stageName}/throttle/${resourcePath}/${httpMethod}/burstLimit`,
            value: burstLimit.toString()
        }
    ];
    
    console.log(`Updating throttling for ${httpMethod} ${resourcePath}`);
    console.log(`Rate Limit: ${rateLimit}, Burst Limit: ${burstLimit}`);
    console.log('Patch Operations:', JSON.stringify(patchOperations, null, 2));
    
    const body = JSON.stringify({ patchOperations });
    const request = createSignedRequest('PATCH', path, body);
    
    // Print request details
    console.log('\n=== REQUEST DETAILS ===');
    console.log(`URL: https://${request.host}${request.path}`);
    console.log(`Method: ${request.method}`);
    console.log('\nHeaders:');
    Object.entries(request.headers).forEach(([key, value]) => {
        console.log(`  ${key}: ${value}`);
    });
    console.log('\nBody:');
    console.log(JSON.stringify(JSON.parse(request.body), null, 2));
    console.log('========================\n');
    
    try {
        const response = await makeRequest(request);
        return response;
    } catch (error) {
        console.error('Error updating throttling:', error);
        throw error;
    }
}

// Example usage
async function main() {
    console.log('Using Usage Plan ID:', usagePlanId);
    console.log('Using Region:', region);
    
    try {
        // Update throttling for GET /users method
        await updateMethodThrottling('/users', 'GET', 300, 500);
    } catch (error) {
        console.error('Failed to update method throttling:', error);
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}

module.exports = { updateMethodThrottling };