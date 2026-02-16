/**
 * Daily Debate System - Combines topics and personas
 */

export interface DailyDebate {
  persona: string;
  personaId?: string;
  topic: string;
  topicId?: string;
  description?: string;
  category?: string;
}

// Curated pairings of personas with topics they'd have interesting takes on
export const CURATED_DAILY_DEBATES: DailyDebate[] = [
  // Philosophy + Philosophers
  { personaId: "socrates", persona: "Socrates", topicId: "free-will", topic: "Is free will an illusion?", category: "philosophy" },
  { personaId: "nietzsche", persona: "Friedrich Nietzsche", topicId: "morality-objective", topic: "Is morality objective or just opinion?", category: "philosophy" },
  { personaId: "marcus-aurelius", persona: "Marcus Aurelius", topicId: "death-bad", topic: "Is death actually bad for the person who dies?", category: "philosophy" },
  { personaId: "aristotle", persona: "Aristotle", topicId: "consciousness-special", topic: "Is human consciousness special or just computation?", category: "philosophy" },
  { personaId: "diogenes", persona: "Diogenes", topicId: "experience-machine", topic: "Would you plug into a machine that simulates a perfect life?", category: "philosophy" },

  // Ethics + Intellectuals  
  { personaId: "hitchens", persona: "Christopher Hitchens", topicId: "euthanasia", topic: "Should people have the right to end their own lives?", category: "ethics", description: "Writer and polemicist known for his sharp wit and confrontational style." },
  { personaId: "carl-sagan", persona: "Carl Sagan", topicId: "animal-testing", topic: "Is animal testing justified to save human lives?", category: "ethics", description: "Astronomer and science communicator who championed critical thinking." },
  { personaId: "hannah-arendt", persona: "Hannah Arendt", topicId: "vigilante-justice", topic: "Is vigilante justice ever morally justified?", category: "ethics", description: "Political philosopher who studied power and the 'banality of evil'." },
  { personaId: "chomsky", persona: "Noam Chomsky", topicId: "wealth-immoral", topic: "Is being a billionaire inherently immoral?", category: "ethics", description: "Linguist and social critic known for his analysis of power structures." },
  { personaId: "feynman", persona: "Richard Feynman", topicId: "trolley-problem", topic: "Would you kill one person to save five?", category: "ethics", description: "Physicist known for his ability to simplify complex concepts." },

  // Technology + Modern Voices
  { personaId: "sam-harris", persona: "Sam Harris", topicId: "ai-consciousness", topic: "Can AI ever be truly conscious?", category: "technology" },
  { personaId: "yuval-harari", persona: "Yuval Noah Harari", topicId: "ai-threat", topic: "Is AI an existential threat to humanity?", category: "technology" },
  { personaId: "nassim-taleb", persona: "Nassim Taleb", topicId: "crypto-future", topic: "Is cryptocurrency the future of money or a scam?", category: "technology" },
  { personaId: "contrapoints", persona: "Natalie Wynn", topicId: "algorithm-radicalization", topic: "Are recommendation algorithms radicalizing society?", category: "technology" },
  { personaId: "bo-burnham", persona: "Bo Burnham", topicId: "tech-addiction", topic: "Should social media be regulated like tobacco?", category: "technology" },

  // Society + Comedians
  { personaId: "george-carlin", persona: "George Carlin", topicId: "cancel-culture", topic: "Is cancel culture justice or mob rule?", category: "society" },
  { personaId: "bill-hicks", persona: "Bill Hicks", topicId: "drug-legalization", topic: "Should all drugs be legalized?", category: "society" },
  { personaId: "ricky-gervais", persona: "Ricky Gervais", topicId: "meritocracy-myth", topic: "Is meritocracy a myth?", category: "society" },
  { personaId: "norm-macdonald", persona: "Norm Macdonald", topicId: "marriage-outdated", topic: "Is marriage an outdated institution?", category: "society" },
  { personaId: "aoc", persona: "Alexandria Ocasio-Cortez", topicId: "college-worth", topic: "Is college worth it anymore?", category: "society" },

  // Science + Historical
  { personaId: "feynman", persona: "Richard Feynman", topicId: "mars-vs-earth", topic: "Should we colonize Mars or fix Earth first?", category: "science" },
  { personaId: "carl-sagan", persona: "Carl Sagan", topicId: "alien-life", topic: "Is intelligent alien life common in the universe?", category: "science" },
  { personaId: "churchill", persona: "Winston Churchill", topicId: "nuclear-power", topic: "Is nuclear power the solution to climate change?", category: "science" },
  { personaId: "maya-angelou", persona: "Maya Angelou", topicId: "science-limits", topic: "Are there questions science can never answer?", category: "science" },

  // Relationships + Wildcards
  { personaId: "tyrion", persona: "Tyrion Lannister", topicId: "friends-exes", topic: "Should you stay friends with your exes?", category: "relationships" },
  { personaId: "sherlock", persona: "Sherlock Holmes", topicId: "dating-apps", topic: "Have dating apps ruined romance?", category: "relationships" },
  { personaId: "yoda", persona: "Yoda", topicId: "love-choice", topic: "Is love a choice or a feeling?", category: "relationships" },
  { personaId: "devil", persona: "The Devil", topicId: "ghosting-okay", topic: "Is ghosting ever acceptable?", category: "relationships" },
  { personaId: "morpheus", persona: "Morpheus", topicId: "open-relationships", topic: "Can open relationships actually work?", category: "relationships" },

  // Business
  { personaId: "nassim-taleb", persona: "Nassim Taleb", topicId: "entrepreneurship", topic: "Is entrepreneurship glorified gambling?", category: "business" },
  { personaId: "diogenes", persona: "Diogenes", topicId: "passive-income", topic: "Is passive income ethical?", category: "business" },
  { personaId: "jordan-peterson", persona: "Jordan Peterson", topicId: "hustle-culture", topic: "Is hustle culture toxic or necessary?", category: "business" },

  // Pop Culture
  { personaId: "oscar-wilde", persona: "Oscar Wilde", topicId: "remakes-ruining", topic: "Are remakes ruining entertainment?", category: "pop-culture" },
  { personaId: "george-carlin", persona: "George Carlin", topicId: "celebrity-opinions", topic: "Should celebrities stay out of politics?", category: "pop-culture" },
  { personaId: "bo-burnham", persona: "Bo Burnham", topicId: "influencer-legitimate", topic: "Is 'influencer' a legitimate career?", category: "pop-culture" },

  // Hot Takes
  { personaId: "sherlock", persona: "Sherlock Holmes", topicId: "hot-dog-sandwich", topic: "Is a hot dog a sandwich?", category: "hot-takes" },
  { personaId: "aristotle", persona: "Aristotle", topicId: "cereal-soup", topic: "Is cereal a soup?", category: "hot-takes" },
  { personaId: "socrates", persona: "Socrates", topicId: "water-wet", topic: "Is water wet?", category: "hot-takes" },
  { personaId: "drunk-uncle", persona: "Drunk Uncle", topicId: "pineapple-pizza", topic: "Does pineapple belong on pizza?", category: "hot-takes" },
  { personaId: "yoda", persona: "Yoda", topicId: "batman-vs-superman", topic: "Could Batman beat Superman?", category: "hot-takes" },

  // Politics + Historical
  { personaId: "mlk", persona: "Martin Luther King Jr.", topicId: "democracy-best", topic: "Is democracy the best form of government?", category: "politics" },
  { personaId: "frederick-douglass", persona: "Frederick Douglass", topicId: "lobbying-corruption", topic: "Is lobbying just legalized corruption?", category: "politics" },
  { personaId: "lincoln", persona: "Abraham Lincoln", topicId: "two-party-system", topic: "Is the two-party system destroying America?", category: "politics" },

  // New Additions (2026-02-15)
  { personaId: "industrialist", persona: "The Industrialist", topicId: "software-assembly-line", topic: "Is the end of human coding inevitable?", category: "technology" },
  { personaId: "liberator", persona: "The Liberator", topicId: "uncensored-ai-illegal", topic: "Should uncensored AI image generators be made illegal?", category: "technology" },

  // New Additions (2026-02-13)
  { personaId: "snowden", persona: "Edward Snowden", topicId: "parents-location", topic: "Your parents should have access to your location 24/7", category: "society" },
  { personaId: "bernie", persona: "Bernie Sanders", topicId: "billionaire-immoral", topic: "It is immoral to be a billionaire while poverty exists", category: "economics" },
  { personaId: "haidt", persona: "Jonathan Haidt", topicId: "smartphones-gen-alpha", topic: "Smartphones have ruined Gen Alpha childhood", category: "society" },
  { personaId: "thiel", persona: "Peter Thiel", topicId: "university-scam", topic: "University is a scam and you should just learn from AI", category: "education" },
  { personaId: "peter-singer", persona: "Peter Singer", topicId: "meat-illegal", topic: "Eating meat will be illegal in 50 years", category: "ethics", description: "Moral philosopher and pioneer of the animal liberation movement." },

  // Extra combos for variety
  { personaId: "hitchens", persona: "Christopher Hitchens", topicId: "cultural-relativism", topic: "Are all cultures equally valid morally?", category: "ethics" },
  { personaId: "simone-de-beauvoir", persona: "Simone de Beauvoir", topicId: "childfree", topic: "Is choosing not to have children selfish?", category: "relationships" },
  { personaId: "devil", persona: "The Devil", topicId: "torture-vs-dust", topic: "Is it worse to torture one or annoy a billion?", category: "philosophy" },
];

// Legacy debates for backwards compatibility
export const LEGACY_DAILY_DEBATES: DailyDebate[] = [
  { persona: "Elon Musk", topic: "Did Elon ruin Twitter/X?" },
  { persona: "Donald Trump", topic: "Was the 2020 election stolen?" },
  { persona: "Greta Thunberg", topic: "Should we ban fossil fuels by 2030?" },
  { persona: "Jordan Peterson", topic: "Is traditional masculinity toxic?" },
  { persona: "Joe Rogan", topic: "Should psychedelics be legalized?" },
  { persona: "Ben Shapiro", topic: "Should college be free?" },
  { persona: "Bernie Sanders", topic: "Should billionaires exist?" },
  { persona: "Sam Altman", topic: "Will AGI happen in our lifetime?" },
  { persona: "Geoffrey Hinton", topic: "Should we be afraid of AI?" },
  { persona: "Dave Chappelle", topic: "Has comedy become too PC?" },
  { persona: "Neil deGrasse Tyson", topic: "Is space exploration worth it?" },
];

const ALL_DAILY_DEBATES = [...CURATED_DAILY_DEBATES, ...LEGACY_DAILY_DEBATES];

export function getDailyDebate(): DailyDebate {
  const today = new Date();
  const dayOfYear = Math.floor((today.getTime() - new Date(today.getFullYear(), 0, 0).getTime()) / 86400000);
  const index = dayOfYear % ALL_DAILY_DEBATES.length;
  return ALL_DAILY_DEBATES[index];
}

export function getDebateForDate(date: Date): DailyDebate {
  const dayOfYear = Math.floor((date.getTime() - new Date(date.getFullYear(), 0, 0).getTime()) / 86400000);
  const index = dayOfYear % ALL_DAILY_DEBATES.length;
  return ALL_DAILY_DEBATES[index];
}

export function getRandomDebate(): DailyDebate {
  return ALL_DAILY_DEBATES[Math.floor(Math.random() * ALL_DAILY_DEBATES.length)];
}

export function getDebatesByCategory(category: string): DailyDebate[] {
  return CURATED_DAILY_DEBATES.filter(d => d.category === category);
}
