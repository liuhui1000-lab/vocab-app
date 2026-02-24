import { NextResponse } from 'next/server';
import { getDB } from '@/lib/db-helpers';


// 新的学期分类
const sampleSemesters = [
  { name: '六年级', slug: 'grade6', description: '六年级词汇', order: 1 },
  { name: '七年级', slug: 'grade7', description: '七年级词汇', order: 2 },
  { name: '八年级上', slug: 'grade8-1', description: '八年级上学期词汇', order: 3 },
  { name: '八年级下', slug: 'grade8-2', description: '八年级下学期词汇', order: 4 },
  { name: '九年级上', slug: 'grade9-1', description: '九年级上学期词汇', order: 5 },
  { name: '九年级下', slug: 'grade9-2', description: '九年级下学期词汇', order: 6 },
];

// 每个学期15个示例单词
const sampleWords = [
  // 六年级 (index 0-14)
  { word: 'apple', phonetic: '/ˈæpl/', meaning: 'n. 苹果', exampleEn: 'I eat an apple every day.', exampleCn: '我每天吃一个苹果。' },
  { word: 'book', phonetic: '/bʊk/', meaning: 'n. 书', exampleEn: 'This is a good book.', exampleCn: '这是一本好书。' },
  { word: 'cat', phonetic: '/kæt/', meaning: 'n. 猫', exampleEn: 'I have a cat.', exampleCn: '我有一只猫。' },
  { word: 'dog', phonetic: '/dɒɡ/', meaning: 'n. 狗', exampleEn: 'The dog is cute.', exampleCn: '这只狗很可爱。' },
  { word: 'egg', phonetic: '/eɡ/', meaning: 'n. 鸡蛋', exampleEn: 'I had two eggs for breakfast.', exampleCn: '我早餐吃了两个鸡蛋。' },
  { word: 'fish', phonetic: '/fɪʃ/', meaning: 'n. 鱼', exampleEn: 'I like eating fish.', exampleCn: '我喜欢吃鱼。' },
  { word: 'girl', phonetic: '/ɡɜːl/', meaning: 'n. 女孩', exampleEn: 'She is a nice girl.', exampleCn: '她是个好女孩。' },
  { word: 'hand', phonetic: '/hænd/', meaning: 'n. 手', exampleEn: 'Wash your hands.', exampleCn: '洗手。' },
  { word: 'ice', phonetic: '/aɪs/', meaning: 'n. 冰', exampleEn: 'The ice is cold.', exampleCn: '冰很冷。' },
  { word: 'jump', phonetic: '/dʒʌmp/', meaning: 'v. 跳', exampleEn: 'Can you jump high?', exampleCn: '你能跳得高吗？' },
  { word: 'king', phonetic: '/kɪŋ/', meaning: 'n. 国王', exampleEn: 'The king is kind.', exampleCn: '国王很仁慈。' },
  { word: 'lion', phonetic: '/ˈlaɪən/', meaning: 'n. 狮子', exampleEn: 'The lion is strong.', exampleCn: '狮子很强壮。' },
  { word: 'milk', phonetic: '/mɪlk/', meaning: 'n. 牛奶', exampleEn: 'I drink milk every morning.', exampleCn: '我每天早上喝牛奶。' },
  { word: 'nose', phonetic: '/nəʊz/', meaning: 'n. 鼻子', exampleEn: 'My nose is big.', exampleCn: '我的鼻子很大。' },
  { word: 'orange', phonetic: '/ˈɒrɪndʒ/', meaning: 'n. 橙子', exampleEn: 'I like orange juice.', exampleCn: '我喜欢橙汁。' },
  // 七年级 (index 15-29)
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
  // 八年级上 (index 30-44)
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
  { word: 'attention', phonetic: '/əˈtenʃn/', meaning: 'n. 注意', exampleEn: 'Pay attention.', exampleCn: '注意。' },
  { word: 'average', phonetic: '/ˈævərɪdʒ/', meaning: 'adj. 平均的', exampleEn: 'Average score.', exampleCn: '平均分。' },
  { word: 'avoid', phonetic: '/əˈvɔɪd/', meaning: 'v. 避免', exampleEn: 'Avoid mistakes.', exampleCn: '避免错误。' },
  { word: 'balance', phonetic: '/ˈbæləns/', meaning: 'n. 平衡', exampleEn: 'Keep your balance.', exampleCn: '保持平衡。' },
  { word: 'basic', phonetic: '/ˈbeɪsɪk/', meaning: 'adj. 基本的', exampleEn: 'Basic skills.', exampleCn: '基本技能。' },
  // 八年级下 (index 45-59)
  { word: 'behave', phonetic: '/bɪˈheɪv/', meaning: 'v. 表现', exampleEn: 'Behave yourself.', exampleCn: '规矩点。' },
  { word: 'believe', phonetic: '/bɪˈliːv/', meaning: 'v. 相信', exampleEn: 'I believe you.', exampleCn: '我相信你。' },
  { word: 'beyond', phonetic: '/bɪˈjɒnd/', meaning: 'prep. 超过', exampleEn: 'Beyond my expectation.', exampleCn: '超出我的预期。' },
  { word: 'borrow', phonetic: '/ˈbɒrəʊ/', meaning: 'v. 借', exampleEn: 'Can I borrow your pen?', exampleCn: '我可以借你的笔吗？' },
  { word: 'cancel', phonetic: '/ˈkænsl/', meaning: 'v. 取消', exampleEn: 'The meeting was cancelled.', exampleCn: '会议被取消了。' },
  { word: 'capable', phonetic: '/ˈkeɪpəbl/', meaning: 'adj. 有能力的', exampleEn: 'She is very capable.', exampleCn: '她很有能力。' },
  { word: 'celebrate', phonetic: '/ˈselɪbreɪt/', meaning: 'v. 庆祝', exampleEn: 'Let\'s celebrate!', exampleCn: '让我们庆祝一下！' },
  { word: 'challenge', phonetic: '/ˈtʃælɪndʒ/', meaning: 'n. 挑战', exampleEn: 'Accept the challenge.', exampleCn: '接受挑战。' },
  { word: 'character', phonetic: '/ˈkærəktər/', meaning: 'n. 性格', exampleEn: 'He has a strong character.', exampleCn: '他性格坚强。' },
  { word: 'choice', phonetic: '/tʃɔɪs/', meaning: 'n. 选择', exampleEn: 'Make a choice.', exampleCn: '做出选择。' },
  { word: 'comfortable', phonetic: '/ˈkʌmftəbl/', meaning: 'adj. 舒适的', exampleEn: 'This chair is comfortable.', exampleCn: '这把椅子很舒适。' },
  { word: 'compare', phonetic: '/kəmˈpeər/', meaning: 'v. 比较', exampleEn: 'Compare the two.', exampleCn: '比较这两个。' },
  { word: 'complete', phonetic: '/kəmˈpliːt/', meaning: 'v. 完成', exampleEn: 'Complete the task.', exampleCn: '完成任务。' },
  { word: 'condition', phonetic: '/kənˈdɪʃn/', meaning: 'n. 条件', exampleEn: 'Good condition.', exampleCn: '良好的条件。' },
  { word: 'confident', phonetic: '/ˈkɒnfɪdənt/', meaning: 'adj. 自信的', exampleEn: 'Be confident.', exampleCn: '要自信。' },
  // 九年级上 (index 60-74)
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
  { word: 'experiment', phonetic: '/ɪkˈsperɪmənt/', meaning: 'n. 实验', exampleEn: 'Do an experiment.', exampleCn: '做实验。' },
  { word: 'explain', phonetic: '/ɪkˈspleɪn/', meaning: 'v. 解释', exampleEn: 'Please explain.', exampleCn: '请解释。' },
  { word: 'explore', phonetic: '/ɪkˈsplɔːr/', meaning: 'v. 探索', exampleEn: 'Explore the world.', exampleCn: '探索世界。' },
  { word: 'express', phonetic: '/ɪkˈspres/', meaning: 'v. 表达', exampleEn: 'Express yourself.', exampleCn: '表达你自己。' },
  { word: 'fair', phonetic: '/feər/', meaning: 'adj. 公平的', exampleEn: 'It\'s not fair.', exampleCn: '这不公平。' },
  // 九年级下 (index 75-89)
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
  { word: 'patience', phonetic: '/ˈpeɪʃns/', meaning: 'n. 耐心', exampleEn: 'Have patience.', exampleCn: '要有耐心。' },
  { word: 'perform', phonetic: '/pəˈfɔːm/', meaning: 'v. 表演', exampleEn: 'Perform well.', exampleCn: '表现好。' },
  { word: 'prefer', phonetic: '/prɪˈfɜːr/', meaning: 'v. 更喜欢', exampleEn: 'I prefer tea.', exampleCn: '我更喜欢茶。' },
  { word: 'prevent', phonetic: '/prɪˈvent/', meaning: 'v. 预防', exampleEn: 'Prevent accidents.', exampleCn: '预防事故。' },
  { word: 'quality', phonetic: '/ˈkwɒləti/', meaning: 'n. 质量', exampleEn: 'High quality.', exampleCn: '高质量。' },
];

// POST - initialize sample data
export async function POST(request: Request) {
  try {
    const db = getDB(request);
    const body = await request.json().catch(() => ({}));
    const forceReset = body.forceReset === true;

    // Check if data already exists
    const existingSemesters = await db
      .prepare('SELECT id FROM semesters LIMIT 1')
      .first();

    if (existingSemesters && !forceReset) {
      return NextResponse.json({ 
        message: 'Data already initialized',
        semesters: 1 
      });
    }

    // If force reset, delete old data
    if (forceReset && existingSemesters) {
      // Delete in correct order (progress -> words -> semesters)
      await db.prepare('DELETE FROM study_stats').run();
      await db.prepare('DELETE FROM user_progress').run();
      await db.prepare('DELETE FROM vocab_words').run();
      await db.prepare('DELETE FROM semesters').run();
    }

    // Insert semesters
    let semesterCount = 0;
    const insertedSemesterIds: number[] = [];

    for (const semester of sampleSemesters) {
      const result = await db
        .prepare('INSERT INTO semesters (name, slug, description, "order", is_active) VALUES (?, ?, ?, ?, 1) RETURNING id')
        .bind(semester.name, semester.slug, semester.description, semester.order)
        .first();
      
      if (result) {
        insertedSemesterIds.push((result as any).id);
        semesterCount++;
      }
    }

    // Insert words for each semester (15 words per semester)
    let wordCount = 0;
    const wordsPerSemester = 15;
    
    for (let i = 0; i < insertedSemesterIds.length; i++) {
      const semesterId = insertedSemesterIds[i];
      const startIndex = i * wordsPerSemester;
      const semesterWords = sampleWords.slice(startIndex, startIndex + wordsPerSemester);

      for (let idx = 0; idx < semesterWords.length; idx++) {
        const w = semesterWords[idx];
        await db
          .prepare(`
            INSERT INTO vocab_words (semester_id, word, phonetic, meaning, example_en, example_cn, "order")
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `)
          .bind(semesterId, w.word, w.phonetic, w.meaning, w.exampleEn, w.exampleCn, idx)
          .run();
        wordCount++;
      }
    }

    return NextResponse.json({ 
      success: true, 
      semesters: semesterCount,
      words: wordCount 
    });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
