# Team Messenger Lambda

This Lambda function receives messages from an SNS topic and forwards them to Microsoft Teams using an adaptive card format.

## Overview

The Lambda function:

1. Receives notifications from an SNS topic
2. Formats the data as Microsoft Teams adaptive cards
3. Sends the formatted message to a Teams webhook URL

## Prerequisites

- AWS CLI configured with appropriate permissions
- Node.js 18.x or higher
- A Microsoft Teams webhook URL

## Deployment Options

### Using Serverless Framework (Recommended)

The easiest way to deploy this function is with the Serverless Framework:

```bash
# Install dependencies
npm install

# Store the webhook URL as a parameter
serverless param set --name teamsWebhookUrl --value "your-teams-webhook-url" --stage dev

# Deploy to dev environment
npm run deploy:dev

# Or deploy to production
npm run deploy:prod
```

You can also use the serverless command directly:

```bash
# Deploy to a specific stage and region
serverless deploy --stage prod --region us-west-2
```

### Using AWS SAM CLI

You can also deploy using the AWS SAM CLI with the template.yaml file:

```bash
# Make the script executable
chmod +x deploy.sh

# Deploy to the default (dev) environment
./deploy.sh

# Or deploy to a specific environment
./deploy.sh prod
```

## Testing

After deployment, you can test the Lambda function by publishing a message to the SNS topic:

```bash
# Basic text message
aws sns publish \
  --topic-arn <SNS_TOPIC_ARN> \
  --subject "Test Notification" \
  --message '{"items": [{"type": "TextBlock", "text": "This is a test message", "wrap": true}]}'

# Or sending a message from a JSON file
aws sns publish \
  --topic-arn <SNS_TOPIC_ARN> \
  --subject "Test Notification" \
  --message file://test-message.json
```

### Example Teams Card JSON Format

Here's an example of what you can include in your test message JSON:

```json
{
  "items": [
    {
      "type": "TextBlock",
      "text": "Deployment Status Report",
      "weight": "bolder",
      "size": "medium"
    },
    {
      "type": "TextBlock",
      "text": "Build completed successfully",
      "wrap": true
    },
    {
      "type": "FactSet",
      "facts": [
        {
          "title": "Status",
          "value": "Success"
        },
        {
          "title": "Duration",
          "value": "3m 42s"
        },
        {
          "title": "Environment",
          "value": "Production"
        }
      ]
    }
  ]
}
```

## Architecture

```
[SNS Topic] → [Lambda Function] → [Microsoft Teams Webhook]
```

The Lambda function is subscribed to an SNS topic. When a message is published to the topic, the Lambda function is triggered, processes the message, and sends it to Microsoft Teams.

## Resources Created

- Lambda Function
- IAM Role for the Lambda function
- SNS Topic
- SNS Subscription

## Customizing

You can customize the appearance and behavior of the Teams messages by editing the `formatTeamsMessage` function in the `index.js` file.

## Security

The Microsoft Teams webhook URL is stored securely using the Serverless Framework parameters. It is not visible in the CloudFormation stack outputs. The Lambda function has minimal permissions required to execute. 