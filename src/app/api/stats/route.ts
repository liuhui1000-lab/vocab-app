import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

// GET study stats
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const year = searchParams.get('year');
    const semesterId = searchParams.get('semesterId');

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }

    const client = getSupabaseClient();

    let query = client
      .from('study_stats')
      .select('*')
      .eq('user_id', userId);

    if (year) {
      query = query.like('date', `${year}%`);
    }

    if (semesterId) {
      query = query.eq('semester_id', parseInt(semesterId));
    }

    const { data, error } = await query.order('date', { ascending: true });

    if (error) {
      console.error('Error fetching stats:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ stats: data });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST - record study stats
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, semesterId, date, type } = body;

    if (!userId || !semesterId || !date || !type) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const client = getSupabaseClient();

    // Check if record exists
    const { data: existing } = await client
      .from('study_stats')
      .select('*')
      .eq('user_id', userId)
      .eq('semester_id', semesterId)
      .eq('date', date)
      .single();

    if (existing) {
      // Update existing record
      const updateField = type === 'new' ? 'new_count' : 'review_count';
      const { data, error } = await client
        .from('study_stats')
        .update({
          [updateField]: (existing[updateField as keyof typeof existing] as number) + 1,
        })
        .eq('id', existing.id)
        .select();

      if (error) {
        console.error('Error updating stats:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ success: true, data });
    } else {
      // Insert new record
      const { data, error } = await client
        .from('study_stats')
        .insert({
          user_id: userId,
          semester_id: semesterId,
          date,
          new_count: type === 'new' ? 1 : 0,
          review_count: type === 'review' ? 1 : 0,
        })
        .select();

      if (error) {
        console.error('Error inserting stats:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ success: true, data });
    }
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
