import axios from 'axios';

// Default webhook URL if not set via environment variable
const DEFAULT_WEBHOOK_URL = "https://mum0.webhook.office.com/webhookb2/4928ae4e-5cd0-4092-b0cb-f9318ee715d5@28fd0d9a-e529-413f-88d5-7f33f67675ef/IncomingWebhook/2fab0241d5bb4af7a3fe1ae03a7f8dcb/f13f15a4-8d84-4d2e-8850-7505d71f7d0a/V2R4vN7I5vsXXlcLeUsoVPx29Z7TXWUBF8Tcxl0MpG2oY1";

/**
 * Lambda function that processes direct SNS messages containing CodePipeline events
 * and forwards them to Microsoft Teams.
 * 
 * @param {Object} event - The SNS event object
 * @param {Object} context - The Lambda context object
 * @returns {Promise<void>} - Resolves on success, throws error on failure
 */
export const handler = async (event, context) => {
  try {
    console.log('SNS Event received:', JSON.stringify(event, null, 2));
    
    // Get the Teams webhook URL from environment variables or use default
    const teamsWebhookUrl = process.env.TEAMS_WEBHOOK_URL || DEFAULT_WEBHOOK_URL;
    
    // Process SNS event messages (can be multiple records in one event)
    const promises = event.Records.map(async (record) => {
      const snsInfo = record.Sns;
      let codePipelineEvent;

      try {
        // The SNS Message field contains the CodePipeline event as a JSON string
        codePipelineEvent = JSON.parse(snsInfo.Message); 
        console.log('Parsed CodePipeline Event:', JSON.stringify(codePipelineEvent, null, 2));
      } catch (parseError) {
        console.error('Failed to parse SNS Message as CodePipeline Event JSON:', parseError);
        // Send a fallback message indicating the parsing error
        const fallbackSubject = snsInfo.Subject || 'SNS Notification Error';
        const fallbackMessage = { 
            items: [ 
                { type: "TextBlock", text: "Error parsing CodePipeline event from SNS", weight: "bolder", color: "attention" }, 
                { type: "TextBlock", text: `Subject: ${fallbackSubject}`, wrap: true },
                { type: "TextBlock", text: `Original Message: ${snsInfo.Message}`, wrap: true }
            ]
        };
        await sendToTeams(teamsWebhookUrl, formatFallbackMessage(fallbackSubject, fallbackMessage));
        return; // Stop processing this record
      }
      
      // Extract relevant details from the CodePipeline event
      const detail = codePipelineEvent.detail;
      const pipelineName = detail?.pipeline;
      const executionId = detail?.['execution-id'];
      const stageName = detail?.stage;
      const actionName = detail?.action;
      const state = detail?.state; // e.g., SUCCEEDED, FAILED, STARTED
      const externalExecutionSummary = detail?.['execution-result']?.['external-execution-summary'];
      const timestamp = codePipelineEvent.time || new Date().toISOString();

      // Format the message for Teams using the extracted data
      const teamsMessage = formatCodePipelineEventForTeams(
          pipelineName,
          executionId,
          stageName,
          actionName,
          state,
          externalExecutionSummary,
          timestamp
      );
      
      // Send the message to Teams
      await sendToTeams(teamsWebhookUrl, teamsMessage);
    });
    
    await Promise.all(promises);
    
    console.log('Successfully processed all SNS records.');

  } catch (error) {
    console.error('Error processing SNS event:', error);
    throw error; 
  }
};

/**
 * Formats a CodePipeline event notification for Microsoft Teams.
 */
function formatCodePipelineEventForTeams(pipelineName, executionId, stageName, actionName, state, summary, timestamp) {
  const isSuccess = state === 'SUCCEEDED';
  const statusEmoji = isSuccess ? '✅' : (state === 'FAILED' ? '❌' : 'ℹ️');
  const cardTitle = `${statusEmoji} Pipeline: ${pipelineName}`;
  const cardColor = isSuccess ? "good" : (state === 'FAILED' ? "attention" : "default");

  const facts = [
    { title: "Pipeline", value: pipelineName || "N/A" },
    { title: "Execution ID", value: executionId || "N/A" },
    { title: "Stage", value: stageName || "N/A" },
    { title: "Action", value: actionName || "N/A" },
    { title: "Status", value: state || "N/A" },
    { title: "Timestamp", value: new Date(timestamp).toLocaleString() || "N/A" }
  ];

  const body = [
      {
          type: "TextBlock",
          size: "large",
          weight: "bolder",
          text: cardTitle,
          color: cardColor,
      },
      {
          type: "FactSet",
          facts: facts,
          separator: true
      }
  ];

  // Add summary if available
  if (summary) {
      body.push({
          type: "TextBlock",
          text: `**Summary:** ${summary}`,
          wrap: true,
          separator: true
      });
  }

  return {
    type: 'message',
    attachments: [
      {
        contentType: 'application/vnd.microsoft.card.adaptive',
        contentUrl: null,
        content: {
          $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
          type: 'AdaptiveCard',
          version: '1.2',
          msTeams: {
            width: 'full'
          },
          body: body
        }
      }
    ]
  };
}

/**
 * Formats a simple fallback message when parsing fails.
 */
function formatFallbackMessage(subject, message) {
  let adaptiveCardBody = [];
  if (typeof message === 'object' && message !== null && message.items && Array.isArray(message.items)){
      adaptiveCardBody = message.items;
  } else {
      adaptiveCardBody.push({ type: "TextBlock", text: subject, weight: "bolder" });
      adaptiveCardBody.push({ type: "TextBlock", text: JSON.stringify(message, null, 2), wrap: true });
  }
  return {
    type: 'message',
    attachments: [
      {
        contentType: 'application/vnd.microsoft.card.adaptive',
        contentUrl: null,
        content: {
          $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
          type: 'AdaptiveCard',
          version: '1.2',
          msTeams: {
            width: 'full'
          },
          body: adaptiveCardBody
        }
      }
    ]
  };
}

/**
 * Send a message to Microsoft Teams
 * 
 * @param {string} webhookUrl - The Teams webhook URL
 * @param {Object} message - The formatted Teams message
 * @returns {Promise<void>} - Resolves on success, rejects on error
 */
async function sendToTeams(webhookUrl, message) {
  try {
    const response = await axios.post(webhookUrl, message);
    console.log('Message sent to Teams:', response.status, response.statusText);
  } catch (error) {
    console.error('Error sending to Teams:', error.response ? JSON.stringify(error.response.data) : error.message);
    // Re-throw the error so the Lambda invocation fails
    throw error;
  }
} 
