import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import OpenAI from 'openai';
import { supabase } from './supabase.js';
import * as cheerio from 'cheerio';

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
    message: 'OpenAI + Supabase Backend Active'
  });
});

// =========================
// API KEY CHECK
// =========================

const openaiKey = process.env.OPENAI_API_KEY || '';

console.log(
  'OpenAI Key:',
  openaiKey
    ? `${openaiKey.substring(0, 12)}...`
    : '❌ MISSING'
);

// =========================
// CHAT API
// =========================

app.post('/api/chat', async (req, res) => {
  try {
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        text: '❌ Missing OPENAI_API_KEY'
      });
    }

    const openai = new OpenAI({
      apiKey
    });

    const {
      messages = [],
      pageContent = '',
      botId
    } = req.body;

    // 1. Fetch Bot Knowledge from Database
    let botKnowledge = '';
    let botName = 'AI Assistant';

    if (botId) {
      const { data: botData } = await supabase
        .from('bots')
        .select('name, knowledge')
        .eq('id', botId)
        .single();
      
      if (botData) {
        botKnowledge = botData.knowledge || '';
        botName = botData.name || 'AI Assistant';
      }
    }

    const formattedMessages = messages.map((m) => ({
      role: m.role,
      content: m.content
    }));

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are a professional AI assistant for ${botName}.

KNOWLEDGE BASE:
${botKnowledge}

CURRENT PAGE CONTENT (for context):
${pageContent}

INSTRUCTIONS:
1. Use the KNOWLEDGE BASE first to answer questions.
2. If the answer isn't in the knowledge base, use the CURRENT PAGE CONTENT.
3. Be professional, helpful, and concise.`
        },
        ...formattedMessages
      ],
      max_tokens: 1024
    });

    const botReply = response.choices[0].message.content;

    // =========================
    // SAVE CHAT LOGS
    // =========================
    try {
      const userMessage = messages[messages.length - 1]?.content || '';
      await supabase.from('chat_logs').insert({
        bot_id: botId,
        user_message: userMessage,
        bot_reply: botReply,
        created_at: new Date().toISOString()
      });
      console.log('✅ Chat log saved');
    } catch (logError) {
      console.error('❌ Supabase Log Error:', logError.message);
    }

    res.json({
      text: botReply
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({
      text: error.message || 'Internal Server Error'
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
// SCRAPE WEBSITE
// =========================

const scrapeWebsite = async (url) => {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });
    
    if (!res.ok) throw new Error(`Failed to fetch: ${res.statusText}`);
    
    const html = await res.text();
    const $ = cheerio.load(html);

    // Remove unwanted elements
    $('script, style, nav, footer, noscript').remove();

    // Get text content
    const text = $('body').text()
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 10000); // Limit to 10k chars

    return text;
  } catch (error) {
    console.error('❌ Scrape Error:', error);
    return '';
  }
};

app.post('/api/scrape', async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'URL is required' });

  console.log(`🔍 Scraping website: ${url}`);
  const content = await scrapeWebsite(url);
  
  if (!content) {
    return res.status(500).json({ error: 'Could not extract content from website' });
  }

  res.json({ content });
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