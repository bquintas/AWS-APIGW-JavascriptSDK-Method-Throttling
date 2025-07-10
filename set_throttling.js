#!/usr/bin/env node

require('dotenv').config();
const { APIGatewayClient, UpdateUsagePlanCommand } = require('@aws-sdk/client-api-gateway');
const { CloudFormationClient, DescribeStacksCommand } = require('@aws-sdk/client-cloudformation');

const apiClient = new APIGatewayClient({ region: process.env.AWS_REGION || 'us-east-1' });
const cfClient = new CloudFormationClient({ region: process.env.AWS_REGION || 'us-east-1' });

async function getUsagePlanId() {
    const response = await cfClient.send(new DescribeStacksCommand({
        StackName: 'api-gateway-stack'
    }));
    
    const outputs = response.Stacks[0].Outputs;
    const usagePlanOutput = outputs.find(output => output.OutputKey === 'UsagePlanId');
    
    return usagePlanOutput ? usagePlanOutput.OutputValue : null;
}

async function setMethodThrottling() {
    const usagePlanId = await getUsagePlanId();
    const apiId = process.env.API_GATEWAY_ID;
    const stageName = 'dev';
    
    if (!usagePlanId || !apiId) {
        console.log("Missing usage plan ID or API Gateway ID");
        return;
    }
    
    await apiClient.send(new UpdateUsagePlanCommand({
        usagePlanId: usagePlanId,
        patchOperations: [
            {
                op: 'add',
                path: `/apiStages/${apiId}:${stageName}/throttle//users/GET/rateLimit`,
                value: '400'
            },
            {
                op: 'add',
                path: `/apiStages/${apiId}:${stageName}/throttle//users/GET/burstLimit`,
                value: '600'
            }
        ]
    }));
    
    console.log(`Set throttling for GET /users: 400 req/sec, 600 burst`);
    console.log(`Usage Plan ID: ${usagePlanId}`);
}

setMethodThrottling().catch(console.error);