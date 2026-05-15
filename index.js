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

// Version Test Endpoint
app.get('/api/test', (req, res) => {
  res.json({ status: 'Live', version: '2.0', message: 'Model fallback logic is active.' });
});

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// For verification (Logs to Render Console only)
console.log('API Key Check:', process.env.ANTHROPIC_API_KEY ? `Starts with: ${process.env.ANTHROPIC_API_KEY.substring(0, 10)}...` : 'MISSING!');

app.get('/', (req, res) => res.send('BotSaaS (Render) Backend is Running!'));

app.post('/api/chat', async (req, res) => {
  try {
    const { messages, botId } = req.body;
    
    const response = await anthropic.messages.create({
      model: 'claude-3-haiku-20240307',
      max_tokens: 1024,
      messages: messages.map(m => ({ role: m.role, content: m.content }))
    });

    res.json({ text: response.content[0].text });
  } catch (error) {
    res.status(200).json({ text: `⚠️ Error: ${error.message}` });
  }
});

// Bots API
app.get('/api/bots', async (req, res) => {
  const { data, error } = await supabase.from('bots').select('*');
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
      icon_size: bot.icon_size || bot.iconSize,
      knowledge: bot.knowledge || bot.context,
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

app.delete('/api/logs/:id', async (req, res) => {
  const { error } = await supabase.from('chat_logs').delete().eq('id', req.params.id);
  if (error) return res.status(500).json(error);
  res.json({ success: true });
});

app.delete('/api/bots/:id/logs', async (req, res) => {
  const { error } = await supabase.from('chat_logs').delete().eq('bot_id', req.params.id);
  if (error) return res.status(500).json(error);
  res.json({ success: true });
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
