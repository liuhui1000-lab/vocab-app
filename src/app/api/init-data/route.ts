import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/storage/database/supabase-client';

// Sample vocabulary data for testing
const sampleSemesters = [
  { name: '七年级上学期', slug: 'grade7-1', description: '七年级第一学期词汇', order: 1 },
  { name: '七年级下学期', slug: 'grade7-2', description: '七年级第二学期词汇', order: 2 },
  { name: '八年级上学期', slug: 'grade8-1', description: '八年级第一学期词汇', order: 3 },
  { name: '八年级下学期', slug: 'grade8-2', description: '八年级第二学期词汇', order: 4 },
  { name: '九年级上学期', slug: 'grade9-1', description: '九年级第一学期词汇', order: 5 },
  { name: '九年级下学期', slug: 'grade9-2', description: '九年级第二学期词汇', order: 6 },
];

const sampleWords = [
  // 七年级上学期
  { word: 'after', phonetic: '/ˈɑːftər/', meaning: 'prep. 在…之后', exampleEn: 'We play football after school.', exampleCn: '我们放学后踢足球。' },
  { word: 'age', phonetic: '/eɪdʒ/', meaning: 'n. 年龄', exampleEn: 'What is your age?', exampleCn: '你多大了？' },
  { word: 'always', phonetic: '/ˈɔːlweɪz/', meaning: 'adv. 总是', exampleEn: 'He is always late.', exampleCn: '他总是迟到。' },
  { word: 'area', phonetic: '/ˈeəriə/', meaning: 'n. 地区', exampleEn: 'This area is quiet.', exampleCn: '这个地区很安静。' },
  { word: 'family', phonetic: '/ˈfæməli/', meaning: 'n. 家庭', exampleEn: 'I love my family.', exampleCn: '我爱我的家。' },
  { word: 'ferry', phonetic: '/ˈferi/', meaning: 'n. 渡船', exampleEn: 'Take a ferry.', exampleCn: '坐渡船。' },
  { word: 'heavy', phonetic: '/ˈhevi/', meaning: 'adj. 重的', exampleEn: 'The box is heavy.', exampleCn: '箱子很重。' },
  { word: 'height', phonetic: '/haɪt/', meaning: 'n. 高度', exampleEn: 'What is your height?', exampleCn: '你身高多少？' },
  { word: 'like', phonetic: '/laɪk/', meaning: 'v. 喜欢', exampleEn: 'I like reading.', exampleCn: '我喜欢读书。' },
  { word: 'love', phonetic: '/lʌv/', meaning: 'n. 爱', exampleEn: 'Love is important.', exampleCn: '爱很重要。' },
  { word: 'meet', phonetic: '/miːt/', meaning: 'v. 遇见', exampleEn: 'Nice to meet you.', exampleCn: '很高兴见到你。' },
  { word: 'museum', phonetic: '/mjuˈziːəm/', meaning: 'n. 博物馆', exampleEn: 'Visit the museum.', exampleCn: '参观博物馆。' },
  { word: 'never', phonetic: '/ˈnevər/', meaning: 'adv. 从不', exampleEn: 'I never lie.', exampleCn: '我从不撒谎。' },
  { word: 'number', phonetic: '/ˈnʌmbər/', meaning: 'n. 数字', exampleEn: 'Phone number.', exampleCn: '电话号码。' },
  { word: 'only', phonetic: '/ˈəʊnli/', meaning: 'adv. 仅仅', exampleEn: 'Only you.', exampleCn: '只有你。' },
  // 七年级下学期
  { word: 'share', phonetic: '/ʃeər/', meaning: 'v. 分享', exampleEn: 'Share with friends.', exampleCn: '和朋友分享。' },
  { word: 'skate', phonetic: '/skeɪt/', meaning: 'v. 滑冰', exampleEn: 'Can you skate?', exampleCn: '你会滑冰吗？' },
  { word: 'sometimes', phonetic: '/ˈsʌmtaɪmz/', meaning: 'adv. 有时', exampleEn: 'I sometimes walk.', exampleCn: '我有时走路。' },
  { word: 'soon', phonetic: '/suːn/', meaning: 'adv. 不久', exampleEn: 'See you soon.', exampleCn: '回头见。' },
  { word: 'together', phonetic: '/təˈɡeðər/', meaning: 'adv. 一起', exampleEn: 'Play together.', exampleCn: '一起玩。' },
  { word: 'tomorrow', phonetic: '/təˈmɒrəʊ/', meaning: 'adv. 明天', exampleEn: 'See you tomorrow.', exampleCn: '明天见。' },
  { word: 'usually', phonetic: '/ˈjuːʒuəli/', meaning: 'adv. 通常', exampleEn: 'I usually sleep early.', exampleCn: '我通常早睡。' },
  { word: 'weekend', phonetic: '/ˌwiːkˈend/', meaning: 'n. 周末', exampleEn: 'On the weekend.', exampleCn: '在周末。' },
  { word: 'yesterday', phonetic: '/ˈjestədeɪ/', meaning: 'adv. 昨天', exampleEn: 'Yesterday morning.', exampleCn: '昨天早上。' },
  { word: 'young', phonetic: '/jʌŋ/', meaning: 'adj. 年轻的', exampleEn: 'Young man.', exampleCn: '年轻人。' },
  // 八年级上学期
  { word: 'accept', phonetic: '/əkˈsept/', meaning: 'v. 接受', exampleEn: 'I accept your invitation.', exampleCn: '我接受你的邀请。' },
  { word: 'achieve', phonetic: '/əˈtʃiːv/', meaning: 'v. 实现', exampleEn: 'Achieve your dreams.', exampleCn: '实现你的梦想。' },
  { word: 'advantage', phonetic: '/ədˈvɑːntɪdʒ/', meaning: 'n. 优势', exampleEn: 'This is a big advantage.', exampleCn: '这是一个很大的优势。' },
  { word: 'advertise', phonetic: '/ˈædvətaɪz/', meaning: 'v. 做广告', exampleEn: 'They advertise on TV.', exampleCn: '他们在电视上做广告。' },
  { word: 'against', phonetic: '/əˈɡeɪnst/', meaning: 'prep. 反对', exampleEn: 'I am against this idea.', exampleCn: '我反对这个想法。' },
  { word: 'agree', phonetic: '/əˈɡriː/', meaning: 'v. 同意', exampleEn: 'I agree with you.', exampleCn: '我同意你的看法。' },
  { word: 'allow', phonetic: '/əˈlaʊ/', meaning: 'v. 允许', exampleEn: 'Smoking is not allowed.', exampleCn: '不允许吸烟。' },
  { word: 'ancient', phonetic: '/ˈeɪnʃənt/', meaning: 'adj. 古老的', exampleEn: 'Ancient history.', exampleCn: '古代历史。' },
  { word: 'argue', phonetic: '/ˈɑːɡjuː/', meaning: 'v. 争论', exampleEn: 'Don\'t argue with me.', exampleCn: '不要和我争论。' },
  { word: 'attack', phonetic: '/əˈtæk/', meaning: 'v. 攻击', exampleEn: 'The dog might attack.', exampleCn: '狗可能会攻击。' },
  // 八年级下学期
  { word: 'balance', phonetic: '/ˈbæləns/', meaning: 'n. 平衡', exampleEn: 'Keep your balance.', exampleCn: '保持平衡。' },
  { word: 'behave', phonetic: '/bɪˈheɪv/', meaning: 'v. 表现', exampleEn: 'Behave yourself.', exampleCn: '规矩点。' },
  { word: 'believe', phonetic: '/bɪˈliːv/', meaning: 'v. 相信', exampleEn: 'I believe you.', exampleCn: '我相信你。' },
  { word: 'beyond', phonetic: '/bɪˈjɒnd/', meaning: 'prep. 超过', exampleEn: 'Beyond my expectation.', exampleCn: '超出我的预期。' },
  { word: 'borrow', phonetic: '/ˈbɒrəʊ/', meaning: 'v. 借', exampleEn: 'Can I borrow your pen?', exampleCn: '我可以借你的笔吗？' },
  { word: 'cancel', phonetic: '/ˈkænsl/', meaning: 'v. 取消', exampleEn: 'The meeting was cancelled.', exampleCn: '会议被取消了。' },
  { word: 'capable', phonetic: '/ˈkeɪpəbl/', meaning: 'adj. 有能力的', exampleEn: 'She is very capable.', exampleCn: '她很有能力。' },
  { word: 'celebrate', phonetic: '/ˈselɪbreɪt/', meaning: 'v. 庆祝', exampleEn: 'Let\'s celebrate!', exampleCn: '让我们庆祝一下！' },
  { word: 'challenge', phonetic: '/ˈtʃælɪndʒ/', meaning: 'n. 挑战', exampleEn: 'Accept the challenge.', exampleCn: '接受挑战。' },
  { word: 'character', phonetic: '/ˈkærəktər/', meaning: 'n. 性格', exampleEn: 'He has a strong character.', exampleCn: '他性格坚强。' },
  // 九年级上学期
  { word: 'damage', phonetic: '/ˈdæmɪdʒ/', meaning: 'n./v. 损害', exampleEn: 'The damage was serious.', exampleCn: '损害很严重。' },
  { word: 'decide', phonetic: '/dɪˈsaɪd/', meaning: 'v. 决定', exampleEn: 'I decided to go.', exampleCn: '我决定去。' },
  { word: 'develop', phonetic: '/dɪˈveləp/', meaning: 'v. 发展', exampleEn: 'Develop new skills.', exampleCn: '发展新技能。' },
  { word: 'discover', phonetic: '/dɪˈskʌvər/', meaning: 'v. 发现', exampleEn: 'I discovered a secret.', exampleCn: '我发现了一个秘密。' },
  { word: 'discuss', phonetic: '/dɪˈskʌs/', meaning: 'v. 讨论', exampleEn: 'Let\'s discuss it.', exampleCn: '让我们讨论一下。' },
  { word: 'effective', phonetic: '/ɪˈfektɪv/', meaning: 'adj. 有效的', exampleEn: 'This method is effective.', exampleCn: '这个方法很有效。' },
  { word: 'efficient', phonetic: '/ɪˈfɪʃnt/', meaning: 'adj. 高效的', exampleEn: 'Be more efficient.', exampleCn: '更高效一点。' },
  { word: 'electricity', phonetic: '/ɪˌlekˈtrɪsəti/', meaning: 'n. 电', exampleEn: 'Save electricity.', exampleCn: '节约用电。' },
  { word: 'encourage', phonetic: '/ɪnˈkʌrɪdʒ/', meaning: 'v. 鼓励', exampleEn: 'Encourage each other.', exampleCn: '互相鼓励。' },
  { word: 'environment', phonetic: '/ɪnˈvaɪrənmənt/', meaning: 'n. 环境', exampleEn: 'Protect the environment.', exampleCn: '保护环境。' },
  // 九年级下学期
  { word: 'focus', phonetic: '/ˈfəʊkəs/', meaning: 'v. 集中', exampleEn: 'Focus on your work.', exampleCn: '专注于你的工作。' },
  { word: 'fortune', phonetic: '/ˈfɔːtʃuːn/', meaning: 'n. 财富', exampleEn: 'Make a fortune.', exampleCn: '发财。' },
  { word: 'freedom', phonetic: '/ˈfriːdəm/', meaning: 'n. 自由', exampleEn: 'Freedom of speech.', exampleCn: '言论自由。' },
  { word: 'guilty', phonetic: '/ˈɡɪlti/', meaning: 'adj. 内疚的', exampleEn: 'I feel guilty.', exampleCn: '我感到内疚。' },
  { word: 'imagine', phonetic: '/ɪˈmædʒɪn/', meaning: 'v. 想象', exampleEn: 'Imagine the future.', exampleCn: '想象未来。' },
  { word: 'improve', phonetic: '/ɪmˈpruːv/', meaning: 'v. 改进', exampleEn: 'Improve yourself.', exampleCn: '提升自己。' },
  { word: 'inspire', phonetic: '/ɪnˈspaɪər/', meaning: 'v. 激励', exampleEn: 'Inspire others.', exampleCn: '激励他人。' },
  { word: 'manage', phonetic: '/ˈmænɪdʒ/', meaning: 'v. 管理', exampleEn: 'Manage your time.', exampleCn: '管理你的时间。' },
  { word: 'necessary', phonetic: '/ˈnesəseri/', meaning: 'adj. 必要的', exampleEn: 'It is necessary.', exampleCn: '这是必要的。' },
  { word: 'opportunity', phonetic: '/ˌɒpəˈtjuːnəti/', meaning: 'n. 机会', exampleEn: 'Seize the opportunity.', exampleCn: '抓住机会。' },
];

// POST - initialize sample data
export async function POST(request: NextRequest) {
  try {
    const client = getSupabaseClient();

    // Check if data already exists
    const { data: existingSemesters } = await client
      .from('semesters')
      .select('id')
      .limit(1);

    if (existingSemesters && existingSemesters.length > 0) {
      return NextResponse.json({ 
        message: 'Data already initialized',
        semesters: existingSemesters.length 
      });
    }

    // Insert semesters
    const { data: insertedSemesters, error: semesterError } = await client
      .from('semesters')
      .insert(sampleSemesters)
      .select();

    if (semesterError) {
      console.error('Error inserting semesters:', semesterError);
      return NextResponse.json({ error: semesterError.message }, { status: 500 });
    }

    // Insert words for each semester
    let wordCount = 0;
    const wordsPerSemester = 10;
    
    for (let i = 0; i < insertedSemesters.length; i++) {
      const semester = insertedSemesters[i];
      const startIndex = i * wordsPerSemester;
      const semesterWords = sampleWords.slice(startIndex, startIndex + wordsPerSemester);

      if (semesterWords.length > 0) {
        const wordsToInsert = semesterWords.map((w, idx) => ({
          semester_id: semester.id,
          word: w.word,
          phonetic: w.phonetic,
          meaning: w.meaning,
          example_en: w.exampleEn,
          example_cn: w.exampleCn,
          order: idx,
        }));

        const { error: wordError } = await client
          .from('vocab_words')
          .insert(wordsToInsert);

        if (wordError) {
          console.error('Error inserting words:', wordError);
        } else {
          wordCount += wordsToInsert.length;
        }
      }
    }

    return NextResponse.json({ 
      success: true, 
      semesters: insertedSemesters.length,
      words: wordCount 
    });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
