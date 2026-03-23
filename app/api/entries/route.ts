import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const { data, error } = await getSupabase()
      .from('writing_entries')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Supabase fetch error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Fetch entries error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch entries' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const {
      concept_id,
      concept_summary,
      opening_style,
      body,
      word_count,
      duration_seconds,
    } = await request.json();

    const { data, error } = await getSupabase()
      .from('writing_entries')
      .insert({
        concept_id: concept_id || null,
        concept_summary,
        opening_style: opening_style || null,
        body,
        word_count,
        duration_seconds: duration_seconds || null,
      })
      .select('id')
      .single();

    if (error) {
      console.error('Supabase insert error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ id: data.id });
  } catch (error) {
    console.error('Save entry error:', error);
    return NextResponse.json(
      { error: 'Failed to save entry' },
      { status: 500 }
    );
  }
}
