# API Gateway Method Throttling via JavaScript v3.0 SDK demo

Deploy API Gateway via CloudFormation and manage method-specific throttling with AWS SDK.

## Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure AWS credentials:**
   ```bash
   aws configure
   ```

3. **Deploy API Gateway:**
   ```bash
   npm run deploy
   ```

4. **Get API Gateway details:**
   ```bash
   aws cloudformation describe-stacks --stack-name api-gateway-stack --query 'Stacks[0].Outputs'
   ```

5. **Set environment variables:**
   ```bash
   cp .env.example .env
   # Edit .env with your API Gateway ID and Root Resource ID from stack outputs
   ```

## Usage

**Add /users resource with GET method (automatically deploys):**
```bash
npm run add-resource
```

**Set method throttling (400 req/sec, 600 burst):**
```bash
npm run set-method-throttling
```

**Replace method throttling (250 req/sec, 300 burst):**
```bash
npm run replace-method-throttling
```

## Key Features

- **CloudFormation deployment** with usage plans and API keys
- **Method-specific throttling** for individual endpoints
- **Add/Replace operations** for throttling management
- **Mock integrations** for testing