import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import Anthropic from '@anthropic-ai/sdk';
import { supabase } from './supabase.js';

dotenv.config();

const app = express();
const port = process.env.PORT || 5000;

// =========================
// MIDDLEWARE
// =========================

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'DELETE'],
  allowedHeaders: ['Content-Type']
}));

app.use(express.json());

// =========================
// ROOT ROUTE
// =========================

app.get('/', (req, res) => {
  res.send('🚀 BotSaaS Backend Running Successfully!');
});

// =========================
// HEALTH CHECK
// =========================

app.get('/api/test', (req, res) => {
  res.json({
    status: 'Live',
    version: '3.0',
    message: 'Claude + Supabase Backend Active'
  });
});

// =========================
// API KEY CHECK
// =========================

const apiKey = process.env.ANTHROPIC_API_KEY || '';

console.log(
  'Anthropic Key:',
  apiKey
    ? `${apiKey.substring(0, 12)}...`
    : '❌ MISSING'
);

// =========================
// CHAT API
// =========================

app.post('/api/chat', async (req, res) => {
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY;

    const anthropic = new Anthropic({
      apiKey
    });

    const {
      messages = [],
      pageContent = '',
      botId = 'AI Assistant'
    } = req.body;

    const formattedMessages = messages.map((m) => ({
      role: m.role,
      content: m.content
    }));

    const response = await anthropic.messages.create({
      model: 'claude-3-opus-20240229',
      max_tokens: 1024,
      system: `
You are an AI assistant for ${botId}.

Website knowledge:
${pageContent}
`,
      messages: formattedMessages
    });

    const botReply =
      response.content[0].text;

    res.json({
      text: botReply
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      text: JSON.stringify(error)
    });
  }
});

// =========================
// GET ALL BOTS
// =========================

app.get('/api/bots', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('bots')
      .select('*');

    if (error) throw error;

    res.json(data);

  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: error.message
    });
  }
});

// =========================
// CREATE / UPDATE BOT
// =========================

app.post('/api/bots', async (req, res) => {
  try {
    const bot = req.body;

    const { data, error } = await supabase
      .from('bots')
      .upsert({
        id: bot.id || undefined,
        name: bot.name,
        website: bot.website,
        color: bot.color,
        icon_size:
          bot.icon_size || bot.iconSize,
        knowledge:
          bot.knowledge || bot.context,
        icon_url: bot.icon_url
      })
      .select();

    if (error) throw error;

    res.json(data[0]);

  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: error.message
    });
  }
});

// =========================
// DELETE BOT
// =========================

app.delete('/api/bots/:id', async (req, res) => {
  try {
    const { error } = await supabase
      .from('bots')
      .delete()
      .eq('id', req.params.id);

    if (error) throw error;

    res.json({
      success: true
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: error.message
    });
  }
});

// =========================
// GET CHAT LOGS
// =========================

app.get('/api/bots/:id/logs', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('chat_logs')
      .select('*')
      .eq('bot_id', req.params.id)
      .order('created_at', {
        ascending: false
      });

    if (error) throw error;

    res.json(data);

  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: error.message
    });
  }
});

// =========================
// DELETE SINGLE LOG
// =========================

app.delete('/api/logs/:id', async (req, res) => {
  try {
    const { error } = await supabase
      .from('chat_logs')
      .delete()
      .eq('id', req.params.id);

    if (error) throw error;

    res.json({
      success: true
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: error.message
    });
  }
});

// =========================
// DELETE ALL LOGS FOR BOT
// =========================

app.delete('/api/bots/:id/logs', async (req, res) => {
  try {
    const { error } = await supabase
      .from('chat_logs')
      .delete()
      .eq('bot_id', req.params.id);

    if (error) throw error;

    res.json({
      success: true
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: error.message
    });
  }
});

// =========================
// START SERVER
// =========================

app.listen(port, () => {
  console.log(
    `🔥 Server running on port ${port}`
  );
});