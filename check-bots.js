import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing supabase credentials in env");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkBots() {
  const { data, error } = await supabase.from('bots').select('*');
  if (error) {
    console.error("Error fetching bots:", error);
  } else {
    console.log("Bots fetched:", JSON.stringify(data, null, 2));
  }
}

checkBots();
