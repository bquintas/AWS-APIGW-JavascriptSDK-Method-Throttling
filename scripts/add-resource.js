require('dotenv').config();
const { APIGatewayClient, CreateResourceCommand, PutMethodCommand, PutIntegrationCommand, CreateDeploymentCommand } = require('@aws-sdk/client-api-gateway');

const client = new APIGatewayClient({ region: process.env.AWS_REGION || 'us-east-1' });

async function addResource(apiId, parentId, pathPart, httpMethod = 'GET') {
  try {
    // Create resource
    const resourceResponse = await client.send(new CreateResourceCommand({
      restApiId: apiId,
      parentId: parentId,
      pathPart: pathPart
    }));

    console.log(`Created resource: ${pathPart} with ID: ${resourceResponse.id}`);

    // Add method
    await client.send(new PutMethodCommand({
      restApiId: apiId,
      resourceId: resourceResponse.id,
      httpMethod: httpMethod,
      authorizationType: 'NONE'
    }));

    // Add mock integration
    await client.send(new PutIntegrationCommand({
      restApiId: apiId,
      resourceId: resourceResponse.id,
      httpMethod: httpMethod,
      type: 'MOCK',
      requestTemplates: {
        'application/json': '{"statusCode": 200}'
      }
    }));

    console.log(`Added ${httpMethod} method to /${pathPart}`);
    return resourceResponse.id;
  } catch (error) {
    console.error('Error:', error);
  }
}

async function deployAPI(apiId, stageName = 'dev') {
  try {
    await client.send(new CreateDeploymentCommand({
      restApiId: apiId,
      stageName: stageName
    }));
    console.log(`Deployed API to ${stageName} stage`);
  } catch (error) {
    console.error('Deployment error:', error);
  }
}

async function run() {
  const API_ID = process.env.API_GATEWAY_ID || 'your-api-id';
  const ROOT_RESOURCE_ID = process.env.ROOT_RESOURCE_ID || 'your-root-resource-id';
  
  await addResource(API_ID, ROOT_RESOURCE_ID, 'users', 'GET');
  await deployAPI(API_ID);
}

run();