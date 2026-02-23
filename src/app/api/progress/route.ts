import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

// GET user progress for selected semesters
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const semesterIds = searchParams.get('semesterIds');

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }

    const client = getSupabaseClient();

    let query = client
      .from('user_progress')
      .select('*')
      .eq('user_id', userId);

    if (semesterIds) {
      const ids = semesterIds.split(',').map(id => parseInt(id));
      query = query.in('semester_id', ids);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching progress:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ progress: data });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST - save user progress
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, progress } = body;

    if (!userId || !progress || !Array.isArray(progress)) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const client = getSupabaseClient();
    const results = [];

    for (const item of progress) {
      // Check if progress exists
      const { data: existing } = await client
        .from('user_progress')
        .select('id')
        .eq('user_id', userId)
        .eq('word_id', item.wordId)
        .eq('semester_id', item.semesterId)
        .single();

      if (existing) {
        // Update existing progress
        const { data, error } = await client
          .from('user_progress')
          .update({
            state: item.state,
            next_review: item.nextReview,
            ef: item.ef,
            interval: item.interval,
            failure_count: item.failureCount,
            penalty_progress: item.penaltyProgress,
            in_penalty: item.inPenalty,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.id)
          .select();
        
        if (!error) results.push(data);
      } else {
        // Insert new progress
        const { data, error } = await client
          .from('user_progress')
          .insert({
            user_id: userId,
            word_id: item.wordId,
            semester_id: item.semesterId,
            state: item.state,
            next_review: item.nextReview,
            ef: item.ef,
            interval: item.interval,
            failure_count: item.failureCount,
            penalty_progress: item.penaltyProgress,
            in_penalty: item.inPenalty,
          })
          .select();
        
        if (!error) results.push(data);
      }
    }

    return NextResponse.json({ success: true, saved: results.length });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE - reset user progress for a semester
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const semesterId = searchParams.get('semesterId');

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }

    const client = getSupabaseClient();

    let query = client
      .from('user_progress')
      .delete()
      .eq('user_id', userId);

    if (semesterId) {
      query = query.eq('semester_id', parseInt(semesterId));
    }

    const { error } = await query;

    if (error) {
      console.error('Error deleting progress:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
