/*
 * Arabic interface. The English text is the key: FP.t(english) returns the Arabic when
 * the interface is in Arabic, and the English otherwise. Text in the page itself, and any
 * text the app later sets to an exact English phrase, is translated as it appears, so
 * only phrases with numbers or names in them need FP.t in the code.
 *
 * Arabic is chosen for visitors whose browser prefers Arabic, or by the language switch
 * (remembered), or by a ?lang=ar / ?lang=en link. Numbers stay in Western digits.
 */
(function () {
  'use strict';
  const FP = window.FP;
  const KEY = 'focuspal:lang';

  let lang = null;
  try { lang = localStorage.getItem(KEY); } catch (e) { /* storage unavailable */ }
  const asked = new URLSearchParams(location.search).get('lang');
  if (asked === 'ar' || asked === 'en') {
    lang = asked;
    try { localStorage.setItem(KEY, asked); } catch (e) { /* storage unavailable */ }
  }
  if (lang !== 'ar' && lang !== 'en') {
    lang = (navigator.languages || [navigator.language || '']).some((l) => /^ar\b/i.test(l)) ? 'ar' : 'en';
  }
  FP.lang = lang;

  const AR = {
    // ---------- top bar, timer and alerts ----------
    'Focus timer': 'مؤقّت التركيز',
    'Panels': 'اللوحات',
    'Completed focus sessions today': 'جلسات التركيز المكتملة اليوم',
    '{n} sessions · {m} min today': 'الجلسات اليوم: {n} · الدقائق: {m}',
    'Your avatar': 'حيوانك',
    'Change your animal': 'غيّر حيوانك',
    'Choose your animal': 'اختر حيوانك',
    'Night lighting (D)': 'الإضاءة الليلية (D)',
    'Turn on night lighting': 'تشغيل الإضاءة الليلية',
    'Turn off night lighting': 'إيقاف الإضاءة الليلية',
    '🌙 Night lighting on': '🌙 الإضاءة الليلية مفعّلة',
    '☀️ Night lighting off': '☀️ الإضاءة الليلية متوقّفة',
    'Settings': 'الإعدادات',
    'Settings: timer, tasks and sounds': 'الإعدادات: المؤقّت والمهام والأصوات',
    'Open settings: timer, tasks and sounds': 'افتح الإعدادات: المؤقّت والمهام والأصوات',
    'Breathe: a guided breathing break (B)': 'تنفّس: استراحة تنفّس موجّهة (B)',
    'Breathe: open the guided breathing mode': 'افتح وضع التنفّس الموجّه',
    'Focus mode: full screen, no buttons (Z)': 'وضع التركيز: ملء الشاشة بلا أزرار (Z)',
    'Enter focus mode': 'دخول وضع التركيز',
    'Full screen (F)': 'ملء الشاشة (F)',
    'Toggle full screen': 'تبديل ملء الشاشة',
    'Minimize timer': 'تصغير المؤقّت',
    'Minimize timer (T)': 'تصغير المؤقّت (T)',
    'Show the full timer': 'إظهار المؤقّت كاملًا',
    'Show the full timer (T)': 'إظهار المؤقّت كاملًا (T)',
    'Timer mode': 'وضع المؤقّت',
    'Focus': 'تركيز',
    'Short break': 'استراحة قصيرة',
    'Long break': 'استراحة طويلة',
    'Break': 'استراحة',
    'Ready · {mode}': 'جاهز · {mode}',
    'Paused': 'متوقّف مؤقّتًا',
    'Start': 'ابدأ',
    'Pause': 'إيقاف',
    'Resume': 'استئناف',
    '{label} timer (Space)': '{label} (Space)',
    '{label} timer': '{label}',
    'Start timer': 'تشغيل المؤقّت',
    'Start timer (Space)': 'تشغيل المؤقّت (Space)',
    'Reset (R)': 'إعادة الضبط (R)',
    'Reset timer': 'إعادة ضبط المؤقّت',
    'Skip to next (S)': 'التالي (S)',
    'Skip to next session': 'الانتقال إلى الجلسة التالية',
    'Sound on/off (A)': 'تشغيل/إيقاف الصوت (A)',
    'Turn sound on or off': 'تشغيل الصوت أو إيقافه',
    'Sessions in this cycle': 'جلسات هذه الدورة',
    '{done} of {every} sessions before a long break': '{done} من {every} قبل الاستراحة الطويلة',
    'What will you focus on?': 'على ماذا ستركّز؟',
    'Pomodoro · 25 / 5': 'بومودورو · 25 / 5',
    'Press Esc or double-click to leave focus mode': 'اضغط Esc أو انقر مرتين للخروج من وضع التركيز',
    'Map': 'الخريطة',
    'Open the map (M)': 'افتح الخريطة (M)',
    'Time for a break': 'وقت الاستراحة',
    'Focus session complete.': 'اكتملت جلسة التركيز.',
    'Back to focus': 'عودة إلى التركيز',
    'Break’s over': 'انتهت الاستراحة',
    'Ready for your next focus session?': 'هل أنت مستعد لجلسة التركيز التالية؟',
    '{min}-minute break': 'استراحة مدتها {dur}',
    '{min}-minute long break': 'استراحة طويلة مدتها {dur}',
    'Focus session complete. Your {kind} has started.': 'اكتملت جلسة التركيز. بدأت {kind}.',
    'Focus session complete. Time for a {kind}.': 'اكتملت جلسة التركيز. حان وقت {kind}.',
    'Your {min}-minute focus session has started.': 'بدأت جلسة تركيز مدتها {dur}.',
    'Start break': 'ابدأ الاستراحة',
    'Start focusing': 'ابدأ التركيز',
    'Got it': 'حسنًا',
    'Later': 'لاحقًا',
    'Not yet': 'ليس بعد',
    'Breathe for 3 minutes': 'تنفّس لثلاث دقائق',
    '🔔 Also notify me when FocusPal is in the background': '🔔 نبّهني أيضًا عندما يكون التطبيق في الخلفية',
    '🔔 Notifications on. You’ll be told when breaks start and end.': '🔔 الإشعارات مفعّلة. سننبّهك عند بدء الاستراحات وانتهائها.',
    'Notifications are blocked. You can allow them in your browser’s site settings.': 'الإشعارات محظورة. يمكنك السماح بها من إعدادات الموقع في متصفحك.',
    'Notifications aren’t supported in this browser.': 'هذا المتصفح لا يدعم الإشعارات.',
    'Notifications were blocked. You can allow them in your browser’s site settings.': 'تم حظر الإشعارات. يمكنك السماح بها من إعدادات الموقع في متصفحك.',
    '🔈 Sound paused · Tap to resume': '🔈 الصوت متوقّف · اضغط للاستئناف',
    '✨ A new version of FocusPal is ready.': '✨ نسخة جديدة من التطبيق جاهزة.',
    'Refresh': 'تحديث',
    'A small request': 'طلب صغير',
    'If FocusPal helps you focus, please remember my parents in your prayers.': 'إن نفعك هذا التطبيق، فلا تنسَ والديّ من دعائك',
    'Close': 'إغلاق',
    'Captain speaking': 'كلمة قائد الطائرة',
    'Play one now': 'شغّل واحدًا الآن',

    // ---------- karak ----------
    'Buy us a karak': 'اشترِ لنا كرك',
    'Enjoying FocusPal?': 'هل أعجبك التطبيق؟',
    'Buy us a karak to keep it free.': 'اشترِ لنا كرك ليبقى مجانيًا.',
    '☕ Enjoying FocusPal? Buy us a karak': '☕ هل أعجبك التطبيق؟ اشترِ لنا كرك',

    // ---------- settings panel ----------
    'Close panel': 'إغلاق اللوحة',
    'Timer': 'المؤقّت',
    'Tasks': 'المهام',
    'Sounds': 'الأصوات',
    'Language': 'اللغة',
    'Focus technique': 'أسلوب التركيز',
    'Not sure?': 'لست متأكدًا؟',
    'New to timers or struggling to start': 'جديد على المؤقّتات أو تجد صعوبة في البدء',
    '→ Pomodoro.': '← بومودورو.',
    'Studying or writing': 'مذاكرة أو كتابة',
    '→ 50 / 10.': '← 50 / 10.',
    'Deep project and already in flow': 'مشروع عميق وأنت مندمج فيه',
    '→ 90 / 20.': '← 90 / 20.',
    'Best for:': 'الأنسب لـ:',
    '{l}′ every {e}': '{l}′ كل {e}',
    '{name}: {f} min focus · {s} min break': '{name}: تركيز {fd} · استراحة {sd}',
    'Long break every': 'استراحة طويلة كل',
    'sessions': 'جلسات',
    'min': 'دقيقة',
    'Immersion': 'الانغماس',
    'Immersion level': 'مستوى الانغماس',
    'How much the scene moves while you focus. Breaks always bring it fully back to life, because a calming view helps your attention recover.': 'مقدار حركة المشهد أثناء تركيزك. في الاستراحات يعود المشهد إلى الحياة دائمًا، لأن المنظر الهادئ يساعد انتباهك على التعافي.',
    'Night lighting for scenes': 'إضاءة ليلية للمشاهد',
    'Behaviour': 'الإعدادات العامة',
    'Start breaks automatically': 'بدء الاستراحات تلقائيًا',
    'Start next focus session automatically': 'بدء جلسة التركيز التالية تلقائيًا',
    'Play a chime between sessions': 'تشغيل نغمة بين الجلسات',
    'Desktop notifications': 'إشعارات سطح المكتب',
    'Soften ambience during breaks': 'خفض أصوات المكان أثناء الاستراحات',
    'Keep the screen awake while the timer or sounds are on': 'إبقاء الشاشة مضاءة أثناء عمل المؤقّت أو الأصوات',
    'Why work in intervals?': 'لماذا العمل على فترات؟',
    'Attention fades with time on task.': 'الانتباه يخبو مع طول العمل.',
    'Performance on sustained tasks drifts downward (the “vigilance decrement”); planned breaks let you come back fresher instead of grinding on tired.': 'يتراجع الأداء في المهام الطويلة تدريجيًا (ما يُعرف بتراجع اليقظة)، والاستراحات المخطّطة تعيدك أنشط بدل أن تواصل وأنت متعب.',
    'A visible finish line helps you start.': 'خطّ نهاية واضح يساعدك على البدء.',
    'Short, timeboxed blocks lower the barrier to beginning, which is why Pomodoro works so well against procrastination.': 'الفترات القصيرة المحدّدة تسهّل البدء، ولهذا ينجح بومودورو كثيرًا ضد التسويف.',
    'Rest your eyes.': 'أرِح عينيك.',
    'The 20‑20‑20 rule: every 20 minutes, look about 6 m (20 ft) away for 20 seconds.': 'قاعدة 20‑20‑20: كل 20 دقيقة، انظر إلى شيء يبعد نحو 6 أمتار لمدة 20 ثانية.',
    'Make breaks real breaks.': 'اجعل الاستراحة استراحة حقيقية.',
    'Stand, move, hydrate, look out a window. Scrolling your phone keeps your brain busy and makes it harder to restart.': 'قف وتحرّك واشرب الماء وانظر من النافذة. تصفّح الهاتف يُبقي دماغك مشغولًا ويصعّب العودة.',
    'Steady ambient sound': 'الصوت المحيط الثابت',
    'can mask distracting noises and conversations. Keep it at a low, comfortable level.': 'يحجب الضوضاء والأحاديث المشتّتة. أبقِه منخفضًا ومريحًا.',
    'Keyboard': 'لوحة المفاتيح',
    'start / pause': 'تشغيل / إيقاف',
    'reset': 'إعادة الضبط',
    'skip': 'التالي',
    'map': 'الخريطة',
    'ambience': 'الأصوات',
    'immersion': 'الانغماس',
    'minimize timer': 'تصغير المؤقّت',
    'night lighting': 'الإضاءة الليلية',
    'focus mode': 'وضع التركيز',
    'breathe': 'تنفّس',
    'full screen': 'ملء الشاشة',
    'travel to a place': 'الانتقال إلى مكان',
    'Today’s tasks': 'مهام اليوم',
    'New task': 'مهمة جديدة',
    'Add a task…': 'أضف مهمة…',
    'Add': 'إضافة',
    'Pick one task to focus on. Each finished focus session adds a 🍅 to it.': 'اختر مهمة واحدة للتركيز عليها. كل جلسة تركيز مكتملة تضيف إليها 🍅.',
    'Clear completed': 'مسح المنجَز',
    'No tasks yet. Add one above, then pick it to focus on.': 'لا توجد مهام بعد. أضف مهمة في الأعلى ثم اخترها لتركّز عليها.',
    'Nice work! Task complete ✅': 'عمل رائع! اكتملت المهمة ✅',
    'Focus on this': 'ركّز على هذه',
    'Remove': 'حذف',
    'Mark “{x}” done': 'تحديد «{x}» كمنجزة',
    'Focus on “{x}”': 'التركيز على «{x}»',
    'Remove “{x}”': 'حذف «{x}»',
    'Master': 'الصوت العام',
    'Master volume': 'مستوى الصوت العام',
    'Volume': 'مستوى الصوت',
    'Chime': 'النغمة',
    'Chime volume': 'مستوى صوت النغمة',
    'Environment': 'المكان',
    'Reset this mix': 'إعادة ضبط المزيج',
    'Sounds are made live in your browser, apart from the café and diner crowds (public-domain recordings) and the captain, who uses your device\'s own voice.': 'تُولَّد الأصوات مباشرة في متصفحك، باستثناء أصوات الناس في المقهى والمطعم (تسجيلات من الملكية العامة) وصوت قائد الطائرة الذي يستخدم صوت جهازك.',

    // ---------- techniques ----------
    'Pomodoro': 'بومودورو',
    'Francesco Cirillo’s classic. Short, timeboxed sprints make it easy to start and keep fatigue low; a longer break after every four.': 'الأسلوب الكلاسيكي لفرانشيسكو سيريلو. فترات قصيرة محدّدة تسهّل البدء وتقلّل الإرهاق، مع استراحة أطول بعد كل أربع جلسات.',
    'getting started, homework, revision, admin, beating procrastination': 'البدء، والواجبات، والمراجعة، والأعمال الإدارية، والتغلّب على التسويف',
    'Deep Study 50 / 10': 'مذاكرة عميقة 50 / 10',
    'Longer blocks give you time to get properly into a problem, and the 10-minute break fits neatly into each hour.': 'الفترات الأطول تمنحك وقتًا للتعمّق في المسألة، واستراحة العشر دقائق تناسب كل ساعة تمامًا.',
    'reading, studying for exams, writing, coding': 'القراءة، والمذاكرة للامتحانات، والكتابة، والبرمجة',
    'The 52 / 17 rhythm': 'إيقاع 52 / 17',
    'From DeskTime’s analysis of its most productive users, who averaged about 52 minutes of work then 17 minutes fully away. Observational, but a popular rhythm.': 'من تحليل تطبيق ديسك تايم لأكثر مستخدميه إنتاجية، إذ كانوا يعملون نحو 52 دقيقة ثم يبتعدون تمامًا 17 دقيقة. نتيجة رصدية، لكنه إيقاع شائع.',
    'office work, steady project work, people who like long, real breaks': 'العمل المكتبي، والعمل المتواصل على المشاريع، ومن يحب استراحات طويلة حقيقية',
    'Ultradian 90 / 20': 'الدورة الطبيعية 90 / 20',
    'Built around the roughly 90-minute rest–activity cycle (Kleitman) and the ~90-minute practice sessions Ericsson observed in expert performers.': 'مبني على دورة النشاط والراحة التي تمتد نحو 90 دقيقة (كلايتمان)، وعلى جلسات التدريب القريبة من 90 دقيقة التي رصدها إريكسون لدى أصحاب الأداء المتميّز.',
    'deep creative or technical work, once you can sustain focus': 'العمل الإبداعي أو التقني العميق، حين تستطيع الحفاظ على تركيزك',
    'Custom': 'مخصّص',
    'Set your own rhythm. A good rule of thumb: about 1 minute of break for every 5 minutes of focus.': 'اضبط إيقاعك الخاص. قاعدة مفيدة: نحو دقيقة استراحة لكل خمس دقائق تركيز.',
    'when you already know what works for you': 'حين تعرف ما يناسبك',

    // ---------- tips ----------
    'Put your phone out of reach, or face down in another room.': 'ضع هاتفك بعيدًا عن متناولك، أو مقلوبًا في غرفة أخرى.',
    'Write down the single outcome you want from this session.': 'اكتب النتيجة الواحدة التي تريدها من هذه الجلسة.',
    'Close tabs and apps you won’t need for this task.': 'أغلق التبويبات والتطبيقات التي لا تحتاجها لهذه المهمة.',
    'Grab some water now so you don’t need to get up mid-session.': 'أحضر بعض الماء الآن حتى لا تضطر للقيام في منتصف الجلسة.',
    'Distracting thought? Jot it on paper and get back to the task.': 'خطرت لك فكرة مشتّتة؟ دوّنها على ورقة وعُد إلى المهمة.',
    'Stand up and stretch your shoulders, neck and back.': 'قف ومدّد كتفيك ورقبتك وظهرك.',
    '20-20-20: look at something about 6 m (20 ft) away for 20 seconds.': 'قاعدة 20-20-20: انظر إلى شيء يبعد نحو 6 أمتار لمدة 20 ثانية.',
    'Refill your water and take a few sips.': 'املأ كوب الماء واشرب بضع رشفات.',
    'Box breathing: in 4 · hold 4 · out 4 · hold 4. Repeat a few times.': 'تنفّس المربّع: شهيق 4 · حبس 4 · زفير 4 · حبس 4. كرّر ذلك بضع مرات.',
    'Walk around for a minute. A little movement refreshes attention.': 'تمشَّ لمدة دقيقة. قليل من الحركة ينعش الانتباه.',
    'Step away from screens. Scrolling isn’t rest for your brain.': 'ابتعد عن الشاشات. التصفّح ليس راحة لدماغك.',
    'Close your eyes and relax your jaw, shoulders and forehead.': 'أغمض عينيك وأرخِ فكّك وكتفيك وجبينك.',
    'Take a short walk, ideally outside in daylight.': 'تمشَّ قليلًا، ويُفضَّل في الخارج تحت ضوء النهار.',
    'Have a light snack and some water.': 'تناول وجبة خفيفة وبعض الماء.',
    'Do a few minutes of gentle stretching or mobility work.': 'مارس بضع دقائق من التمدد الخفيف أو تمارين الحركة.',
    'Tidy your desk so the next round starts clean.': 'رتّب مكتبك لتبدأ الجولة التالية بمكان مرتّب.',
    'Note what you finished and what comes next.': 'دوّن ما أنجزته وما الخطوة التالية.',

    // ---------- immersion ----------
    'Calm': 'هادئ',
    'The scene dims, softens and goes still while you focus, and people’s voices fade to a soft, wordless murmur. Best for reading, revision and exams.': 'يخفت المشهد ويهدأ ويسكن أثناء تركيزك، وتتحوّل أصوات الناس إلى همهمة ناعمة بلا كلمات. الأنسب للقراءة والمراجعة والامتحانات.',
    'Balanced': 'متوازن',
    'The scene gently fades and slows during focus, then comes back to life on breaks.': 'يخفت المشهد ويتباطأ بلطف أثناء التركيز، ثم يعود إلى الحياة في الاستراحات.',
    'Immersive': 'غامر',
    'The full scene and motion all the time. The most atmospheric, and the most distracting.': 'المشهد كاملًا بحركته طوال الوقت. الأكثر حيوية، والأكثر تشتيتًا.',

    // ---------- breathe ----------
    'Breathe': 'تنفّس',
    'Close breathing': 'إغلاق التنفّس',
    'A few minutes of slow breathing. Follow the circle: it grows as you breathe in and shrinks as you breathe out.': 'دقائق قليلة من التنفّس البطيء. اتبع الدائرة: تكبر مع الشهيق وتصغر مع الزفير.',
    'Breathing pattern': 'نمط التنفّس',
    'How long': 'المدة',
    '6 breaths a minute': '6 أنفاس في الدقيقة',
    'Box': 'المربّع',
    '4 in · 4 hold · 4 out · 4 hold': 'شهيق 4 · حبس 4 · زفير 4 · حبس 4',
    'Relax': 'استرخاء',
    '4 in · 7 hold · 8 out': 'شهيق 4 · حبس 7 · زفير 8',
    '{m} min': '{m} د',
    'Soft bell when the breath changes': 'جرس هادئ عند تغيّر النفَس',
    'Begin': 'ابدأ',
    'Breathe in': 'شهيق',
    'Hold': 'احبس',
    'Breathe out': 'زفير',
    'End': 'إنهاء',
    '{time} left': 'متبقٍ {time}',
    'Well done': 'أحسنت',
    'You breathed slowly for {mins} minutes. Notice how you feel before you go back.': 'تنفّست ببطء لمدة {dur}. لاحظ شعورك قبل أن تعود.',
    'Back to FocusPal': 'العودة إلى التطبيق',
    'Breathe again': 'تنفّس مرة أخرى',

    // ---------- map ----------
    'Choose where to study': 'اختر مكان المذاكرة',
    'Where will you focus today?': 'أين ستركّز اليوم؟',
    '🏝️ {n} places to explore': '🏝️ أماكن للاستكشاف: {n}',
    '✨ Premium · all {n} places open': '✨ بريميوم · كل الأماكن مفتوحة ({n})',
    '🏆 All {n} places unlocked!': '🏆 فُتحت كل الأماكن ({n})!',
    '🏝️ {u}/{n} places · next: {next} in {r} sessions': '🏝️ الأماكن: {u}/{n} · التالي: {next} بعد {r} من الجلسات',
    'Travel to {name}: {tagline}': 'الانتقال إلى {name}: {tagline}',
    '{name}, locked: {r} more focus sessions to unlock': '{name}، مقفل: يُفتح بعد {r} من جلسات التركيز',
    '🔒 {r} more sessions': '🔒 بعد {r} من الجلسات',
    '🔒 Unlocks after <b>{n} focus sessions</b>. You’ve done {d}, so {r} to go.': '🔒 يُفتح بعد <b>{n} من جلسات التركيز</b>. أنجزت {d}، وبقي {r}.',
    '✨ Unlock every place with Premium': '✨ افتح كل الأماكن مع بريميوم',
    'Sounds here': 'أصوات المكان',
    'Focus here →': 'ركّز هنا ←',
    'Back to {name} →': '→ العودة إلى {name}',
    '← Back': '→ رجوع',
    'Unlock all': 'فتح الكل',
    '{place} unlocks after {r} more focus sessions, or get every place now with Premium.': '{place} يُفتح بعد {r} من جلسات التركيز، أو احصل على كل الأماكن الآن مع بريميوم.',
    '🎉 New place unlocked: {names}! Open the map to visit.': '🎉 فُتح مكان جديد: {names}! افتح الخريطة لزيارته.',
    ' and ': ' و',

    // ---------- avatar ----------
    'Choose your study buddy': 'اختر رفيق مذاكرتك',
    'Optional. Your animal travels with you on the map.': 'اختياري. حيوانك يرافقك على الخريطة.',
    'Animal': 'الحيوان',
    'Accessory': 'الإضافة',
    'Background': 'الخلفية',
    'Save': 'حفظ',
    'Use the default pin': 'استخدم الدبوس الافتراضي',
    '🎲 Surprise me': '🎲 فاجئني',
    '🐾 Saved. Your animal travels with you on the map.': '🐾 تم الحفظ. حيوانك يرافقك على الخريطة.',
    'Back to the default pin.': 'عدنا إلى الدبوس الافتراضي.',
    'Cat': 'قطة', 'Dog': 'كلب', 'Fox': 'ثعلب', 'Panda': 'باندا', 'Owl': 'بومة', 'Rabbit': 'أرنب',
    'Bear': 'دب', 'Penguin': 'بطريق', 'Koala': 'كوالا', 'Lion': 'أسد', 'Falcon': 'صقر', 'Camel': 'جمل',
    'None': 'بدون', 'Glasses': 'نظارة', 'Headphones': 'سماعات', 'Grad cap': 'قبعة تخرّج',

    // ---------- premium ----------
    'Premium': 'بريميوم',
    'Go Premium': 'اشترك في بريميوم',
    'You’re Premium ✨': 'أنت مشترك في بريميوم ✨',
    'Study anywhere on the island, right away.': 'ذاكر في أي مكان على الجزيرة فورًا.',
    'Every place, right away': 'كل الأماكن فورًا',
    'Skip the unlock path and study anywhere on the island.': 'تخطَّ مراحل الفتح وذاكر في أي مكان على الجزيرة.',
    'New places as they’re added': 'أماكن جديدة فور إضافتها',
    'Fresh spots to study in, included in your plan.': 'أماكن جديدة للمذاكرة ضمن اشتراكك.',
    'Saved sound mixes': 'مزيجات صوت محفوظة',
    'Keep your favourite blend for each place.': 'احتفظ بمزيجك المفضّل لكل مكان.',
    'Focus history & streaks': 'سجل التركيز والأيام المتتالية',
    'See your weeks add up.': 'شاهد أسابيعك تتراكم.',
    'Soon': 'قريبًا',
    'Coming soon': 'قريبًا',
    'Billing': 'الفوترة',
    'Monthly': 'شهري',
    'Yearly': 'سنوي',
    'per month': 'شهريًا',
    'per year': 'سنويًا',
    'Prefer to earn it? Every place also unlocks for free as you complete focus sessions.': 'تفضّل أن تكسبها؟ كل الأماكن تُفتح مجانًا أيضًا مع إكمال جلسات التركيز.',
    'Developer testing (only shown locally)': 'اختبار المطوّر (يظهر محليًا فقط)',
    'Turn Premium on': 'تفعيل بريميوم',
    'Turn Premium off': 'إيقاف بريميوم',
    'Back to focusing': 'العودة إلى التركيز',
    '✨ Premium is on: every place is open.': '✨ بريميوم مفعّل: كل الأماكن مفتوحة.',
    'Premium is off: places unlock as you focus.': 'بريميوم متوقّف: تُفتح الأماكن مع تركيزك.',
    'Continue to checkout · {price} / year': 'المتابعة إلى الدفع · {price} سنويًا',
    'Continue to checkout · {price} / month': 'المتابعة إلى الدفع · {price} شهريًا',

    // ---------- places ----------
    'Deep Space': 'الفضاء العميق',
    'Drift past a ringed planet in silence and starlight.': 'حلّق قرب كوكب ذي حلقات في الصمت وضوء النجوم.',
    'Cosmic drone': 'همهمة كونية',
    'Starlight': 'ضوء النجوم',
    'Ship engine': 'محرّك المركبة',
    'Busy Café': 'المقهى المزدحم',
    'The gentle buzz of a coffee shop, cups clinking, espresso hissing.': 'ضجيج مقهى لطيف، ورنين الأكواب، وهسهسة الإسبريسو.',
    'People chatting': 'أحاديث الناس',
    'Cups & spoons': 'أكواب وملاعق',
    'Espresso bar': 'ركن الإسبريسو',
    'Café music': 'موسيقى المقهى',
    'Old Library': 'المكتبة القديمة',
    'Hushed halls, turning pages and a patient clock.': 'قاعات هادئة، وصفحات تُقلَّب، وساعة صبورة.',
    'Room tone': 'هدوء القاعة',
    'Turning pages': 'تقليب الصفحات',
    'Wall clock': 'ساعة الحائط',
    'Distant footsteps': 'خطوات بعيدة',
    'Late-night Diner': 'مطعم آخر الليل',
    'Neon glow, a sizzling grill and an old jukebox.': 'وهج النيون، وشواية تطقطق، وصندوق موسيقى قديم.',
    'Busy tables': 'طاولات مزدحمة',
    'Grill sizzle': 'طقطقة الشواية',
    'Plates & cutlery': 'صحون وأدوات مائدة',
    'Jukebox': 'صندوق الموسيقى',
    'Sunny Garden': 'الحديقة المشمسة',
    'Birdsong, a soft breeze and a trickling fountain.': 'تغريد الطيور، ونسيم لطيف، ونافورة تنساب.',
    'Breeze': 'النسيم',
    'Birdsong': 'تغريد الطيور',
    'Fountain': 'النافورة',
    'Rainy Dorm': 'غرفة السكن الممطرة',
    'Rain on the window, distant thunder, a lo-fi radio.': 'مطر على النافذة، ورعد بعيد، وراديو موسيقى هادئة.',
    'Rain': 'المطر',
    'Drops on glass': 'قطرات على الزجاج',
    'Distant thunder': 'رعد بعيد',
    'Lo-fi radio': 'راديو هادئ',
    'Calm Office': 'المكتب الهادئ',
    'Sunlight through the blinds, soft typing, a quiet hum.': 'ضوء الشمس عبر الستائر، وطباعة خفيفة، وهمهمة هادئة.',
    'Air conditioning': 'المكيّف',
    'Keyboards': 'لوحات المفاتيح',
    'Distant colleagues': 'زملاء من بعيد',
    'Ocean Sunset': 'غروب على البحر',
    'Rolling waves, gulls and a warm sea breeze.': 'أمواج متتابعة، ونوارس، ونسيم بحر دافئ.',
    'Waves': 'الأمواج',
    'Seagulls': 'النوارس',
    'Sea breeze': 'نسيم البحر',
    'Fireside Cabin': 'كوخ المدفأة',
    'A crackling fire while the snow falls outside.': 'نار تطقطق والثلج يتساقط في الخارج.',
    'Crackling fire': 'نار تطقطق',
    'Wind outside': 'الريح في الخارج',
    'Mantel clock': 'ساعة الرف',
    'Airport Café': 'مقهى المطار',
    'Coffee by the gate, planes taking off and a soft departures chime.': 'قهوة قرب البوابة، وطائرات تقلع، ونغمة إعلان رحلات هادئة.',
    'Terminal crowd': 'زحام الصالة',
    'Coffee bar': 'ركن القهوة',
    'Rolling suitcases': 'حقائب تُجرّ',
    'Departure chimes': 'نغمات المغادرة',
    'Planes outside': 'طائرات في الخارج',
    'Grand Hotel Lobby': 'بهو الفندق الكبير',
    'Marble floors, crystal chandeliers and a pianist playing softly.': 'أرضيات رخامية، وثريات كريستال، وعازف بيانو يعزف بهدوء.',
    'Lobby piano': 'بيانو البهو',
    'Quiet guests': 'نزلاء هادئون',
    'Footsteps on marble': 'خطوات على الرخام',
    'Reception & elevator': 'الاستقبال والمصعد',
    'Lobby fountain': 'نافورة البهو',
    'Courtyard Library': 'مكتبة الفناء',
    'A quiet library under the arches of a mosque courtyard, with a fountain and doves.': 'مكتبة هادئة تحت أقواس فناء مسجد، مع نافورة وحمام.',
    'Courtyard fountain': 'نافورة الفناء',
    'Doves & sparrows': 'حمام وعصافير',
    'Warm breeze': 'نسيم دافئ',
    'Alajeer HQ': 'مقر الأجير',
    'A calm, modern office looking out over the skyline at sunset. Home of the team behind FocusPal.': 'مكتب عصري هادئ يطل على أفق المدينة وقت الغروب. مقر الفريق الذي صنع هذا التطبيق.',
    'The team, nearby': 'الفريق على مقربة',
    'Coffee corner': 'ركن القهوة',
    'Henson Site Office': 'مكتب موقع هنسون',
    'A site office on a Henson project at dusk: blueprints on the desk, a crane and a substation outside, and a gentle Persian santur. Build it right, build it once.': 'مكتب موقع في أحد مشاريع هنسون وقت الغسق: مخططات على المكتب، ورافعة ومحطة كهرباء في الخارج، وأنغام سنطور فارسي هادئة. ابنِه صحيحًا، وابنِه مرة واحدة.',
    'Persian santur': 'سنطور فارسي',
    'Construction site': 'موقع البناء',
    'Substation hum': 'طنين محطة الكهرباء',
    'Site-office AC': 'مكيّف المكتب',
    'Blueprints': 'المخططات',
    'Oasis Spa': 'سبا الواحة',
    'Warm stone, mosaic tiles and steam under a starlit dome, with a trickling fountain and the hum of a singing bowl.': 'حجر دافئ، وبلاط فسيفساء، وبخار تحت قبة مرصّعة بالنجوم، مع نافورة تنساب ورنين وعاء غنائي.',
    'Basin fountain': 'نافورة الحوض',
    'Steam': 'البخار',
    'Singing bowls': 'الأوعية الغنائية',
    'Echoing drips': 'قطرات يتردد صداها',
    'Warm hum': 'همهمة دافئة',
    'City Bus': 'حافلة المدينة',
    'A window seat on a city bus: streets, palms and towers rolling past, and a gentle stop now and then.': 'مقعد بجانب النافذة في حافلة المدينة: شوارع ونخيل وأبراج تمرّ أمامك، وتوقّف هادئ بين حين وآخر.',
    'Engine & road': 'المحرّك والطريق',
    'Road bumps': 'مطبّات الطريق',
    'Turn signal': 'إشارة الانعطاف',
    'Other passengers': 'ركّاب آخرون',
    'Express Train': 'القطار السريع',
    'A table seat on an express train: fields and hills sliding by, the rhythm of the rails and a cup of coffee.': 'مقعد على طاولة في قطار سريع: حقول وتلال تنساب أمامك، وإيقاع القضبان، وفنجان قهوة.',
    'Train tracks': 'سكة القطار',
    'Carriage rumble': 'هدير العربة',
    'Quiet carriage': 'عربة هادئة',
    'Airplane Cabin': 'مقصورة الطائرة',
    'A window seat above the clouds: the steady hush of the engines, the wing in the sun, nowhere to be until you land.': 'مقعد بجانب النافذة فوق الغيوم: هدير المحركات الثابت، والجناح تحت الشمس، ولا شيء ينتظرك حتى الهبوط.',
    'Cabin hum & seatbelt sign': 'هدير المقصورة وإشارة الحزام',
    'Pilot announcements': 'إعلانات قائد الطائرة',
    'Air vent': 'فتحة التكييف',
    'Yoga Studio': 'استوديو اليوغا',
    'A sunlit studio by the sea: wooden floors, mats and plants, soft music, wind chimes and a curl of incense.': 'استوديو مشمس على البحر: أرضيات خشبية، وسجّادات ونباتات، وموسيقى هادئة، وأجراس رياح، ودخان بخور.',
    'Calm music': 'موسيقى هادئة',
    'Bamboo flute': 'ناي الخيزران',
    'Wind chimes': 'أجراس الرياح',
    'Morning birds': 'طيور الصباح',
    'Sea outside': 'البحر في الخارج',

    // ---------- the bus's next-stop sign ----------
    'Next stop · {stop}': 'المحطة التالية · {stop}',
    'Stopping · {stop}': 'نتوقّف عند · {stop}',
    'Bab Al Bahrain': 'باب البحرين', 'Manama Souq': 'سوق المنامة', 'Adliya': 'العدلية', 'Juffair': 'الجفير',
    'Seef': 'السيف', 'Muharraq': 'المحرق', 'Isa Town': 'مدينة عيسى', 'Riffa': 'الرفاع', 'Budaiya': 'البديع', 'Hoora': 'الحورة',
  };

  const fill = (s, vars) => (vars ? s.replace(/\{(\w+)\}/g, (m, k) => (vars[k] != null ? vars[k] : m)) : s);
  // FP.t(phrase, vars, english): the Arabic for `phrase` in an Arabic interface; otherwise
  // `english` (when the English needs its own wording, e.g. plurals) or the phrase itself.
  FP.t = (s, vars, english) => {
    if (lang === 'ar' && AR[s] != null) return fill(AR[s], vars);
    return english != null ? english : fill(s, vars);
  };
  // A number of minutes the way Arabic counts them: دقيقة واحدة، دقيقتان، 3–10 دقائق، 11+ دقيقة.
  FP.dur = (n) => {
    if (lang !== 'ar') return `${n} min`;
    if (n === 1) return 'دقيقة واحدة';
    if (n === 2) return 'دقيقتان';
    return n >= 3 && n <= 10 ? `${n} دقائق` : `${n} دقيقة`;
  };
  FP.setLang = (l) => {
    try { localStorage.setItem(KEY, l); } catch (e) { /* storage unavailable */ }
    const u = new URL(location.href);
    u.searchParams.delete('lang');
    location.replace(u.toString());
  };

  if (lang !== 'ar') return;

  // ---------- the page in Arabic ----------
  document.documentElement.lang = 'ar';
  document.documentElement.dir = 'rtl';

  const ATTRS = ['title', 'aria-label', 'placeholder', 'alt'];
  const EMOJI = /^((?:\p{Extended_Pictographic}|️|‍)+\s+)([\s\S]+)$/u;
  function tr(text) {
    const m = /^(\s*)([\s\S]*?)(\s*)$/.exec(text);
    const core = m[2];
    if (!core) return null;
    let out = AR[core];
    if (out == null) {
      // "☕ Busy Café": keep the emoji, translate the rest
      const e = EMOJI.exec(core);
      if (e && AR[e[2]] != null) out = e[1] + AR[e[2]];
    }
    return out == null ? null : m[1] + out + m[3];
  }
  // People's own words (task names) are never translated.
  const skip = (el) => !el || el.closest('script, style, .task-text, [data-no-tr]');
  function textNode(n) {
    if (skip(n.parentElement)) return;
    const v = tr(n.nodeValue);
    if (v != null && v !== n.nodeValue) n.nodeValue = v;
  }
  function attrs(el) {
    if (skip(el)) return;
    ATTRS.forEach((a) => {
      const val = el.getAttribute(a);
      if (!val) return;
      const v = tr(val);
      if (v != null && v !== val) el.setAttribute(a, v);
    });
  }
  function tree(root) {
    if (root.nodeType === 3) return textNode(root);
    if (root.nodeType !== 1) return;
    attrs(root);
    root.querySelectorAll('*').forEach(attrs);
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let n = w.nextNode(); n; n = w.nextNode()) textNode(n);
  }
  tree(document.body);
  new MutationObserver((list) => {
    for (const m of list) {
      if (m.type === 'childList') m.addedNodes.forEach(tree);
      else if (m.type === 'characterData') textNode(m.target);
      else if (m.type === 'attributes') attrs(m.target);
    }
  }).observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS });
})();
