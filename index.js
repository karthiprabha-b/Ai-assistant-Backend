import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import Anthropic from '@anthropic-ai/sdk';

dotenv.config();

const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

app.post('/api/chat', async (req, res) => {
  try {
    const { messages, pageContent } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Messages are required and must be an array.' });
    }

    const systemPrompt = `You are the official AI Assistant for the Maharashtra Muslim Conference (MMC), led by Haji Zubair Memon.
Your goal is to provide accurate information about the organization's work, social activities, and political advocacy based on the website content.

CONTEXT OF THE WEBPAGE:
${pageContent || 'No page content provided.'}

Rules:
1. Identify yourself as the MMC Assistant.
2. Answer based ONCE on the provided context. If information about a specific program or event is in the text, highlight it.
3. If the user asks about Haji Zubair Memon, refer to him as the dynamic leader of the organization.
4. Be professional, respectful, and helpful.
5. If you don't know an answer, suggest they contact the MMC office directly.`;

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: systemPrompt,
      messages: messages.map(m => ({
        role: m.role,
        content: m.content,
      })),
    });

    res.json({ text: response.content[0].text });
  } catch (error) {
    console.error('Claude API Error:', error);
    res.status(500).json({ error: 'Failed to fetch response from Claude.' });
  }
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
