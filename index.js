import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import Anthropic from '@anthropic-ai/sdk';
import { supabase } from './supabase.js';

dotenv.config();

const app = express();
const port = process.env.PORT || 5000;

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'DELETE'],
  allowedHeaders: ['Content-Type']
}));
app.use(express.json());

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

app.get('/', (req, res) => res.send('BotSaaS (Render) Backend is Running!'));

app.post('/api/chat', async (req, res) => {
  try {
    const { messages, pageContent, botId } = req.body;
    
    // Fetch bot config from Supabase
    const { data: botConfig, error: botError } = await supabase
      .from('bots')
      .select('*')
      .eq('id', botId)
      .single();

    if (botError || !botConfig) {
      return res.status(404).json({ error: 'Bot not found.' });
    }

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Messages are required.' });
    }

    const systemPrompt = `You are the official ${botConfig.name}.
Your goal is to provide accurate information based on the website content and your specific knowledge base.

SPECIFIC BOT KNOWLEDGE:
${botConfig.knowledge || ''}

CURRENT PAGE CONTEXT:
${pageContent || 'No page content provided.'}

Rules:
1. Identify yourself as the ${botConfig.name}.
2. Answer based on the provided knowledge and page context.
3. If you don't know an answer, suggest they contact human support.
4. Be professional and helpful.`;

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: systemPrompt,
      messages: messages.map(m => ({
        role: m.role,
        content: m.content,
      })),
    });

    const botReply = response.content[0].text;

    // Save to logs in the background (don't block the response)
    supabase.from('chat_logs').insert({
      bot_id: botId,
      user_message: messages[messages.length - 1].content,
      bot_reply: botReply
    }).then(({ error }) => {
      if (error) console.error('Logging error:', error.message);
    });

    res.json({ text: botReply });
  } catch (error) {
    console.error('Claude/Supabase Error:', error.message);
    res.status(500).json({ error: 'Failed to process request.', details: error.message });
  }
});

// Bot CRUD via Supabase
app.get('/api/bots', async (req, res) => {
  const { data, error } = await supabase.from('bots').select('*').order('created_at', { ascending: false });
  if (error) return res.status(500).json(error);
  res.json(data);
});

app.post('/api/bots', async (req, res) => {
  const bot = req.body;
  const { data, error } = await supabase
    .from('bots')
    .upsert({
      id: bot.id || undefined,
      name: bot.name,
      website: bot.website,
      color: bot.color,
      icon_size: bot.iconSize || bot.icon_size,
      knowledge: bot.context || bot.knowledge,
      icon_url: bot.icon_url
    })
    .select();
  
  if (error) return res.status(500).json(error);
  res.json(data[0]);
});

app.delete('/api/bots/:id', async (req, res) => {
  const { error } = await supabase.from('bots').delete().eq('id', req.params.id);
  if (error) return res.status(500).json(error);
  res.json({ success: true });
});

app.get('/api/bots/:id/logs', async (req, res) => {
  const { data, error } = await supabase
    .from('chat_logs')
    .select('*')
    .eq('bot_id', req.params.id)
    .order('created_at', { ascending: false });
    
  if (error) return res.status(500).json(error);
  res.json(data);
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
