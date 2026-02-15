const Anthropic = require('@anthropic-ai/sdk');
const crypto = require('crypto');
const { getDb } = require('../db');

const MODEL = 'claude-sonnet-4-5-20250929';

// Approximate pricing per token (USD) for Claude Sonnet
const INPUT_COST_PER_TOKEN = 0.000003;
const OUTPUT_COST_PER_TOKEN = 0.000015;

function getClient() {
  const apiKey = process.env.CLAUDE_API_KEY;
  if (!apiKey || apiKey === 'YOUR_CLAUDE_API_KEY') {
    throw new Error('CLAUDE_API_KEY is not configured. Set it in your environment variables.');
  }
  return new Anthropic({ apiKey });
}

/**
 * Analyze a research paper's markdown content using Claude.
 * Returns: { summary, rating, category, tags, keyFindings }
 */
async function analyzePaper(markdownContent, userId) {
  const client = getClient();

  // Truncate very long papers to stay within context limits
  const maxChars = 150000;
  const truncated =
    markdownContent.length > maxChars
      ? markdownContent.slice(0, maxChars) + '\n\n[Content truncated due to length...]'
      : markdownContent;

  const prompt = `Analyze this research paper and return a JSON object with the following fields:

- "summary": A 2-3 paragraph summary of the paper covering the main objectives, methods, and conclusions.
- "rating": An integer from 1-10 based on methodology quality, novelty, and significance.
- "category": One of: "Neuroscience", "Computer Science", "Biology", "Physics", "Mathematics", "Medicine", "Chemistry", "Engineering", "Psychology", "Economics", "Other".
- "tags": An array of 3-5 relevant keywords as strings.
- "keyFindings": An array of 3-5 key findings, each as a concise sentence string.

Return ONLY valid JSON, no additional text or markdown formatting.

Paper content:

${truncated}`;

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 2000,
    messages: [
      {
        role: 'user',
        content: prompt,
      },
    ],
  });

  const responseText = response.content[0].text;
  const inputTokens = response.usage.input_tokens;
  const outputTokens = response.usage.output_tokens;
  const costEstimate = inputTokens * INPUT_COST_PER_TOKEN + outputTokens * OUTPUT_COST_PER_TOKEN;

  // Log usage
  trackUsage(userId, 'paper_analysis', costEstimate);

  // Parse the JSON response - handle potential markdown code blocks
  let parsed;
  try {
    // Try direct parse first
    parsed = JSON.parse(responseText);
  } catch {
    // Try extracting JSON from markdown code block
    const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      parsed = JSON.parse(jsonMatch[1].trim());
    } else {
      // Try finding the first { and last }
      const start = responseText.indexOf('{');
      const end = responseText.lastIndexOf('}');
      if (start !== -1 && end !== -1) {
        parsed = JSON.parse(responseText.slice(start, end + 1));
      } else {
        throw new Error('Failed to parse Claude response as JSON');
      }
    }
  }

  return {
    summary: parsed.summary || '',
    rating: Math.min(10, Math.max(1, parseInt(parsed.rating, 10) || 5)),
    category: parsed.category || 'Other',
    tags: Array.isArray(parsed.tags) ? parsed.tags : [],
    keyFindings: Array.isArray(parsed.keyFindings) ? parsed.keyFindings : [],
    costEstimate,
  };
}

/**
 * Generate an AI response for an annotation/question about a paper.
 */
async function answerAnnotation(paperMarkdown, selectedText, question, userId) {
  const client = getClient();

  // Use a smaller portion of the paper for context
  const maxChars = 50000;
  const truncatedPaper =
    paperMarkdown.length > maxChars
      ? paperMarkdown.slice(0, maxChars) + '\n\n[Content truncated...]'
      : paperMarkdown;

  const prompt = `You are a research assistant. A user is reading a research paper and has a question.

Paper context (may be truncated):
${truncatedPaper}

The user highlighted this text:
"${selectedText}"

Their question/note:
${question}

Provide a helpful, concise response that draws on the paper content and your knowledge. Keep it to 2-3 paragraphs maximum.`;

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 1000,
    messages: [
      {
        role: 'user',
        content: prompt,
      },
    ],
  });

  const responseText = response.content[0].text;
  const inputTokens = response.usage.input_tokens;
  const outputTokens = response.usage.output_tokens;
  const costEstimate = inputTokens * INPUT_COST_PER_TOKEN + outputTokens * OUTPUT_COST_PER_TOKEN;

  trackUsage(userId, 'annotation_query', costEstimate);

  return {
    aiResponse: responseText,
    costEstimate,
  };
}

/**
 * Multi-turn chat about a paper using Claude.
 */
async function chatAboutPaper(paperMarkdown, messages, userId) {
  const client = getClient();
  const maxChars = 50000;
  const truncatedPaper = paperMarkdown.length > maxChars ? paperMarkdown.slice(0, maxChars) + '\n\n[Content truncated...]' : paperMarkdown;

  const systemPrompt = `You are a research assistant helping a user understand a research paper. Be concise, accurate, and helpful.\n\nPaper content:\n${truncatedPaper}`;

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 1500,
    system: systemPrompt,
    messages: messages.map(m => ({ role: m.role, content: m.content })),
  });

  const responseText = response.content[0].text;
  const inputTokens = response.usage.input_tokens;
  const outputTokens = response.usage.output_tokens;
  const costEstimate = inputTokens * INPUT_COST_PER_TOKEN + outputTokens * OUTPUT_COST_PER_TOKEN;
  trackUsage(userId, 'chat_query', costEstimate);
  return { response: responseText, costEstimate };
}

/**
 * Track a Claude API usage event.
 */
function trackUsage(userId, action, costEstimate) {
  try {
    const db = getDb();
    db.prepare('INSERT INTO usage (id, user_id, action, cost_estimate, created_at) VALUES (?, ?, ?, ?, ?)').run(
      crypto.randomUUID(),
      userId,
      action,
      costEstimate,
      new Date().toISOString()
    );
  } catch (err) {
    console.error('Failed to track usage:', err);
  }
}

module.exports = { analyzePaper, answerAnnotation, chatAboutPaper, trackUsage };
