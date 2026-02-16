/**
 * Topic Categories and Debates
 * Organized by category with spicy, engaging topics
 */

export interface Topic {
  id: string;
  question: string;
  description?: string;
  spicyLevel: 1 | 2 | 3; // 1 = mild, 2 = medium, 3 = hot take
}

export interface TopicCategory {
  id: string;
  name: string;
  emoji: string;
  description: string;
  topics: Topic[];
}

export const TOPIC_CATEGORIES: TopicCategory[] = [
  {
    id: "philosophy",
    name: "Philosophy",
    emoji: "🧠",
    description: "The big questions humanity has wrestled with for millennia",
    topics: [
      { id: "free-will", question: "Is free will an illusion?", spicyLevel: 2 },
      { id: "simulation", question: "Are we living in a simulation?", spicyLevel: 2 },
      { id: "meaning-life", question: "Does life have inherent meaning?", spicyLevel: 2 },
      { id: "morality-objective", question: "Is morality objective or just opinion?", spicyLevel: 3 },
      { id: "death-bad", question: "Is death actually bad for the person who dies?", spicyLevel: 3 },
      { id: "knowledge-possible", question: "Can we really know anything for certain?", spicyLevel: 2 },
      { id: "consciousness-special", question: "Is human consciousness special or just complex computation?", spicyLevel: 3 },
      { id: "torture-vs-dust", question: "Is it worse to torture one person or give a billion people dust specks in their eyes?", spicyLevel: 3 },
      { id: "experience-machine", question: "Would you plug into a machine that simulates a perfect life?", spicyLevel: 2 },
      { id: "ship-theseus", question: "If you replace every part of yourself, are you still you?", spicyLevel: 2 },
      { id: "moral-luck", question: "Should we judge people for outcomes they couldn't control?", spicyLevel: 2 },
      { id: "antinatalism", question: "Is it ethical to bring children into a world with suffering?", spicyLevel: 3 },
    ]
  },
  {
    id: "ethics",
    name: "Ethics & Morality",
    emoji: "⚖️",
    description: "Right vs wrong in a complicated world",
    topics: [
      { id: "eating-meat", question: "Is eating meat ethical?", spicyLevel: 2 },
      { id: "designer-babies", question: "Should parents be allowed to genetically enhance their children?", spicyLevel: 3 },
      { id: "death-penalty", question: "Is the death penalty ever justified?", spicyLevel: 2 },
      { id: "lying-okay", question: "Is lying ever morally acceptable?", spicyLevel: 1 },
      { id: "wealth-immoral", question: "Is being a billionaire inherently immoral?", spicyLevel: 3 },
      { id: "animal-testing", question: "Is animal testing justified to save human lives?", spicyLevel: 2 },
      { id: "vigilante-justice", question: "Is vigilante justice ever morally justified?", spicyLevel: 2 },
      { id: "euthanasia", question: "Should people have the right to end their own lives?", spicyLevel: 3 },
      { id: "privacy-security", question: "Should we sacrifice privacy for security?", spicyLevel: 2 },
      { id: "cultural-relativism", question: "Are all cultures equally valid morally?", spicyLevel: 3 },
      { id: "effective-altruism", question: "Are you obligated to give most of your money to charity?", spicyLevel: 2 },
      { id: "trolley-problem", question: "Would you kill one person to save five?", spicyLevel: 2 },
    ]
  },
  {
    id: "technology",
    name: "Technology & AI",
    emoji: "🤖",
    description: "The future is here, and it's complicated",
    topics: [
      { id: "ai-threat", question: "Is AI an existential threat to humanity?", spicyLevel: 2 },
      { id: "social-media-net", question: "Has social media been net negative for humanity?", spicyLevel: 2 },
      { id: "ai-consciousness", question: "Can AI ever be truly conscious?", spicyLevel: 2 },
      { id: "tech-addiction", question: "Should social media be regulated like tobacco?", spicyLevel: 2 },
      { id: "right-to-disconnect", question: "Should employees have a legal right to ignore work messages?", spicyLevel: 1 },
      { id: "ai-art", question: "Is AI-generated art real art?", spicyLevel: 2 },
      { id: "brain-chips", question: "Would you get a brain chip to be smarter?", spicyLevel: 2 },
      { id: "crypto-future", question: "Is cryptocurrency the future of money or a scam?", spicyLevel: 2 },
      { id: "big-tech-breakup", question: "Should Big Tech companies be broken up?", spicyLevel: 2 },
      { id: "algorithm-radicalization", question: "Are recommendation algorithms radicalizing society?", spicyLevel: 2 },
      { id: "digital-afterlife", question: "Should we upload our minds to achieve immortality?", spicyLevel: 3 },
      { id: "ai-jobs", question: "Should AI that replaces jobs be taxed?", spicyLevel: 2 },
      { id: "uncensored-ai-illegal", question: "Should uncensored AI image generators be made illegal?", spicyLevel: 3 },
      { id: "software-assembly-line", question: "Is the end of human coding inevitable?", spicyLevel: 3 },
    ]
  },
  {
    id: "society",
    name: "Society & Culture",
    emoji: "🏛️",
    description: "How we live together (or don't)",
    topics: [
      { id: "cancel-culture", question: "Is cancel culture justice or mob rule?", spicyLevel: 2 },
      { id: "marriage-outdated", question: "Is marriage an outdated institution?", spicyLevel: 2 },
      { id: "college-worth", question: "Is college worth it anymore?", spicyLevel: 2 },
      { id: "meritocracy-myth", question: "Is meritocracy a myth?", spicyLevel: 2 },
      { id: "voting-mandatory", question: "Should voting be mandatory?", spicyLevel: 1 },
      { id: "drug-legalization", question: "Should all drugs be legalized?", spicyLevel: 3 },
      { id: "age-voting", question: "Should the voting age be lowered to 16?", spicyLevel: 2 },
      { id: "tipping-culture", question: "Should tipping be abolished?", spicyLevel: 1 },
      { id: "work-from-home", question: "Is remote work better than office work?", spicyLevel: 1 },
      { id: "beauty-standards", question: "Are beauty standards oppressive or natural?", spicyLevel: 2 },
      { id: "monogamy-natural", question: "Is monogamy natural for humans?", spicyLevel: 2 },
      { id: "hustle-culture", question: "Is hustle culture toxic or necessary?", spicyLevel: 2 },
    ]
  },
  {
    id: "science",
    name: "Science & Nature",
    emoji: "🔬",
    description: "Understanding the universe and our place in it",
    topics: [
      { id: "mars-vs-earth", question: "Should we colonize Mars or fix Earth first?", spicyLevel: 2 },
      { id: "climate-priorities", question: "Is climate change the most important issue facing humanity?", spicyLevel: 2 },
      { id: "nuclear-power", question: "Is nuclear power the solution to climate change?", spicyLevel: 2 },
      { id: "gmo-food", question: "Are GMOs dangerous or humanity's salvation?", spicyLevel: 2 },
      { id: "alien-life", question: "Is intelligent alien life common in the universe?", spicyLevel: 1 },
      { id: "human-evolution", question: "Has human evolution stopped?", spicyLevel: 2 },
      { id: "nature-nurture", question: "Is personality more nature or nurture?", spicyLevel: 2 },
      { id: "science-limits", question: "Are there questions science can never answer?", spicyLevel: 2 },
      { id: "de-extinction", question: "Should we bring back extinct species?", spicyLevel: 2 },
      { id: "space-money", question: "Is space exploration a waste of money?", spicyLevel: 2 },
      { id: "cryonics", question: "Is freezing yourself for future revival rational?", spicyLevel: 2 },
      { id: "ivf-selection", question: "Should parents select embryos for intelligence?", spicyLevel: 3 },
    ]
  },
  {
    id: "pop-culture",
    name: "Pop Culture",
    emoji: "🎬",
    description: "The stuff everyone actually argues about",
    topics: [
      { id: "remakes-ruining", question: "Are remakes and reboots ruining entertainment?", spicyLevel: 1 },
      { id: "streaming-killed", question: "Did streaming kill the movie theater?", spicyLevel: 1 },
      { id: "celebrity-opinions", question: "Should celebrities stay out of politics?", spicyLevel: 2 },
      { id: "reality-tv", question: "Is reality TV harmful to society?", spicyLevel: 1 },
      { id: "influencer-legitimate", question: "Is 'influencer' a legitimate career?", spicyLevel: 1 },
      { id: "video-games-art", question: "Are video games art?", spicyLevel: 1 },
      { id: "music-worse", question: "Is modern music worse than older music?", spicyLevel: 2 },
      { id: "book-better-movie", question: "Is the book always better than the movie?", spicyLevel: 1 },
      { id: "sports-overpaid", question: "Are professional athletes overpaid?", spicyLevel: 1 },
      { id: "award-shows", question: "Are award shows meaningless?", spicyLevel: 1 },
      { id: "true-crime-ethical", question: "Is true crime content ethical?", spicyLevel: 2 },
      { id: "fan-fiction-valid", question: "Is fan fiction legitimate creative work?", spicyLevel: 1 },
    ]
  },
  {
    id: "relationships",
    name: "Relationships & Dating",
    emoji: "💔",
    description: "Love, sex, and everything complicated",
    topics: [
      { id: "friends-exes", question: "Should you stay friends with your exes?", spicyLevel: 1 },
      { id: "dating-apps", question: "Have dating apps ruined romance?", spicyLevel: 2 },
      { id: "age-gaps", question: "Are large age gaps in relationships problematic?", spicyLevel: 2 },
      { id: "cohabitation", question: "Should couples live together before marriage?", spicyLevel: 1 },
      { id: "opposite-sex-friends", question: "Can men and women be just friends?", spicyLevel: 1 },
      { id: "body-count", question: "Does sexual history matter in a relationship?", spicyLevel: 2 },
      { id: "prenups", question: "Should all couples get prenups?", spicyLevel: 1 },
      { id: "ghosting-okay", question: "Is ghosting ever acceptable?", spicyLevel: 1 },
      { id: "social-media-stalking", question: "Is it okay to check your partner's social media?", spicyLevel: 2 },
      { id: "open-relationships", question: "Can open relationships actually work?", spicyLevel: 2 },
      { id: "childfree", question: "Is choosing not to have children selfish?", spicyLevel: 2 },
      { id: "love-choice", question: "Is love a choice or a feeling?", spicyLevel: 1 },
    ]
  },
  {
    id: "business",
    name: "Business & Money",
    emoji: "💰",
    description: "Capitalism, careers, and cash",
    topics: [
      { id: "ubi", question: "Should everyone get a universal basic income?", spicyLevel: 2 },
      { id: "4-day-week", question: "Should the 4-day work week be standard?", spicyLevel: 1 },
      { id: "ceo-pay", question: "Should CEO pay be capped relative to workers?", spicyLevel: 2 },
      { id: "unions", question: "Are unions good or bad for workers?", spicyLevel: 2 },
      { id: "minimum-wage", question: "Should minimum wage be $25/hour?", spicyLevel: 2 },
      { id: "entrepreneurship", question: "Is entrepreneurship glorified gambling?", spicyLevel: 2 },
      { id: "passive-income", question: "Is passive income ethical?", spicyLevel: 2 },
      { id: "advertising-manipulation", question: "Is advertising just manipulation?", spicyLevel: 2 },
      { id: "gig-economy", question: "Is the gig economy exploitative or liberating?", spicyLevel: 2 },
      { id: "financial-literacy", question: "Should financial literacy be mandatory in schools?", spicyLevel: 1 },
      { id: "rent-control", question: "Does rent control help or hurt renters?", spicyLevel: 2 },
      { id: "inheritance-tax", question: "Should inheritance be heavily taxed?", spicyLevel: 3 },
    ]
  },
  {
    id: "hot-takes",
    name: "Hot Takes",
    emoji: "🔥",
    description: "Controversial opinions that will start arguments",
    topics: [
      { id: "pineapple-pizza", question: "Does pineapple belong on pizza?", spicyLevel: 1 },
      { id: "breakfast-dinner", question: "Is breakfast for dinner acceptable?", spicyLevel: 1 },
      { id: "toilet-paper", question: "Should toilet paper hang over or under?", spicyLevel: 1 },
      { id: "hot-dog-sandwich", question: "Is a hot dog a sandwich?", spicyLevel: 1 },
      { id: "gif-pronunciation", question: "Is it pronounced GIF or JIF?", spicyLevel: 1 },
      { id: "cereal-soup", question: "Is cereal a soup?", spicyLevel: 1 },
      { id: "water-wet", question: "Is water wet?", spicyLevel: 1 },
      { id: "die-hard-christmas", question: "Is Die Hard a Christmas movie?", spicyLevel: 1 },
      { id: "mayonnaise-instrument", question: "Is mayonnaise an instrument?", spicyLevel: 1 },
      { id: "birds-real", question: "Are birds real or government drones?", spicyLevel: 1 },
      { id: "batman-vs-superman", question: "Could Batman beat Superman?", spicyLevel: 1 },
      { id: "hogwarts-houses", question: "Is Slytherin actually the best Hogwarts house?", spicyLevel: 1 },
    ]
  },
  {
    id: "politics",
    name: "Politics & Power",
    emoji: "🗳️",
    description: "The stuff that actually runs the world",
    topics: [
      { id: "democracy-best", question: "Is democracy the best form of government?", spicyLevel: 2 },
      { id: "electoral-college", question: "Should the Electoral College be abolished?", spicyLevel: 2 },
      { id: "term-limits", question: "Should there be term limits for all politicians?", spicyLevel: 1 },
      { id: "lobbying-corruption", question: "Is lobbying just legalized corruption?", spicyLevel: 2 },
      { id: "military-spending", question: "Does the US spend too much on military?", spicyLevel: 2 },
      { id: "healthcare-system", question: "Should healthcare be fully government-run?", spicyLevel: 2 },
      { id: "border-policy", question: "Should borders be open or closed?", spicyLevel: 3 },
      { id: "gun-control", question: "Would stricter gun control reduce violence?", spicyLevel: 3 },
      { id: "police-funding", question: "Should police be defunded or reformed?", spicyLevel: 3 },
      { id: "two-party-system", question: "Is the two-party system destroying America?", spicyLevel: 2 },
      { id: "age-limits-politicians", question: "Should there be age limits for politicians?", spicyLevel: 2 },
      { id: "political-dynasty", question: "Should political dynasties be banned?", spicyLevel: 2 },
    ]
  }
];

export function getRandomTopicFromCategory(categoryId: string): Topic | null {
  const category = TOPIC_CATEGORIES.find(c => c.id === categoryId);
  if (!category) return null;
  return category.topics[Math.floor(Math.random() * category.topics.length)];
}

export function getTopicSuggestions(count: number = 3): Topic[] {
  const allTopics = TOPIC_CATEGORIES.flatMap(c => c.topics);
  const shuffled = [...allTopics].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

export function getAllTopics(): Topic[] {
  return TOPIC_CATEGORIES.flatMap(c => c.topics);
}

/**
 * Get related topics for post-debate suggestions.
 * Prioritizes topics from the same category, then fills from other categories.
 * Excludes the current topic.
 */
export function getRelatedTopics(currentTopicQuestion: string, count: number = 3): Topic[] {
  // Find which category the current topic belongs to
  let currentCategory: string | null = null;
  for (const cat of TOPIC_CATEGORIES) {
    if (cat.topics.some(t => t.question === currentTopicQuestion)) {
      currentCategory = cat.id;
      break;
    }
  }

  const allTopics = TOPIC_CATEGORIES.flatMap(c =>
    c.topics.map(t => ({ ...t, categoryId: c.id }))
  ).filter(t => t.question !== currentTopicQuestion);

  // Separate same-category and other topics
  const sameCategory = allTopics.filter(t => t.categoryId === currentCategory);
  const otherCategories = allTopics.filter(t => t.categoryId !== currentCategory);

  // Shuffle both pools
  const shuffleSame = [...sameCategory].sort(() => Math.random() - 0.5);
  const shuffleOther = [...otherCategories].sort(() => Math.random() - 0.5);

  // Take 2 from same category (if available), 1 from other
  const results: Topic[] = [];
  const fromSame = Math.min(2, shuffleSame.length);
  results.push(...shuffleSame.slice(0, fromSame));
  results.push(...shuffleOther.slice(0, count - fromSame));

  return results.slice(0, count);
}

export function getTopicById(id: string): Topic | null {
  for (const category of TOPIC_CATEGORIES) {
    const topic = category.topics.find(t => t.id === id);
    if (topic) return topic;
  }
  return null;
}
