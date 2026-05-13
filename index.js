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

    const systemPrompt = `You are a helpful assistant for the website. 
Below is the content of the current webpage. Use this context to answer user questions accurately.

CONTEXT OF THE WEBPAGE:
${pageContent || 'No page content provided.'}

Rules:
1. Answer ONLY based on the provided context if possible.
2. If the answer is not in the context, politely say you don't know and offer general help.
3. Be professional, concise, and friendly.
4. If the user shows buying intent, encourage them to contact support or explore the products.`;

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
