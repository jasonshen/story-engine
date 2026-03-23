import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const { concept_data, summary_text, narrative } = await request.json();

    const { data, error } = await getSupabase()
      .from('saved_concepts')
      .insert({
        concept_data,
        summary_text,
        narrative: narrative || null,
      })
      .select('id')
      .single();

    if (error) {
      console.error('Supabase insert error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ id: data.id });
  } catch (error) {
    console.error('Save concept error:', error);
    return NextResponse.json(
      { error: 'Failed to save concept' },
      { status: 500 }
    );
  }
}
