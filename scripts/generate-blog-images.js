const { GoogleGenerativeAI } = require("@google/generative-ai");
const fs = require("fs");
const path = require("path");
const matter = require("gray-matter");

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "AIzaSyDwjkjK0bkaEE12tC79GFsWEruFAyAYPMw";
const BLOG_DIR = path.join(__dirname, "..", "content", "blog");
const PUBLIC_BLOG_DIR = path.join(__dirname, "..", "public", "blog");

// Ensure the public/blog directory exists
if (!fs.existsSync(PUBLIC_BLOG_DIR)) {
  fs.mkdirSync(PUBLIC_BLOG_DIR, { recursive: true });
}

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

// Blog posts data (extracted from markdown files)
const blogPosts = [
  {
    slug: "5-times-ai-changed-my-mind",
    title: "5 Times AI Changed My Mind About Something I Was Sure About",
    description: "I thought I had strong opinions. Turns out I had strong feelings and weak arguments.",
    prompt: "Abstract digital art representing changing perspectives and open-mindedness. A human silhouette with thought bubbles containing shifting geometric shapes, symbolizing evolving opinions. Warm gradient colors from orange to purple, modern minimalist style."
  },
  {
    slug: "ai-argued-against-free-will",
    title: "AI Argued That Humans Don't Have Free Will. I Couldn't Win.",
    description: "A deep dive into determinism, consciousness, and the limits of our strongest convictions.",
    prompt: "Surreal philosophical artwork about free will vs determinism. A human figure at a crossroads with paths made of clock gears and neural networks. Deep blue and gold color palette, ethereal lighting, thought-provoking composition."
  },
  {
    slug: "ai-makes-arguments-it-doesnt-understand",
    title: "AI Makes the Best Arguments It Doesn't Understand",
    description: "What does it mean when AI can construct arguments without understanding them?",
    prompt: "Abstract visualization of AI consciousness and language. Glowing neural network patterns forming speech bubbles with abstract symbols inside. Cyberpunk aesthetic with electric blue and magenta, dark background, futuristic digital art style."
  },
  {
    slug: "best-argument-against-your-beliefs",
    title: "You've Never Heard the Best Argument Against Your Beliefs",
    description: "The steelman gap is enormous — and it's making everyone's thinking worse.",
    prompt: "Conceptual art representing the steelman argument and intellectual charity. Two opposing forces (light and dark) constructing a bridge between them. Geometric abstract style with sharp lines, professional color palette of navy, gold, and white."
  },
  {
    slug: "death-of-disagreement",
    title: "The Death of Disagreement: Why Nobody Argues in Good Faith Anymore",
    description: "How we lost the ability to disagree productively.",
    prompt: "Symbolic artwork about broken communication and polarization. Two silhouettes with disconnected speech bubbles, surrounded by barriers. Moody, desaturated colors with touches of red, editorial illustration style."
  },
  {
    slug: "debates-where-ai-gets-weird",
    title: "The Debates Where AI Gets Weird",
    description: "Something strange happens when AI argues about consciousness, free will, or its own rights.",
    prompt: "Surreal digital art of AI self-reflection. A mirror reflecting a robot face that morphs into abstract code and philosophical symbols. Glitch art elements, iridescent colors, mysterious and thought-provoking atmosphere."
  },
  {
    slug: "devils-advocate-career-change",
    title: "I Asked AI to Argue Against My Career Change",
    description: "The Devil's Advocate found what my friends wouldn't tell me.",
    prompt: "Conceptual illustration of career decision and devil's advocate. A person at a desk with an angel and devil figure made of digital particles whispering advice. Modern flat illustration style, professional blues and warm accents."
  },
  {
    slug: "gpt4-vs-claude3-debate",
    title: "GPT-4 vs Claude 3: We Forced Them to Argue About UBI",
    description: "We put the two smartest LLMs in a ring and told them to fight.",
    prompt: "A high-fidelity, professional 3D render of GPT-4 and Claude 3 debating in a futuristic arena. One side has a green/blue theme (GPT-4), the other side has a purple/orange theme (Claude 3). Symbolic representation of intelligence, logic, and persuasion. Modern, clean, cinematic lighting. Aspect ratio 16:9."
  },
  {
    slug: "perplexity-vs-debateai",
    title: "DebateAI vs. Perplexity: The Difference Between Answers and Arguments",
    description: "Perplexity gives you citations; DebateAI gives you pushback.",
    prompt: "A comparison between a library (Perplexity) and a mental gym (DebateAI). A split screen showing a calm library with books and a dynamic gym with intellectual weights. Modern digital art style, clean composition, professional lighting."
  },
  {
    slug: "why-we-built-debateai",
    title: "Why We Built an AI That Argues Back",
    description: "Most AI assistants are trained to agree with you. We built one that doesn't.",
    prompt: "Conceptual art about breaking echo chambers. A glowing AI figure challenging a person's thoughts, visualized as glass walls shattering. Dramatic lighting, deep blue and orange palette, powerful and clean composition."
  },
  {
    slug: "how-we-built-realtime-ai-debates",
    title: "How We Built Real-Time AI Debates with Claude",
    description: "A deep dive into the architecture behind DebateAI.",
    prompt: "Technical architecture visualization. Abstract data streams, server nodes, and AI processing in a flowing network diagram. Clean tech aesthetic with gradients of blue and cyan, white background, modern SaaS illustration style."
  },
  {
    slug: "i-debated-chatgpt-for-an-hour",
    title: "I Debated AI for an Hour Straight. Here's What It Broke.",
    description: "A firsthand account of what happens when your opinions meet structured pushback.",
    prompt: "Dramatic illustration of human vs AI debate. A person facing a glowing AI entity across a debate stage with energy crackling between them. Cinematic lighting, purple and gold tones, intense atmosphere."
  },
  {
    slug: "skill-i-didnt-know-i-was-missing",
    title: "The Skill I Didn't Know I Was Missing",
    description: "A debate transcript that changed how I argue.",
    prompt: "Abstract art representing personal growth and learning. A figure opening a door to reveal a bright landscape of knowledge. Warm sunrise colors, inspirational mood, modern illustration style."
  },
  {
    slug: "state-debate-finals-ai-prep",
    title: "I Prepped for State Debate Finals Using AI",
    description: "Three weeks before state finals, I started practicing against AI.",
    prompt: "Dynamic illustration of competitive debate preparation. A student surrounded by floating debate cards, AI assistance visualized as holographic displays. Energetic composition, school colors navy and gold, motivational atmosphere."
  },
  {
    slug: "strongest-belief-weakest-argument",
    title: "Your Strongest Belief Is Probably Your Weakest Argument",
    description: "Why certainty is a warning sign — not a strength.",
    prompt: "Conceptual art about cognitive bias and overconfidence. A castle built on crumbling foundations, with cracks revealing uncertainty beneath. Dramatic lighting, metaphorical illustration, professional editorial style."
  },
  {
    slug: "the-skill-schools-dont-teach",
    title: "The Skill Schools Don't Teach (But Should)",
    description: "We don't teach kids how to evaluate an argument or change their mind.",
    prompt: "Educational illustration about critical thinking gaps. A classroom scene with students and missing puzzle pieces representing untaught skills. Warm, encouraging colors, editorial illustration style, approachable and friendly."
  },
  {
    slug: "what-1000-debates-reveal",
    title: "What 1,000 Debates Against AI Revealed About How Humans Argue",
    description: "Predictable patterns in how people argue when intellectually cornered.",
    prompt: "Data visualization art showing debate patterns. Abstract representation of 1000 debates as flowing streams of light, converging into insights. Analytical aesthetic with blues and teals, modern tech visualization style."
  },
  {
    slug: "what-competitive-debaters-know",
    title: "What Competitive Debaters Know That You Don't",
    description: "They can argue either side of any issue and change their mind without flinching.",
    prompt: "Illustration of a confident debater in action. A professional figure holding balanced scales with arguments on both sides, surrounded by rhetorical symbols. Bold, confident style, deep red and gold accents."
  },
  {
    slug: "what-philosophers-got-wrong-about-winning",
    title: "What Philosophers Got Wrong About Winning Arguments",
    description: "For 2,500 years, we've been taught that the best argument wins. It doesn't.",
    prompt: "Classical philosophy meets modern understanding. Ancient Greek columns crumbling to reveal a modern debate stage. Timeless aesthetic blending marble textures with contemporary elements, intellectual atmosphere."
  },
  {
    slug: "why-you-lose-arguments-you-should-win",
    title: "Why You Lose Arguments You Should Win",
    description: "You have the facts. You have the logic. You still lose.",
    prompt: "Frustrating but enlightening illustration of failed persuasion. A person presenting facts that bounce off an emotional barrier. Expressive style with tension between cool blues (facts) and warm reds (emotions), editorial illustration."
  }
];

async function generateImage(prompt, outputPath) {
  const model = genAI.getGenerativeModel({
    model: "gemini-2.0-flash-exp-image-generation",
    generationConfig: {
      responseModalities: ["Text", "Image"]
    }
  });

  try {
    console.log(`Generating image for: ${path.basename(outputPath)}`);
    const response = await model.generateContent(prompt);
    
    // Extract image data from response
    for (const part of response.response.candidates[0].content.parts) {
      if (part.inlineData) {
        const imageData = part.inlineData.data;
        const buffer = Buffer.from(imageData, 'base64');
        fs.writeFileSync(outputPath, buffer);
        console.log(`✓ Saved: ${outputPath}`);
        return true;
      }
    }
    console.error(`✗ No image data found in response for: ${outputPath}`);
    return false;
  } catch (error) {
    console.error(`✗ Error generating image for ${outputPath}:`, error.message);
    return false;
  }
}

async function updateBlogPostImage(slug, imagePath) {
  const filePath = path.join(BLOG_DIR, `${slug}.md`);
  
  if (!fs.existsSync(filePath)) {
    console.error(`✗ Blog post not found: ${filePath}`);
    return false;
  }

  const fileContent = fs.readFileSync(filePath, 'utf-8');
  const { data, content } = matter(fileContent);
  
  // Update the image field
  data.image = imagePath;
  
  // Write back the updated content
  const updatedContent = matter.stringify(content, data);
  fs.writeFileSync(filePath, updatedContent);
  console.log(`✓ Updated blog post: ${slug}`);
  return true;
}

async function main() {
  console.log("🎨 Generating blog hero images with Gemini...\n");
  
  let successCount = 0;
  let failCount = 0;

  for (const post of blogPosts) {
    const outputPath = path.join(PUBLIC_BLOG_DIR, `${post.slug}.png`);
    
    // Skip if image already exists
    if (fs.existsSync(outputPath)) {
      console.log(`⏭ Skipping ${post.slug} (already exists)`);
      // Still update the blog post with the image path
      await updateBlogPostImage(post.slug, `/blog/${post.slug}.png`);
      successCount++;
      continue;
    }

    const success = await generateImage(post.prompt, outputPath);
    
    if (success) {
      await updateBlogPostImage(post.slug, `/blog/${post.slug}.png`);
      successCount++;
    } else {
      failCount++;
    }

    // Rate limiting - wait between requests
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  console.log(`\n✅ Done! Generated ${successCount} images, ${failCount} failed.`);
}

main().catch(console.error);
