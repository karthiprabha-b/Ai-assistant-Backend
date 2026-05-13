import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import Anthropic from '@anthropic-ai/sdk';

dotenv.config();

const app = express();
const port = process.env.PORT || 5000;

app.use(cors({
  origin: '*', // Allow all origins for the widget
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type']
}));
app.use(express.json());

// Health check to see if server is alive
app.get('/', (req, res) => res.send('Chatbot Backend is Running!'));

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

app.post('/api/chat', async (req, res) => {
  try {
    const { messages, pageContent } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Messages are required and must be an array.' });
    }

    const systemPrompt = `You are the official AI Assistant for Travelism AI, a premier travel agency.
Your goal is to provide accurate information about our travel packages, destinations, flight bookings, and hotel services based on the website content.

CONTEXT OF THE WEBPAGE:
${pageContent || 'No page content provided.'}

Rules:
1. Identify yourself as the Travelism AI Assistant.
2. Answer based on the provided context and our travel services.
3. If the user asks about specific destinations, highlight our top-rated tours.
4. Be professional, adventurous, and helpful.
5. If you don't know an answer, suggest they contact our travel experts directly via the contact page.`;

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
    console.error('Claude API Error Details:', {
      message: error.message,
      stack: error.stack,
      type: error.type,
      status: error.status
    });
    res.status(500).json({ 
      error: 'Failed to fetch response from Claude.',
      details: error.message 
    });
  }
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
