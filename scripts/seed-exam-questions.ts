import { loadEnvConfig } from '@next/env';
loadEnvConfig(process.cwd(), true);
import { supabaseAdapter } from '../src/lib/store/supabase-adapter';
import { db } from '../src/lib/store/db';

async function main() {
  console.log('Restoring platform settings...');
  await supabaseAdapter.updatePlatformSettings({
    platformName: 'Zealosh LMS — Enterprise HSE Learning Platform',
    organizationName: 'Zealosh Training & Consultants',
    supportEmail: 'support@zealosh.com',
  });

  console.log('Seeding exam questions...');
  const questions = Array.from(db.examQuestions.values());
  for (const q of questions) {
    const saved = await supabaseAdapter.saveExamQuestion(q);
    console.log(`Saved question: ${saved.id} (${saved.domain})`);
  }
  console.log(`All ${questions.length} questions successfully seeded to Supabase.`);
}

main().catch((err) => {
  console.error('Seed script error:', err);
  process.exit(1);
});
