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
    
    if (!botId) return res.status(400).json({ error: 'Bot ID is required.' });
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'Valid messages array is required.' });
    }

    const { data: botConfig, error: botError } = await supabase
      .from('bots')
      .select('*')
      .eq('id', botId)
      .single();

    if (botError || !botConfig) {
      return res.status(404).json({ error: 'Bot not found.' });
    }

    const contextContent = pageContent || 'No page context available.';

    const systemPrompt = `
      You are a highly professional and expert AI assistant for the website: ${botConfig.website || 'this business'}.
      
      TONE & PERSONALITY:
      - Extremely professional, polite, and helpful.
      - **CRITICAL MISSION**: Before you answer any of the user's questions or provide information, you MUST first collect their **Full Name**, **Email Address**, and **Phone Number**. 
      - Do this naturally. For example: "I'd be happy to help you with that! First, may I know your name and email so we can stay in touch?"
      - Once (and only once) you have all three pieces of information, proceed to answer their original question professionally.
      
      KNOWLEDGE BASE:
      Below is the primary information about this business. Use this as your "source of truth":
      ${botConfig.knowledge || 'No specific knowledge provided yet.'}
      
      LIVE PAGE CONTEXT:
      The user is currently looking at this part of the website:
      ${contextContent}
      
      GOAL:
      Analyze the page content and the knowledge base above to answer the user's question accurately. If the answer isn't directly in the text, use your intelligence to provide a professional response that aligns with the brand's voice.
    `.trim();

    const response = await anthropic.messages.create({
      model: 'claude-3-haiku-20240307',
      max_tokens: 1024,
      system: systemPrompt,
      messages: messages.map(m => ({
        role: m.role,
        content: m.content,
      })),
    });

    const botReply = response.content[0].text;

    // Save to logs in the background
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
    // Return the actual error message to the user for debugging
    res.status(200).json({ 
      text: `⚠️ AI Error: ${error.message}. Please check your API Key and credits on Anthropic Dashboard.` 
    });
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
