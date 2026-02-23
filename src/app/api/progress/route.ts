import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

// GET user progress for selected semesters
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const username = searchParams.get('username');
    const semesterIds = searchParams.get('semesterIds');

    if (!username) {
      return NextResponse.json({ error: 'username is required' }, { status: 400 });
    }

    const client = getSupabaseClient();

    let query = client
      .from('user_progress')
      .select('*')
      .eq('username', username);

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
    const { username, progress } = body;

    if (!username || !progress || !Array.isArray(progress)) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const client = getSupabaseClient();
    const results = [];
    const errors = [];

    for (const item of progress) {
      try {
        // Check if progress exists
        const { data: existing } = await client
          .from('user_progress')
          .select('id')
          .eq('username', username)
          .eq('word_id', item.wordId)
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
          
          if (error) {
            errors.push({ wordId: item.wordId, error: error.message });
          } else {
            results.push(data);
          }
        } else {
          // Insert new progress
          const { data, error } = await client
            .from('user_progress')
            .insert({
              username: username,
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
          
          if (error) {
            errors.push({ wordId: item.wordId, error: error.message });
          } else {
            results.push(data);
          }
        }
      } catch (err) {
        errors.push({ wordId: item.wordId, error: String(err) });
      }
    }

    return NextResponse.json({ 
      success: true, 
      saved: results.length,
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE - reset user progress for a semester
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const username = searchParams.get('username');
    const semesterId = searchParams.get('semesterId');

    if (!username) {
      return NextResponse.json({ error: 'username is required' }, { status: 400 });
    }

    const client = getSupabaseClient();

    let query = client
      .from('user_progress')
      .delete()
      .eq('username', username);

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
