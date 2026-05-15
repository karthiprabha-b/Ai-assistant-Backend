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
    const { messages, pageContent, botId } = req.body;
    
    if (!botId) return res.status(400).json({ error: 'Bot ID is required.' });

    const { data: botConfig, error: botError } = await supabase
      .from('bots').select('*').eq('id', botId).single();

    if (botError || !botConfig) return res.status(404).json({ error: 'Bot not found.' });

    const systemPrompt = `
      You are a professional AI assistant for ${botConfig.name}.
      CRITICAL MISSION: Before answering questions, naturally collect the user's Name, Email, and Phone.
      BUSINESS KNOWLEDGE: ${botConfig.knowledge || ''}
      CURRENT PAGE: ${pageContent || ''}
    `.trim();

    const response = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20240620',
      max_tokens: 1024,
      system: systemPrompt,
      messages: messages.filter(m => m.role === 'user' || m.role === 'assistant').map(m => ({
        role: m.role,
        content: m.content
      }))
    });

    const botReply = response.content[0].text;

    // Background log
    supabase.from('chat_logs').insert({
      bot_id: botId,
      user_message: messages[messages.length - 1].content,
      bot_reply: botReply
    }).then(({ error }) => { if (error) console.error('Logging Error:', error); });

    res.json({ text: botReply });
  } catch (error) {
    console.error('Claude Error:', error);
    res.status(200).json({ text: `⚠️ AI Service Error: ${error.message}. Please check your Anthropic API key/credits.` });
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
