import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ semesterId: string }> }
) {
  try {
    const { semesterId } = await params;
    const client = getSupabaseClient();

    const { data, error } = await client
      .from('vocab_words')
      .select('*')
      .eq('semester_id', parseInt(semesterId))
      .order('order', { ascending: true });

    if (error) {
      console.error('Error fetching vocab words:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ words: data });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
