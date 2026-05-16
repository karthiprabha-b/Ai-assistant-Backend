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
    const currentKey = process.env.ANTHROPIC_API_KEY || '';

    if (!currentKey) {
      return res.status(500).json({
        text: '❌ Missing ANTHROPIC_API_KEY'
      });
    }

    const {
      messages = [],
      pageContent = '',
      botId = 'AI Assistant'
    } = req.body;

    console.log('📩 Incoming Messages:', messages);
    console.log('🤖 Using Model: claude-3-7-sonnet-latest');

    // Create fresh client each request
    const client = new Anthropic({
      apiKey: currentKey
    });

    // Clean messages
    const formattedMessages = messages
      .filter(
        (m) =>
          m.role === 'user' ||
          m.role === 'assistant'
      )
      .map((m) => ({
        role: m.role,
        content: m.content
      }));

    // System Prompt
    const instructions = `
You are a professional AI assistant for ${botId}.

RULES:
1. First collect:
- Name
- Email
- Phone Number

2. Then answer user questions professionally.

3. Keep replies concise and friendly.

WEBSITE KNOWLEDGE:
${pageContent}
`.trim();

    // Claude API
    const response = await client.messages.create({
      model: 'claude-3-7-sonnet-latest',
      max_tokens: 1024,
      system: instructions,
      messages: formattedMessages
    });

    const botReply =
      response.content?.[0]?.text ||
      'No response generated.';

    // =========================
    // SAVE CHAT LOGS
    // =========================

    try {
      const userMessage =
        messages[messages.length - 1]?.content || '';

      await supabase
        .from('chat_logs')
        .insert({
          bot_id: botId,
          user_message: userMessage,
          bot_reply: botReply,
          created_at: new Date().toISOString()
        });

      console.log('✅ Chat log saved');

    } catch (logError) {
      console.error(
        '❌ Supabase Log Error:',
        logError.message
      );
    }

    // Send Response
    res.json({
      text: botReply
    });

  } catch (error) {
    console.error('❌ Claude Error:', error);

    res.status(500).json({
      text:
        error?.message ||
        'Internal Server Error'
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